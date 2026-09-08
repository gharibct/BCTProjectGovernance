"""Loads the measurement-metric reference data (Unit / Formula / Operational
Definition / Benchmark Value / min-max, per project type) from the bundled YAML
file.

Parsed once and cached, but the cache is keyed on the file's mtime, so an edit
to metric_reference.yaml is picked up on the next call without a server restart
(the file is small; a stat() per call is negligible).
"""

from decimal import Decimal, InvalidOperation
from pathlib import Path

import yaml

from app.schemas.metric_reference import MetricReference, ProjectTypeMetricReference

_YAML_PATH = Path(__file__).resolve().parent.parent / "data" / "metric_reference.yaml"

_cache: tuple[float, MetricReference] | None = None


def get_metric_reference() -> MetricReference:
    global _cache
    mtime = _YAML_PATH.stat().st_mtime
    if _cache is None or _cache[0] != mtime:
        raw = yaml.safe_load(_YAML_PATH.read_text(encoding="utf-8"))
        _cache = (
            mtime,
            {
                code: ProjectTypeMetricReference.model_validate(entry)
                for code, entry in raw.items()
            },
        )
    return _cache[1]


def _bound(raw: str | None) -> Decimal | None:
    """A metric_reference min_value/max_value string as a Decimal, or None when
    it's blank or not a plain number (both mean 'no bound on that side')."""
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def metric_range_errors(
    ref_code: str,
    field_to_key: dict[str, str],
    values: dict[str, object],
    *,
    label_suffix: str = "",
) -> list[str]:
    """One human-readable message per value in `values` that falls outside its
    config [min_value, max_value] (inclusive). None / non-numeric values, blank
    or unparseable bounds, and unknown ref_code / metric keys are all skipped."""
    ref = get_metric_reference().get(ref_code)
    if ref is None:
        return []
    by_key = {m.key: m for m in ref.metrics}

    errors: list[str] = []
    for field, key in field_to_key.items():
        raw = values.get(field)
        if raw is None:
            continue
        try:
            value = Decimal(str(raw))
        except (InvalidOperation, ValueError):
            continue
        entry = by_key.get(key)
        if entry is None:
            continue
        label = f"{entry.label}{label_suffix}"
        low = _bound(entry.min_value)
        high = _bound(entry.max_value)
        if low is not None and value < low:
            errors.append(f"{label}: {value} is below the minimum {low}.")
        if high is not None and value > high:
            errors.append(f"{label}: {value} is above the maximum {high}.")
    return errors
