"""Database helper for the JENKIN preview launcher.

Runs inside the launcher-owned virtualenv (psycopg, alembic), never in a
checkout's own environment. Usage:

    python dbtool.py <probe|ensure|inspect|plan> '<json params>'

Params: host, port, user, db, and for ``plan`` api_dir (the previewed
revision's apps/api). Prints exactly one JSON object on the last stdout line.
Exit 0 = success, 2 = refusal or failure with {"error": ..., "kind": ...}.

Safety: only loopback servers and databases named lifeos_preview or
lifeos_preview_<suffix> are accepted, and a database is written to only when
it carries the launcher's ownership comment (or is empty and gets adopted).
lifeos_dev, lifeos_test and every other database are refused. Passwords are
never handled here: libpq reads ~/.pgpass or trust authentication.
"""

from __future__ import annotations

import ipaddress
import json
import re
import sys

import psycopg
from psycopg import sql

OWNER_MARKER = "jenkin-preview-launcher"
DB_NAME_RE = re.compile(r"^lifeos_preview(?:_[a-z0-9]{1,24})?$")
FORBIDDEN_DBS = frozenset(
    {"lifeos", "lifeos_dev", "lifeos_test", "postgres", "template0", "template1"}
)
LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})
DOCUMENT_TABLES = ("documents", "document_versions", "document_blobs")


class Refusal(Exception):
    def __init__(self, message: str, kind: str = "refused") -> None:
        super().__init__(message)
        self.kind = kind


def approve(params: dict) -> None:
    name = params.get("db", "")
    if name in FORBIDDEN_DBS or not DB_NAME_RE.fullmatch(name):
        raise Refusal(
            f"database {name!r} is not an approved preview database "
            "(only lifeos_preview or lifeos_preview_<suffix>)",
            "unsafe_target",
        )
    if params.get("host") not in LOOPBACK_HOSTS:
        raise Refusal(
            f"host {params.get('host')!r} is not loopback; the preview database must be local",
            "unsafe_target",
        )


def connect(params: dict, dbname: str) -> psycopg.Connection:
    try:
        return psycopg.connect(
            host=params["host"],
            port=int(params["port"]),
            user=params["user"],
            dbname=dbname,
            connect_timeout=5,
            autocommit=True,
            application_name="jenkin-preview-launcher",
        )
    except psycopg.OperationalError as error:
        text = str(error)
        lowered = text.lower()
        if "password" in lowered or "authentication" in lowered:
            kind = "auth"
        elif "role" in lowered and "does not exist" in lowered:
            kind = "role"
        elif "database" in lowered and "does not exist" in lowered:
            kind = "missing_db"
        else:
            kind = "server"
        # libpq messages never contain the password itself.
        raise Refusal(text.strip().splitlines()[0] if text.strip() else "connection failed", kind)


def verify_target(conn: psycopg.Connection, params: dict) -> None:
    current, server_addr = conn.execute(
        "SELECT current_database(), host(inet_server_addr())"
    ).fetchone()
    if current != params["db"]:
        raise Refusal(f"connected to {current!r}, expected {params['db']!r}", "unsafe_target")
    if server_addr is not None and not ipaddress.ip_address(server_addr).is_loopback:
        raise Refusal(f"server address {server_addr} is not loopback", "unsafe_target")


def maintenance_connection(params: dict) -> psycopg.Connection:
    last: Refusal | None = None
    for name in ("postgres", "template1"):
        try:
            return connect(params, name)
        except Refusal as error:
            if error.kind != "missing_db":
                raise
            last = error
    raise last or Refusal("no maintenance database reachable", "server")


def database_comment(conn: psycopg.Connection, name: str) -> tuple[bool, str | None]:
    row = conn.execute(
        "SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = %s",
        (name,),
    ).fetchone()
    if row is None:
        return False, None
    return True, row[0]


def user_table_count(conn: psycopg.Connection) -> int:
    return conn.execute(
        """
        SELECT count(*) FROM information_schema.tables
         WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
           AND left(table_schema, 8) <> 'pg_toast'
        """
    ).fetchone()[0]


def cmd_probe(params: dict) -> dict:
    with maintenance_connection(params) as conn:
        version = conn.execute("SHOW server_version").fetchone()[0]
        role = conn.execute(
            "SELECT rolsuper OR rolcreatedb FROM pg_roles WHERE rolname = current_user"
        ).fetchone()
    return {"server_version": version, "can_create_db": bool(role and role[0])}


