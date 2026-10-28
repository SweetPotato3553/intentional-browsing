"""Build the unpacked Chromium extension using only the Python standard library."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def build(output=None, source=False):
    project = Path(__file__).resolve().parent
    extension = project / "extension"
    manifest = json.loads((extension / "manifest.json").read_text(encoding="utf-8"))
    kind = "source" if source else "chromium"
    destination = Path(output) if output else project / "dist" / f"intentional-browsing-{kind}-{manifest['version']}.zip"
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(extension.rglob("*")):
            if file.is_file() and "_metadata" not in file.relative_to(extension).parts:
                archive.write(file, file.relative_to(project).as_posix())
        for name in ["README.md", "README.en.md", "CHANGELOG.md", "REVIEW.md", "RELEASE-REVIEW.md", "PRIVACY.md", "VERIFICATION.json", "LICENSE", "CONTRIBUTING.md", "SECURITY.md"]:
            archive.write(project / name, name)
        for file in sorted((project / "docs").rglob("*")):
            if file.is_file():
                archive.write(file, file.relative_to(project).as_posix())
        if source:
            reports = json.loads((project / "VERIFICATION.json").read_text(encoding="utf-8"))["reports"]
            for name in ["build.py", "package.json", ".gitignore", ".gitattributes", ".editorconfig"]:
                archive.write(project / name, name)
            for file in sorted((project / ".github").rglob("*")):
                if file.is_file():
                    archive.write(file, file.relative_to(project).as_posix())
            for directory in ["tests", "tools"]:
                for file in sorted((project / directory).rglob("*")):
                    if "artifacts" in file.relative_to(project).parts and file.name not in reports:
                        continue
                    if file.is_file() and "__pycache__" not in file.parts and file.suffix in {".cjs", ".py", ".json"}:
                        archive.write(file, file.relative_to(project).as_posix())
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert json.loads(archive.read("extension/manifest.json"))["version"] == manifest["version"]
        verification = json.loads(archive.read("VERIFICATION.json"))
        assert verification["version"] == manifest["version"]
        for name, digest in verification["extension_sha256"].items():
            assert hashlib.sha256(archive.read("extension/" + name)).hexdigest() == digest, name
        assert not any("_metadata" in name or "node_modules" in name for name in archive.namelist())
        if source:
            for name in ["build.py", "package.json", "tests/run.cjs", "tools/verify_release.py"]:
                assert name in archive.namelist(), name
        else:
            assert not any(name.startswith(("tests/", "tools/")) for name in archive.namelist())
    print(destination.resolve())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", help="Optional ZIP destination")
    parser.add_argument("--source", action="store_true", help="Include build, tests and verification reports")
    args = parser.parse_args()
    build(args.output, args.source)
