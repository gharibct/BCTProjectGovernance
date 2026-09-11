from app.crud.base import CRUDBase
from app.models.reporting_attestation import MonthlyReportAttestation
from app.schemas.reporting_attestation import MonthlyReportAttestationCreate

monthly_report_attestation_crud = CRUDBase[
    MonthlyReportAttestation, MonthlyReportAttestationCreate, MonthlyReportAttestationCreate
](MonthlyReportAttestation)
