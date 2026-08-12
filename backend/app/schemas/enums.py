"""Value sets that used to be enforced by DB CHECK constraints (see db/tables/*.sql
comments). With no CHECK constraints in the schema, these Pydantic-validated
StrEnums are the only place these are enforced.
"""

from enum import StrEnum


class HealthRating(StrEnum):
    RED = "Red"
    POTENTIAL_RED = "Potential Red"
    AMBER = "Amber"
    GREEN = "Green"


# Worst-to-best severity order, used by services.health_rollup for "worst wins" rollups.
HEALTH_RATING_SEVERITY = [HealthRating.RED, HealthRating.POTENTIAL_RED, HealthRating.AMBER, HealthRating.GREEN]


class RoleCode(StrEnum):
    ADMIN = "ADMIN"
    CXO = "CXO"
    ACCOUNT_MANAGER = "ACCOUNT_MANAGER"
    GEO_HEAD = "GEO_HEAD"
    PROJECT_MANAGER = "PROJECT_MANAGER"
    TEAM_MEMBER = "TEAM_MEMBER"
    DELIVERY_EXCELLENCE = "DELIVERY_EXCELLENCE"
    PMO = "PMO"


class ContractType(StrEnum):
    FPP = "FPP"
    TM = "T&M"
    CAPPED_TM = "Capped T&M"
    INTERNAL = "Internal"


class ProjectOwned(StrEnum):
    FULLY_OWNED = "Fully Owned"
    CO_OWNED = "Co-Owned"
    CUSTOMER_DRIVEN = "Customer Driven"


class BillingType(StrEnum):
    FPP = "FPP"
    FB = "FB"
    TM = "T&M"
    PRODUCT = "Product"
    UNIT_BASED_BILLING = "Unit Based Billing"
    OTHERS = "Others"


class EngagementType(StrEnum):
    IMPLEMENTATION = "Implementation"
    SUPPORT = "Support"


class ApplicablePhase(StrEnum):
    REQUIREMENT = "Requirement"
    DESIGN = "Design"
    CUT = "CUT"
    BUILD_AND_DEPLOYMENT = "Build & Deployment"
    TESTING = "Testing"
    UAT = "UAT"
    WARRANTY = "Warranty"
    SUPPORT = "Support"


class ProjectStatus(StrEnum):
    DRAFT = "Draft"
    PENDING_APPROVAL = "Pending Approval"
    APPROVED = "Approved"
    HOLD = "Hold"
    CLOSED = "Closed"
    OPEN_ONLY_FOR_BILLING = "Open Only for Billing"


class Category(StrEnum):
    """Shared 6-category taxonomy: Risk Category, DE Assessment Alert Category."""

    CORE_DELIVERY = "Core Delivery"
    PEOPLE = "People"
    OPERATIONAL = "Operational"
    CUSTOMER = "Customer"
    FINANCIAL = "Financial"
    COMPLIANCE = "Compliance"


class RiskType(StrEnum):
    INTERNAL = "Internal"
    EXTERNAL = "External"


class Probability(StrEnum):
    VERY_LOW = "Very Low"
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    VERY_HIGH = "Very High"


