from datetime import datetime, timedelta
import secrets
import hmac
import hashlib
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.database.base import get_db
from app.models.models import User, UserRole, AuditAction, AuditLog, ShopSettings, PasswordResetCode
from app.schemas.schemas import (
    LoginRequest, TokenResponse, UserCreate, UserResponse,
    ShopRegistrationRequest, RegistrationResponse,
    ForgotPasswordRequest, VerifyOtpRequest, ResetPasswordRequest,
    SubscriptionPaymentRequest, GoogleAuthRequest
)
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user
from app.utils.captcha import generate_captcha_challenge, verify_captcha_challenge
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


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _purge_reset_state(db: Session, user_id: int) -> None:
    db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user_id
    ).delete(synchronize_session=False)
    db.commit()


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
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    # 1. Strictly enforce server-side single-use CAPTCHA verification first
    is_valid_captcha, captcha_error = verify_captcha_challenge(
        payload.captcha_token, payload.captcha_code
    )
    if not is_valid_captcha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=captcha_error,
        )

    clean_identifier = (payload.username or "").strip()
    identifier_lower = clean_identifier.lower()

    user = db.query(User).filter(
        or_(
            func.lower(User.username) == identifier_lower,
            func.lower(User.email) == identifier_lower,
            User.phone == clean_identifier
        ),
        User.is_active == True
    ).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username, mobile, or password",
        )
    token = create_access_token({"sub": str(user.id)})

    # Audit log
    audit = AuditLog(user_id=user.id, action=AuditAction.LOGIN)
    db.add(audit)
    db.commit()

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        name=user.name,
        role=user.role,
        subscription_status=user.subscription_status or "ACTIVE",
    )


@router.post("/register", response_model=RegistrationResponse, status_code=201)
def register_shop(payload: ShopRegistrationRequest, db: Session = Depends(get_db)):
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

    # 4. Generate Auth Token
    token = create_access_token({"sub": str(new_user.id)})

    # 5. Business credential export payload
    base_login_url = f"{settings.app_base_url.rstrip('/')}/login" if settings.app_base_url else "https://nockbill.com/login"

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

    credentials = {
        "account_id": f"SHOP-{shop_record.id:05d}",
        "shop_name": shop_record.shop_name,
        "owner_name": new_user.name,
        "username": new_user.username,
        "email": new_user.email or "",
        "phone": new_user.phone or "",
        "role": new_user.role.value,
        "initial_password": payload.password,
        "console_login_url": base_login_url,
        "gstin": shop_record.gstin or "UNREGISTERED",
        "fertilizer_license": shop_record.fertilizer_license_no or "N/A",
        "created_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "security_warning": "CONFIDENTIAL: Official Business Master Access Key. Keep secure and do not share.",
    }

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
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the shop owner can manage or activate subscriptions."
        )

    shop_id = getattr(current_user, "shop_id", None)
    if not shop_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is not linked to a valid shop."
        )

    clean_ref = (payload.payment_ref or "DEMO-ACTIVATION").strip()

    current_user.subscription_status = "ACTIVE"
    shop = db.query(ShopSettings).filter(ShopSettings.id == shop_id).first()
    if shop:
        shop.subscription_status = "ACTIVE"

    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.SETTINGS_UPDATE,
        description=f"Subscription activated in demo mode: {payload.plan_name} (demo mode, no payment processed) Ref: {clean_ref}"
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
        "activated_at": datetime.utcnow().isoformat()
    }


