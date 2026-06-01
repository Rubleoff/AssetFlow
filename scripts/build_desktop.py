from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


def run(command: list[str], *, cwd: Path) -> None:
    subprocess.run(command, cwd=cwd, check=True)


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    web_root = repo_root / "web"
    web_dist = web_root / "dist"
    api_root = repo_root / "api"

    run(["npm", "run", "build"], cwd=web_root)

    if not web_dist.exists():
        raise SystemExit("Frontend build not found in web/dist")

    add_data = f"{web_dist}{os.pathsep}app/static"
    run(
        [
            "pyinstaller",
            "--noconfirm",
            "--onefile",
            "--name",
            "AssetFlow",
            "--paths",
            str(api_root),
            "--add-data",
            add_data,
            str(repo_root / "main.py"),
        ],
        cwd=repo_root,
    )


if __name__ == "__main__":
    sys.exit(main())
