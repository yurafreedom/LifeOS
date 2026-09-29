"""«Самопроверка LifeOS» — a custom, transparent questionnaire. Not a clinical test.

It is not a validated psychometric instrument and it diagnoses nothing. The
only thing it can raise is one attention flag — "there may be a repeated debt
repayment friction pattern worth reviewing" — and the response always lists the
exact answers that raised it and the rule that counted them. ``unknown`` and
``prefer_not`` never count toward anything.
"""

from typing import Any

from app.services.system_review.contexts import SELF_CHECK_QUESTIONNAIRE, SELF_CHECK_QUESTIONS

# The answer to each question that counts as one indicator.
INDICATORS: dict[str, str] = {
    "q_know_total": "no",
    "q_repayment_plan": "no",
    "q_payments_delayed": "yes",
    "q_new_spend_on_credit": "yes",
    "q_avoid_checking": "yes",
    "q_income_sufficient": "no",
    "q_pattern_repeat": "yes",
}
THRESHOLD = 2
FLAG = "repayment_friction_pattern_worth_reviewing"


def evaluate_self_check(answers: dict[str, str] | None) -> dict[str, Any]:
    answers = dict(answers or {})
    triggered = [
        {"question": question, "answer": answers[question]}
        for question in SELF_CHECK_QUESTIONS
        if answers.get(question) == INDICATORS[question]
    ]
    return {
        "questionnaire": SELF_CHECK_QUESTIONNAIRE,
        "not_clinical": True,
        "questions": list(SELF_CHECK_QUESTIONS),
        "answers": answers,
        "answered": sum(1 for value in answers.values() if value in ("yes", "no")),
        "rule": {"indicators": INDICATORS, "threshold": THRESHOLD},
        "flag": FLAG if len(triggered) >= THRESHOLD else None,
        "triggered_by": triggered,
    }
