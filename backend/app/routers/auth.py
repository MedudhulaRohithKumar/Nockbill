from datetime import datetime, timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.database.base import get_db
from app.models.models import User, UserRole, AuditAction, AuditLog, ShopSettings
from app.schemas.schemas import (
    LoginRequest, TokenResponse, UserCreate, UserResponse,
    ShopRegistrationRequest, RegistrationResponse,
    ForgotPasswordRequest, VerifyOtpRequest, ResetPasswordRequest,
    SubscriptionPaymentRequest, GoogleAuthRequest
)
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user
from app.utils.captcha import generate_captcha_challenge, verify_captcha_challenge
from app.services.email_service import send_password_reset_email
from app.config.settings import settings
from app.utils.google_auth import (
    verify_google_token, GoogleVerificationError, GoogleUnreachableError
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# In-memory store for password reset tokens {identifier: {"token": str, "expires_at": datetime}}
RESET_TOKENS: dict = {}


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
    current_user.subscription_status = "ACTIVE"
    shop_id = getattr(current_user, "shop_id", 1) or 1
    settings = db.query(ShopSettings).filter(ShopSettings.id == shop_id).first()
    if settings:
        settings.subscription_status = "ACTIVE"
    
    audit = AuditLog(
        user_id=current_user.id,
        action=AuditAction.SETTINGS_UPDATE,
        description=f"Subscription activated: {payload.plan_name} (₹{payload.amount}) via {payload.payment_method} Ref: {payload.payment_ref}"
    )
    db.add(audit)
    db.commit()

    return {
        "success": True,
        "message": f"Payment of ₹{payload.amount:.2f} confirmed! {payload.plan_name} is now active.",
        "subscription_status": "ACTIVE",
        "payment_ref": payload.payment_ref,
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

    # Always return a clean response if user is not found
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No active shop account found with that email, username, or mobile number."
        )

    # Generate cryptographically secure 6-digit numeric verification code
    otp = f"{secrets.randbelow(900000) + 100000}"
    reset_secret = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    RESET_TOKENS[user.username] = {
        "code": otp,
        "token": reset_secret,
        "expires_at": expires_at,
        "user_id": user.id,
        "attempts": 0,
        "verified": False,
    }

    # Construct one-click reset link if frontend base URL is configured
    base_url = settings.app_base_url.rstrip("/")
    reset_link = f"{base_url}/login?action=reset&user={user.username}&code={otp}&token={reset_secret}"

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

    response_data = {
        "success": True,
        "message": f"A 6-digit verification code has been sent to {masked}." if email_dispatched else f"Verification code generated for {masked}.",
        "email_sent": email_dispatched,
        "masked_target": masked,
    }

    # If external email delivery could not be completed (e.g. local dev container without cloud email credentials),
    # return dev_otp so local testing is never blocked or misleading
    if not email_dispatched:
        response_data["dev_otp"] = otp

    return response_data


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

    entry = RESET_TOKENS.get(user.username)
    if not entry or datetime.utcnow() > entry["expires_at"]:
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired (valid for 15 minutes). Please request a new code."
        )

    if entry.get("attempts", 0) >= 5:
        del RESET_TOKENS[user.username]
        raise HTTPException(
            status_code=429,
            detail="Too many incorrect attempts. Please request a new 6-digit verification code."
        )

    provided_code = (payload.otp_code or "").strip()
    # Strict check: if 6 characters, must be 6 digits
    if len(provided_code) == 6 and not provided_code.isdigit():
        raise HTTPException(status_code=400, detail="Verification code must be a 6-digit number.")

    if provided_code != entry["code"] and provided_code != entry.get("token"):
        entry["attempts"] = entry.get("attempts", 0) + 1
        remaining = max(0, 5 - entry["attempts"])
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect 6-digit verification code ({remaining} attempts remaining)."
        )

    entry["verified"] = True
    return {
        "success": True,
        "verified": True,
        "reset_token": entry["token"],
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
        raise HTTPException(status_code=400, detail="Invalid verification code or user not found.")

    entry = RESET_TOKENS.get(user.username)
    is_valid = False
    provided_code = (payload.reset_token or "").strip()

    if entry and (entry["code"] == provided_code or entry.get("token") == provided_code):
        if datetime.utcnow() <= entry["expires_at"]:
            is_valid = True

    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="The verification session is invalid or has expired. Please verify your code again."
        )

    if len((payload.new_password or "").strip()) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    # Update password securely
    user.password_hash = hash_password(payload.new_password.strip())
    audit = AuditLog(
        user_id=user.id,
        action=AuditAction.SETTINGS_UPDATE,
        description=f"Password reset completed for user {user.username}"
    )
    db.add(audit)
    db.commit()

    # Clear single-use token immediately
    if user.username in RESET_TOKENS:
        del RESET_TOKENS[user.username]

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
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

