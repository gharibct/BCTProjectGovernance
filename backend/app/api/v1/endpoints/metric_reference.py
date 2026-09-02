"""GET /metric-reference — the Unit / Formula / Operational Definition /
Benchmark Value shown in the Measurement-tab "how this metric is calculated"
popup. Static bundled reference data (app/data/metric_reference.yaml); every
authenticated role reads it, nobody writes it.
"""

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.schemas.metric_reference import ProjectTypeMetricReference
from app.services.metric_reference import get_metric_reference

router = APIRouter(prefix="/metric-reference", tags=["Reference Data"])


@router.get("", response_model=dict[str, ProjectTypeMetricReference])
async def read_metric_reference(_: object = Depends(get_current_user)):
    return get_metric_reference()
