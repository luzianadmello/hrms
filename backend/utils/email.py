import os
import smtplib
from email.message import EmailMessage


def send_email(to: str, subject: str, body: str) -> bool:
    host = os.getenv("SMTP_HOST")

    # Dev mode: no SMTP configured -> print to the server console
    if not host:
        print(f"\n[DEV EMAIL] to={to}\nsubject={subject}\n{body}\n")
        return True

    msg = EmailMessage()
    msg["From"] = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", ""))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587"))) as server:
            server.starttls()
            server.login(os.getenv("SMTP_USER", ""), os.getenv("SMTP_PASSWORD", ""))
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"[EMAIL FAILED] {e}")
        return False