from app.services.status_report_history import _event_for


def test_approved_back_to_draft_is_a_revoke_not_a_recall():
    assert _event_for("Approved", "Submitted") == "Revoked"
    assert _event_for("Draft", "Submitted") == "Submitted"
    assert _event_for("Submitted", "Draft") == "Recalled"