@router.post("/forgot-password/request")
def forgot_password_request(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    ident = (payload.identifier or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Please enter your email, username, or phone number.")

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
    expires_at = datetime.utcnow() + timedelta(minutes=RESET_CODE_TTL_MINUTES)

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
def verify_reset_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    ident = (payload.identifier or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Account identifier is required.")

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
    now = datetime.utcnow()

    # Only the newest pending (unverified) code for this user is ever considered.
    entry = (
        db.query(PasswordResetCode)
        .filter(PasswordResetCode.user_id == user.id, PasswordResetCode.verified.is_(False))
        .order_by(PasswordResetCode.id.desc())
        .first()
    )
    if not entry or now > entry.expires_at:
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
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    ident = (payload.identifier or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Identifier is required.")

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
    now = datetime.utcnow()
    freshness_cutoff = now - timedelta(seconds=RESET_SESSION_TTL_SECONDS)

    entry = (
        db.query(PasswordResetCode)
        .filter(PasswordResetCode.user_id == user.id, PasswordResetCode.verified.is_(True))
        .order_by(PasswordResetCode.id.desc())
        .first()
    )
    if not entry or not entry.verified_token:
        raise HTTPException(status_code=400, detail=invalid_msg)

    if now > entry.expires_at or (entry.verified_at and entry.verified_at < freshness_cutoff):
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

    # Same transaction: drop any other outstanding codes, change password, audit.
    db.query(PasswordResetCode).filter(
        PasswordResetCode.user_id == user.id
    ).delete(synchronize_session=False)
    user.password_hash = hash_password(new_pwd)
    db.add(AuditLog(
        user_id=user.id,
        action=AuditAction.SETTINGS_UPDATE,
        description=f"Password reset completed for user {user.username}"
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


@router.post("/google", response_model=TokenResponse)
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Production-grade Google Sign-In verification endpoint.
    Verifies the Google ID Token via Google's tokeninfo endpoint,
    validates the audience and issuer, and logs in or creates the merchant shop.
    """
    token_str = (payload.credential or "").strip()
    if not token_str:
        raise HTTPException(status_code=400, detail="Google credential token is missing.")

    # 1. Verify token (ID Token -> local JWKS signature check; Access Token -> tokeninfo,
    #    both with strict audience validation against our Google Client ID).
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
        raise HTTPException(status_code=401, detail=f"Google sign-in failed: {exc}")

    # 2. Validate Google payload fields
    google_email = google_data.get("email")
    email_verified = google_data.get("email_verified") or google_data.get("verified_email")
    if not google_email or str(email_verified).lower() not in ("true", "1", "yes"):
        raise HTTPException(status_code=400, detail="Google account email is not verified.")

    google_sub = google_data.get("sub")
    full_name = google_data.get("name") or google_data.get("given_name") or google_email.split("@")[0]

    # 3. Lookup existing user by email
    clean_email = google_email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == clean_email).first()

    if not user:
        # Create username derived from email or google sub
        base_username = clean_email.split("@")[0].replace(".", "_").replace("-", "_")
        candidate_username = base_username[:40]
        suffix = 1
        while db.query(User).filter(User.username == candidate_username).first():
            candidate_username = f"{base_username[:35]}_{suffix}"
            suffix += 1

        # Determine shop name
        shop_title = (payload.shop_name or "").strip()[:200] or f"{full_name[:150]}'s Shop"

        # Create new Shop Settings
        new_shop = ShopSettings(
            shop_name=shop_title,
            proprietor_name=full_name[:200],
            email=clean_email[:150],
            phone=payload.phone.strip()[:20] if (payload.phone and payload.phone.strip()) else None,
            gstin=payload.gstin.strip().upper()[:20] if (payload.gstin and payload.gstin.strip()) else None,
            default_gst_rate=18,
            invoice_prefix="INV",
            invoice_counter=1,
            currency="INR",
            subscription_status="ACTIVE",
        )
        db.add(new_shop)
        db.flush()

        # Hybrid Authentication:
        # If user provided a password during Google registration, save it so they can log in
        # with either Google OR Email + Password anytime. Otherwise generate a secure fallback.
        clean_pwd = (payload.password or "").strip()
        chosen_password = clean_pwd if len(clean_pwd) >= 6 else secrets.token_urlsafe(24)

        # Create new User
        user = User(
            name=full_name[:100],
            username=candidate_username,
            email=clean_email[:150],
            phone=payload.phone.strip()[:20] if (payload.phone and payload.phone.strip()) else None,
            password_hash=hash_password(chosen_password),
            role=UserRole.OWNER,
            shop_id=new_shop.id,
            subscription_status="ACTIVE",
            is_active=True
        )
        db.add(user)
        db.flush()

        # Dispatch Welcome Email to new Google user
        if clean_email:
            try:
                login_url = f"{settings.app_base_url.rstrip('/')}/login" if settings.app_base_url else "https://nockbill.com/login"
                send_welcome_account_email(
                    to_email=clean_email,
                    recipient_name=full_name,
                    username=candidate_username,
                    shop_name=new_shop.shop_name,
                    login_url=login_url,
                    gstin=new_shop.gstin,
                    license_no=new_shop.fertilizer_license_no,
                    role_name="Store Owner"
                )
            except Exception as exc:
                logger.warning("Could not dispatch welcome email to new Google user %s: %s", clean_email, exc)
    else:
        # User exists: if they provided a new password, update it so they can use hybrid email+pwd
        clean_pwd = (payload.password or "").strip()
        if len(clean_pwd) >= 6:
            user.password_hash = hash_password(clean_pwd)
        if payload.phone and payload.phone.strip() and not user.phone:
            user.phone = payload.phone.strip()[:20]
        if payload.shop_name and payload.shop_name.strip() and user.shop:
            if user.shop.shop_name in ("My Fertilizer Shop", "My Agro Store", f"{full_name}'s Agro Store"):
                user.shop.shop_name = payload.shop_name.strip()[:200]
        db.flush()

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account has been deactivated. Please contact support.")

    # Generate application JWT
    jwt_token = create_access_token({"sub": str(user.id)})

    audit = AuditLog(
        user_id=user.id,
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
        role=user.role,
        subscription_status=user.subscription_status or "ACTIVE",
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(403, "Only owners can create users")
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(400, "Username already exists")
    user = User(
        name=payload.name,
        username=payload.username,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=payload.role,
        shop_id=current_user.shop_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Dispatch Welcome Email to newly created sub-user
    if user.email and user.email.strip():
        try:
            login_url = f"{settings.app_base_url.rstrip('/')}/login" if settings.app_base_url else "https://nockbill.com/login"
            shop_title = current_user.shop.shop_name if current_user.shop else "NockBill Solutions"
            role_label = "Store Owner" if user.role == UserRole.OWNER else "Staff / Cashier"
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

    return user

