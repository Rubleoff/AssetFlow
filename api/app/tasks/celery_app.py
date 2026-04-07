from celery import Celery

from app.core.config import get_settings

settings = get_settings()
celery_app = Celery("assetflow", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone=settings.default_timezone,
    beat_schedule={
        "process-outbox-every-five-minutes": {
            "task": "app.tasks.jobs.process_outbox_events",
            "schedule": 300,
        },
        "generate-recurring-hourly": {
            "task": "app.tasks.jobs.generate_recurring_due",
            "schedule": 3600,
        },
        "rebuild-snapshots-nightly": {
            "task": "app.tasks.jobs.refresh_snapshots",
            "schedule": 24 * 3600,
        },
    },
)
