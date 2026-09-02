"""Loads the measurement-metric reference data (Unit / Formula / Operational
Definition / Benchmark Value, per project type) from the bundled YAML file.

This is authored once from the requirements workbook, never edited at runtime,
so it's parsed and validated a single time and cached for the process.
"""

from functools import lru_cache
from pathlib import Path

import yaml

from app.schemas.metric_reference import MetricReference, ProjectTypeMetricReference

_YAML_PATH = Path(__file__).resolve().parent.parent / "data" / "metric_reference.yaml"


@lru_cache(maxsize=1)
def get_metric_reference() -> MetricReference:
    raw = yaml.safe_load(_YAML_PATH.read_text(encoding="utf-8"))
    return {
        code: ProjectTypeMetricReference.model_validate(entry)
        for code, entry in raw.items()
    }
