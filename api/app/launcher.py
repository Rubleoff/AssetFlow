from __future__ import annotations

import logging
import threading
import time
import webbrowser
from collections.abc import Callable
from urllib.error import URLError
from urllib.request import urlopen

import uvicorn

from app.main import app

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000

logger = logging.getLogger(__name__)


def _open_browser_when_ready(url: str, health_url: str, timeout_seconds: int = 20) -> None:
    def _worker() -> None:
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            try:
                with urlopen(health_url, timeout=1):
                    webbrowser.open_new_tab(url)
                    return
            except URLError:
                time.sleep(0.25)
            except OSError:
                time.sleep(0.25)

    threading.Thread(target=_worker, daemon=True).start()


def _run_periodically(fn: Callable[[], object], interval: int) -> None:
    def _loop() -> None:
        while True:
            try:
                fn()
            except Exception:
                logger.exception("Scheduled job %s failed", fn.__name__)
            time.sleep(interval)

    threading.Thread(target=_loop, daemon=True, name=f"scheduler-{fn.__name__}").start()


def _start_scheduler() -> None:
    from app.tasks.jobs import generate_recurring_due, process_outbox_events, refresh_snapshots

    _run_periodically(process_outbox_events, 300)
    _run_periodically(generate_recurring_due, 3600)
    _run_periodically(refresh_snapshots, 86400)


def run_desktop_app(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    app_url = f"http://{host}:{port}/"
    health_url = f"http://{host}:{port}/health"
    _open_browser_when_ready(app_url, health_url)
    _start_scheduler()
    uvicorn.run(app, host=host, port=port)
