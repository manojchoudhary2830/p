import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger("uvicorn.error")

async def send_transactional_email(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: Optional[str] = None
) -> bool:
    """
    Sends email via SendGrid using SENDGRID_API_KEY and SENDER_EMAIL.
    Per p.md security audit: Reset links and credentials are NOT logged to console.
    """
    if not settings.SENDGRID_API_KEY or "placeholder" in settings.SENDGRID_API_KEY or "mock" in settings.SENDGRID_API_KEY:
        # In development/test mode without live API key, simulate success without logging secret links
        logger.info(f"📧 [Email Simulated] Sent email to: {to_email} | Subject: {subject} (Secrets excluded from logs)")
        return True

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=settings.SENDER_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=html_content,
            plain_text_content=text_content or "Please view this email in an HTML-compatible client."
        )
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info(f"📧 SendGrid delivery status: {response.status_code} to {to_email}")
        return response.status_code in (200, 201, 202)
    except Exception as e:
        logger.error(f"Failed to send email via SendGrid to {to_email}: {e}")
        return False
