from __future__ import annotations

import threading
import time
import webbrowser
from urllib.error import URLError
from urllib.request import urlopen

import uvicorn

from app.main import app

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000


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


def run_desktop_app(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    app_url = f"http://{host}:{port}/"
    health_url = f"http://{host}:{port}/health"
    _open_browser_when_ready(app_url, health_url)
    uvicorn.run(app, host=host, port=port)
