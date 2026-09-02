"""Schemas for the Measurement-tab metric reference popup — served read-only
from app/data/metric_reference.yaml (see app.services.metric_reference).
"""

from pydantic import BaseModel


class MetricReferenceEntry(BaseModel):
    key: str
    label: str
    unit: str
    formula: str
    operational_definition: str
    benchmark_value: str
    mandatory: bool | None = None


class ProjectTypeMetricReference(BaseModel):
    has_excel_reference: bool
    metrics: list[MetricReferenceEntry] = []
    note: str | None = None


# Top level is keyed by project_types.code (DEVELOPMENT, SUPPORT, ...).
MetricReference = dict[str, ProjectTypeMetricReference]
