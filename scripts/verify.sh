#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "== JSON validation =="
node - <<'NODE'
const fs = require("fs");
for (const file of ["package.json", "package-lock.json"]) {
  JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`ok ${file}`);
}
NODE

echo "== Markdown local links =="
python3 - <<'PY'
from pathlib import Path
import re
import subprocess
import sys

root = Path.cwd()
tracked = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard"], text=True).splitlines()
markdown_files = [root / path for path in tracked if path.endswith(".md") and (root / path).exists()]
link_pattern = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
bad = []

for markdown in markdown_files:
    text = markdown.read_text(encoding="utf-8")
    for match in link_pattern.finditer(text):
        target = match.group(1).strip()
        if not target or target.startswith(("#", "http://", "https://", "mailto:")):
            continue
        target = target.split()[0].strip("<>")
        target_path = target.split("#", 1)[0]
        if not target_path:
            continue
        resolved = (markdown.parent / target_path).resolve()
        try:
            resolved.relative_to(root)
        except ValueError:
            bad.append(f"{markdown.relative_to(root)} -> {target}")
            continue
        if not resolved.exists():
            bad.append(f"{markdown.relative_to(root)} -> {target}")

if bad:
    print("Broken local markdown links:", file=sys.stderr)
    for item in bad:
        print(f"  {item}", file=sys.stderr)
    sys.exit(1)

print(f"ok {len(markdown_files)} markdown files")
PY

echo "== No-secret scan =="
python3 - <<'PY'
from pathlib import Path
import re
import subprocess
import sys

root = Path.cwd()
patterns = [
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"sk-[A-Za-z0-9_-]{30,}"),
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{20,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"AIza[0-9A-Za-z_-]{30,}"),
    re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC |DSA |)PRIVATE KEY-----"),
]

tracked = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"])
files = [item.decode() for item in tracked.split(b"\0") if item and (root / item.decode()).exists()]
hits = []

for name in files:
    path = root / name
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    for line_no, line in enumerate(text.splitlines(), start=1):
        for pattern in patterns:
            if pattern.search(line):
                hits.append(f"{name}:{line_no}: {pattern.pattern}")

if hits:
    print("Potential secrets found:", file=sys.stderr)
    for hit in hits:
        print(f"  {hit}", file=sys.stderr)
    sys.exit(1)

print(f"ok scanned {len(files)} tracked/untracked files")
PY

echo "== Python compile =="
python3 - <<'PY'
from pathlib import Path
import py_compile
import subprocess
import sys
import tempfile

files = [Path(path) for path in subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard"], text=True).splitlines() if path.endswith(".py") and Path(path).exists()]
with tempfile.TemporaryDirectory() as tmpdir:
    for path in files:
        cfile = Path(tmpdir) / f"{path.name}.pyc"
        py_compile.compile(str(path), cfile=str(cfile), doraise=True)
        print(f"ok {path}")
if not files:
    print("ok no python files")
PY

echo "== Node syntax =="
python3 - <<'PY'
from pathlib import Path
import subprocess
import sys

files = [path for path in subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard"], text=True).splitlines() if path.endswith(".js") and Path(path).exists()]
for path in files:
    subprocess.run(["node", "--check", path], check=True)
    print(f"ok {path}")
if not files:
    print("ok no js files")
PY

echo "verify ok"