def cmd_ensure(params: dict) -> dict:
    approve(params)
    name = params["db"]
    with maintenance_connection(params) as conn:
        exists, comment = database_comment(conn, name)
        if not exists:
            allowed = conn.execute(
                "SELECT rolsuper OR rolcreatedb FROM pg_roles WHERE rolname = current_user"
            ).fetchone()
            if not (allowed and allowed[0]):
                raise Refusal(
                    f"role {params['user']!r} may not create databases; create {name} once "
                    f"(createdb -h {params['host']} {name}) or grant CREATEDB",
                    "privilege",
                )
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
            conn.execute(
                sql.SQL("COMMENT ON DATABASE {} IS {}").format(
                    sql.Identifier(name), sql.Literal(OWNER_MARKER)
                )
            )
            return {"created": True, "adopted": False}
        if comment == OWNER_MARKER:
            return {"created": False, "adopted": False}
    # Exists without the launcher's marker: adopt only if it holds nothing.
    with connect(params, name) as conn:
        verify_target(conn, params)
        tables = user_table_count(conn)
        if tables:
            raise Refusal(
                f"database {name} exists, was not created by the preview launcher and "
                f"contains {tables} table(s); refusing to migrate or use it",
                "foreign_db",
            )
        conn.execute(
            sql.SQL("COMMENT ON DATABASE {} IS {}").format(
                sql.Identifier(name), sql.Literal(OWNER_MARKER)
            )
        )
    return {"created": False, "adopted": True}


def require_owned(params: dict) -> None:
    approve(params)
    with maintenance_connection(params) as conn:
        exists, comment = database_comment(conn, params["db"])
    if not exists:
        raise Refusal(f"database {params['db']} does not exist", "missing_db")
    if comment != OWNER_MARKER:
        raise Refusal(f"database {params['db']} is not marked as launcher-owned", "foreign_db")


def cmd_inspect(params: dict) -> dict:
    require_owned(params)
    with connect(params, params["db"]) as conn:
        verify_target(conn, params)
        versions: list[str] = []
        if conn.execute("SELECT to_regclass('public.alembic_version')").fetchone()[0]:
            versions = [row[0] for row in conn.execute("SELECT version_num FROM alembic_version")]
        has_users = None
        if conn.execute("SELECT to_regclass('public.users')").fetchone()[0]:
            has_users = conn.execute("SELECT EXISTS (SELECT 1 FROM users)").fetchone()[0]
        document_rows = 0
        for table in DOCUMENT_TABLES:
            if conn.execute("SELECT to_regclass(%s)", (f"public.{table}",)).fetchone()[0]:
                document_rows += conn.execute(
                    sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier(table))
                ).fetchone()[0]
        return {
            "versions": versions,
            "has_users": has_users,
            "document_rows": document_rows,
            "tables": user_table_count(conn),
        }


def cmd_plan(params: dict) -> dict:
    state = cmd_inspect(params)
    api_dir = params["api_dir"]
    sys.path.insert(0, api_dir)
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    script = ScriptDirectory.from_config(Config(f"{api_dir}/alembic.ini"))
    heads = list(script.get_heads())
    result = {**state, "heads": heads}
    if len(heads) != 1:
        return {**result, "action": "refuse", "message": f"revision has {len(heads)} heads"}
    head = heads[0]
    current = state["versions"]
    if not current:
        if state["tables"]:
            return {
                **result,
                "action": "refuse",
                "message": "database has tables but no alembic_version; refusing to migrate",
            }
        return {**result, "action": "upgrade"}
    if current == [head]:
        return {**result, "action": "none"}
    ancestors = {rev.revision for rev in script.walk_revisions(base="base", head=head)}
    unknown = [rev for rev in current if rev not in ancestors]
    if unknown:
        return {
            **result,
            "action": "refuse",
            "message": (
                f"database schema {', '.join(current)} is newer than (or diverged from) this "
                f"revision's head {head}; it will not be downgraded"
            ),
        }
    return {**result, "action": "upgrade"}


COMMANDS = {"probe": cmd_probe, "ensure": cmd_ensure, "inspect": cmd_inspect, "plan": cmd_plan}


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[0] not in COMMANDS:
        print(json.dumps({"error": "usage: dbtool.py <command> '<json>'", "kind": "usage"}))
        return 2
    params = json.loads(argv[1])
    try:
        result = COMMANDS[argv[0]](params)
    except Refusal as error:
        print(json.dumps({"error": str(error), "kind": error.kind}))
        return 2
    except psycopg.Error as error:
        print(json.dumps({"error": str(error).strip().splitlines()[0], "kind": "database"}))
        return 2
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
