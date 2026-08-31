from app.crud.base import CRUDBase
from app.models.measurement import (
    MeasurementCloudMaintenance,
    MeasurementCloudMigration,
    MeasurementConsulting,
    MeasurementDevelopment,
    MeasurementStaffing,
    MeasurementSupport,
    MeasurementTesting,
)
from app.schemas.measurement import (
    MeasurementCloudMaintenanceCreate,
    MeasurementCloudMigrationCreate,
    MeasurementConsultingCreate,
    MeasurementDevelopmentUpdate,
    MeasurementStaffingUpdate,
    MeasurementSupportCreate,
    MeasurementTestingCreate,
)

# Development and Staffing are created/updated via bespoke endpoint logic
# (nested defect/priority child rows), but still use CRUDBase for get/list/delete.
measurement_development_crud = CRUDBase[MeasurementDevelopment, MeasurementDevelopmentUpdate, MeasurementDevelopmentUpdate](
    MeasurementDevelopment
)
measurement_staffing_crud = CRUDBase[MeasurementStaffing, MeasurementStaffingUpdate, MeasurementStaffingUpdate](
    MeasurementStaffing
)

measurement_support_crud = CRUDBase[MeasurementSupport, MeasurementSupportCreate, MeasurementSupportCreate](
    MeasurementSupport
)
measurement_testing_crud = CRUDBase[MeasurementTesting, MeasurementTestingCreate, MeasurementTestingCreate](
    MeasurementTesting
)
measurement_consulting_crud = CRUDBase[MeasurementConsulting, MeasurementConsultingCreate, MeasurementConsultingCreate](
    MeasurementConsulting
)
measurement_cloud_maintenance_crud = CRUDBase[
    MeasurementCloudMaintenance, MeasurementCloudMaintenanceCreate, MeasurementCloudMaintenanceCreate
](MeasurementCloudMaintenance)
measurement_cloud_migration_crud = CRUDBase[
    MeasurementCloudMigration, MeasurementCloudMigrationCreate, MeasurementCloudMigrationCreate
](MeasurementCloudMigration)
