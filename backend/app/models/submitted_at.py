"""Keeps `submitted_at` on the Project / Account / Geo status reports.

`submitted_at` is when the report was last filed (moved to Submitted, or Baselined
for a Geo report). It stays through Approved, is cleared when the report goes
back to Draft / Rejected / Draft - Saved (recall, rejection), and is set afresh
on the next submission. Late submission is judged from it against the reporting
period's due date (see services/report_timeliness.py).

Done in an ORM event so every code path that changes a report's status — the PM,
the Delivery Manager's approval, the Geo baseline, recalls — is covered without
each endpoint having to remember.
"""

from datetime import datetime, timezone

from sqlalchemy import event

_FILED = {"Submitted", "Approved", "Baselined"}


def _sync_submitted_at(mapper, connection, target) -> None:
    if target.status in _FILED:
        if target.submitted_at is None:
            target.submitted_at = datetime.now(timezone.utc)
    else:
        target.submitted_at = None


def track_submitted_at(model) -> None:
    event.listen(model, "before_insert", _sync_submitted_at)
    event.listen(model, "before_update", _sync_submitted_at)
