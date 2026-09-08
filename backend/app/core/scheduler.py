"""APScheduler wiring for the daily notification scans.

`build_scheduler()` returns an un-started `AsyncIOScheduler` with a single
daily job. `app.main`'s lifespan starts it on boot and shuts it down on exit,
guarded by `settings.enable_scheduler`. Tests drive `httpx.ASGITransport`,
which never fires the lifespan, so the scheduler stays dormant under pytest.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config import settings
from app.services.notification_scans import run_all_scans

logger = logging.getLogger(__name__)


async def _run_notification_scans() -> None:
    try:
        result = await run_all_scans()
        logger.info("notification scans complete: %s", result)
    except Exception:  # noqa: BLE001 — a scan failure must not kill the scheduler
        logger.exception("notification scans failed")


def build_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _run_notification_scans,
        CronTrigger(hour=settings.notification_scan_hour, minute=0),
        id="notification_scans",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    return scheduler
