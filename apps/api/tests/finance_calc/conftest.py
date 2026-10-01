"""Pure calculation-engine tests: no database, no app, no network.

The package-level ``clean_database`` fixture is autouse and needs PostgreSQL;
the engine never touches a database, so it is replaced here by a no-op and
these tests run (rather than skip) without ``LIFEOS_TEST_DATABASE_URL``.
"""

import pytest


@pytest.fixture(autouse=True)
def clean_database():
    yield
