from datetime import datetime, timedelta, timezone
import json
import secrets
import hmac
import hashlib
from typing import Optional
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Header, status, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.database.base import get_db
from app.models.models import User, UserRole, AuditAction, AuditLog, ShopSettings, PasswordResetCode
from app.schemas.schemas import (
    LoginRequest, TokenResponse, UserCreate, UserUpdate, UserResponse,
    ShopRegistrationRequest, RegistrationResponse,
    ForgotPasswordRequest, VerifyOtpRequest, ResetPasswordRequest,
    SubscriptionPaymentRequest, SubscriptionWebhookRequest, GoogleAuthRequest
)
from app.utils.auth import (
    create_user_access_token,
    get_current_user,
    get_current_user_optional,
    hash_password,
    require_owner,
    verify_password,
)
from app.utils.captcha import generate_captcha_challenge, verify_captcha_challenge
from app.utils.rate_limit import enforce_rate_limit, get_client_ip
from app.services.email_service import (
    send_password_reset_email,
    send_password_reset_confirmation_email,
    send_welcome_account_email
)
from app.config.settings import settings
from app.utils.google_auth import (
    verify_google_token, GoogleVerificationError, GoogleUnreachableError
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Password reset state lives ONLY in the password_reset_codes table. There is
# deliberately no in-memory cache: Lambda runs many independent workers and any
# per-process copy can be replayed after another worker has consumed it.
RESET_CODE_TTL_MINUTES = 15
RESET_SESSION_TTL_SECONDS = 600
RESET_MAX_OTP_ATTEMPTS = 5
RESET_MAX_TOKEN_ATTEMPTS = 3

ACCOUNT_NOT_FOUND_CODE = "ACCOUNT_NOT_FOUND"
ERR_ACCOUNT_DEACTIVATED = "Your account has been deactivated. Please contact support."
ERR_EMAIL_ALREADY_EXISTS = (
    "An account with this email already exists. Please sign in with your Google account or password."
)


def _format_shop_account_id(shop_id: Optional[int]) -> Optional[str]:
    if not shop_id:
        return None
    return f"SHOP-{int(shop_id):05d}"


def _serialize_user(user: User) -> UserResponse:
    shop_id = getattr(user, "shop_id", None)
    return UserResponse(
        id=user.id,
        name=user.name,
        username=user.username,
        email=user.email,
        phone=user.phone,
        role=user.role,
        shop_id=shop_id,
        shop_account_id=_format_shop_account_id(shop_id),
        subscription_status=user.subscription_status or "ACTIVE",
        is_active=bool(user.is_active),
        created_at=user.created_at,
    )


def _resolve_shop_account_id(db: Session, raw_account_id: str) -> Optional[int]:
    """Resolve an AWS-style Shop Account ID (e.g. 'SHOP-00001', '1', GSTIN, or shop name) to shop_id."""
    cleaned = (raw_account_id or "").strip()
    if not cleaned:
        return None
    upper = cleaned.upper()
    numeric_part = upper[5:].strip() if upper.startswith("SHOP-") else upper
    if numeric_part.isdigit():
        candidate_id = int(numeric_part)
        shop = db.query(ShopSettings).filter(ShopSettings.id == candidate_id).first()
        if shop:
            return shop.id
    shop_by_alias = db.query(ShopSettings).filter(
        or_(
            func.upper(ShopSettings.gstin) == upper,
            func.lower(ShopSettings.shop_name) == cleaned.lower(),
        )
    ).first()
    if shop_by_alias:
        return shop_by_alias.id
    owner_by_alias = db.query(User).filter(
        func.lower(User.username) == cleaned.lower(),
        User.role == UserRole.OWNER,
    ).first()
    return owner_by_alias.shop_id if owner_by_alias else None


def _get_login_url() -> str:
    return f"{settings.app_base_url.rstrip('/')}/login" if settings.app_base_url else "https://nockbill.com/login"


def _build_owner_credentials_payload(shop_record: ShopSettings, owner_user: User, login_url: str) -> dict:
    """Build non-secret credential metadata for post-registration export (never includes password)."""
    return {
        "account_id": f"SHOP-{shop_record.id:05d}",
        "shop_name": shop_record.shop_name,
        "owner_name": owner_user.name,
        "username": owner_user.username,
        "email": owner_user.email or "",
        "phone": owner_user.phone or "",
        "role": owner_user.role.value,
        "console_login_url": login_url,
        "gstin": shop_record.gstin or "UNREGISTERED",
        "fertilizer_license": shop_record.fertilizer_license_no or "N/A",
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "security_warning": "CONFIDENTIAL: Official Business Master Access Key. Keep secure and do not share.",
    }


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _purge_reset_state(db: Session, user_id: int) -> None:
    db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user_id
    ).delete(synchronize_session=False)
    db.commit()


