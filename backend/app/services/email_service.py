"""
NockBill Solutions — Enterprise Email Notification Service
Powered by Amazon SES with high-converting, responsive HTML email templates.
Covers:
1. Password Reset Verification (6-digit OTP + 1-click link)
2. Password Reset Confirmation & Security Notice (instant acknowledgement)
3. Welcome & Shop Account Provisioning (credentials, onboarding checklist & dashboard link)
"""
import logging
import os
from datetime import datetime
from typing import Optional
import boto3
from botocore.exceptions import ClientError
from app.config.settings import settings

logger = logging.getLogger(__name__)


def get_ses_client():
    """
    Create and return a boto3 SES client using environment/IAM role credentials.
    In AWS Lambda / ECS / EC2, boto3 automatically uses the IAM execution role via
    the ambient AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_SESSION_TOKEN.
    We preserve the full credential tuple (including aws_session_token) to avoid
    stripping STS security tokens on temporary credentials.
    """
    region = settings.ses_region or settings.aws_region or "ap-south-1"
    kwargs = {"region_name": region}
    
    access_key = (settings.aws_access_key_id or "").strip()
    secret_key = (settings.aws_secret_access_key or "").strip()
    session_token = (
        getattr(settings, "aws_session_token", "")
        or os.environ.get("AWS_SESSION_TOKEN")
        or os.environ.get("AWS_SECURITY_TOKEN")
        or ""
    ).strip()

    if access_key and secret_key:
        kwargs["aws_access_key_id"] = access_key
        kwargs["aws_secret_access_key"] = secret_key
        if session_token:
            kwargs["aws_session_token"] = session_token
    elif session_token:
        kwargs["aws_session_token"] = session_token

    return boto3.client("ses", **kwargs)


