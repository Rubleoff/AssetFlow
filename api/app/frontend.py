from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse


def get_frontend_root() -> Path | None:
    packaged_root = Path(__file__).resolve().parent / "static"
    if packaged_root.exists():
        return packaged_root

    repo_root = Path(__file__).resolve().parents[2]
    built_root = repo_root / "web" / "dist"
    if built_root.exists():
        return built_root

    return None


def mount_frontend(app: FastAPI) -> None:
    frontend_root = get_frontend_root()
    if frontend_root is None:
        return

    index_file = frontend_root / "index.html"
    if not index_file.exists():
        return

    resolved_root = frontend_root.resolve()

    def serve_index() -> FileResponse:
        return FileResponse(index_file)

    @app.get("/", include_in_schema=False)
    def frontend_index() -> FileResponse:
        return serve_index()

    @app.get("/{path:path}", include_in_schema=False)
    def frontend_route(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404)
        if path in {"docs", "redoc", "openapi.json", "health"} or path.startswith("docs/") or path.startswith("redoc/"):
            raise HTTPException(status_code=404)

        candidate = (frontend_root / path).resolve()
        try:
            candidate.relative_to(resolved_root)
        except ValueError:
            raise HTTPException(status_code=404) from None

        if candidate.is_file():
            return FileResponse(candidate)

        if "." not in Path(path).name:
            return serve_index()

        raise HTTPException(status_code=404)
