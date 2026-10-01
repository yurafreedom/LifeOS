"""JENKIN local preview launcher (macOS, Python 3.11 standard library only).

Invoked through scripts/preview.sh; see scripts/preview/README.md.

    preview.sh [start] [--ref REF | --source PATH] [--db-suffix NAME]
               [--port N] [--api-port N] [--no-open]
    preview.sh status | stop | token | logs | help

The foreground run prepares dependencies, migrates only the dedicated preview
database, builds the production frontend, starts the real API and `vite
preview` as its own children, waits for readiness, opens the browser and stops
both services on Ctrl+C. Persistent data (database, secrets, mail) is kept.
"""

from __future__ import annotations

import argparse
import fcntl
import getpass
import hashlib
import json
import os
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DBTOOL = SCRIPT_DIR / "dbtool.py"
HOME = Path(os.environ.get("JENKIN_PREVIEW_HOME") or Path.home() / ".jenkin-preview").expanduser()

CONFIG_DEFAULTS = {
    "PREVIEW_PG_HOST": "127.0.0.1",
    "PREVIEW_PG_PORT": "5432",
    "PREVIEW_PG_USER": getpass.getuser(),
    "PREVIEW_DB": "lifeos_preview",
    "PREVIEW_WEB_PORT": "4710",
    "PREVIEW_API_PORT": "8710",
    "PREVIEW_ANALYTICS": "true",
    "PREVIEW_MAIL": "file",
}
CONFIG_TEMPLATE = """\
# JENKIN preview launcher — local, private configuration (not in Git).
# No passwords here: PostgreSQL credentials come from trust auth or ~/.pgpass.
# Only a loopback server and a database named lifeos_preview[_suffix] are accepted.
PREVIEW_PG_HOST={PREVIEW_PG_HOST}
PREVIEW_PG_PORT={PREVIEW_PG_PORT}
PREVIEW_PG_USER={PREVIEW_PG_USER}
PREVIEW_DB={PREVIEW_DB}
# Preferred ports (browser storage is per origin, so keep them stable).
PREVIEW_WEB_PORT={PREVIEW_WEB_PORT}
PREVIEW_API_PORT={PREVIEW_API_PORT}
# true = build with VITE_LIFEOS_ANALYTICS_ENABLED and open LIFEOS_AA_WRITE_ENABLED.
PREVIEW_ANALYTICS={PREVIEW_ANALYTICS}
# file = development .eml files under ~/.jenkin-preview/mail (nothing is sent); disabled = no mail.
PREVIEW_MAIL={PREVIEW_MAIL}
"""
DB_NAME_RE = re.compile(r"^lifeos_preview(?:_[a-z0-9]{1,24})?$")
SUFFIX_RE = re.compile(r"^[a-z0-9]{1,24}$")
FORBIDDEN_DBS = frozenset({"lifeos", "lifeos_dev", "lifeos_test", "postgres", "template0", "template1"})
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})
# Inherited variables that could silently retarget the API, the build or libpq.
STRIPPED_ENV_PREFIXES = ("LIFEOS_", "VITE_")
STRIPPED_ENV_KEYS = frozenset(
    {"PGHOST", "PGHOSTADDR", "PGPORT", "PGUSER", "PGDATABASE", "PGSERVICE", "PGSERVICEFILE",
     "PGOPTIONS", "PYTHONPATH", "PYTHONHOME", "VIRTUAL_ENV", "NODE_OPTIONS"}
)
MIN_NODE = (20, 19)
API_READY_SECONDS = 90
WEB_READY_SECONDS = 45
STOP_GRACE_SECONDS = 10
KEEP_BUILDS = 4
KEEP_VENVS = 3
KEEP_LOG_RUNS = 20
TAIL_LINES = 40


class LauncherError(Exception):
    """A clear, actionable failure. Printed without a traceback."""


class Interrupted(Exception):
    """Ctrl+C, `stop`, or the terminal closing."""


# ───────────────────────────── output ─────────────────────────────


def say(message: str = "") -> None:
    print(message, flush=True)


def step(message: str) -> None:
    print(f"• {message}", flush=True)


def warn(message: str) -> None:
    print(f"! {message}", file=sys.stderr, flush=True)


def tail(path: Path, lines: int = TAIL_LINES) -> str:
    try:
        content = path.read_text(errors="replace").splitlines()
    except OSError:
        return "(log not available)"
    return "\n".join(content[-lines:])


def show_tail(title: str, path: Path) -> None:
    say(f"\n── last lines of {title} ({path}) ──")
    say(tail(path))
    say("── end ──")


# ───────────────────────────── layout and config ─────────────────────────────


@dataclass(frozen=True)
class Layout:
    home: Path

    @property
    def config(self) -> Path: return self.home / "config.env"
    @property
    def secrets(self) -> Path: return self.home / "secrets"
    @property
    def token(self) -> Path: return self.secrets / "bootstrap-token"
    @property
    def venvs(self) -> Path: return self.home / "venvs"
    @property
    def builds(self) -> Path: return self.home / "builds"
    @property
    def worktrees(self) -> Path: return self.home / "worktrees"
    @property
    def run(self) -> Path: return self.home / "run"
    @property
    def cwd(self) -> Path: return self.run / "cwd"  # empty: no stray .env is ever read
    @property
    def lock(self) -> Path: return self.run / "launcher.lock"
    @property
    def state(self) -> Path: return self.run / "instance.json"
    @property
    def logs(self) -> Path: return self.home / "logs"
    @property
    def mail(self) -> Path: return self.home / "mail"

    def keyring(self, db: str) -> Path:
        return self.secrets / f"keyring-{db}.json"


L = Layout(HOME)