def set_auth_cookie(response: Response, token: str) -> None:
    """
    Attach HttpOnly; Secure; SameSite=Lax cookie for XSS-proof browser sessions.
    Token is also returned in JSON response body for non-browser / mobile clients.
    """
    max_age = (settings.access_token_expire_minutes * 60) if settings.access_token_expire_minutes else 60 * 60 * 24 * 7
    is_secure = not settings.debug
    response.set_cookie(
        key="access_token",
        value=token,
        max_age=max_age,
        expires=max_age,
        path="/",
        httponly=True,
        secure=is_secure,
        samesite="lax",
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear the HttpOnly authentication cookie."""
    is_secure = not settings.debug
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        secure=is_secure,
        samesite="lax",
    )


@router.get("/captcha")
def get_login_captcha():
    """
    Generate a server-side distorted raster CAPTCHA image and a cryptographically
    signed HMAC-SHA256 challenge token. Plaintext answer never leaves the server.
    """
    token, image_data_uri = generate_captcha_challenge()
    return {
        "captcha_token": token,
        "captcha_image": image_data_uri,
    }


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    clean_identifier = (payload.username or "").strip()
    identifier_lower = clean_identifier.lower()

    enforce_rate_limit(db, "login_ip", client_ip, settings.rate_limit_login_per_15min, 900)
    enforce_rate_limit(db, "login_id", identifier_lower, settings.rate_limit_login_per_15min, 900)

    # 1. Strictly enforce server-side single-use CAPTCHA verification (DB-backed across Lambda workers)
    is_valid_captcha, captcha_error = verify_captcha_challenge(
        payload.captcha_token, payload.captcha_code, db=db
    )
    if not is_valid_captcha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=captcha_error,
        )

    raw_account_id = (payload.shop_account_id or "").strip()
    resolved_shop_id: Optional[int] = None
    if raw_account_id:
        resolved_shop_id = _resolve_shop_account_id(db, raw_account_id)
        if not resolved_shop_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Shop Account ID, IAM username, or password",
            )

    user_query = db.query(User).filter(
        or_(
            func.lower(User.username) == identifier_lower,
            func.lower(User.email) == identifier_lower,
            User.phone == clean_identifier
        )
    )
    if resolved_shop_id is not None:
        user_query = user_query.filter(User.shop_id == resolved_shop_id)
    user = user_query.first()

    if not user:
        if resolved_shop_id is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Shop Account ID, IAM username, or password",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ACCOUNT_NOT_FOUND_CODE,
                "message": "No shop account found with these details. Please register your shop.",
                "identifier": clean_identifier,
            },
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ERR_ACCOUNT_DEACTIVATED,
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username, mobile, or password",
        )
    token = create_user_access_token(user)
    set_auth_cookie(response, token)

    # Audit log
    audit = AuditLog(user_id=user.id, shop_id=user.shop_id, action=AuditAction.LOGIN, ip_address=client_ip)
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        name=user.name,
        email=user.email,
        phone=user.phone,
        shop_name=user.shop.shop_name if user.shop else None,
        role=user.role,
        subscription_status=user.subscription_status or "ACTIVE",
    )


@router.post("/register", response_model=RegistrationResponse, status_code=201)
def register_shop(payload: ShopRegistrationRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    enforce_rate_limit(db, "register_ip", client_ip, settings.rate_limit_register_per_hour, 3600)

    # Enforce single-use CAPTCHA on registration to stop bot/spam shop creation
    is_valid_captcha, captcha_error = verify_captcha_challenge(
        payload.captcha_token, payload.captcha_code, db=db
    )
    if not is_valid_captcha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=captcha_error,
        )

    clean_username = (payload.username or "").strip()[:50]
    clean_email = (payload.email or "").strip()[:150] if payload.email else None
    clean_phone = (payload.phone or "").strip()[:20] if payload.phone else None
    clean_owner = (payload.owner_name or "").strip()[:100] or clean_username
    clean_shop_name = (payload.shop_name or "").strip()[:200] or f"{clean_owner}'s Shop"

    # 1. Check if username or email already exists
    existing_user = db.query(User).filter(func.lower(User.username) == clean_username.lower()).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username is already taken. Please choose another.")
    
    if clean_email:
        existing_email = db.query(User).filter(func.lower(User.email) == clean_email.lower()).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # 2. Create ShopSettings FIRST so foreign key users.shop_id -> shop_settings.id
    #    always points to a valid row even on a fresh, unseeded RDS database.
    shop_record = ShopSettings(
        shop_name=clean_shop_name,
        proprietor_name=(payload.proprietor_name.strip()[:200] if payload.proprietor_name else clean_owner[:200]),
        subscription_status="PENDING",
        phone=clean_phone,
        email=clean_email,
        address_line1=payload.address_line1.strip()[:500] if payload.address_line1 else None,
        address_line2=payload.address_line2.strip()[:500] if payload.address_line2 else None,
        city=payload.city.strip()[:100] if payload.city else None,
        state=payload.state.strip()[:100] if payload.state else None,
        pincode=payload.pincode.strip()[:10] if payload.pincode else None,
        gstin=payload.gstin.strip().upper()[:20] if payload.gstin else None,
        fertilizer_license_no=payload.fertilizer_license_no.strip()[:100] if payload.fertilizer_license_no else None,
        pesticide_license_no=payload.pesticide_license_no.strip()[:100] if payload.pesticide_license_no else None,
        seed_license_no=payload.seed_license_no.strip()[:100] if payload.seed_license_no else None,
        bank_name=payload.bank_name.strip()[:200] if payload.bank_name else None,
        bank_account_no=payload.bank_account_no.strip()[:50] if payload.bank_account_no else None,
        bank_ifsc=payload.bank_ifsc.strip().upper()[:20] if payload.bank_ifsc else None,
        bank_branch=payload.bank_branch.strip()[:200] if payload.bank_branch else None,
        upi_id=payload.upi_id.strip()[:100] if payload.upi_id else None,
        default_gst_rate=payload.default_gst_rate if payload.default_gst_rate is not None else 18,
        invoice_prefix=payload.invoice_prefix.strip().upper()[:10] if payload.invoice_prefix else "INV",
        invoice_counter=1,
    )
    db.add(shop_record)
    db.flush()

    # 3. Create Owner User linked to shop_record.id
    new_user = User(
        name=clean_owner,
        username=clean_username,
        email=clean_email,
        phone=clean_phone,
        password_hash=hash_password(payload.password),
        role=UserRole.OWNER,
        shop_id=shop_record.id,
        subscription_status="PENDING",
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    # Audit log
    audit = AuditLog(
        user_id=new_user.id,
        action=AuditAction.LOGIN,
        description=f"New shop registered: {shop_record.shop_name} by {new_user.name} (Shop ID: {shop_record.id})"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_user)

    # 4. Generate Auth Token bound to token_version (S6)
    token = create_user_access_token(new_user)
    set_auth_cookie(response, token)

    # 5. Business credential export payload
    base_login_url = _get_login_url()

    # 6. Dispatch Welcome Email
    if clean_email:
        try:
            send_welcome_account_email(
                to_email=clean_email,
                recipient_name=clean_owner,
                username=clean_username,
                shop_name=shop_record.shop_name,
                login_url=base_login_url,
                gstin=shop_record.gstin,
                license_no=shop_record.fertilizer_license_no,
                role_name="Store Owner / Administrator"
            )
        except Exception as exc:
            logger.warning("Could not dispatch welcome email to %s: %s", clean_email, exc)

    # Never echo raw plaintext passwords back in HTTP response bodies (H5).
    credentials = _build_owner_credentials_payload(shop_record, new_user, base_login_url)

    return RegistrationResponse(
        access_token=token,
        token_type="bearer",
        user_id=new_user.id,
        username=new_user.username,
        name=new_user.name,
        email=new_user.email,
        phone=new_user.phone,
        role=new_user.role,
        shop_name=shop_record.shop_name,
        subscription_status="PENDING",
        credentials=credentials,
    )


@router.post("/activate-subscription")
def activate_subscription(
    payload: SubscriptionPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """
    Self-service demo activation is strictly forbidden in production/staging or
    whenever SUBSCRIPTION_PAYMENT_MODE != 'demo'. In live mode, subscriptions must
    be activated via the cryptographically signed /api/auth/subscription-webhook endpoint.
    """
    if not settings.demo_activation_allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-service subscription activation is disabled. Complete payment verification through the payment gateway.",
        )

    shop_id = getattr(current_user, "shop_id", None)
    if not shop_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is not linked to a valid shop.",
        )

    clean_ref = (payload.payment_ref or "DEMO-ACTIVATION").strip()

    current_user.subscription_status = "ACTIVE"
    shop = db.query(ShopSettings).filter(ShopSettings.id == shop_id).first()
    if shop:
        shop.subscription_status = "ACTIVE"

    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.SETTINGS_UPDATE,
        description=f"Subscription activated in demo mode: {payload.plan_name} (demo mode, no payment processed) Ref: {clean_ref}",
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": "Demo activation—no payment processed.",
        "subscription_status": "ACTIVE",
        "demo": True,
        "payment_verified": False,
        "payment_ref": clean_ref,
        "activated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/subscription-webhook")
async def subscription_payment_webhook(
    request: Request,
    x_payment_signature: str = Header(default="", alias="X-Payment-Signature"),
    db: Session = Depends(get_db),
):
    """
    Server-to-server payment webhook that activates a shop subscription only after
    verifying the HMAC-SHA256 signature computed with PAYMENT_WEBHOOK_SECRET.
    """
    webhook_secret = (settings.payment_webhook_secret or "").strip()
    if not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment webhook verification is not configured.",
        )

    raw_body = await request.body()
    expected_sig = hmac.new(
        webhook_secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    provided_sig = (x_payment_signature or "").strip()
    if not provided_sig or not hmac.compare_digest(expected_sig, provided_sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid payment webhook signature.",
        )

    try:
        parsed = SubscriptionWebhookRequest.model_validate(json.loads(raw_body.decode("utf-8")))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed webhook payload.")

    if parsed.event != "payment.captured":
        return {"success": True, "ignored": True, "event": parsed.event}

    shop = db.query(ShopSettings).filter(ShopSettings.id == parsed.shop_id).first()
    if not shop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop not found.")

    shop.subscription_status = "ACTIVE"
    db.query(User).filter(User.shop_id == parsed.shop_id).update(
        {User.subscription_status: "ACTIVE"}, synchronize_session=False
    )
    db.add(AuditLog(
        user_id=None,
        action=AuditAction.SETTINGS_UPDATE,
        reference_id=parsed.shop_id,
        reference_type="ShopSettings",
        description=f"Verified subscription payment webhook: plan={parsed.plan_name}, ref={parsed.payment_ref}",
    ))
    db.commit()

    return {
        "success": True,
        "subscription_status": "ACTIVE",
        "payment_verified": True,
        "shop_id": parsed.shop_id,
        "payment_ref": parsed.payment_ref,
        "activated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/forgot-password/request")
def forgot_password_request(payload: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    ident = (payload.identifier or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Please enter your email, username, or phone number.")

    client_ip = get_client_ip(request)
    enforce_rate_limit(db, "otp_req_ip", client_ip, settings.rate_limit_otp_request_per_hour, 3600)
    enforce_rate_limit(db, "otp_req_id", ident.lower(), settings.rate_limit_otp_request_per_hour, 3600)

    user = db.query(User).filter(
        or_(
            func.lower(User.username) == ident.lower(),
            func.lower(User.email) == ident.lower(),
            User.phone == ident
        )
    ).first()

    # Generic response if user is not found to prevent user enumeration
    if not user:
        return {
            "success": True,
            "message": "If an account matches that identifier, a 6-digit verification code has been dispatched.",
            "email_sent": False,
            "masked_target": "your registered account",
        }

    # Generate cryptographically secure 6-digit numeric verification code
    otp = f"{secrets.randbelow(900000) + 100000}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_CODE_TTL_MINUTES)

    # The database is the ONLY authority for reset state (no per-worker memory).
    # Issuing a new code invalidates every earlier code/session for this user.
    try:
        db.query(PasswordResetCode).filter(
            PasswordResetCode.user_id == user.id
        ).delete(synchronize_session=False)
        db.add(PasswordResetCode(
            user_id=user.id,
            username=user.username,
            code_hash=_sha256(otp),
            reset_secret=None,
            verified=False,
            verified_token=None,
            verified_at=None,
            attempts=0,
            reset_attempts=0,
            expires_at=expires_at,
        ))
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Could not persist password reset code: %s", exc)
        # Never email a code that cannot be verified.
        raise HTTPException(
            status_code=503,
            detail="Password reset is temporarily unavailable. Please try again shortly.",
        )

    # The link only opens the reset dialog for this account; the code itself is
    # delivered in the email body and never placed in a URL.
    base_url = settings.app_base_url.rstrip("/")
    reset_link = f"{base_url}/login?action=reset&user={quote(user.username)}"

    # Target email: prefer user's direct email, or fallback to shop email
    target_email = user.email
    if not target_email and user.shop:
        target_email = user.shop.email

    email_dispatched = False
    if target_email:
        email_dispatched = send_password_reset_email(
            to_email=target_email,
            recipient_name=user.name or user.username,
            otp_code=otp,
            reset_link=reset_link,
        )

    # Masked recipient identifier for frontend confirmation
    if target_email and "@" in target_email:
        parts = target_email.split("@")
        name_part = parts[0]
        masked = (name_part[:2] + "•••@" + parts[1]) if len(name_part) > 2 else f"•••@{parts[1]}"
    elif user.phone and len(user.phone) >= 7:
        masked = user.phone[:3] + "•••" + user.phone[-3:]
    else:
        masked = "your registered account"

    # In local debug mode, log to server logger ONLY; NEVER return OTP in API response
    if not email_dispatched and settings.debug:
        logger.info("[LOCAL DEV] Password reset OTP for %s: %s", user.username, otp)

    return {
        "success": True,
        "message": f"If an account matches that identifier, a 6-digit verification code has been dispatched to {masked}.",
        "email_sent": email_dispatched,
        "masked_target": masked,
    }


@router.post("/forgot-password/verify")
def verify_reset_otp(payload: VerifyOtpRequest, request: Request, db: Session = Depends(get_db)):
    ident = (payload.identifier or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Account identifier is required.")

    client_ip = get_client_ip(request)
    enforce_rate_limit(db, "otp_verify_ip", client_ip, settings.rate_limit_otp_verify_per_15min, 900)
    enforce_rate_limit(db, "otp_verify_id", ident.lower(), settings.rate_limit_otp_verify_per_15min, 900)

    user = db.query(User).filter(
        or_(
            func.lower(User.username) == ident.lower(),
            func.lower(User.email) == ident.lower(),
            User.phone == ident
        )
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification code or account not found.")

    provided_code = (payload.otp_code or "").strip()
    if len(provided_code) != 6 or not provided_code.isdigit():
        raise HTTPException(status_code=400, detail="Verification code must be a 6-digit number.")

    expired_msg = "Verification code has expired or was replaced. Please request a new code."
    now = datetime.now(timezone.utc)

    # Only the newest pending (unverified) code for this user is ever considered.
    entry = (
        db.query(PasswordResetCode)
        .filter(PasswordResetCode.user_id == user.id, PasswordResetCode.verified.is_(False))
        .order_by(PasswordResetCode.id.desc())
        .first()
    )
    entry_expires_at = (
        entry.expires_at.replace(tzinfo=timezone.utc)
        if (entry and entry.expires_at and entry.expires_at.tzinfo is None)
        else (entry.expires_at if entry else None)
    )
    if not entry or not entry_expires_at or now > entry_expires_at:
        raise HTTPException(status_code=400, detail=expired_msg)
    if (entry.attempts or 0) >= RESET_MAX_OTP_ATTEMPTS:
        _purge_reset_state(db, user.id)
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect attempts. Please request a new 6-digit verification code.",
        )

    if not hmac.compare_digest(_sha256(provided_code), entry.code_hash or ""):
        # Atomic increment: concurrent guesses on other workers cannot share a stale counter.
        db.query(PasswordResetCode).filter(PasswordResetCode.id == entry.id).update(
            {PasswordResetCode.attempts: PasswordResetCode.attempts + 1},
            synchronize_session=False,
        )
        db.commit()
        db.refresh(entry)
        remaining = max(0, RESET_MAX_OTP_ATTEMPTS - (entry.attempts or 0))
        if remaining == 0:
            _purge_reset_state(db, user.id)
            raise HTTPException(
                status_code=429,
                detail="Too many incorrect attempts. Please request a new 6-digit verification code.",
            )
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect 6-digit verification code ({remaining} attempts remaining).",
        )

    # Atomic compare-and-swap: exactly one request can consume this code. The OTP hash
    # is overwritten so the code can never be replayed, and only the HASH of the
    # single-use reset token is stored.
    verified_token = secrets.token_urlsafe(32)
    consumed = db.query(PasswordResetCode).filter(
        PasswordResetCode.id == entry.id,
        PasswordResetCode.verified.is_(False),
        PasswordResetCode.code_hash == entry.code_hash,
        PasswordResetCode.attempts < RESET_MAX_OTP_ATTEMPTS,
        PasswordResetCode.expires_at > now,
    ).update(
        {
            PasswordResetCode.code_hash: "CONSUMED",
            PasswordResetCode.verified: True,
            PasswordResetCode.verified_token: _sha256(verified_token),
            PasswordResetCode.verified_at: now,
        },
        synchronize_session=False,
    )
    db.commit()
    if consumed != 1:
        raise HTTPException(status_code=400, detail=expired_msg)

    return {
        "success": True,
        "verified": True,
        "reset_token": verified_token,
        "message": "Code verified! Please set your new password."
    }


@router.post("/forgot-password/reset")
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    ident = (payload.identifier or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Identifier is required.")

    client_ip = get_client_ip(request)
    enforce_rate_limit(db, "otp_reset_ip", client_ip, settings.rate_limit_otp_verify_per_15min, 900)

    user = db.query(User).filter(
        or_(
            func.lower(User.username) == ident.lower(),
            func.lower(User.email) == ident.lower(),
            User.phone == ident
        )
    ).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification session or user not found.")

    # Validate the new password BEFORE consuming the session so a typo does not burn it.
    new_pwd = (payload.new_password or "").strip()
    if len(new_pwd) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    invalid_msg = "The verification session is invalid or already used. Please verify your 6-digit code again."
    now = datetime.now(timezone.utc)
    freshness_cutoff = now - timedelta(seconds=RESET_SESSION_TTL_SECONDS)

    entry = (
        db.query(PasswordResetCode)
        .filter(PasswordResetCode.user_id == user.id, PasswordResetCode.verified.is_(True))
        .order_by(PasswordResetCode.id.desc())
        .first()
    )
    if not entry or not entry.verified_token:
        raise HTTPException(status_code=400, detail=invalid_msg)

    entry_expires_at = (
        entry.expires_at.replace(tzinfo=timezone.utc)
        if (entry.expires_at and entry.expires_at.tzinfo is None)
        else entry.expires_at
    )
    entry_verified_at = (
        entry.verified_at.replace(tzinfo=timezone.utc)
        if (entry.verified_at and entry.verified_at.tzinfo is None)
        else entry.verified_at
    )
    if (entry_expires_at and now > entry_expires_at) or (entry_verified_at and entry_verified_at < freshness_cutoff):
        _purge_reset_state(db, user.id)
        raise HTTPException(
            status_code=400,
            detail="The verification session has expired. Please request a new code.",
        )

    if (entry.reset_attempts or 0) >= RESET_MAX_TOKEN_ATTEMPTS:
        _purge_reset_state(db, user.id)
        raise HTTPException(
            status_code=429,
            detail="Too many failed reset attempts. Please request a new verification code.",
        )

    provided_hash = _sha256((payload.reset_token or "").strip())
    if not hmac.compare_digest(provided_hash, entry.verified_token):
        db.query(PasswordResetCode).filter(PasswordResetCode.id == entry.id).update(
            {PasswordResetCode.reset_attempts: PasswordResetCode.reset_attempts + 1},
            synchronize_session=False,
        )
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Invalid reset verification token. Please verify your code again.",
        )

    # Atomic single-use consumption: the conditional DELETE succeeds for exactly one
    # request. In PostgreSQL a concurrent duplicate blocks on the row lock and then
    # deletes 0 rows, so a token can never be replayed - on this or any other worker.
    consumed = db.query(PasswordResetCode).filter(
        PasswordResetCode.id == entry.id,
        PasswordResetCode.verified.is_(True),
        PasswordResetCode.verified_token == provided_hash,
        PasswordResetCode.expires_at > now,
        PasswordResetCode.verified_at >= freshness_cutoff,
    ).delete(synchronize_session=False)
    if consumed != 1:
        db.rollback()
        raise HTTPException(status_code=400, detail=invalid_msg)

    # Same transaction: drop any other outstanding codes, change password, bump token_version to revoke all active JWTs (S6), audit.
    db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user.id
    ).delete(synchronize_session=False)
    user.password_hash = hash_password(new_pwd)
    user.token_version = int(getattr(user, "token_version", 1) or 1) + 1
    db.add(AuditLog(
        user_id=user.id,
        shop_id=user.shop_id,
        action=AuditAction.SETTINGS_UPDATE,
        description=f"Password reset completed and active sessions revoked for user {user.username}"
    ))
    db.commit()

    # Dispatch password reset confirmation email
    target_email = user.email
    if not target_email and user.shop and user.shop.email:
        target_email = user.shop.email
    if target_email:
        try:
            shop_title = user.shop.shop_name if user.shop else "Your Shop"
            send_password_reset_confirmation_email(
                to_email=target_email,
                recipient_name=user.name or user.username,
                username=user.username,
                shop_name=shop_title,
            )
        except Exception as exc:
            logger.warning("Could not dispatch password reset confirmation email to %s: %s", target_email, exc)

    return {"success": True, "message": "Password updated successfully! You can now sign in with your new password."}


def _resolve_google_username(db: Session, requested_username: Optional[str], clean_email: str) -> str:
    """Resolve and validate a unique username for a new Google-registered shop owner."""
    if requested_username and requested_username.strip():
        candidate = requested_username.strip()[:50]
        if len(candidate) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be at least 3 characters.",
            )
        existing = db.query(User).filter(func.lower(User.username) == candidate.lower()).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken. Please choose another.",
            )
        return candidate

    base_username = clean_email.split("@")[0].replace(".", "_").replace("-", "_")
    if len(base_username) < 3:
        base_username = f"{base_username}_shop"
    candidate_username = base_username[:40]
    suffix = 1
    while db.query(User).filter(func.lower(User.username) == candidate_username.lower()).first():
        candidate_username = f"{base_username[:35]}_{suffix}"
        suffix += 1
    return candidate_username


def _create_google_shop_and_user(
    db: Session,
    payload: GoogleAuthRequest,
    clean_email: str,
    full_name: str,
    google_sub: str,
) -> tuple[ShopSettings, User]:
    """Create a complete ShopSettings and hybrid Google+Password Owner User record."""
    clean_pwd = (payload.password or "").strip()
    if clean_pwd and len(clean_pwd) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters.",
        )
    chosen_password = clean_pwd if len(clean_pwd) >= 6 else secrets.token_urlsafe(24)

    candidate_username = _resolve_google_username(db, payload.username, clean_email)
    clean_owner = (payload.owner_name or "").strip()[:100] or full_name[:100]
    shop_title = (payload.shop_name or "").strip()[:200] or f"{clean_owner[:150]}'s Shop"
    proprietor_title = (payload.proprietor_name or "").strip()[:200] or clean_owner[:200]
    clean_phone = payload.phone.strip()[:20] if (payload.phone and payload.phone.strip()) else None
    initial_sub_status = "ACTIVE" if settings.demo_activation_allowed else "PENDING"

    new_shop = ShopSettings(
        shop_name=shop_title,
        proprietor_name=proprietor_title,
        email=clean_email[:150],
        phone=clean_phone,
        address_line1=payload.address_line1.strip()[:500] if payload.address_line1 else None,
        address_line2=payload.address_line2.strip()[:500] if payload.address_line2 else None,
        city=payload.city.strip()[:100] if payload.city else None,
        state=payload.state.strip()[:100] if payload.state else None,
        pincode=payload.pincode.strip()[:10] if payload.pincode else None,
        gstin=payload.gstin.strip().upper()[:20] if (payload.gstin and payload.gstin.strip()) else None,
        fertilizer_license_no=payload.fertilizer_license_no.strip()[:100] if payload.fertilizer_license_no else None,
        pesticide_license_no=payload.pesticide_license_no.strip()[:100] if payload.pesticide_license_no else None,
        seed_license_no=payload.seed_license_no.strip()[:100] if payload.seed_license_no else None,
        bank_name=payload.bank_name.strip()[:200] if payload.bank_name else None,
        bank_account_no=payload.bank_account_no.strip()[:50] if payload.bank_account_no else None,
        bank_ifsc=payload.bank_ifsc.strip().upper()[:20] if payload.bank_ifsc else None,
        bank_branch=payload.bank_branch.strip()[:200] if payload.bank_branch else None,
        upi_id=payload.upi_id.strip()[:100] if payload.upi_id else None,
        default_gst_rate=payload.default_gst_rate if payload.default_gst_rate is not None else 18,
        invoice_prefix=payload.invoice_prefix.strip().upper()[:10] if payload.invoice_prefix else "INV",
        invoice_counter=1,
        currency="INR",
        subscription_status=initial_sub_status,
    )
    db.add(new_shop)
    db.flush()

    user = User(
        name=clean_owner,
        username=candidate_username,
        email=clean_email[:150],
        phone=clean_phone,
        google_sub=google_sub,
        password_hash=hash_password(chosen_password),
        role=UserRole.OWNER,
        shop_id=new_shop.id,
        subscription_status=initial_sub_status,
        is_active=True,
    )
    db.add(user)
    db.flush()

    if clean_email:
        try:
            send_welcome_account_email(
                to_email=clean_email,
                recipient_name=clean_owner,
                username=candidate_username,
                shop_name=new_shop.shop_name,
                login_url=_get_login_url(),
                gstin=new_shop.gstin,
                license_no=new_shop.fertilizer_license_no,
                role_name="Store Owner",
            )
        except Exception as exc:
            logger.warning("Could not dispatch welcome email to new Google user %s: %s", clean_email, exc)

    return new_shop, user


@router.post("/google", response_model=TokenResponse)
def google_auth(payload: GoogleAuthRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Production-grade Google Sign-In verification endpoint.
    Verifies the Google ID Token, validates audience/issuer and google_sub,
    and logs in an existing Google-linked account or creates a new merchant shop.
    """
    client_ip = get_client_ip(request)
    enforce_rate_limit(db, "google_auth_ip", client_ip, settings.rate_limit_login_per_15min, 900)

    token_str = (payload.credential or "").strip()
    if not token_str:
        raise HTTPException(status_code=400, detail="Google credential token is missing.")

    try:
        google_data = verify_google_token(token_str, settings.google_client_id)
    except GoogleUnreachableError:
        logger.error(
            "Google sign-in: backend cannot reach Google (no outbound internet from Lambda/VPC)."
        )
        raise HTTPException(
            status_code=503,
            detail="Google sign-in is temporarily unavailable. Please sign in with your email and password.",
        )
    except GoogleVerificationError as exc:
        logger.warning("Google sign-in verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Google sign-in verification failed.")

    google_email = google_data.get("email")
    email_verified = google_data.get("email_verified") or google_data.get("verified_email")
    if not google_email or str(email_verified).lower() not in ("true", "1", "yes"):
        raise HTTPException(status_code=400, detail="Google account email is not verified.")

    google_sub = str(google_data.get("sub") or "").strip()[:64]
    if not google_sub:
        raise HTTPException(status_code=401, detail="Google account subject identifier is missing.")

    full_name = google_data.get("name") or google_data.get("given_name") or google_email.split("@")[0]
    clean_email = google_email.strip().lower()
    auth_mode = (payload.mode or "auto").strip().lower()

    # Look up strictly by immutable Google subject first to prevent cross-account hijacking (H5)
    user = db.query(User).filter(User.google_sub == google_sub).first()
    existing_by_email = db.query(User).filter(func.lower(User.email) == clean_email).first()

    if auth_mode == "preflight":
        if user or existing_by_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=ERR_EMAIL_ALREADY_EXISTS,
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": ACCOUNT_NOT_FOUND_CODE,
                "message": "No shop account found for this Google account. Complete your shop setup to register.",
                "email": clean_email,
                "name": full_name,
            },
        )

    if user and auth_mode == "register":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ERR_EMAIL_ALREADY_EXISTS,
        )

    if not user and existing_by_email:
        # Never allow linking if already bound to a different Google subject, during explicit
        # registration, or whenever a password overwrite is attempted (H5).
        if (
            existing_by_email.google_sub
            and existing_by_email.google_sub != google_sub
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is already linked to a different Google account.",
            )
        if auth_mode == "login" and not (payload.password or "").strip():
            # Existing account created before google_sub existed (or registered with this
            # verified Gmail): link google_sub cleanly without modifying password_hash.
            existing_by_email.google_sub = google_sub
            db.add(AuditLog(
                user_id=existing_by_email.id,
                shop_id=existing_by_email.shop_id,
                action=AuditAction.SETTINGS_UPDATE,
                description=f"Linked verified Google account ({clean_email}) to existing user {existing_by_email.username}",
            ))
            db.flush()
            user = existing_by_email
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=ERR_EMAIL_ALREADY_EXISTS,
            )

    created_credentials: Optional[dict] = None
    if not user:
        if auth_mode == "login":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": ACCOUNT_NOT_FOUND_CODE,
                    "message": "No shop account found for this Google account. Complete your shop setup to register.",
                    "email": clean_email,
                    "name": full_name,
                },
            )

        new_shop, user = _create_google_shop_and_user(db, payload, clean_email, full_name, google_sub)
        created_credentials = _build_owner_credentials_payload(new_shop, user, _get_login_url())
    else:
        # Never overwrite an existing user's password_hash during Google Sign-In
        if payload.phone and payload.phone.strip() and not user.phone:
            user.phone = payload.phone.strip()[:20]
        if payload.shop_name and payload.shop_name.strip() and user.shop:
            if user.shop.shop_name in ("My Fertilizer Shop", "My Agro Store", f"{full_name}'s Agro Store"):
                user.shop.shop_name = payload.shop_name.strip()[:200]
        db.flush()

    if not user.is_active:
        raise HTTPException(status_code=403, detail=ERR_ACCOUNT_DEACTIVATED)

    # Generate application JWT bound to user.token_version (S6)
    jwt_token = create_user_access_token(user)
    set_auth_cookie(response, jwt_token)

    audit = AuditLog(
        user_id=user.id,
        shop_id=user.shop_id,
        action=AuditAction.LOGIN,
        description=f"Successful Sign-in with Google ({clean_email})"
    )
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=jwt_token,
        user_id=user.id,
        username=user.username,
        name=user.name,
        email=user.email,
        phone=user.phone,
        shop_name=user.shop.shop_name if user.shop else None,
        role=user.role,
        subscription_status=user.subscription_status or "ACTIVE",
        credentials=created_credentials,
    )


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Revoke all active JWTs server-side by bumping token_version and clear the HttpOnly cookie (S6)."""
    if current_user is not None:
        current_user.token_version = int(getattr(current_user, "token_version", 1) or 1) + 1
        db.add(AuditLog(
            user_id=current_user.id,
            shop_id=current_user.shop_id,
            action=AuditAction.LOGOUT,
            description=f"User {current_user.username} logged out and revoked active tokens",
        ))
        db.commit()
    clear_auth_cookie(response)
    return {"success": True, "message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return _serialize_user(current_user)


@router.get("/users", response_model=list[UserResponse])
def list_shop_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """List all IAM users belonging to the authenticated owner's shop."""
    users = (
        db.query(User)
        .filter(User.shop_id == current_user.shop_id)
        .order_by(User.id.asc())
        .all()
    )
    return [_serialize_user(u) for u in users]


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    existing = db.query(User).filter(func.lower(User.username) == payload.username.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists. Please choose another.")
    if payload.email:
        existing_email = db.query(User).filter(func.lower(User.email) == payload.email.lower()).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="An account with this email already exists.")
    user = User(
        name=payload.name,
        username=payload.username,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=payload.role,
        shop_id=current_user.shop_id,
        subscription_status=current_user.subscription_status or "ACTIVE",
        is_active=True,
    )
    db.add(user)
    db.flush()
    db.add(AuditLog(
        user_id=current_user.id,
        shop_id=current_user.shop_id,
        action=AuditAction.SETTINGS_UPDATE,
        description=f"Created IAM user {user.username} ({user.role.value})",
    ))
    db.commit()
    db.refresh(user)

    # Dispatch Welcome Email to newly created sub-user
    if user.email and user.email.strip():
        try:
            account_id = _format_shop_account_id(current_user.shop_id) or ""
            login_url = f"{_get_login_url()}?account={account_id}" if account_id else _get_login_url()
            shop_title = current_user.shop.shop_name if current_user.shop else "NockBill Solutions"
            role_label = "Store Owner" if user.role == UserRole.OWNER else "Staff / Cashier (IAM)"
            send_welcome_account_email(
                to_email=user.email.strip(),
                recipient_name=user.name,
                username=user.username,
                shop_name=shop_title,
                login_url=login_url,
                role_name=role_label
            )
        except Exception as exc:
            logger.warning("Could not dispatch welcome email to user %s: %s", user.email, exc)

    return _serialize_user(user)