class Impact(StrEnum):
    VERY_LOW = "Very Low"
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class RiskSeverity(StrEnum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class ResponseStrategy(StrEnum):
    AVOID = "Avoid"
    MITIGATE = "Mitigate"
    TRANSFER = "Transfer"
    ACCEPT = "Accept"


class RiskStatus(StrEnum):
    OPEN = "Open"
    MONITORING = "Monitoring"
    CLOSED = "Closed"


class IssuePriority(StrEnum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class IssueSeverity(StrEnum):
    MINOR = "Minor"
    MAJOR = "Major"
    CRITICAL = "Critical"


class IssueStatus(StrEnum):
    NEW = "New"
    ASSIGNED = "Assigned"
    IN_PROGRESS = "In Progress"
    PENDING = "Pending"
    RESOLVED = "Resolved"
    CLOSED = "Closed"


class IssueEscalationLevel(StrEnum):
    PM = "PM"
    DELIVERY_MANAGER = "Delivery Manager"
    STEERING_COMMITTEE = "Steering Committee"


class DependencyType(StrEnum):
    INTERNAL = "Internal"
    EXTERNAL = "External"
    VENDOR = "Vendor"
    CUSTOMER = "Customer"
    INFRASTRUCTURE = "Infrastructure"
    REGULATORY = "Regulatory"
    THIRD_PARTY = "Third Party"


class DependencyStatus(StrEnum):
    NOT_STARTED = "Not Started"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    BLOCKED = "Blocked"


class Criticality(StrEnum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class ProbabilityOfDelay(StrEnum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class DependencyEscalationLevel(StrEnum):
    PROJECT_MANAGER = "Project Manager"
    DELIVERY_MANAGER = "Delivery Manager"
    STEERING_COMMITTEE = "Steering Committee"


class ProbabilityOfFailure(StrEnum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class ImpactRating(StrEnum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class ValidationStatus(StrEnum):
    PENDING = "Pending"
    VALIDATED = "Validated"
    INVALID = "Invalid"


class AssumptionStatus(StrEnum):
    OPEN = "Open"
    CLOSED = "Closed"
    CANCELLED = "Cancelled"


class OpportunityImpact(StrEnum):
    VERY_LOW = "Very Low"
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class ExpectedBenefit(StrEnum):
    TIME = "Time"
    COST = "Cost"
    QUALITY = "Quality"
    REVENUE = "Revenue"


class BenefitType(StrEnum):
    COST_SAVING = "Cost Saving"
    REVENUE_INCREASE = "Revenue Increase"
    QUALITY_IMPROVEMENT = "Quality Improvement"
    CUSTOMER_SATISFACTION = "Customer Satisfaction"


class ExploitationStrategy(StrEnum):
    EXPLOIT = "Exploit"
    ENHANCE = "Enhance"
    SHARE = "Share"
    ACCEPT = "Accept"


class OpportunityStatus(StrEnum):
    IDENTIFIED = "Identified"
    APPROVED = "Approved"
    IMPLEMENTED = "Implemented"
    CLOSED = "Closed"


class StaffingPriority(StrEnum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class SdlcStage(StrEnum):
    URD = "URD"
    PROTO = "Proto"
    SRS = "SRS"
    ADD = "ADD"
    HLD = "HLD"
    USP_LLD = "USP/LLD"
    CODE = "Code"
    UTC = "UTC"
    SITC = "SITC"
    UT = "UT"
    SIT = "SIT"


class CommitmentFrequency(StrEnum):
    ONE_TIME = "One Time"
    WEEKLY = "Weekly"
    FORTNIGHT = "Fortnight"
    MONTHLY = "Monthly"
    QUARTERLY = "Quarterly"
    HALF_YEARLY = "Half Yearly"
    PHASE_WISE = "Phase Wise"


class MetStatus(StrEnum):
    MET = "Met"
    NOT_MET = "Not Met"


class MilestonePaymentStatus(StrEnum):
    PAID_ON_TIME = "Paid On Time"
    DELAYED_PAYMENT = "Delayed Payment"
    YET_TO_BE_PAID = "Yet To Be Paid"


class FindingClassification(StrEnum):
    OBSERVATION = "Observation"
    RECOMMENDATION = "Recommendation"


class FindingStatus(StrEnum):
    OPEN = "Open"
    CLOSED = "Closed"
    ON_HOLD = "On Hold"
    DEFERRED = "Deferred"


class ExpectedCadence(StrEnum):
    WEEKLY = "Weekly"
    MONTHLY = "Monthly"
    QUARTERLY = "Quarterly"
    AD_HOC = "Ad Hoc"


class IntegrationName(StrEnum):
    MICROSOFT_365 = "Microsoft 365"
    BCT_ORACLE_APPLICATION = "BCT Oracle Application"
    TICKETING_TOOLS = "Ticketing Tools"
    PROJECT_MANAGEMENT_TOOLS = "Project Management Tools"


class ConnectionStatus(StrEnum):
    CONNECTED = "Connected"
    ERROR = "Error"
    NOT_CONFIGURED = "Not Configured"


class BackupRestoreAction(StrEnum):
    BACKUP = "Backup"
    RESTORE = "Restore"


class BackupRestoreStatus(StrEnum):
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"
    FAILED = "Failed"


class PeriodType(StrEnum):
    WEEKLY = "Weekly"
    MONTHLY = "Monthly"
    BASELINE = "Baseline"


class ReportStatus(StrEnum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class ProjectStatusCategory(StrEnum):
    KEY_ACCOMPLISHMENTS = "Key Accomplishments"
    UPCOMING_KEY_RELEASES = "Upcoming Key Releases / Milestones / Actions"
    LEADERSHIP_SUPPORT_REQUIRED = "Leadership Support / Attention Required"
    KEY_RISKS_ISSUES = "Key Risks / Issues"


# Project -> Account rollup (see services/account_rollup.py): whether a
# project's own status item has been pulled into the account's register,
# dismissed, or is still awaiting a decision.
class RollupStatus(StrEnum):
    PENDING = "Pending"
    PULLED = "Pulled"
    IGNORED = "Ignored"


class DocumentContext(StrEnum):
    CREATE = "create"
    REPORTING = "reporting"


class DocumentAiStatus(StrEnum):
    NOT_PROCESSED = "Not Processed"
    PROCESSING = "Processing"
    PROCESSED = "Processed"
    EXCLUDED = "Excluded"


class AiSuggestionStatus(StrEnum):
    """See AI-Implementation.md §9: a suggestion is PENDING until the PM either
    IGNOREs it directly, or RESOLVEs (implicitly, by saving/editing/creating
    on the screen it belongs to — at that point any AI-derived value on
    screen is just manual data)."""

    PENDING = "pending"
    IGNORED = "ignored"
    RESOLVED = "resolved"


class AiRowSuggestionStatus(StrEnum):
    """Row-level counterpart to AiSuggestionStatus, used by ai_row_suggestions
    (RAID grids, AI-Implementation.md §10). A suggestion here is a whole
    candidate Risk/Issue/Dependency/Assumption/Opportunity row rather than one
    field's value, so there's no "resolved on save" — it's PENDING until the
    PM either IGNOREs it or APPLIEs it (which creates the real row via that
    entity's own create endpoint, the same one manual entry uses)."""

    PENDING = "pending"
    IGNORED = "ignored"
    APPLIED = "applied"
