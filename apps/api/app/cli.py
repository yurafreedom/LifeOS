"""Operator commands. Run from apps/api with the deployment's environment.

    python -m app.cli grant-owner <email>

Designates the owner explicitly. The M10 migration promotes a sole existing
user automatically; with several historical users it promotes no one, because
choosing among them would be a guess. Exactly one owner exists afterwards:
any previous owner becomes a member.

Document keyring (JENKIN S2 — see Outputs/Runbooks/jenkin-document-keys-runbook.md).
None of these ever prints key material; they print key ids and short key
check values so copies can be compared.

    python -m app.cli keyring-generate <path> --key-id <id>
        Create a NEW keyring file (refuses to overwrite) with one random key, 0600.
    python -m app.cli keyring-add-key <path> --key-id <id> [--activate]
        Add a random key to an existing file (atomic replace, 0600). Old keys stay.
    python -m app.cli keyring-import-key <path> --from <escrow file> --key-id <id>
        Copy one key (e.g. restored from escrow) into the file; never activates it.
    python -m app.cli keyring-activate <path> --key-id <id>
        Make an existing key the active wrapping key for new data keys.
    python -m app.cli keyring-check [<path>]
        Validate a keyring file (default: LIFEOS_KEYRING_FILE) and list its keys.
    python -m app.cli keyring-retire-key <path> --key-id <id> --confirm-no-backups-need-it
        Remove a non-active key, refused while any live record still uses it.
    python -m app.cli documents-rotate [--batch-size N]
        Re-wrap every live data key onto the configured active key (resumable).
    python -m app.cli documents-verify [--deep]
        Verify every live record; exit 0 only when rotation is complete.
"""

from __future__ import annotations

import argparse
import os
import secrets
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import func, select, update

from app.config import get_settings
from app.crypto.keyring import (
    KEY_BYTES,
    Keyring,
    KeyringError,
    check_value,
    load_keyring,
    serialize_keyring,
)
from app.db import create_engine_from_settings, create_session_factory
from app.models import User
from app.security.passwords import normalize_email


def grant_owner(email: str) -> int:
    factory = create_session_factory(create_engine_from_settings(get_settings()))
    canonical = normalize_email(email)
    with factory.begin() as db:
        user = db.scalar(select(User).where(func.lower(User.email) == canonical))
        if user is None:
            print("No account with that email.", file=sys.stderr)
            return 1
        db.execute(update(User).where(User.role == "owner", User.id != user.id).values(role="member"))
        user.role = "owner"
    print("Owner designated.")
    return 0


# ───────────────────────────── keyring files ─────────────────────────────


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _write_new_file(path: Path, data: bytes) -> None:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        os.write(fd, data)
        os.fsync(fd)
    finally:
        os.close(fd)


def _replace_file(path: Path, data: bytes) -> None:
    """Atomic replace: a crash leaves either the old or the new file, never half."""
    directory = path.resolve().parent
    fd, temp_name = tempfile.mkstemp(prefix=".keyring-", dir=directory)
    closed = False
    try:
        os.fchmod(fd, 0o600)
        os.write(fd, data)
        os.fsync(fd)
        os.close(fd)
        closed = True
        os.replace(temp_name, path)
    except BaseException:
        if not closed:
            os.close(fd)
        if os.path.exists(temp_name):
            os.unlink(temp_name)
        raise
    dir_fd = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(dir_fd)
    finally:
        os.close(dir_fd)


def _group_read_allowed() -> bool:
    try:
        return get_settings().keyring_allow_group_read
    except Exception:  # noqa: BLE001 — checking a file must not require a database URL
        return False


def _entries(path: Path) -> tuple[list[tuple[str, bytes, str | None]], str]:
    keyring = load_keyring(path, allow_group_read=_group_read_allowed())
    created = {info.key_id: info.created_at for info in keyring.info()}
    return [
        (key_id, keyring.material(key_id), created[key_id]) for key_id in keyring.key_ids
    ], keyring.active_key_id


