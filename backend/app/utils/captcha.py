"""
Server-side cryptographic CAPTCHA generator and single-use verifier.
Renders a distorted raster PNG image (base64 data URI) so no plaintext
characters ever exist in the DOM or network payload, and signs challenges
with HMAC-SHA256 + database-backed single-use nonce tracking so solved
challenges cannot be replayed across stateless AWS Lambda workers.
"""
import base64
from datetime import datetime, timezone
import hashlib
import hmac
import io
import math
import random
import secrets
import time
from typing import Dict, Optional, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.models import UsedCaptchaNonce

# Unambiguous character set (excludes 0/O, 1/I/L)
CAPTCHA_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
CAPTCHA_LENGTH = 6
CAPTCHA_TTL_SECONDS = 300  # 5 minutes

# Fallback in-process nonce set used only when verify_captcha_challenge is called without a DB session
_FALLBACK_USED_NONCES: Dict[str, int] = {}


def _cleanup_fallback_nonces(now: int) -> None:
    if len(_FALLBACK_USED_NONCES) > 2000:
        expired = [k for k, exp in _FALLBACK_USED_NONCES.items() if exp < now]
        for k in expired:
            _FALLBACK_USED_NONCES.pop(k, None)


def _compute_signature(nonce: str, expires_at: int, code: str) -> str:
    raw_secret = (settings.secret_key or "").strip()
    if not raw_secret:
        raise RuntimeError("SECRET_KEY must be configured before signing CAPTCHA tokens.")
    secret = raw_secret.encode("utf-8")
    msg = f"{nonce}:{expires_at}:{code.strip().upper()}".encode("utf-8")
    return hmac.new(secret, msg, hashlib.sha256).hexdigest()


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Load a bold TrueType font if available, or fall back to scaled default font."""
    font_candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
        "/System/Library/Fonts/Monaco.ttf",
    ]
    for path in font_candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def _render_captcha_png(code: str) -> str:
    """
    Render the CAPTCHA code into a distorted, anti-OCR raster PNG image
    and return it as a base64 data URI.
    """
    width, height = 240, 72
    bg_color = (241, 248, 245)
    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)

    rng = random.SystemRandom()

    for x in range(0, width, 16):
        draw.line([(x, 0), (x, height)], fill=(224, 236, 230), width=1)
    for y in range(0, height, 16):
        draw.line([(0, y), (width, y)], fill=(224, 236, 230), width=1)

    for _ in range(140):
        nx = rng.randint(0, width - 1)
        ny = rng.randint(0, height - 1)
        dot_color = (
            rng.randint(150, 210),
            rng.randint(170, 215),
            rng.randint(160, 210),
        )
        draw.point((nx, ny), fill=dot_color)

    palette = [
        (4, 120, 87),
        (15, 118, 110),
        (30, 64, 175),
        (109, 40, 217),
        (180, 83, 9),
        (15, 23, 42),
    ]

    for _ in range(5):
        line_color = rng.choice(palette)
        pts = [
            (rng.randint(0, 30), rng.randint(5, height - 5)),
            (rng.randint(60, 120), rng.randint(5, height - 5)),
            (rng.randint(130, 190), rng.randint(5, height - 5)),
            (rng.randint(200, width), rng.randint(5, height - 5)),
        ]
        draw.line(pts, fill=line_color, width=rng.randint(1, 2), joint="curve")

    font = _load_font(34)
    slot_width = (width - 28) // len(code)

    for idx, ch in enumerate(code):
        char_layer = Image.new("RGBA", (60, 60), (0, 0, 0, 0))
        char_draw = ImageDraw.Draw(char_layer)
        color = rng.choice(palette)

        char_draw.text((14, 10), ch, font=font, fill=(255, 255, 255, 180))
        char_draw.text((12, 8), ch, font=font, fill=(*color, 255))

        angle = rng.randint(-20, 20)
        rotated = char_layer.rotate(angle, resample=Image.Resampling.BICUBIC, expand=False)

        x_pos = 14 + idx * slot_width + rng.randint(-3, 3)
        y_pos = rng.randint(4, 12)
        img.paste(rotated, (x_pos, y_pos), rotated)

    warped = Image.new("RGB", (width, height), bg_color)
    src_pixels = img.load()
    dst_pixels = warped.load()

    phase_x = rng.uniform(0, math.pi * 2)
    phase_y = rng.uniform(0, math.pi * 2)
    amp_x = rng.uniform(2.2, 3.4)
    amp_y = rng.uniform(1.5, 2.5)

    for y in range(height):
        for x in range(width):
            shift_x = int(amp_x * math.sin(2 * math.pi * y / 34.0 + phase_x))
            shift_y = int(amp_y * math.cos(2 * math.pi * x / 48.0 + phase_y))
            src_x = min(max(x + shift_x, 0), width - 1)
            src_y = min(max(y + shift_y, 0), height - 1)
            dst_pixels[x, y] = src_pixels[src_x, src_y]

    fg_draw = ImageDraw.Draw(warped)
    for _ in range(2):
        c = rng.choice(palette)
        y1 = rng.randint(15, height - 15)
        y2 = rng.randint(15, height - 15)
        y3 = rng.randint(15, height - 15)
        fg_draw.line([(8, y1), (width // 2, y2), (width - 8, y3)], fill=c, width=2)

    warped = warped.filter(ImageFilter.SMOOTH_MORE)

    buf = io.BytesIO()
    warped.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _consume_nonce(nonce: str, expires_at: int, now: int, db: Optional[Session]) -> bool:
    """
    Atomically claim a CAPTCHA nonce as consumed.
    Returns True if newly claimed, False if already consumed (replay attempt).
    """
    if db is not None:
        now_dt = datetime.fromtimestamp(now, tz=timezone.utc)
        exp_dt = datetime.fromtimestamp(expires_at + 60, tz=timezone.utc)
        try:
            db.query(UsedCaptchaNonce).filter(
                UsedCaptchaNonce.expires_at < now_dt
            ).delete(synchronize_session=False)
            db.add(UsedCaptchaNonce(nonce=nonce, expires_at=exp_dt))
            db.commit()
            return True
        except IntegrityError:
            db.rollback()
            return False

    _cleanup_fallback_nonces(now)
    if nonce in _FALLBACK_USED_NONCES:
        return False
    _FALLBACK_USED_NONCES[nonce] = expires_at + 60
    return True


def generate_captcha_challenge() -> Tuple[str, str]:
    """
    Generate a new single-use CAPTCHA challenge.
    Returns (captcha_token, captcha_image_data_uri).
    """
    now = int(time.time())
    rng = random.SystemRandom()
    code = "".join(rng.choice(CAPTCHA_CHARS) for _ in range(CAPTCHA_LENGTH))
    nonce = secrets.token_hex(16)
    expires_at = now + CAPTCHA_TTL_SECONDS

    sig = _compute_signature(nonce, expires_at, code)
    token = f"{nonce}.{expires_at}.{sig}"
    image_data_uri = _render_captcha_png(code)

    return token, image_data_uri


def verify_captcha_challenge(
    captcha_token: str,
    user_code: str,
    db: Optional[Session] = None,
) -> Tuple[bool, str]:
    """
    Strictly validate and immediately consume a CAPTCHA challenge token.
    Every verification attempt burns the nonce in the shared database so it can
    NEVER be replayed across Lambda workers.
    """
    if not captcha_token or not user_code:
        return False, "Security CAPTCHA code is required."

    cleaned_code = "".join(ch for ch in user_code.strip().upper() if ch.isalnum())
    if len(cleaned_code) != CAPTCHA_LENGTH:
        return False, f"CAPTCHA code must be {CAPTCHA_LENGTH} characters."

    parts = captcha_token.strip().split(".")
    if len(parts) != 3:
        return False, "Invalid CAPTCHA security token. Please refresh CAPTCHA."

    nonce, exp_str, provided_sig = parts
    if not nonce or len(nonce) > 64 or not nonce.isalnum():
        return False, "Malformed CAPTCHA token. Please refresh CAPTCHA."
    try:
        expires_at = int(exp_str)
    except ValueError:
        return False, "Malformed CAPTCHA token. Please refresh CAPTCHA."

    now = int(time.time())

    # 1. Check expiration before inserting a nonce row
    if now > expires_at:
        return False, "CAPTCHA has expired. Please enter the newly generated code."

    # 2. Atomically burn the nonce across all workers (even if the typed code is wrong)
    if not _consume_nonce(nonce, expires_at, now, db):
        return False, "This CAPTCHA has already been used. Please enter the new CAPTCHA code."

    # 3. Verify cryptographic HMAC-SHA256 signature in constant time
    expected_sig = _compute_signature(nonce, expires_at, cleaned_code)
    if not hmac.compare_digest(expected_sig, provided_sig):
        return False, "Incorrect CAPTCHA code. Please try again with the new code."

    return True, "CAPTCHA verified."
