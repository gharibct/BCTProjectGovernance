"""Worst-wins health rollup (UX §4.3: 'if any one category is Red, the overall
is Red'). Extended here to a full severity order (Red > Potential Red > Amber
> Green) so the same helper covers the two-input Overall Project Health rollup
too ('inferred from the highest-severity status across Delivery Declared and
DE Assessed ratings').
"""

from app.schemas.enums import HEALTH_RATING_SEVERITY, HealthRating


def compute_overall_rating(ratings: list[HealthRating]) -> HealthRating:
    for candidate in HEALTH_RATING_SEVERITY:
        if candidate in ratings:
            return candidate
    return HealthRating.GREEN


def compute_overall_project_health(
    delivery_declared: HealthRating | None,
    de_assessed: HealthRating | None,
) -> HealthRating | None:
    candidates = [r for r in (delivery_declared, de_assessed) if r is not None]
    if not candidates:
        return None
    return compute_overall_rating(candidates)
