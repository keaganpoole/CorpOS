from pathlib import Path

from dotenv import load_dotenv


def load_project_env() -> None:
    backend_dir = Path(__file__).resolve().parent
    project_root = backend_dir.parent

    # Load shared project env first, then allow backend-specific overrides.
    for env_path in (project_root / ".env", backend_dir / ".env"):
        if env_path.exists():
            load_dotenv(env_path)
