import smtplib
from email.message import EmailMessage

from config import settings


def send_email(to: str, subject: str, body: str) -> bool:
    # No SMTP configured: print to the console (development only)
    if not settings.smtp_host:
        if settings.environment == "development":
            print(f"\n[DEV EMAIL] to={to}\nsubject={subject}\n{body}\n")
            return True
        print("[EMAIL NOT SENT] SMTP is not configured")
        return False

    msg = EmailMessage()
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"[EMAIL FAILED] {e}")
        return False