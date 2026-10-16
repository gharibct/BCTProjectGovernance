from app.schemas.enums import ReportStatus
from app.services.dashboard import (
    SUB_APPROVED,
    SUB_AUTO_GENERATED,
    SUB_BASELINED,
    SUB_NOT_BASELINED,
    SUB_NOT_SUBMITTED,
    SUB_SUBMITTED,
    submission_bucket,
)


def test_project_and_account_buckets():
    for stream in ("delivery-status-projects", "delivery-status-account"):
        assert submission_bucket(stream, ReportStatus.APPROVED) == SUB_APPROVED
        assert submission_bucket(stream, ReportStatus.SUBMITTED) == SUB_SUBMITTED
        assert submission_bucket(stream, ReportStatus.BASELINED) == SUB_SUBMITTED
        # Draft / Rejected / no report all count as not filed.
        assert submission_bucket(stream, ReportStatus.DRAFT) == SUB_NOT_SUBMITTED
        assert submission_bucket(stream, ReportStatus.REJECTED) == SUB_NOT_SUBMITTED
        assert submission_bucket(stream, None) == SUB_NOT_SUBMITTED


def test_geo_buckets():
    geo = "delivery-status-geo"
    assert submission_bucket(geo, ReportStatus.BASELINED) == SUB_BASELINED
    assert submission_bucket(geo, ReportStatus.AUTO_GENERATED) == SUB_AUTO_GENERATED
    assert submission_bucket(geo, ReportStatus.DRAFT) == SUB_NOT_BASELINED
    assert submission_bucket(geo, None) == SUB_NOT_BASELINED