@router.put("/users/{user_id}", response_model=UserResponse)
def update_shop_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Update an IAM user strictly within the authenticated owner's shop."""
    target = (
        db.query(User)
        .filter(User.id == user_id, User.shop_id == current_user.shop_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="IAM user not found in your shop.")

    if target.id == current_user.id:
        if payload.is_active is False:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own active owner account.")
        if payload.role is not None and payload.role != UserRole.OWNER:
            raise HTTPException(status_code=400, detail="You cannot demote your own active owner account.")

    if payload.username is not None and payload.username.lower() != target.username.lower():
        dup_user = db.query(User).filter(
            func.lower(User.username) == payload.username.lower(),
            User.id != target.id,
        ).first()
        if dup_user:
            raise HTTPException(status_code=400, detail="Username already exists. Please choose another.")
        target.username = payload.username

    if payload.email is not None:
        if payload.email and (not target.email or payload.email.lower() != target.email.lower()):
            dup_email = db.query(User).filter(
                func.lower(User.email) == payload.email.lower(),
                User.id != target.id,
            ).first()
            if dup_email:
                raise HTTPException(status_code=400, detail="An account with this email already exists.")
        target.email = payload.email

    if payload.name is not None:
        target.name = payload.name
    if payload.phone is not None:
        target.phone = payload.phone
    if payload.role is not None:
        target.role = payload.role

    should_revoke_tokens = False
    if payload.is_active is not None:
        if not payload.is_active and target.is_active:
            should_revoke_tokens = True
        target.is_active = payload.is_active

    if payload.password:
        target.password_hash = hash_password(payload.password)
        should_revoke_tokens = True

    if should_revoke_tokens:
        target.token_version = int(getattr(target, "token_version", 1) or 1) + 1

    db.add(AuditLog(
        user_id=current_user.id,
        shop_id=current_user.shop_id,
        action=AuditAction.SETTINGS_UPDATE,
        description=f"Updated IAM user {target.username} (ID: {target.id})",
    ))
    db.commit()
    db.refresh(target)
    return _serialize_user(target)


@router.delete("/users/{user_id}")
def delete_shop_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Permanently delete an IAM user strictly within the authenticated owner's shop."""
    target = (
        db.query(User)
        .filter(User.id == user_id, User.shop_id == current_user.shop_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=404, detail="IAM user not found in your shop.")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own active owner account.")

    deleted_username = target.username
    db.query(PasswordResetCode).filter(PasswordResetCode.user_id == target.id).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.user_id == target.id).update(
        {AuditLog.user_id: None}, synchronize_session=False
    )
    db.delete(target)
    db.add(AuditLog(
        user_id=current_user.id,
        shop_id=current_user.shop_id,
        action=AuditAction.SETTINGS_UPDATE,
        description=f"Deleted IAM user {deleted_username} (ID: {user_id})",
    ))
    db.commit()
    return {"success": True, "message": f"IAM user '{deleted_username}' deleted."}