def _print_keyring(keyring: Keyring) -> None:
    print(f"active key: {keyring.active_key_id}")
    for info in keyring.info():
        marker = "*" if info.key_id == keyring.active_key_id else " "
        print(f" {marker} {info.key_id}  created {info.created_at or '?'}  check {info.check_value}")


def keyring_generate(path: Path, key_id: str) -> int:
    material = secrets.token_bytes(KEY_BYTES)
    data = serialize_keyring([(key_id, material, _now())], key_id)
    try:
        _write_new_file(path, data)
    except FileExistsError:
        print("Refusing to overwrite an existing keyring file.", file=sys.stderr)
        return 1
    print(f"Created {path} (0600) with key {key_id} (check {check_value(material)}).")
    print("Back this file up separately from database backups before storing any document.")
    return 0


def keyring_add_key(path: Path, key_id: str, activate: bool) -> int:
    entries, active = _entries(path)
    if any(existing == key_id for existing, _, _ in entries):
        print("That key id already exists.", file=sys.stderr)
        return 1
    material = secrets.token_bytes(KEY_BYTES)
    entries.append((key_id, material, _now()))
    _replace_file(path, serialize_keyring(entries, key_id if activate else active))
    state = "and activated it" if activate else "(not active)"
    print(f"Added key {key_id} {state} (check {check_value(material)}). Old keys were kept.")
    print("Back up the updated file, then deploy it to every API process.")
    return 0


def keyring_import_key(path: Path, source: Path, key_id: str) -> int:
    entries, active = _entries(path)
    if any(existing == key_id for existing, _, _ in entries):
        print("That key id is already in the file.", file=sys.stderr)
        return 1
    source_entries, _ = _entries(source)
    match = [entry for entry in source_entries if entry[0] == key_id]
    if not match:
        print("The source file has no key with that id.", file=sys.stderr)
        return 1
    entries.append(match[0])
    _replace_file(path, serialize_keyring(entries, active))
    print(f"Imported {key_id} (check {check_value(match[0][1])}); the active key is unchanged.")
    return 0


def keyring_activate(path: Path, key_id: str) -> int:
    entries, _ = _entries(path)
    if not any(existing == key_id for existing, _, _ in entries):
        print("No such key id in the file.", file=sys.stderr)
        return 1
    _replace_file(path, serialize_keyring(entries, key_id))
    print(f"Active key is now {key_id}. Deploy the file to every API process before rotating.")
    return 0


def keyring_check(path: Path | None) -> int:
    target = path
    if target is None:
        configured = get_settings().keyring_file
        if not configured:
            print("LIFEOS_KEYRING_FILE is not set.", file=sys.stderr)
            return 2
        target = Path(configured)
    _print_keyring(load_keyring(target, allow_group_read=_group_read_allowed()))
    return 0


def keyring_retire_key(path: Path, key_id: str) -> int:
    entries, active = _entries(path)
    if key_id == active:
        print("Refusing to retire the active key.", file=sys.stderr)
        return 1
    if not any(existing == key_id for existing, _, _ in entries):
        print("No such key id in the file.", file=sys.stderr)
        return 1
    from app.services.documents.rotation import records_using_key

    factory = create_session_factory(create_engine_from_settings(get_settings()))
    remaining = records_using_key(factory, key_id)
    if remaining:
        print(
            f"Refusing: {remaining} live record(s) still use {key_id}. Rotate and verify first.",
            file=sys.stderr,
        )
        return 1
    kept = [entry for entry in entries if entry[0] != key_id]
    _replace_file(path, serialize_keyring(kept, active))
    print(
        f"Removed {key_id} from this file. Backups taken before the rotation still need it: "
        "keep the escrowed copy until those backups expire."
    )
    return 0


# ───────────────────────────── document rotation ─────────────────────────────


def _runtime_keyring():
    settings = get_settings()
    if not settings.keyring_file:
        raise KeyringError("LIFEOS_KEYRING_FILE is not set")
    keyring = load_keyring(settings.keyring_file, allow_group_read=settings.keyring_allow_group_read)
    factory = create_session_factory(create_engine_from_settings(settings))
    return factory, keyring


