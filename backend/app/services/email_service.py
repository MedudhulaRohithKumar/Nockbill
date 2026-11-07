import logging
from typing import Optional
import boto3
from botocore.exceptions import ClientError
from app.config.settings import settings

logger = logging.getLogger(__name__)


def get_ses_client():
    """Create and return a boto3 SES client using environment/IAM role credentials."""
    region = settings.ses_region or settings.aws_region or "ap-south-1"
    kwargs = {"region_name": region}
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        kwargs["aws_access_key_id"] = settings.aws_access_key_id
        kwargs["aws_secret_access_key"] = settings.aws_secret_access_key
    return boto3.client("ses", **kwargs)


def send_password_reset_email(to_email: str, recipient_name: str, otp_code: str, reset_link: Optional[str] = None) -> bool:
    """
    Dispatches a branded NockBill Solutions password reset email via Amazon SES.
    Includes both the 6-digit verification code and a 1-click secure link.
    """
    sender = settings.ses_sender_email or "admin@nockbill.com"
    subject = f"{otp_code} is your NockBill Solutions password reset code"

    text_body = (
        f"Hello {recipient_name},\n\n"
        f"You requested to reset your password for your NockBill Solutions account.\n\n"
        f"Your 6-digit verification code is: {otp_code}\n\n"
        f"This code will expire in 15 minutes.\n"
    )
    if reset_link:
        text_body += f"Alternatively, click this link to reset your password: {reset_link}\n"
    text_body += "\nIf you did not request this, please ignore this email.\n- NockBill Solutions Team"

    action_button_html = ""
    if reset_link:
        action_button_html = f"""
        <div style="margin: 24px 0; text-align: center;">
          <a href="{reset_link}" style="background-color: #047857; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
            Reset Password Instantly
          </a>
        </div>
        """

    html_body = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center">
              <table width="560" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #064e3b 100%); padding: 28px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                      NockBill <span style="color: #34d399;">Solutions</span>
                    </h1>
                    <p style="color: #cbd5e1; margin: 4px 0 0; font-size: 12px;">Smart Agro &amp; Fertilizer ERP</p>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 32px 32px 24px;">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 18px; font-weight: 700;">Password Reset Request</h2>
                    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 12px 0 20px;">
                      Hello <strong>{recipient_name}</strong>,<br>
                      We received a request to reset the password for your NockBill account. Enter the following verification code in your browser:
                    </p>

                    <!-- OTP Code Box -->
                    <div style="background-color: #ecfdf5; border: 1.5px dashed #059669; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #065f46;">
                        {otp_code}
                      </span>
                      <p style="margin: 6px 0 0; color: #047857; font-size: 12px; font-weight: 600;">Valid for 15 minutes</p>
                    </div>

                    {action_button_html}

                    <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 24px 0 0;">
                      If you did not request a password reset, please ignore this email or contact support. Your password remains safe and unchanged.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f1f5f9; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                      &copy; 2026 NockBill Solutions. Sent securely via Amazon SES from <strong>{sender}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """

    try:
        client = get_ses_client()
        response = client.send_email(
            Source=f"NockBill Solutions <{sender}>",
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": text_body, "Charset": "UTF-8"},
                    "Html": {"Data": html_body, "Charset": "UTF-8"},
                },
            },
        )
        logger.info(f"Amazon SES dispatched password reset email to {to_email}. MessageId: {response.get('MessageId')}")
        return True
    except ClientError as e:
        logger.error(f"Amazon SES ClientError sending to {to_email}: {e.response['Error']['Message']}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending email via SES to {to_email}: {e}")
        return False
