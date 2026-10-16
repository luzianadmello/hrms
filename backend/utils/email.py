"""Development email transport.

SMTP is intentionally not wired up yet. For now, print a complete email to the
backend terminal and return success so activation/reset flows can be tested.
Replace this function with the real email provider integration when ready.
"""
from __future__ import annotations


def send_email(*, to: str, subject: str, body: str) -> bool:
    separator = "=" * 72
    print(
        f"\\n{separator}\\n"
        "HRMS OUTGOING EMAIL (DEVELOPMENT MODE)\\n"
        f"{separator}\\n"
        f"To: {to}\\n"
        f"Subject: {subject}\\n"
        "Content-Type: text/plain; charset=UTF-8\\n"
        f"{'-' * 72}\\n"
        f"{body}\\n"
        f"{separator}\\n",
        flush=True,
    )
    return True
