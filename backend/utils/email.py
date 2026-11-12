"""Development email transport.

SMTP is intentionally not wired up yet. For now, print a complete email to the
backend terminal, laid out like a real message, and return success so the
activation / reset flows can be tested. Replace this function with the real
email provider integration when ready.
"""
from __future__ import annotations

from datetime import datetime, timezone

SEPARATOR = "=" * 72
RULE = "-" * 72


def send_email(*, to: str, subject: str, body: str) -> bool:
    sent_at = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

    message = "\n".join(
        [
            "",
            SEPARATOR,
            "HRMS OUTGOING EMAIL (DEVELOPMENT MODE - NOT ACTUALLY SENT)",
            SEPARATOR,
            "From: HRMS <no-reply@hrms.local>",
            f"To: {to}",
            f"Date: {sent_at}",
            f"Subject: {subject}",
            "Content-Type: text/plain; charset=UTF-8",
            RULE,
            "",
            body,
            "",
            SEPARATOR,
            "",
        ]
    )

    print(message, flush=True)
    return True
