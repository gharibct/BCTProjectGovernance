from dataclasses import dataclass

from fastapi import Query


@dataclass
class PaginationParams:
    skip: int = 0
    limit: int = 50


def pagination_params(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> PaginationParams:
    return PaginationParams(skip=skip, limit=limit)
