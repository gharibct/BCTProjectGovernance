"""Schemas for the Measurement-tab metric reference popup — served read-only
from app/data/metric_reference.yaml (see app.services.metric_reference).
"""

from pydantic import BaseModel


class MetricUnitBenchmark(BaseModel):
    """A benchmark_value / min_value / max_value triple for one unit of
    measurement — same string conventions as the fields on MetricReferenceEntry."""

    benchmark_value: str
    min_value: str = ""
    max_value: str = ""


class MetricReferenceEntry(BaseModel):
    key: str
    label: str
    unit: str
    formula: str
    operational_definition: str
    benchmark_value: str
    # Allowed range for a metric *target* (see metric_target.py). Quoted strings
    # like benchmark_value; "" (or unparseable) means that side is unbounded.
    min_value: str = ""
    max_value: str = ""
    mandatory: bool | None = None
    # Per-unit-of-measurement benchmark overrides. Only Development's
    # `productivity` uses this today: the project's Size Unit (CP/FP/LOC/SP)
    # selects which benchmark the Metric Target screen shows / prefills. Falls
    # back to the scalar benchmark_value above for an unlisted unit.
    benchmark_by_unit: dict[str, MetricUnitBenchmark] | None = None


class ProjectTypeMetricReference(BaseModel):
    has_excel_reference: bool
    metrics: list[MetricReferenceEntry] = []
    note: str | None = None


# Top level is keyed by project_types.code (DEVELOPMENT, SUPPORT, ...).
MetricReference = dict[str, ProjectTypeMetricReference]
