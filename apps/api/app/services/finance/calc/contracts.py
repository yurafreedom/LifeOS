"""Versions, vocabulary and limits of the calculation engine (leaf module).

Everything a caller may put in an input document is enumerated here. A value
outside these sets is never guessed at: it is reported as ``unsupported`` with
its path and value (see ``reader.py``).
"""

ENGINE_VERSION = "1.0.0"
SCHEMA_VERSION = 1

MODELS = ("daily_accrual", "amortizing", "revolving")

# Result status. ``unsupported`` = nothing computed (a required input is missing or
# a central mechanic is outside the catalogue); ``partial`` = computed for the
# supported part only; ``invalid`` = malformed or contradictory input.
COMPLETE = "complete"
PARTIAL = "partial"
UNSUPPORTED = "unsupported"
INVALID = "invalid"

# Bounds: every loop in the engine is bounded by one of these.
MAX_HORIZON_DAYS = 50 * 366
MAX_EVENTS = 5000
MAX_PERIODS = 600
MAX_CYCLES = 600
MAX_VERSIONS = 50
MAX_MINOR = 10**15
MAX_STEP_MINOR = 10**6

ROUNDING_MODES = ("half_up", "half_even", "down", "up")
INTEREST_STAGES = ("daily", "at_posting")
DAY_COUNTS = ("ACT_365_FIXED", "ACT_360", "ACT_ACT_ISDA")
KNOWN_UNSUPPORTED_DAY_COUNTS = {"30_360": "day_count_30_360", "ACT_365L": "day_count_act_365l"}
RATE_UNITS = {"percent": 100, "fraction": 1}
RATE_PERIODS = ("day", "month", "year")

CONTRACTUAL_RATE = "contractual_rate"
# Disclosed cost metrics describe a loan; they are not accrual rules (roadmap F2).
DISCLOSED_METRICS = {
    "apr": "disclosed_metric_not_accrual_input",
    "real_annual_cost": "disclosed_metric_not_accrual_input",
    "daily_total_cost": "disclosed_metric_not_accrual_input",
    "total_cost_of_credit": "disclosed_metric_not_accrual_input",
    "effective_rate": "disclosed_metric_not_accrual_input",
}
RATE_KINDS = ("fixed",)
KNOWN_UNSUPPORTED_RATE_KINDS = {
    "variable": "variable_rate",
    "floating": "variable_rate",
    "indexed": "variable_rate",
    "stepped": "stepped_rate",
}

OPENING_BASES = ("contractual_disbursement", "observed", "projected")
PROJECTED_FROM_PREVIOUS = "projected_from_previous"

FIRST_ACCRUAL_DAYS = ("opening_day", "day_after_opening")
PAYMENT_EFFECTS = ("same_day", "next_day")
BALANCE_BASES = ("outstanding_principal",)
KNOWN_UNSUPPORTED_BALANCE_BASES = {
    "principal_plus_unpaid_interest": "interest_capitalisation",
    "average_daily_balance": "average_daily_balance",
    "statement_balance": "statement_balance_basis_in_daily_model",
}

LOAN_COMPONENTS = ("fees", "interest", "principal")
ALLOCATION_IGNORED = ("penalties",)  # never charged by the engine, so allocating to it is a no-op

FEE_KINDS = ("one_off", "one_off_percent", "periodic_fixed", "periodic_percent")
FEE_BASES = ("opening_principal", "outstanding_principal")
LOAN_CLOSURE = "loan_closure"

PAYMENT_KINDS = ("regular", "early_partial", "early_full")
PAYMENT_BASES = ("actual", "planned")
EARLY_FEE_KINDS = ("none", "fixed")
KNOWN_UNSUPPORTED_EARLY_FEES = {
    "percent_of_prepaid": "early_repayment_fee_percent",
    "percent_of_payment": "early_repayment_fee_percent",
}

AMORTIZING_METHODS = ("annuity", "equal_principal")
FREQUENCIES = ("monthly",)
PERIOD_RATE_RULES = ("annual_div_12",)
FINAL_ADJUSTMENTS = ("last_payment_settles_balance",)
RECALCULATIONS = ("reduce_term", "reduce_payment")

REVOLVING_COMPONENTS = ("fees", "interest", "cash", "purchases")
INTEREST_BEARING = ("purchases_out_of_grace", "cash", "posted_interest", "fees")
TRANSACTION_KINDS = ("purchase", "cash_withdrawal")
GRACE_KINDS = ("none", "full_statement_payment")
GRACE_LOSS_POLICIES = ("retroactive_from_transaction_date", "from_statement_date", "from_due_date")
GRACE_LOSS_CHARGES = ("due_date", "next_statement")
MINIMUM_PLUS = ("interest", "fees")