def ensure_home() -> None:
    inside = subprocess.run(
        ["git", "-C", str(HOME.parent if not HOME.exists() else HOME), "rev-parse", "--show-toplevel"],
        capture_output=True, text=True,
    )
    if inside.returncode == 0:
        ignored = subprocess.run(
            ["git", "-C", inside.stdout.strip(), "check-ignore", "-q", str(HOME)],
            capture_output=True,
        )
        if ignored.returncode != 0:
            raise LauncherError(
                f"JENKIN_PREVIEW_HOME {HOME} is inside a Git checkout and not ignored; "
                "choose a private location outside the repository"
            )
    for directory in (L.home, L.secrets, L.venvs, L.builds, L.worktrees, L.run, L.cwd, L.logs, L.mail):
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    for directory in (L.home, L.secrets, L.run):
        os.chmod(directory, 0o700)
    stray = [p.name for p in L.cwd.iterdir()]
    if stray:
        raise LauncherError(f"{L.cwd} must stay empty (found {', '.join(stray)}); remove those files")


def load_config() -> dict[str, str]:
    if not L.config.exists():
        fd = os.open(L.config, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as handle:
            handle.write(CONFIG_TEMPLATE.format(**CONFIG_DEFAULTS))
    os.chmod(L.config, 0o600)
    values = dict(CONFIG_DEFAULTS)
    for number, raw in enumerate(L.config.read_text().splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        key, sep, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if not sep or key not in CONFIG_DEFAULTS:
            raise LauncherError(f"{L.config}:{number}: unknown setting {key!r}")
        values[key] = value
    return values


def clean_env() -> dict[str, str]:
    env = {
        key: value for key, value in os.environ.items()
        if not key.startswith(STRIPPED_ENV_PREFIXES) and key not in STRIPPED_ENV_KEYS
    }
    env["PYTHONDONTWRITEBYTECODE"] = "1"  # never write __pycache__ into a checkout
    env["PYTHONUNBUFFERED"] = "1"
    return env


def read_or_create_secret(path: Path) -> str:
    if not path.exists():
        value = secrets.token_urlsafe(48)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as handle:
            handle.write(value)
    os.chmod(path, 0o600)
    value = path.read_text().strip()
    if len(value) < 32:
        raise LauncherError(f"{path} is shorter than 32 characters; it was edited by hand")
    return value


# ───────────────────────────── processes and locking ─────────────────────────────


def proc_identity(pid: int) -> tuple[str, str] | None:
    """(start time, command line) of a live process, or None."""
    start = subprocess.run(["ps", "-o", "lstart=", "-p", str(pid)], capture_output=True, text=True)
    command = subprocess.run(["ps", "-o", "command=", "-p", str(pid)], capture_output=True, text=True)
    if start.returncode or command.returncode or not start.stdout.strip():
        return None
    return start.stdout.strip(), command.stdout.strip()


def record_process(pid: int, marker: str) -> dict:
    identity = proc_identity(pid)
    return {"pid": pid, "lstart": identity[0] if identity else "", "marker": marker}


def is_same_process(record: dict) -> bool:
    """True only if the PID still belongs to the very process that was recorded."""
    identity = proc_identity(int(record["pid"]))
    return (
        identity is not None
        and bool(record.get("lstart"))
        and identity[0] == record["lstart"]
        and record["marker"] in identity[1]
    )


def acquire_lock() -> int | None:
    fd = os.open(L.lock, os.O_RDWR | os.O_CREAT, 0o600)  # not inherited by children
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        return None
    return fd


def read_state() -> dict | None:
    try:
        return json.loads(L.state.read_text())
    except (OSError, ValueError):
        return None


def write_state(state: dict) -> None:
    temp = L.state.with_suffix(".tmp")
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as handle:
        json.dump(state, handle, indent=2)
    os.replace(temp, L.state)


def remove_state() -> None:
    try:
        L.state.unlink()
    except FileNotFoundError:
        pass


def stop_recorded_orphans(state: dict) -> list[str]:
    """Stop services left behind by a launcher that died without cleanup.

    A recorded PID is signalled only when its start time and command line
    still match the record and it leads its own process group, so a reused PID
    belonging to another program is never touched.
    """
    stopped = []
    for record in state.get("services", []):
        pid = int(record["pid"])
        if not is_same_process(record):
            continue
        try:
            if os.getpgid(pid) != pid:
                continue
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            continue
        deadline = time.monotonic() + STOP_GRACE_SECONDS
        while time.monotonic() < deadline and is_same_process(record):
            time.sleep(0.2)
        if is_same_process(record):
            try:
                os.killpg(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        stopped.append(f"{record.get('name', 'service')} (pid {pid})")
    return stopped


# ───────────────────────────── git and sources ─────────────────────────────


GIT_ENV = {**os.environ, "GIT_OPTIONAL_LOCKS": "0", "GIT_TERMINAL_PROMPT": "0"}


def git(args: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess:
    result = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, env=GIT_ENV)
    if check and result.returncode:
        raise LauncherError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result


def git_out(args: list[str], cwd: Path) -> str:
    return git(args, cwd).stdout.strip()


@dataclass
class Source:
    path: Path
    kind: str
    branch: str
    commit: str
    subject: str
    changes: list[str] = field(default_factory=list)
    ref: str | None = None

    @property
    def api(self) -> Path: return self.path / "apps" / "api"
    @property
    def web(self) -> Path: return self.path / "apps" / "web"


def describe_checkout(path: Path, kind: str, ref: str | None = None) -> Source:
    top = Path(git_out(["rev-parse", "--show-toplevel"], path))
    for required in ("apps/api/alembic.ini", "apps/api/requirements.lock", "apps/web/package-lock.json"):
        if not (top / required).exists():
            raise LauncherError(f"{top} does not look like a JENKIN checkout (missing {required})")
    branch = git(["symbolic-ref", "--short", "-q", "HEAD"], top, check=False).stdout.strip()
    status = git(["status", "--porcelain=v1", "--untracked-files=normal"], top).stdout
    return Source(
        path=top,
        kind=kind,
        branch=branch or "(detached HEAD)",
        commit=git_out(["rev-parse", "HEAD"], top),
        subject=git_out(["log", "-1", "--format=%s"], top),
        changes=[line for line in status.splitlines() if line.strip()],
        ref=ref,
    )


def resolve_ref(repo: Path, ref: str) -> tuple[str, str]:
    """Fetch REF from origin and return (commit, label). Never falls back to main."""
    if ref.startswith("-") or not re.fullmatch(r"[A-Za-z0-9._/@+-]+", ref) or ".." in ref:
        raise LauncherError(f"invalid --ref {ref!r}")
    if re.fullmatch(r"[0-9a-fA-F]{7,40}", ref):
        found = git(["rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"], repo, check=False)
        if found.returncode:
            step(f"Fetching origin to find commit {ref}")
            git(["fetch", "--no-tags", "origin"], repo)
            if len(ref) == 40:
                git(["fetch", "--no-tags", "origin", ref], repo, check=False)
            found = git(["rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"], repo, check=False)
        if found.returncode:
            raise LauncherError(f"commit {ref} was not found locally or on origin")
        return found.stdout.strip(), ref
    name = ref.removeprefix("origin/")
    step(f"Fetching origin/{name}")
    fetched = git(["fetch", "--no-tags", "origin", f"+refs/heads/{name}:refs/remotes/origin/{name}"],
                  repo, check=False)
    if fetched.returncode:
        raise LauncherError(f"could not fetch branch {name!r} from origin: {fetched.stderr.strip()}")
    return git_out(["rev-parse", f"refs/remotes/origin/{name}^{{commit}}"], repo), f"origin/{name}"


def ensure_managed_worktree(repo: Path, label: str, commit: str) -> Path:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", label.removeprefix("origin/")).strip("-.")[:80] or commit[:12]
    path = L.worktrees / slug
    marker = L.worktrees / f"{slug}.managed.json"
    listing = git_out(["worktree", "list", "--porcelain"], repo)
    registered = {line[len("worktree "):] for line in listing.splitlines() if line.startswith("worktree ")}
    if path.exists():
        if not marker.exists() or str(path.resolve()) not in {str(Path(p).resolve()) for p in registered}:
            raise LauncherError(f"{path} exists but is not a launcher-managed worktree; not touching it")
        dirty = git_out(["status", "--porcelain=v1", "--untracked-files=normal"], path)
        if dirty:
            raise LauncherError(
                f"managed worktree {path} has local changes; it is never erased automatically.\n"
                f"Inspect it with: git -C {path} status   (preview it as-is with --source {path})"
            )
        if git_out(["rev-parse", "HEAD"], path) != commit:
            step(f"Updating clean managed worktree to {commit[:12]}")
            git(["checkout", "--quiet", "--detach", commit], path)
    else:
        if marker.exists():
            raise LauncherError(f"{marker} exists without its worktree; run `git worktree prune` "
                                f"and delete the marker, then retry")
        step(f"Creating managed worktree {path}")
        git(["worktree", "add", "--quiet", "--detach", str(path), commit], repo)
        marker.write_text(json.dumps({"ref": label, "created": datetime.now().isoformat(timespec="seconds"),
                                      "repo": str(repo)}, indent=2))
    return path


# ───────────────────────────── prerequisites ─────────────────────────────


def check_python() -> None:
    if sys.version_info[:2] != (3, 11):
        raise LauncherError(f"the API requires Python 3.11; running {sys.version.split()[0]}")


def check_node() -> str:
    node = shutil.which("node")
    npm = shutil.which("npm")
    if not node or not npm:
        raise LauncherError("Node.js and npm are required (Node ≥ 20.19). Install with nvm: nvm install 22")
    version = subprocess.run([node, "--version"], capture_output=True, text=True).stdout.strip()
    match = re.match(r"v(\d+)\.(\d+)", version)
    if not match or (int(match[1]), int(match[2])) < MIN_NODE:
        raise LauncherError(f"Node {version} is too old for Vite 8; install Node ≥ 20.19 (nvm install 22)")
    return version


# ───────────────────────────── logged commands ─────────────────────────────


def run_logged(cmd: list[str], *, cwd: Path, env: dict[str, str], log: Path, title: str) -> None:
    with open(log, "ab") as handle:
        handle.write(f"\n$ {' '.join(cmd)}\n".encode())
        handle.flush()
        process = subprocess.Popen(cmd, cwd=cwd, env=env, stdout=handle, stderr=subprocess.STDOUT,
                                   stdin=subprocess.DEVNULL)
        try:
            code = process.wait()
        except BaseException:
            process.terminate()
            try:
                process.wait(timeout=STOP_GRACE_SECONDS)
            except subprocess.TimeoutExpired:
                process.kill()
            raise
    if code:
        show_tail(title, log)
        raise LauncherError(f"{title} failed (exit {code}). Full log: {log}")


# ───────────────────────────── Python environment ─────────────────────────────


def ensure_venv(source: Source, log: Path) -> Path:
    lock = source.api / "requirements.lock"
    key = hashlib.sha256(lock.read_bytes() + sys.version.encode()).hexdigest()[:16]
    venv = L.venvs / key
    ready = venv / ".jenkin-preview-ready"
    if ready.exists():
        ready.touch()
        step(f"API dependencies: reusing launcher venv {venv.name} (requirements.lock unchanged)")
        return venv
    if venv.exists():
        shutil.rmtree(venv)  # an interrupted install inside the launcher's own directory
    step(f"API dependencies: creating launcher venv {venv.name} from requirements.lock (first run only)")
    env = clean_env()
    run_logged([sys.executable, "-m", "venv", str(venv)], cwd=L.cwd, env=env, log=log, title="venv creation")
    run_logged([str(venv / "bin" / "python"), "-m", "pip", "install", "--disable-pip-version-check",
                "--no-input", "--require-hashes", "-r", str(lock)],
               cwd=L.cwd, env=env, log=log, title="pip install -r requirements.lock")
    ready.write_text(json.dumps({"lock": str(lock), "created": datetime.now().isoformat(timespec="seconds")}))
    prune(L.venvs, KEEP_VENVS, keep={venv}, marker=".jenkin-preview-ready")
    return venv


def prune(directory: Path, keep_count: int, keep: set[Path], marker: str) -> None:
    entries = [p for p in directory.iterdir() if p.is_dir() and (p / marker).exists()]
    entries.sort(key=lambda p: (p / marker).stat().st_mtime, reverse=True)
    for stale in entries[keep_count:]:
        if stale not in keep:
            shutil.rmtree(stale, ignore_errors=True)


# ───────────────────────────── frontend ─────────────────────────────


def node_modules_current(web: Path) -> bool:
    hidden_path = web / "node_modules" / ".package-lock.json"
    if not hidden_path.exists() or not (web / "node_modules" / ".bin" / "vite").exists():
        return False
    want = json.loads((web / "package-lock.json").read_text()).get("packages", {})
    have = json.loads(hidden_path.read_text()).get("packages", {})
    for path, meta in want.items():
        if not path.startswith("node_modules/"):
            continue
        got = have.get(path)
        if got is None:
            if meta.get("optional") or meta.get("devOptional") or meta.get("os") or meta.get("cpu"):
                continue  # platform-specific optional package
            return False
        if got.get("version") != meta.get("version"):
            return False
    return all(path in want for path in have if path.startswith("node_modules/"))


def ensure_node_modules(source: Source, log: Path) -> None:
    if node_modules_current(source.web):
        step("Frontend dependencies: node_modules matches package-lock.json")
        return
    step(f"Frontend dependencies: npm ci in {source.web} (lockfile changed or not installed)")
    run_logged(["npm", "ci", "--no-audit", "--no-fund"], cwd=source.web, env=clean_env(), log=log,
               title="npm ci")
    if not node_modules_current(source.web):
        raise LauncherError("npm ci finished but node_modules still does not match package-lock.json")


def file_digest(path: Path) -> bytes:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.digest()


def web_fingerprint(source: Source, build_env: dict[str, str], node_version: str) -> str:
    """Content hash of everything the production build reads.

    Tracked and untracked (non-ignored) files under apps/web, the lockfile and
    any local apps/web/.env* files, the build flags and the Node version. A
    different Git revision produces a new build exactly when it changes these.
    """
    listed = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "apps/web"],
        cwd=source.path, capture_output=True, env=GIT_ENV, check=True,
    ).stdout.decode()
    names = set(filter(None, listed.split("\0")))
    names.update(str(p.relative_to(source.path)) for p in source.web.glob(".env*") if p.is_file())
    digest = hashlib.sha256(b"jenkin-preview-build-v1\0")
    for name in sorted(names):
        path = source.path / name
        if path.is_file():
            digest.update(name.encode() + b"\0" + file_digest(path))
    digest.update(json.dumps(build_env, sort_keys=True).encode())
    digest.update(node_version.encode())
    return digest.hexdigest()[:24]


def ensure_build(source: Source, build_env: dict[str, str], node_version: str, log: Path) -> Path:
    key = web_fingerprint(source, build_env, node_version)
    out = L.builds / key
    marker = out / ".jenkin-build.json"
    if marker.exists() and (out / "index.html").exists():
        marker.touch()
        step(f"Frontend build: reusing cached production build {key} (sources unchanged)")
        return out
    env_files = sorted(p.name for p in source.web.glob(".env*") if p.is_file())
    if env_files:
        warn(f"apps/web has local {', '.join(env_files)}; Vite may read them during the build")
    step(f"Frontend build: vite build → {out} ({', '.join(f'{k}={v}' for k, v in build_env.items()) or 'no flags'})")
    temp = L.builds / f".tmp-{key}-{os.getpid()}"
    shutil.rmtree(temp, ignore_errors=True)
    env = {**clean_env(), **build_env}
    try:
        run_logged([str(source.web / "node_modules" / ".bin" / "vite"), "build", "--outDir", str(temp),
                    "--emptyOutDir"], cwd=source.web, env=env, log=log, title="frontend build")
        if not (temp / "index.html").exists():
            raise LauncherError(f"the build produced no index.html; see {log}")
        (temp / ".jenkin-build.json").write_text(json.dumps({
            "source": str(source.path), "commit": source.commit, "dirty": bool(source.changes),
            "flags": build_env, "built": datetime.now().isoformat(timespec="seconds"),
        }, indent=2))
        shutil.rmtree(out, ignore_errors=True)
        os.rename(temp, out)
    finally:
        shutil.rmtree(temp, ignore_errors=True)
    prune(L.builds, KEEP_BUILDS, keep={out}, marker=".jenkin-build.json")
    return out


# ───────────────────────────── database ─────────────────────────────


@dataclass
class Database:
    host: str
    port: int
    user: str
    name: str

    def params(self, **extra: str) -> dict:
        return {"host": self.host, "port": self.port, "user": self.user, "db": self.name, **extra}

    @property
    def url(self) -> str:
        host = f"[{self.host}]" if ":" in self.host else self.host
        return f"postgresql+psycopg://{self.user}@{host}:{self.port}/{self.name}"


def approved_database(config: dict[str, str], suffix: str | None) -> Database:
    name = config["PREVIEW_DB"]
    if suffix is not None:
        if not SUFFIX_RE.fullmatch(suffix):
            raise LauncherError("--db-suffix must be 1–24 lowercase letters or digits")
        name = f"lifeos_preview_{suffix}"
    if name in FORBIDDEN_DBS or not DB_NAME_RE.fullmatch(name):
        raise LauncherError(
            f"refusing database {name!r}: preview runs only on lifeos_preview or "
            "lifeos_preview_<suffix>, never lifeos_dev, lifeos_test or another database"
        )
    host = config["PREVIEW_PG_HOST"]
    if host not in LOOPBACK_HOSTS:
        raise LauncherError(f"refusing PostgreSQL host {host!r}: the preview database must be local (loopback)")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", config["PREVIEW_PG_USER"]):
        raise LauncherError("PREVIEW_PG_USER contains unsupported characters")
    return Database(host=host, port=int(config["PREVIEW_PG_PORT"]), user=config["PREVIEW_PG_USER"], name=name)


def dbtool(venv: Path, command: str, params: dict) -> dict:
    result = subprocess.run(
        [str(venv / "bin" / "python"), str(DBTOOL), command, json.dumps(params)],
        cwd=L.cwd, env=clean_env(), capture_output=True, text=True, timeout=120,
    )
    lines = result.stdout.strip().splitlines()
    try:
        data = json.loads(lines[-1]) if lines else {}
    except ValueError:
        data = {}
    if result.returncode or "error" in data or not data:
        message = data.get("error") or result.stderr.strip()[-2000:] or "database helper failed"
        raise DatabaseError(message, data.get("kind", "unknown"))
    return data


class DatabaseError(LauncherError):
    def __init__(self, message: str, kind: str) -> None:
        super().__init__(message)
        self.kind = kind


def explain_database_error(error: DatabaseError, db: Database) -> LauncherError:
    hints = {
        "server": (f"PostgreSQL is not reachable on {db.host}:{db.port}. Start your existing local server "
                   "(for Homebrew: brew services start postgresql@18), then rerun."),
        "auth": (f"PostgreSQL rejected role {db.user!r} without a password. Add one line to ~/.pgpass "
                 f"(chmod 600): {db.host}:{db.port}:*:{db.user}:<password> — the launcher never stores it."),
        "role": (f"PostgreSQL has no role {db.user!r}. Set PREVIEW_PG_USER in {L.config} to an existing "
                 "local role that may create databases."),
        "privilege": "",
        "unsafe_target": "",
        "foreign_db": (f"Pick a separate database with --db-suffix <name>, or remove/rename the existing "
                       f"{db.name} yourself if it is truly unused."),
    }
    hint = hints.get(error.kind, "")
    return LauncherError(f"database {db.name}: {error}" + (f"\n  → {hint}" if hint else ""))


# ───────────────────────────── API and S2 features ─────────────────────────────


@dataclass
class Features:
    mail: bool
    public_app_url: bool
    documents: bool


def detect_features(source: Source) -> Features:
    config = (source.api / "app" / "config.py").read_text()
    cli_path = source.api / "app" / "cli.py"
    cli = cli_path.read_text() if cli_path.exists() else ""
    return Features(
        mail="mail_backend" in config and "mail_file_dir" in config,
        public_app_url="public_app_url" in config,
        documents="documents_enabled" in config and "keyring_file" in config and "keyring-generate" in cli,
    )


def api_env(source: Source, db: Database, token: str, web_port: int, config: dict[str, str],
            features: Features, keyring: Path | None) -> dict[str, str]:
    origins = [f"http://127.0.0.1:{web_port}", f"http://localhost:{web_port}"]
    env = clean_env()
    env.update({
        "PYTHONPATH": str(source.api),
        "LIFEOS_ENVIRONMENT": "development",
        "LIFEOS_DATABASE_URL": db.url,
        "LIFEOS_BOOTSTRAP_TOKEN": token,
        "LIFEOS_ALLOWED_HOSTS": json.dumps(["127.0.0.1", "localhost"]),
        "LIFEOS_ALLOWED_ORIGINS": json.dumps(origins),
        "LIFEOS_COOKIE_SECURE": "false",
        "LIFEOS_AA_WRITE_ENABLED": "true" if config["PREVIEW_ANALYTICS"] == "true" else "false",
    })
    if features.public_app_url:
        env["LIFEOS_PUBLIC_APP_URL"] = origins[0]
    if features.mail:
        if config["PREVIEW_MAIL"] == "file":
            mail_dir = L.mail / db.name
            mail_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
            env["LIFEOS_MAIL_BACKEND"] = "file"
            env["LIFEOS_MAIL_FILE_DIR"] = str(mail_dir)
        else:
            env["LIFEOS_MAIL_BACKEND"] = "disabled"
    if keyring is not None:
        env["LIFEOS_DOCUMENTS_ENABLED"] = "true"
        env["LIFEOS_KEYRING_FILE"] = str(keyring)
    return env


def ensure_keyring(venv: Path, source: Source, db: Database, document_rows: int, env: dict[str, str],
                   log: Path) -> Path:
    keyring = L.keyring(db.name)
    if keyring.exists():
        os.chmod(keyring, 0o600)
        step(f"Encrypted documents: using existing keyring {keyring}")
        return keyring
    if document_rows:
        raise LauncherError(
            f"database {db.name} holds {document_rows} encrypted document record(s) but the keyring "
            f"{keyring} is missing. Refusing to start (no new key can decrypt them).\n"
            f"  → Restore the original keyring file to that path (0600), then rerun."
        )
    key_id = f"preview-{datetime.now():%Y%m%d}"
    step(f"Encrypted documents: generating the first local keyring {keyring} (key id {key_id})")
    run_logged([str(venv / "bin" / "python"), "-m", "app.cli", "keyring-generate", str(keyring),
                "--key-id", key_id], cwd=L.cwd, env=env, log=log, title="keyring generation")
    if not keyring.exists():
        raise LauncherError(f"keyring generation did not create {keyring}; see {log}")
    return keyring


# ───────────────────────────── ports and HTTP ─────────────────────────────


def port_busy(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.5)
        if probe.connect_ex(("127.0.0.1", port)) == 0:
            return True
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            return True
    return False


def port_owner(port: int) -> str:
    result = subprocess.run(["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-Fpc"],
                            capture_output=True, text=True)
    pid = command = None
    for line in result.stdout.splitlines():
        if line.startswith("p"):
            pid = line[1:]
        elif line.startswith("c"):
            command = line[1:]
    return f"{command} (pid {pid})" if pid else "an unknown process"


def choose_ports(config: dict[str, str], args: argparse.Namespace) -> tuple[int, int]:
    web = args.port or int(config["PREVIEW_WEB_PORT"])
    api = args.api_port or int(config["PREVIEW_API_PORT"])
    if web == api:
        raise LauncherError("the web and API ports must differ")
    busy = [p for p in (web, api) if port_busy(p)]
    if not busy:
        return web, api
    for port in busy:
        warn(f"port {port} is in use by {port_owner(port)} — it will not be stopped")
    if args.port or args.api_port:
        raise LauncherError("the requested port is occupied; choose another with --port/--api-port")
    for offset in range(1, 21):
        if not port_busy(web + offset) and not port_busy(api + offset):
            warn(f"using the free pair web {web + offset} / API {api + offset}. Browser storage "
                 f"(theme, local preferences) is per port, so this origin starts separately.")
            return web + offset, api + offset
    raise LauncherError("no free port pair found near the configured ports")


_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def http_get(url: str) -> tuple[int, bytes] | None:
    try:
        with _OPENER.open(url, timeout=2) as response:
            return response.status, response.read(200_000)
    except urllib.error.HTTPError as error:
        return error.code, b""
    except (urllib.error.URLError, OSError):
        return None


# ───────────────────────────── services ─────────────────────────────


@dataclass
class Service:
    name: str
    process: subprocess.Popen
    log: Path
    marker: str

    def record(self) -> dict:
        return {"name": self.name, **record_process(self.process.pid, self.marker), "log": str(self.log)}


def start_service(name: str, cmd: list[str], cwd: Path, env: dict[str, str], log: Path, marker: str) -> Service:
    handle = open(log, "ab")
    handle.write(f"$ {' '.join(cmd)}\n".encode())
    handle.flush()
    process = subprocess.Popen(cmd, cwd=cwd, env=env, stdout=handle, stderr=subprocess.STDOUT,
                               stdin=subprocess.DEVNULL, start_new_session=True)
    handle.close()
    return Service(name, process, log, marker)


def stop_service(service: Service) -> None:
    if service.process.poll() is not None:
        return
    try:
        os.killpg(service.process.pid, signal.SIGTERM)  # our own unreaped child: PID cannot be reused
    except ProcessLookupError:
        return
    try:
        service.process.wait(timeout=STOP_GRACE_SECONDS)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(service.process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        service.process.wait()


def wait_ready(title: str, checks: list[tuple[str, callable]], services: list[Service], seconds: int) -> None:
    deadline = time.monotonic() + seconds
    pending = list(checks)
    while pending:
        for service in services:
            code = service.process.poll()
            if code is not None:
                show_tail(f"the {service.name} log", service.log)
                raise LauncherError(f"{service.name} exited during startup (exit {code}). Full log: {service.log}")
        url, accept = pending[0]
        response = http_get(url)
        if response is not None and accept(*response):
            pending.pop(0)
            continue
        if time.monotonic() > deadline:
            for service in services:
                show_tail(f"the {service.name} log", service.log)
            raise LauncherError(f"{title} was not ready within {seconds}s ({url})")
        time.sleep(0.3)


# ───────────────────────────── commands ─────────────────────────────


def new_log_dir() -> Path:
    path = L.logs / datetime.now().strftime("%Y%m%d-%H%M%S")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    latest = L.logs / "latest"
    if latest.is_symlink() or latest.exists():
        latest.unlink()
    latest.symlink_to(path.name)
    runs = sorted(p for p in L.logs.iterdir() if p.is_dir() and not p.is_symlink())
    for stale in runs[:-KEEP_LOG_RUNS]:
        shutil.rmtree(stale, ignore_errors=True)
    return path


def install_signal_handlers() -> None:
    def handler(signum, _frame):
        for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            signal.signal(sig, signal.SIG_IGN)  # finish cleanup without a second interruption
        raise Interrupted(signal.Signals(signum).name)

    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, handler)


def open_browser(url: str, args: argparse.Namespace) -> None:
    if args.no_open or os.environ.get("JENKIN_PREVIEW_NO_OPEN") == "1":
        say(f"  (browser not opened: {url})")
        return
    subprocess.run(["open", url], check=False)


def copy_token_to_clipboard() -> bool:
    if not L.token.exists():
        return False
    result = subprocess.run(["pbcopy"], input=L.token.read_text().strip(), text=True)
    return result.returncode == 0


def print_header(source: Source, db: Database) -> None:
    say("JENKIN preview")
    say(f"  source    {source.path}  [{source.kind}]")
    if source.ref:
        say(f"  ref       {source.ref}")
    say(f"  branch    {source.branch}")
    say(f"  commit    {source.commit[:12]}  {source.subject}")
    if source.changes:
        staged = sum(1 for line in source.changes if line[0] not in " ?")
        say(f"  tree      {len(source.changes)} uncommitted path(s) ({staged} staged) — the working tree "
            "is previewed as-is and left untouched")
    else:
        say("  tree      clean")
    say(f"  database  {db.name} @ {db.host}:{db.port} (role {db.user})")


def resolve_source(args: argparse.Namespace) -> Source:
    own_checkout = Path(git_out(["rev-parse", "--show-toplevel"], SCRIPT_DIR))
    if args.ref:
        commit, label = resolve_ref(own_checkout, args.ref)
        path = ensure_managed_worktree(own_checkout, label, commit)
        return describe_checkout(path, "managed worktree", ref=label)
    if args.source:
        return describe_checkout(Path(args.source).expanduser().resolve(), "--source checkout")
    return describe_checkout(own_checkout, "current checkout")


def cmd_start(args: argparse.Namespace) -> int:
    check_python()
    ensure_home()
    config = load_config()
    db = approved_database(config, args.db_suffix)
    lock_fd = acquire_lock()
    if lock_fd is None:
        return report_running_instance(args)
    install_signal_handlers()
    services: list[Service] = []
    try:
        stale = read_state()
        if stale:
            stopped = stop_recorded_orphans(stale)
            if stopped:
                warn(f"stopped services left by a previous launcher that did not exit cleanly: {', '.join(stopped)}")
            remove_state()
        source = resolve_source(args)
        print_header(source, db)
        state = {"phase": "starting", "launcher": record_process(os.getpid(), "launcher.py"),
                 "source": str(source.path), "kind": source.kind, "ref": source.ref, "branch": source.branch,
                 "commit": source.commit, "dirty": bool(source.changes), "db": db.name, "services": [],
                 "started": datetime.now().isoformat(timespec="seconds")}
        write_state(state)

        node_version = check_node()
        web_port, api_port = choose_ports(config, args)
        logs = new_log_dir()
        say(f"  logs      {logs}")

        venv = ensure_venv(source, logs / "pip.log")

        try:
            probe = dbtool(venv, "probe", db.params())
            step(f"PostgreSQL {probe['server_version']} reachable on {db.host}:{db.port}")
            ensured = dbtool(venv, "ensure", db.params())
            if ensured["created"]:
                step(f"Created the dedicated preview database {db.name}")
            elif ensured["adopted"]:
                step(f"Adopted the empty existing database {db.name} as the preview database")
            plan = dbtool(venv, "plan", db.params(api_dir=str(source.api)))
        except DatabaseError as error:
            raise explain_database_error(error, db) from None

        token = read_or_create_secret(L.token)
        features = detect_features(source)
        env = api_env(source, db, token, web_port, config, features, keyring=None)
        current = ", ".join(plan["versions"]) or "empty"
        head = plan["heads"][0] if plan["heads"] else "?"
        if plan["action"] == "refuse":
            raise LauncherError(
                f"{plan['message']}.\n  → Preview this revision on its own database instead: "
                f"./scripts/preview.sh {'--ref ' + args.ref + ' ' if args.ref else ''}"
                f"--db-suffix r{source.commit[:7]}   (separate, empty; your {db.name} data is untouched)"
            )
        if plan["action"] == "upgrade":
            step(f"Migrating {db.name}: {current} → {head} (forward only)")
            run_logged([str(venv / "bin" / "python"), "-m", "alembic", "-c", str(source.api / "alembic.ini"),
                        "upgrade", "head"], cwd=L.cwd, env=env, log=logs / "migrate.log", title="alembic upgrade")
            plan = dbtool(venv, "plan", db.params(api_dir=str(source.api)))
        else:
            step(f"Database schema is current ({head})")

        keyring = None
        if features.documents:
            keyring = ensure_keyring(venv, source, db, plan["document_rows"], env, logs / "keyring.log")
            env = api_env(source, db, token, web_port, config, features, keyring=keyring)
        elif L.keyring(db.name).exists():
            step("Encrypted documents: not available in this revision (keyring kept, unused)")

        ensure_node_modules(source, logs / "npm.log")
        analytics = config["PREVIEW_ANALYTICS"] == "true"
        build = ensure_build(source, {"VITE_LIFEOS_ANALYTICS_ENABLED": "true"} if analytics else {},
                             node_version, logs / "build.log")

        step(f"Starting API on http://127.0.0.1:{api_port}")
        services.append(start_service(
            "API",
            [str(venv / "bin" / "python"), "-m", "uvicorn", "--factory", "app.main:create_app",
             "--app-dir", str(source.api), "--host", "127.0.0.1", "--port", str(api_port)],
            cwd=L.cwd, env=env, log=logs / "api.log", marker=f"--port {api_port}"))
        wait_ready("API", [(f"http://127.0.0.1:{api_port}/api/healthz",
                            lambda status, body: status == 200 and b'"ok"' in body)],
                   services, API_READY_SECONDS)

        step(f"Starting production preview on http://127.0.0.1:{web_port}")
        web_env = {**clean_env(), "VITE_API_PROXY_TARGET": f"http://127.0.0.1:{api_port}"}
        services.append(start_service(
            "web preview",
            [str(source.web / "node_modules" / ".bin" / "vite"), "preview", "--outDir", str(build),
             "--host", "127.0.0.1", "--port", str(web_port), "--strictPort"],
            cwd=source.web, env=web_env, log=logs / "web.log", marker=f"--port {web_port}"))
        base = f"http://127.0.0.1:{web_port}"
        wait_ready("web preview", [
            (f"{base}/", lambda status, body: status == 200 and b'id="root"' in body),
            (f"{base}/api/healthz", lambda status, body: status == 200 and b'"ok"' in body),
        ], services, WEB_READY_SECONDS)

        state.update({"phase": "running", "url": base + "/", "web_port": web_port, "api_port": api_port,
                      "logs": str(logs), "build": str(build), "services": [s.record() for s in services],
                      "documents": keyring is not None})
        write_state(state)

        say("")
        say(f"JENKIN preview is ready: {base}/")
        if features.mail:
            say(f"  mail      {'development .eml files in ' + str(L.mail / db.name) if config['PREVIEW_MAIL'] == 'file' else 'disabled'} (nothing is sent)")
        say(f"  documents {'encrypted documents enabled' if keyring else 'not in this revision'}")
        if plan["has_users"] is False:
            copied = copy_token_to_clipboard()
            say("  first run: no account exists yet. The setup page opens now.")
            say("             The one-time bootstrap token is " + ("on your clipboard — paste it into the "
                "token field." if copied else "available via ./scripts/preview.sh token"))
            open_browser(f"{base}/?bootstrap=1", args)
        else:
            open_browser(base + "/", args)
        say("Press Ctrl+C to stop the preview (data is kept). Status: ./scripts/preview.sh status")

        while True:
            for service in services:
                code = service.process.poll()
                if code is not None:
                    show_tail(f"the {service.name} log", service.log)
                    raise LauncherError(f"{service.name} stopped unexpectedly (exit {code}); stopping the preview")
            time.sleep(0.5)
    except Interrupted as interrupted:
        say(f"\nStopping preview ({interrupted})…")
        return 0
    finally:
        for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            signal.signal(sig, signal.SIG_IGN)
        for service in reversed(services):
            stop_service(service)
        remove_state()
        os.close(lock_fd)
        if services:
            say(f"Preview stopped. Persistent data kept: database {db.name}, {L.home}")


def report_running_instance(args: argparse.Namespace) -> int:
    state = read_state() or {}
    if state.get("phase") != "running":
        raise LauncherError("another preview launcher is starting in a different terminal; wait for it, or run "
                            "./scripts/preview.sh stop")
    wanted = resolve_source_identity(args)
    same = (state.get("source"), state.get("commit")) == wanted[:2] and state.get("db") == wanted[2]
    if not same:
        raise LauncherError(
            f"a different preview is already running ({state.get('source')} @ {str(state.get('commit'))[:12]}, "
            f"database {state.get('db')}) at {state.get('url')}.\n  → Stop it first: ./scripts/preview.sh stop"
        )
    say(f"JENKIN preview is already running at {state['url']} (launcher pid {state['launcher']['pid']}).")
    if state.get("dirty"):
        say("  It serves the working tree as built at its start; stop and start again to pick up newer edits.")
    open_browser(state["url"], args)
    return 0


def resolve_source_identity(args: argparse.Namespace) -> tuple[str, str, str]:
    config = load_config()
    db = approved_database(config, args.db_suffix)
    own_checkout = Path(git_out(["rev-parse", "--show-toplevel"], SCRIPT_DIR))
    if args.ref:
        commit, label = resolve_ref(own_checkout, args.ref)
        slug = re.sub(r"[^A-Za-z0-9._-]+", "-", label.removeprefix("origin/")).strip("-.")[:80] or commit[:12]
        return str(L.worktrees / slug), commit, db.name
    path = Path(args.source).expanduser().resolve() if args.source else own_checkout
    top = Path(git_out(["rev-parse", "--show-toplevel"], path))
    return str(top), git_out(["rev-parse", "HEAD"], top), db.name


def cmd_status(_args: argparse.Namespace) -> int:
    ensure_home()
    lock_fd = acquire_lock()
    state = read_state()
    if lock_fd is not None:
        try:
            if state:
                leftovers = [f"{r.get('name')} (pid {r['pid']})" for r in state.get("services", [])
                             if is_same_process(r)]
                if leftovers:
                    say(f"JENKIN preview: launcher not running, but its services are still alive: "
                        f"{', '.join(leftovers)}. Stop them with ./scripts/preview.sh stop")
                else:
                    remove_state()
                    say("JENKIN preview: not running (removed stale runtime state; its PIDs are gone "
                        "or belong to other programs)")
            else:
                say("JENKIN preview: not running")
        finally:
            os.close(lock_fd)
        return 0
    if not state:
        say("JENKIN preview: a launcher holds the lock but has not written its state yet (starting)")
        return 0
    say(f"JENKIN preview: {state['phase']}")
    if state.get("url"):
        say(f"  url       {state['url']}")
    say(f"  source    {state['source']}  [{state['kind']}]" + (f"  ref {state['ref']}" if state.get("ref") else ""))
    say(f"  commit    {state['commit'][:12]}  branch {state['branch']}" + ("  (working tree changes)" if state.get("dirty") else ""))
    say(f"  database  {state['db']}")
    say(f"  launcher  pid {state['launcher']['pid']} since {state['started']}")
    for record in state.get("services", []):
        alive = is_same_process(record)
        port = state["api_port"] if record["name"] == "API" else state["web_port"]
        path = "/api/healthz"
        response = http_get(f"http://127.0.0.1:{port}{path}") if alive else None
        health = "healthy" if response and response[0] == 200 else ("running, not healthy" if alive else "gone")
        say(f"  {record['name']:<11} pid {record['pid']}  port {port}  {health}")
    if state.get("logs"):
        say(f"  logs      {state['logs']}")
    return 0


def cmd_stop(_args: argparse.Namespace) -> int:
    ensure_home()
    lock_fd = acquire_lock()
    if lock_fd is not None:
        try:
            state = read_state()
            stopped = stop_recorded_orphans(state) if state else []
            remove_state()
        finally:
            os.close(lock_fd)
        say("No preview launcher is running." + (f" Stopped leftover {', '.join(stopped)}." if stopped else ""))
        return 0
    state = read_state()
    launcher = (state or {}).get("launcher")
    if not launcher or not is_same_process(launcher):
        raise LauncherError("a launcher holds the lock but its recorded PID does not match; "
                            "stop it with Ctrl+C in its terminal")
    os.kill(int(launcher["pid"]), signal.SIGTERM)
    deadline = time.monotonic() + STOP_GRACE_SECONDS * 3
    while time.monotonic() < deadline:
        fd = acquire_lock()
        if fd is not None:
            os.close(fd)
            say("Preview stopped (data kept).")
            return 0
        time.sleep(0.2)
    raise LauncherError("the launcher did not stop in time; press Ctrl+C in its terminal")


def cmd_token(_args: argparse.Namespace) -> int:
    ensure_home()
    if copy_token_to_clipboard():
        say("The bootstrap token is on your clipboard (not shown). It only works while no account exists.")
        return 0
    raise LauncherError("no bootstrap token yet; run ./scripts/preview.sh once first")


def cmd_logs(_args: argparse.Namespace) -> int:
    latest = L.logs / "latest"
    if not latest.exists():
        raise LauncherError("no preview logs yet")
    run_dir = latest.resolve()
    say(f"Logs of the latest run: {run_dir}")
    for name in ("migrate.log", "build.log", "api.log", "web.log"):
        if (run_dir / name).exists():
            show_tail(name, run_dir / name)
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="./scripts/preview.sh",
        description="JENKIN local preview: production build + real API on the dedicated preview database.",
        epilog="Default source: the checkout that contains this script, its working tree as-is "
               "(uncommitted changes included). --ref fetches a branch/commit from origin into a "
               "managed worktree under ~/.jenkin-preview/worktrees. Nothing ever falls back to main.",
    )
    parser.add_argument("command", nargs="?", default="start",
                        choices=["start", "status", "stop", "token", "logs", "help"])
    origin = parser.add_mutually_exclusive_group()
    origin.add_argument("--ref", help="remote branch (e.g. feat/x or origin/feat/x) or commit SHA to preview")
    origin.add_argument("--source", help="preview another local checkout's working tree (read-only use)")
    parser.add_argument("--db-suffix", help="use lifeos_preview_<suffix> instead of the default preview database")
    parser.add_argument("--port", type=int, help="web port (default from config, 4710)")
    parser.add_argument("--api-port", type=int, help="API port (default from config, 8710)")
    parser.add_argument("--no-open", action="store_true", help="do not open the browser")
    args = parser.parse_args(argv)
    if args.command == "help":
        parser.print_help()
        raise SystemExit(0)
    return args


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    handlers = {"start": cmd_start, "status": cmd_status, "stop": cmd_stop, "token": cmd_token, "logs": cmd_logs}
    try:
        return handlers[args.command](args)
    except LauncherError as error:
        warn(f"JENKIN preview: {error}")
        return 1
    except Interrupted:
        return 130
    except BrokenPipeError:  # e.g. `preview.sh status | head`
        os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
        return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