def _print_verification(report) -> None:
    keys = ", ".join(f"{key}={count}" for key, count in sorted(report.by_key.items())) or "none"
    print(
        f"Verified {report.documents} document(s) and {report.versions} version(s)"
        f"{' including content' if report.deep else ''}; records per key: {keys}."
    )
    for label in report.failures:
        print(f"  FAILED: {label}")
    if report.complete:
        print("Live database: every record authenticates and uses the active key.")
        print("Backups made before this rotation still require the previous key(s).")
    else:
        print(
            f"NOT complete: {report.on_other_keys} record(s) on other keys, "
            f"{len(report.failures)} failure(s). Re-run documents-rotate, then verify again."
        )


def documents_rotate(batch_size: int) -> int:
    from app.services.documents.rotation import rewrap_all, verify

    factory, keyring = _runtime_keyring()
    report = rewrap_all(factory, keyring, batch_size=batch_size)
    print(
        f"Active key {report.active_key_id}: re-wrapped {report.rewrapped}, changed "
        f"concurrently (re-run) {report.skipped_concurrent}, unreadable {len(report.failures)}."
    )
    for label in report.failures:
        print(f"  unreadable: {label}")
    verification = verify(factory, keyring)
    _print_verification(verification)
    return 0 if verification.complete else 1


def documents_verify(deep: bool) -> int:
    from app.services.documents.rotation import verify

    factory, keyring = _runtime_keyring()
    report = verify(factory, keyring, deep=deep)
    _print_verification(report)
    return 0 if report.complete else 1


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command")
    generate = commands.add_parser("keyring-generate")
    generate.add_argument("path", type=Path)
    generate.add_argument("--key-id", required=True)
    add = commands.add_parser("keyring-add-key")
    add.add_argument("path", type=Path)
    add.add_argument("--key-id", required=True)
    add.add_argument("--activate", action="store_true")
    imported = commands.add_parser("keyring-import-key")
    imported.add_argument("path", type=Path)
    imported.add_argument("--from", dest="source", type=Path, required=True)
    imported.add_argument("--key-id", required=True)
    activate = commands.add_parser("keyring-activate")
    activate.add_argument("path", type=Path)
    activate.add_argument("--key-id", required=True)
    check = commands.add_parser("keyring-check")
    check.add_argument("path", type=Path, nargs="?")
    retire = commands.add_parser("keyring-retire-key")
    retire.add_argument("path", type=Path)
    retire.add_argument("--key-id", required=True)
    retire.add_argument("--confirm-no-backups-need-it", action="store_true", required=True)
    rotate = commands.add_parser("documents-rotate")
    rotate.add_argument("--batch-size", type=int, default=200)
    verify_parser = commands.add_parser("documents-verify")
    verify_parser.add_argument("--deep", action="store_true")
    return parser


def main(argv: list[str]) -> int:
    if len(argv) == 2 and argv[0] == "grant-owner":
        return grant_owner(argv[1])
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2
    try:
        args = _parser().parse_args(argv)
    except SystemExit as exit_:
        return int(exit_.code or 2)
    handlers = {
        "keyring-generate": lambda: keyring_generate(args.path, args.key_id),
        "keyring-add-key": lambda: keyring_add_key(args.path, args.key_id, args.activate),
        "keyring-import-key": lambda: keyring_import_key(args.path, args.source, args.key_id),
        "keyring-activate": lambda: keyring_activate(args.path, args.key_id),
        "keyring-check": lambda: keyring_check(args.path),
        "keyring-retire-key": lambda: keyring_retire_key(args.path, args.key_id),
        "documents-rotate": lambda: documents_rotate(args.batch_size),
        "documents-verify": lambda: documents_verify(args.deep),
    }
    handler = handlers.get(args.command)
    if handler is None:
        print(__doc__, file=sys.stderr)
        return 2
    try:
        return handler()
    except KeyringError as error:
        print(f"Keyring error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