def _render_email_wrapper(content_html: str, preview_text: str = "") -> str:
    """Wraps template content in standard NockBill Solutions responsive email shell."""
    sender = settings.ses_sender_email or "admin@nockbill.com"
    app_url = settings.app_base_url.rstrip("/") if settings.app_base_url else "https://nockbill.com"
    
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>NockBill Solutions</title>
  <style>
    body, table, td, p, a, li, blockquote {{
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }}
    body {{
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }}
    table {{
      border-collapse: collapse;
    }}
    img {{
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }}
    @media only screen and (max-width: 600px) {{
      .email-container {{
        width: 100% !important;
        margin: auto !important;
        border-radius: 0 !important;
      }}
      .mobile-padding {{
        padding: 24px 20px !important;
      }}
      .otp-text {{
        font-size: 28px !important;
        letter-spacing: 4px !important;
      }}
    }}
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9;">
  <!-- Preview Text (Hidden in body, visible in inbox preview) -->
  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    {preview_text}
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table class="email-container" width="580" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%); padding: 32px 28px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 8px 16px; margin-bottom: 12px;">
                      <span style="font-size: 20px; vertical-align: middle;">🌱</span>
                      <span style="color: #ffffff; font-size: 18px; font-weight: 800; letter-spacing: -0.3px; vertical-align: middle; margin-left: 6px;">
                        NockBill <span style="color: #34d399;">Solutions</span>
                      </span>
                    </div>
                    <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px; font-weight: 500; letter-spacing: 0.2px;">
                      Next-Gen Billing, Inventory &amp; GST Intelligence
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td class="mobile-padding" style="padding: 36px 32px 28px;">
              {content_html}

              <!-- Corporate Email Signature -->
              <div style="margin-top: 36px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #475569; font-size: 14px; font-weight: 600;">
                  Warm regards,
                </p>
                <p style="margin: 4px 0 0; color: #0f172a; font-size: 15px; font-weight: 800; letter-spacing: -0.2px;">
                  The NockBill Solutions Team
                </p>
                <p style="margin: 3px 0 0; color: #64748b; font-size: 13px;">
                  Customer Success &amp; Security Engineering &bull; NockBill Solutions
                </p>
                <table border="0" cellspacing="0" cellpadding="0" style="margin-top: 8px;">
                  <tr>
                    <td style="color: #059669; font-size: 13px; font-weight: 600;">
                      <a href="{app_url}" style="color: #059669; text-decoration: none; font-weight: 600;">nockbill.com</a>
                      <span style="color: #cbd5e1; margin: 0 6px;">&bull;</span>
                      <a href="mailto:support@nockbill.com" style="color: #059669; text-decoration: none;">support@nockbill.com</a>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 11px; line-height: 1.6; margin: 0;">
                This is an automated system notification from <strong>{sender}</strong>.<br>
                &copy; {datetime.utcnow().year} NockBill Solutions. All rights reserved.<br>
                Secure Cloud Infrastructure powered by Amazon Web Services.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send_via_ses(to_email: str, subject: str, text_body: str, html_body: str) -> bool:
    """Helper to dispatch email through Amazon SES with detailed error handling."""
    sender = settings.ses_sender_email or "admin@nockbill.com"
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
        msg_id = response.get("MessageId")
        logger.info(f"Amazon SES successfully dispatched '{subject}' to {to_email}. MessageId: {msg_id}")
        return True
    except ClientError as e:
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        error_code = e.response.get("Error", {}).get("Code", "ClientError")
        logger.error(f"Amazon SES {error_code} sending to {to_email}: {error_msg}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending email via SES to {to_email}: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# 1. Password Reset Verification Email (OTP + 1-Click Link)
# ─────────────────────────────────────────────────────────────────────────────
def send_password_reset_email(
    to_email: str,
    recipient_name: str,
    otp_code: str,
    reset_link: Optional[str] = None
) -> bool:
    """
    Dispatches a branded NockBill Solutions password reset email via Amazon SES.
    Includes both the high-visibility 6-digit verification code and a 1-click secure link.
    """
    subject = f"🔐 {otp_code} is your NockBill verification code"

    text_body = (
        f"Hello {recipient_name},\n\n"
        f"We received a request to reset your password for your NockBill Solutions account.\n\n"
        f"Your 6-digit verification code is: {otp_code}\n\n"
        f"This code will expire in 15 minutes.\n"
    )
    if reset_link:
        text_body += f"\nAlternatively, click here to reset your password directly:\n{reset_link}\n"
    text_body += (
        "\nIf you did not initiate this request, your account remains safe and no changes were made.\n\n"
        "- The NockBill Solutions Team"
    )

    action_btn_html = ""
    if reset_link:
        action_btn_html = f"""
        <div style="margin: 28px 0 20px; text-align: center;">
          <a href="{reset_link}" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
            Reset Password Instantly &rarr;
          </a>
        </div>
        """

    content_html = f"""
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.3px;">
        Password Reset Request
      </h2>
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 12px 0 24px;">
        Hello <strong>{recipient_name}</strong>,<br>
        We received a request to reset your password for your NockBill Solutions store account. Please use the 6-digit verification code below to proceed:
      </p>

      <!-- OTP Code Box -->
      <div style="background-color: #ecfdf5; border: 1.5px dashed #059669; border-radius: 12px; padding: 22px 16px; text-align: center; margin: 24px 0;">
        <span class="otp-text" style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #065f46; display: inline-block;">
          {otp_code}
        </span>
        <p style="margin: 8px 0 0; color: #047857; font-size: 12px; font-weight: 600;">
          ⏱️ Valid for 15 minutes &bull; Single-use security token
        </p>
      </div>

      {action_btn_html}

      <!-- Security Notice Card -->
      <div style="background-color: #f8fafc; border-left: 4px solid #64748b; border-radius: 4px; padding: 14px 16px; margin: 28px 0 0;">
        <p style="margin: 0; color: #475569; font-size: 12px; line-height: 1.6;">
          <strong>Security Notice:</strong> If you did not request a password reset, please ignore this email. Your password will remain unchanged and your account is secure.
        </p>
      </div>
    """

    html_body = _render_email_wrapper(
        content_html=content_html,
        preview_text=f"Your NockBill Solutions verification code is {otp_code} (expires in 15 minutes)."
    )

    return _send_via_ses(to_email, subject, text_body, html_body)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Password Reset Confirmation & Security Notice Email
# ─────────────────────────────────────────────────────────────────────────────
def send_password_reset_confirmation_email(
    to_email: str,
    recipient_name: str,
    username: str,
    shop_name: str
) -> bool:
    """
    Dispatches a real-time security acknowledgement confirming that the password
    for a merchant account was successfully changed.
    """
    subject = f"🛡️ Security Notice: Password changed for your NockBill account ({username})"
    login_url = f"{settings.app_base_url.rstrip('/')}/login" if settings.app_base_url else "https://nockbill.com/login"
    timestamp_str = datetime.utcnow().strftime("%d %b %Y, %H:%M UTC")

    text_body = (
        f"Hello {recipient_name},\n\n"
        f"This is an automated security confirmation that the password for your NockBill Solutions "
        f"account ({username}) associated with '{shop_name}' was successfully updated on {timestamp_str}.\n\n"
        f"You can now sign in with your new password at: {login_url}\n\n"
        f"IMPORTANT: If you did NOT make this change, please contact our security team immediately at "
        f"support@nockbill.com to protect your account.\n\n"
        f"- The NockBill Solutions Team"
    )

    content_html = f"""
      <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 20px; padding: 4px 12px; margin-bottom: 12px;">
        <span style="color: #047857; font-size: 12px; font-weight: 700;">✅ Security Event</span>
      </div>
      <h2 style="color: #0f172a; margin-top: 4px; font-size: 20px; font-weight: 800; letter-spacing: -0.3px;">
        Your Password Has Been Updated
      </h2>
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 12px 0 20px;">
        Hello <strong>{recipient_name}</strong>,<br>
        This email confirms that the password for your NockBill Solutions account was successfully updated.
      </p>

      <!-- Event Summary Box -->
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 20px 0; font-size: 14px;">
        <tr>
          <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 35%;">Username</td>
          <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">{username}</td>
        </tr>
        <tr>
          <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Associated Store</td>
          <td style="padding: 14px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">{shop_name}</td>
        </tr>
        <tr>
          <td style="padding: 14px 18px; color: #64748b;">Date &amp; Time</td>
          <td style="padding: 14px 18px; color: #0f172a; font-weight: 600;">{timestamp_str}</td>
        </tr>
      </table>

      <!-- Sign In Button -->
      <div style="margin: 28px 0; text-align: center;">
        <a href="{login_url}" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
          Sign In to Shop Dashboard &rarr;
        </a>
      </div>

      <!-- Warning Box -->
      <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px; margin: 24px 0 0;">
        <p style="margin: 0; color: #9f1239; font-size: 13px; line-height: 1.6;">
          <strong>⚠️ Did you NOT make this change?</strong><br>
          If you did not authorize this change, someone may have gained unauthorized access to your account. Please reach out to our emergency support immediately at 
          <a href="mailto:support@nockbill.com" style="color: #be123c; font-weight: 700; text-decoration: underline;">support@nockbill.com</a> to lock down your credentials and protect your business data.
        </p>
      </div>
    """

    html_body = _render_email_wrapper(
        content_html=content_html,
        preview_text=f"Password for {username} was successfully changed on {timestamp_str}."
    )

    return _send_via_ses(to_email, subject, text_body, html_body)


# ─────────────────────────────────────────────────────────────────────────────
# 3. New Account Welcome & Shop Provisioned Email
# ─────────────────────────────────────────────────────────────────────────────
def send_welcome_account_email(
    to_email: str,
    recipient_name: str,
    username: str,
    shop_name: str,
    login_url: Optional[str] = None,
    gstin: Optional[str] = None,
    license_no: Optional[str] = None,
    role_name: str = "Store Owner"
) -> bool:
    """
    Dispatches a welcome email with account provisioning details, store info,
    and a quick-start guide when a merchant or staff account is registered.
    """
    subject = f"🌱 Welcome to NockBill Solutions, {recipient_name}! Your Shop Dashboard is Ready"
    target_login_url = login_url or (f"{settings.app_base_url.rstrip('/')}/login" if settings.app_base_url else "https://nockbill.com/login")
    gstin_display = gstin if (gstin and gstin.strip()) else "Unregistered / Standard Retail"
    license_display = license_no if (license_no and license_no.strip()) else "N/A"

    text_body = (
        f"Welcome to NockBill Solutions, {recipient_name}!\n\n"
        f"Congratulations! Your store dashboard for '{shop_name}' has been successfully provisioned.\n\n"
        f"YOUR ACCOUNT DETAILS:\n"
        f"• Business / Store: {shop_name}\n"
        f"• Login Username: {username}\n"
        f"• Role: {role_name}\n"
        f"• GSTIN: {gstin_display}\n"
        f"• Agrochemical License: {license_display}\n\n"
        f"Access your dashboard here: {target_login_url}\n\n"
        f"QUICK START GUIDE:\n"
        f"1. Add Products & Inventory (automated HSN codes & barcode generation)\n"
        f"2. Quick POS Billing (instant GST tax calculations & scannable receipts)\n"
        f"3. Real-Time Reports (GSTR-1, GSTR-3B tax exports & profit analytics)\n\n"
        f"If you have any questions, our support team is here to help at support@nockbill.com.\n\n"
        f"- The NockBill Solutions Team"
    )

    content_html = f"""
      <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 20px; padding: 4px 12px; margin-bottom: 12px;">
        <span style="color: #047857; font-size: 12px; font-weight: 700;">✨ Account Successfully Activated</span>
      </div>
      <h2 style="color: #0f172a; margin-top: 4px; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">
        Welcome to NockBill Solutions!
      </h2>
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 12px 0 24px;">
        Hello <strong>{recipient_name}</strong>,<br>
        Congratulations! Your merchant dashboard for <strong>{shop_name}</strong> is ready. You now have full access to high-speed GST billing, scannable batch-level inventory tracking, and automated tax reporting.
      </p>

      <!-- Store & Credential Card -->
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 20px 0; font-size: 14px;">
        <tr>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 38%;">Store / Business</td>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">{shop_name}</td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Login Username</td>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #059669; font-weight: 700;">{username}</td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Assigned Role</td>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">{role_name}</td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #64748b;">GSTIN</td>
          <td style="padding: 12px 18px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">{gstin_display}</td>
        </tr>
        <tr>
          <td style="padding: 12px 18px; color: #64748b;">Agro / Seed License</td>
          <td style="padding: 12px 18px; color: #0f172a; font-weight: 600;">{license_display}</td>
        </tr>
      </table>

      <!-- CTA Button -->
      <div style="margin: 28px 0; text-align: center;">
        <a href="{target_login_url}" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
          Launch Shop Dashboard &rarr;
        </a>
      </div>

      <!-- Quick Start Guide -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0 0;">
        <h3 style="color: #166534; font-size: 15px; font-weight: 700; margin: 0 0 10px;">
          🚀 Getting Started in 3 Simple Steps:
        </h3>
        <ol style="color: #14532d; font-size: 13px; line-height: 1.7; margin: 0; padding-left: 20px;">
          <li><strong>Inventory Setup:</strong> Add your products, batch numbers, expiry dates, and print barcode labels in seconds.</li>
          <li><strong>Fast POS Billing:</strong> Create clean, GST-compliant tax invoices with automatic CGST / SGST split.</li>
          <li><strong>Tax Reports:</strong> Export ready-to-file GSTR-1, GSTR-3B, and Stock Ledgers to Excel &amp; PDF anytime.</li>
        </ol>
      </div>

      <!-- Support Box -->
      <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">
        Need help setting up your store or importing existing product catalogs? Our dedicated support engineers are available at <a href="mailto:support@nockbill.com" style="color: #059669; font-weight: 600; text-decoration: none;">support@nockbill.com</a>.
      </p>
    """

    html_body = _render_email_wrapper(
        content_html=content_html,
        preview_text=f"Welcome to NockBill Solutions! Your merchant dashboard for {shop_name} is active."
    )

    return _send_via_ses(to_email, subject, text_body, html_body)
