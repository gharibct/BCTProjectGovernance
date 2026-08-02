"""UX §4.12: 'If not Green, an Alert is raised.' The DE fills in the alert's
content when submitting a non-Green assessment (Category/Brief/Detailed
description) — this just enforces that the alert is present exactly when the
rule requires it.
"""

from app.schemas.enums import HealthRating


def validate_alert_requirement(health: HealthRating, alert_provided: bool) -> str | None:
    if health != HealthRating.GREEN and not alert_provided:
        return "An alert (category + brief description) is required when de_assessed_project_health is not Green."
    if health == HealthRating.GREEN and alert_provided:
        return "An alert should not be submitted when de_assessed_project_health is Green."
    return None
