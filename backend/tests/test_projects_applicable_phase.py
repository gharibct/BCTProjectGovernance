"""Applicable Phase is a multi-select on the Project Charter — a
list[ApplicablePhase] on the schema, comma-joined in the DB column
(models/types.CommaSeparatedList)."""

from app.models.types import CommaSeparatedList
from app.schemas.enums import ApplicablePhase
from app.schemas.projects import ProjectCreate, ProjectUpdate


def test_create_defaults_to_empty_list():
    assert ProjectCreate(project_name="X").applicable_phase == []


def test_create_accepts_multiple_phases():
    p = ProjectCreate(project_name="X", applicable_phase=["Requirement", "Testing"])
    assert p.applicable_phase == [ApplicablePhase.REQUIREMENT, ApplicablePhase.TESTING]


def test_read_coercion_tolerates_null_and_raw_string():
    # mode="before" validator lives on ProjectBase, inherited by ProjectCreate.
    assert ProjectCreate.model_validate({"project_name": "X", "applicable_phase": None}).applicable_phase == []
    assert ProjectCreate.model_validate(
        {"project_name": "X", "applicable_phase": "Design, UAT"}
    ).applicable_phase == [ApplicablePhase.DESIGN, ApplicablePhase.UAT]


def test_update_none_means_unchanged():
    # ProjectUpdate keeps None (exclude_unset drops it from the PUT payload).
    assert ProjectUpdate().applicable_phase is None
    assert "applicable_phase" not in ProjectUpdate().model_dump(exclude_unset=True)
    assert ProjectUpdate(applicable_phase=[]).model_dump(exclude_unset=True)["applicable_phase"] == []


def test_type_decorator_round_trip():
    t = CommaSeparatedList()
    assert t.process_bind_param([ApplicablePhase.UAT, ApplicablePhase.SUPPORT], None) == "UAT,Support"
    assert t.process_bind_param([], None) is None
    assert t.process_bind_param(None, None) is None
    assert t.process_bind_param("Testing", None) == "Testing"  # master-data import path
    assert t.process_result_value("Requirement,Testing", None) == ["Requirement", "Testing"]
    assert t.process_result_value(None, None) == []
