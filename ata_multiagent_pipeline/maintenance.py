from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
import shutil

from .contracts import slugify_filename


@dataclass(slots=True)
class CleanupReport:
    scanned_files: int = 0
    archived_files: list[str] = field(default_factory=list)
    skipped_files: list[str] = field(default_factory=list)
    archive_root: str = ""

    def to_dict(self) -> dict:
        return {
            "scanned_files": self.scanned_files,
            "archived_files": self.archived_files,
            "skipped_files": self.skipped_files,
            "archive_root": self.archive_root,
        }


def cleanup_legacy_artifacts(output_root: Path) -> CleanupReport:
    artifact_dirs = ["atas", "dashboards", "email"]
    archive_root = output_root / "legacy_cleanup" / datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    report = CleanupReport(archive_root=str(archive_root))

    for directory_name in artifact_dirs:
        directory = output_root / directory_name
        if not directory.exists():
            continue

        files = [item for item in directory.iterdir() if item.is_file()]
        name_lookup = {item.name.lower(): item for item in files}
        report.scanned_files += len(files)

        for file_path in files:
            normalized_name = _normalized_artifact_name(file_path.name)
            if normalized_name == file_path.name.lower():
                continue

            canonical = name_lookup.get(normalized_name) or _find_canonical_candidate(file_path, files)
            if canonical is None or canonical.resolve() == file_path.resolve():
                report.skipped_files.append(str(file_path))
                continue

            archive_target = archive_root / directory_name / file_path.name
            archive_target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(file_path), str(archive_target))
            report.archived_files.append(str(archive_target))

    return report


def _normalized_artifact_name(file_name: str) -> str:
    path = Path(file_name)
    stem = path.stem
    suffix = path.suffix.lower()

    if "_" in stem:
        prefix, remainder = stem.split("_", 1)
        normalized = f"{prefix.lower()}_{slugify_filename(remainder, fallback='ata')}"
    else:
        normalized = slugify_filename(stem, fallback="ata")

    return f"{normalized}{suffix}"


def _find_canonical_candidate(file_path: Path, files: list[Path]) -> Path | None:
    suspicious_name = file_path.name.lower()
    candidates = [
        candidate
        for candidate in files
        if candidate.suffix.lower() == file_path.suffix.lower()
        and candidate.name.lower() != suspicious_name
        and _normalized_artifact_name(candidate.name) == candidate.name.lower()
    ]

    best_match = None
    best_score = 0.0
    for candidate in candidates:
        score = SequenceMatcher(a=suspicious_name, b=candidate.name.lower()).ratio()
        if score > best_score:
            best_score = score
            best_match = candidate

    return best_match if best_match is not None and best_score >= 0.82 else None
