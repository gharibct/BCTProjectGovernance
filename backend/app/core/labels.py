"""Display name of the ACCOUNT_MANAGER role, in one place.

The role code (ACCOUNT_MANAGER), its routes and API fields keep their internal
names. This label is what gets stored in RAID escalation levels and seeded as
the role's name; renaming the role again means editing it here, in
frontend/src/lib/role-labels.ts, and the roles/escalation SQL seeds. Existing
databases need a one-off UPDATE (see db/rename_account_manager_to_delivery_manager.sql).
"""

ACCOUNT_MANAGER_LABEL = "Delivery Manager"
