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


class YesNo(StrEnum):
    YES = "Yes"
    NO = "No"


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
    UNDER_AMENDMENT = "Under Amendment"
    ONGOING = "Ongoing"
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
    # A commitment whose contractual terms have been violated (e.g. a missed
    # SLA that triggers the penalty clause) — a stronger signal than a single
    # "Not Met" period; rolls up on the non-compliant side everywhere.
    BREACHED = "Breached"


class MilestonePaymentStatus(StrEnum):
    PAID_ON_TIME = "Paid On Time"
    DELAYED_PAYMENT = "Delayed Payment"
    YET_TO_BE_PAID = "Yet To Be Paid"


class FindingClassification(StrEnum):
    # Observation/Recommendation are the legacy register-tab values (still
    # accepted); the rest mirrors Category's 6-value Project RAG taxonomy —
    # the DE Assessment Workspace's Classification combo aligns with it.
    OBSERVATION = "Observation"
    RECOMMENDATION = "Recommendation"
    CORE_DELIVERY = "Core Delivery"
    PEOPLE = "People"
    OPERATIONAL = "Operational"
    CUSTOMER = "Customer"
    FINANCIAL = "Financial"
    COMPLIANCE = "Compliance"


class FindingStatus(StrEnum):
    # Lifecycle mirrors the Action Tracker: Open -> In Progress -> Awaiting
    # Closure -> Closed, or Open/In Progress -> Cancelled. On Hold/Deferred
    # remain valid for legacy rows.
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    AWAITING_CLOSURE = "Awaiting Closure"
    CLOSED = "Closed"
    CANCELLED = "Cancelled"
    ON_HOLD = "On Hold"
    DEFERRED = "Deferred"


class FindingSeverity(StrEnum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class DEAssessmentStatus(StrEnum):
    """A DE assessment is a Draft until the DE submits it. "Not Started" is the
    absence of a row for the period and is never stored."""

    DRAFT = "Draft"
    SUBMITTED = "Submitted"


class DeReviewStatus(StrEnum):
    """projects.de_review_status — the DE governance-approval sub-state layered
    on top of project_status (design-reference/de-approval). NULL = allocated
    to a DE but not yet opened for review; "Awaiting Review" is derived, not
    stored (project_status == Pending Approval AND de_review_status IS NULL)."""

    IN_REVIEW = "In Review"
    RETURNED = "Returned"
    APPROVED = "Approved"


class DeModuleReviewAction(StrEnum):
    """de_project_module_reviews.review_action — the DE's per-module verdict in
    the Project Governance Review workspace."""

    NOT_REVIEWED = "Not Reviewed"
    REVIEWED = "Reviewed"
    GAP_IDENTIFIED = "Gap Identified"


class GovernanceModuleKey(StrEnum):
    """The governance modules that make up a project's approval baseline, keyed
    to the New Project charter sub-screens (frontend new-project-nav.tsx).
    project_profile / scope_schedule / map_oracle_projects / contractual_compliance
    are mandatory for approval; raido / measurement are informational."""

    PROJECT_PROFILE = "project_profile"
    SCOPE_SCHEDULE = "scope_schedule"
    MAP_ORACLE_PROJECTS = "map_oracle_projects"
    CONTRACTUAL_COMPLIANCE = "contractual_compliance"
    RAIDO = "raido"
    MEASUREMENT = "measurement"


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


class ActionLevel(StrEnum):
    """Which entity an Action Tracker action is scoped to — see
    design-reference/action-table-design.md. Screaming-case, matching the doc's
    whole Action vocabulary (level/status/priority)."""

    GEO = "GEO"
    ACCOUNT = "ACCOUNT"
    PROJECT = "PROJECT"


class ActionPriority(StrEnum):
    """Deliberately separate from IssuePriority (Title-Case, used by RAID) —
    design-reference/action-table-design.md specifies screaming-case for every
    Action field, not just level/status."""

    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ActionStatus(StrEnum):
    """Action Tracker lifecycle (design-reference/action-table-design.md):
    Open -> In Progress -> Completed -> Closed, or Open/In Progress ->
    Cancelled. Completed = the assigned work is done; Closed = a separate
    sign-off step verifying that completion, only reachable once Completed
    (see actions.py's /close). Cancelled = abandoned without completing,
    only reachable from Open/In Progress (see actions.py's /cancel)."""

    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"


class ActionHistoryEventType(StrEnum):
    """action_history.event_type (design-reference/action-table-design.md's
    list plus PRIORITY_CHANGE, the one other editable Action field it doesn't
    already name)."""

    CREATED = "CREATED"
    COMMENT = "COMMENT"
    STATUS_CHANGE = "STATUS_CHANGE"
    OWNER_CHANGE = "OWNER_CHANGE"
    DUE_DATE_CHANGE = "DUE_DATE_CHANGE"
    PRIORITY_CHANGE = "PRIORITY_CHANGE"


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
