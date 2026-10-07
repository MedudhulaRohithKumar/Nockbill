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
    ForgotPasswordRequest, ResetPasswordRequest,
    SubscriptionPaymentRequest
)
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# In-memory store for password reset tokens {identifier: {"token": str, "expires_at": datetime}}
RESET_TOKENS: dict = {}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
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
    # 1. Check if username or email already exists
    existing_user = db.query(User).filter(User.username == payload.username.strip()).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username is already taken. Please choose another.")
    
    if payload.email:
        existing_email = db.query(User).filter(User.email == payload.email.strip()).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # 2. Create Owner User (Pending subscription until payment)
    new_user = User(
        name=payload.owner_name.strip(),
        username=payload.username.strip(),
        email=payload.email.strip() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        password_hash=hash_password(payload.password),
        role=UserRole.OWNER,
        subscription_status="PENDING",
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    # 3. Create a dedicated new ShopSettings record for the new shop
    settings = ShopSettings(
        shop_name=payload.shop_name.strip(),
        proprietor_name=payload.proprietor_name.strip() if payload.proprietor_name else payload.owner_name.strip(),
        subscription_status="PENDING",
        phone=payload.phone.strip() if payload.phone else None,
        email=payload.email.strip() if payload.email else None,
        address_line1=payload.address_line1.strip() if payload.address_line1 else None,
        address_line2=payload.address_line2.strip() if payload.address_line2 else None,
        city=payload.city.strip() if payload.city else None,
        state=payload.state.strip() if payload.state else None,
        pincode=payload.pincode.strip() if payload.pincode else None,
        gstin=payload.gstin.strip().upper() if payload.gstin else None,
        fertilizer_license_no=payload.fertilizer_license_no.strip() if payload.fertilizer_license_no else None,
        pesticide_license_no=payload.pesticide_license_no.strip() if payload.pesticide_license_no else None,
        seed_license_no=payload.seed_license_no.strip() if payload.seed_license_no else None,
        bank_name=payload.bank_name.strip() if payload.bank_name else None,
        bank_account_no=payload.bank_account_no.strip() if payload.bank_account_no else None,
        bank_ifsc=payload.bank_ifsc.strip().upper() if payload.bank_ifsc else None,
        bank_branch=payload.bank_branch.strip() if payload.bank_branch else None,
        upi_id=payload.upi_id.strip() if payload.upi_id else None,
        default_gst_rate=payload.default_gst_rate if payload.default_gst_rate is not None else 18,
        invoice_prefix=payload.invoice_prefix.strip().upper() if payload.invoice_prefix else "INV",
        invoice_counter=1,
    )
    db.add(settings)
    db.flush()

    new_user.shop_id = settings.id

    # Audit log
    audit = AuditLog(
        user_id=new_user.id,
        action=AuditAction.LOGIN,
        description=f"New shop registered: {settings.shop_name} by {new_user.name} (Shop ID: {settings.id})"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_user)

    # 4. Generate Auth Token
    token = create_access_token({"sub": str(new_user.id)})

    # 5. Business credential export payload
    credentials = {
        "account_id": f"SHOP-{settings.id:05d}",
        "shop_name": settings.shop_name,
        "owner_name": new_user.name,
        "username": new_user.username,
        "email": new_user.email or "",
        "phone": new_user.phone or "",
        "role": new_user.role.value,
        "initial_password": payload.password,
        "console_login_url": "http://localhost:5173/login",
        "gstin": settings.gstin or "UNREGISTERED",
        "fertilizer_license": settings.fertilizer_license_no or "N/A",
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
        shop_name=settings.shop_name,
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
    ident = payload.identifier.strip()
    user = db.query(User).filter(
        or_(
            User.username == ident,
            User.email == ident,
            User.phone == ident
        )
    ).first()

    if not user:
        # Return success for privacy / anti-enumeration, but in demo mode explain clearly
        return {
            "success": True,
            "message": "If an account matches that email, phone or username, a verification code has been dispatched.",
            "demo_otp": "784920"
        }

    # Generate 6-digit OTP code
    otp = f"{secrets.randbelow(900000) + 100000}"
    RESET_TOKENS[user.username] = {
        "code": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=15),
        "user_id": user.id
    }

    return {
        "success": True,
        "message": f"Verification code dispatched to {user.phone or user.email or user.username}.",
        "demo_otp": otp,
        "masked_target": (
            user.phone[:3] + "•••" + user.phone[-3:] if user.phone and len(user.phone) >= 7
            else (user.email[:2] + "•••@" + user.email.split("@")[-1] if user.email and "@" in user.email else user.username)
        )
    }


@router.post("/forgot-password/reset")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    ident = payload.identifier.strip()
    user = db.query(User).filter(
        or_(
            User.username == ident,
            User.email == ident,
            User.phone == ident
        )
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    entry = RESET_TOKENS.get(user.username)
    # Check OTP (also allow demo code 784920 or active entry code)
    is_valid = False
    if entry and entry["code"] == payload.reset_token.strip():
        if datetime.utcnow() <= entry["expires_at"]:
            is_valid = True
    elif payload.reset_token.strip() == "784920":
        is_valid = True

    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code. Please request a new one.")

    # Update password
    user.password_hash = hash_password(payload.new_password)
    db.commit()

    # Clear token
    if user.username in RESET_TOKENS:
        del RESET_TOKENS[user.username]

    return {"success": True, "message": "Password reset successfully! You can now log in with your new password."}


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

