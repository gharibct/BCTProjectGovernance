"""Loads the "Project Owned" info-tooltip reference data from the bundled
YAML file.

Parsed once and cached, but the cache is keyed on the file's mtime, so an edit
to project_owned_reference.yaml is picked up on the next call without a server
restart (the file is small; a stat() per call is negligible).
"""

from pathlib import Path

import yaml

from app.schemas.project_owned_reference import ProjectOwnedReference, ProjectOwnedReferenceEntry

_YAML_PATH = Path(__file__).resolve().parent.parent / "data" / "project_owned_reference.yaml"

_cache: tuple[float, ProjectOwnedReference] | None = None


def get_project_owned_reference() -> ProjectOwnedReference:
    global _cache
    mtime = _YAML_PATH.stat().st_mtime
    if _cache is None or _cache[0] != mtime:
        raw = yaml.safe_load(_YAML_PATH.read_text(encoding="utf-8"))
        _cache = (
            mtime,
            {code: ProjectOwnedReferenceEntry.model_validate(entry) for code, entry in raw.items()},
        )
    return _cache[1]
