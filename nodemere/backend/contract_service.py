"""Tokenized voice consent contracts and ElevenLabs IVC creation."""

import base64
import hashlib
import io
import logging
import mimetypes
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import PurePosixPath
from uuid import uuid4

import requests
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


CONTRACT_BUCKET = os.environ.get("VOICE_CONTRACT_BUCKET", "voice-contracts")
CONTRACT_TTL_DAYS = int(os.environ.get("VOICE_CONTRACT_TTL_DAYS", "30"))
MAX_SIGNATURE_BYTES = 1_000_000
MAX_SAMPLE_BYTES = 25 * 1024 * 1024
MAX_SAMPLE_COUNT = 6
ALLOWED_AUDIO_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/mp4",
    "audio/m4a",
    "audio/aac",
    "audio/ogg",
}

DEFAULT_AGREEMENT_VERSION = "voice-consent-v1"
DEFAULT_AGREEMENT_BODY = """
Nodemere Voice Consent Agreement

By signing this agreement, I confirm that I am voluntarily allowing Nodemere to create an AI-generated version of my voice using audio recordings I provide.

I allow Nodemere and its customers to use my AI-generated voice, name, and related performer identity for business front desk, receptionist, customer support, appointment booking, call handling, demo, sales, and related operational purposes.

I understand that my AI voice may be used in conversations with real customers and prospects, including phone calls and website experiences. I understand the voice may be generated through ElevenLabs or another voice technology provider selected by Nodemere.

I confirm that the recordings and signature I provide are mine, that I have the right to grant this permission, and that I am not being forced to sign this agreement.

This permission continues unless I ask Nodemere in writing to stop future use. Revocation does not automatically undo prior uses, previously generated materials, or work already delivered before Nodemere receives and processes the request.

I understand this is not an employment agreement, agency agreement, or guarantee of payment unless a separate written deal says otherwise.
""".strip()


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_token() -> str:
    return secrets.token_urlsafe(32)


def safe_filename(filename: str, fallback: str = "file") -> str:
    name = PurePosixPath(str(filename or fallback).replace("\\", "/")).name
    name = "".join(char for char in name if char.isalnum() or char in {".", "-", "_", " "}).strip()
    return name[:140] or fallback


def safe_storage_segment(value, fallback: str = "unknown") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", str(value or fallback)).strip("-")
    return (cleaned or fallback)[:120]


def parse_datetime(value):
    if not value:
        return None
    parsed = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def is_contract_expired(contract: dict) -> bool:
    expires_at = parse_datetime(contract.get("expires_at"))
    return bool(expires_at and expires_at <= now_utc() and contract.get("status") == "draft")


def load_contract_by_token(supabase, token: str) -> dict | None:
    response = (
        supabase.table("contracts")
        .select("*")
        .eq("token_hash", token_hash(token))
        .limit(1)
        .execute()
    )
    contract = (response.data or [None])[0]
    if contract and is_contract_expired(contract):
        timestamp = now_utc().isoformat()
        update = {"status": "expired", "updated_at": timestamp}
        updated = supabase.table("contracts").update(update).eq("id", contract["id"]).execute()
        return (updated.data or [{**contract, **update}])[0]
    return contract


def public_contract_payload(contract: dict) -> dict:
    metadata = contract.get("metadata") if isinstance(contract.get("metadata"), dict) else {}
    return {
        "success": True,
        "contract_id": str(contract.get("id")),
        "status": contract.get("status"),
        "signer_name": contract.get("signer_name") or "",
        "signer_email": contract.get("signer_email") or "",
        "voice_display_name": contract.get("voice_display_name") or "",
        "agreement_version": contract.get("agreement_version") or DEFAULT_AGREEMENT_VERSION,
        "agreement_body": contract.get("agreement_body") or DEFAULT_AGREEMENT_BODY,
        "expires_at": contract.get("expires_at"),
        "signed_at": contract.get("signed_at"),
        "clone_completed_at": contract.get("clone_completed_at"),
        "elevenlabs_voice_id": contract.get("elevenlabs_voice_id"),
        "metadata": {
            "business_name": metadata.get("business_name") or "Nodemere",
        },
    }


def get_contract_public_state(supabase, token: str) -> dict:
    contract = load_contract_by_token(supabase, token)
    if not contract:
        return {"success": False, "status": "not_found", "message": "This contract link is invalid."}
    if contract.get("status") == "expired":
        return {"success": False, "status": "expired", "message": "This contract link has expired."}
    return public_contract_payload(contract)


def create_contract(supabase, *, base_url: str, signer_name: str = "", signer_email: str = "", voice_display_name: str = "", business_id=None, person_id=None, user_id=None, metadata: dict | None = None) -> dict:
    token = create_token()
    created_at = now_utc()
    expires_at = created_at + timedelta(days=CONTRACT_TTL_DAYS)
    clean_name = (signer_name or "").strip()
    clean_voice_name = (voice_display_name or clean_name or "Custom Voice").strip()
    row = {
        "token_hash": token_hash(token),
        "status": "draft",
        "business_id": business_id,
        "person_id": person_id,
        "user_id": user_id,
        "signer_name": clean_name,
        "signer_email": (signer_email or "").strip(),
        "voice_display_name": clean_voice_name,
        "agreement_version": DEFAULT_AGREEMENT_VERSION,
        "agreement_body": DEFAULT_AGREEMENT_BODY,
        "metadata": metadata or {},
        "expires_at": expires_at.isoformat(),
        "created_at": created_at.isoformat(),
        "updated_at": created_at.isoformat(),
    }
    response = supabase.table("contracts").insert(row).execute()
    saved = (response.data or [row])[0]
    contract_url = f"{base_url.rstrip('/')}/contract/{token}" if base_url else f"/contract/{token}"
    clone_url = f"{base_url.rstrip('/')}/clone/{token}" if base_url else f"/clone/{token}"
    return {
        "success": True,
        "contract_id": str(saved.get("id")),
        "status": saved.get("status", "draft"),
        "contract_url": contract_url,
        "clone_url": clone_url,
        "expires_at": saved.get("expires_at"),
    }


def decode_signature_data_url(signature_data_url: str) -> bytes:
    if not signature_data_url or "," not in signature_data_url:
        raise ValueError("Signature is required.")
    header, encoded = signature_data_url.split(",", 1)
    if "image/png" not in header and "image/jpeg" not in header:
        raise ValueError("Signature must be a PNG or JPEG image.")
    content = base64.b64decode(encoded, validate=True)
    if not content or len(content) > MAX_SIGNATURE_BYTES:
        raise ValueError("Signature image is too large.")
    return content


def draw_wrapped_text(pdf, text: str, x: int, y: int, max_width: int, line_height: int, font_name: str = "Helvetica", font_size: int = 10) -> int:
    pdf.setFont(font_name, font_size)
    for paragraph in text.splitlines():
        words = paragraph.split()
        if not words:
            y -= line_height
            continue
        line = ""
        for word in words:
            candidate = f"{line} {word}".strip()
            if pdf.stringWidth(candidate, font_name, font_size) <= max_width:
                line = candidate
                continue
            pdf.drawString(x, y, line)
            y -= line_height
            line = word
        if line:
            pdf.drawString(x, y, line)
            y -= line_height
        y -= 3
    return y


def build_signed_contract_pdf(contract: dict, *, signer_name: str, signer_email: str, signature_bytes: bytes, signed_at: datetime, ip_address: str | None, user_agent: str | None) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    margin = 54
    y = height - 56

    pdf.setFillColor(colors.HexColor("#050505"))
    pdf.rect(0, 0, width, height, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(margin, y, "Nodemere Voice Consent Agreement")
    y -= 26

    pdf.setFillColor(colors.HexColor("#b8b8c3"))
    pdf.setFont("Helvetica", 9)
    pdf.drawString(margin, y, f"Agreement version: {contract.get('agreement_version') or DEFAULT_AGREEMENT_VERSION}")
    y -= 14
    pdf.drawString(margin, y, f"Contract ID: {contract.get('id')}")
    y -= 26

    pdf.setFillColor(colors.white)
    agreement_body = contract.get("agreement_body") or DEFAULT_AGREEMENT_BODY
    y = draw_wrapped_text(pdf, agreement_body, margin, y, int(width - margin * 2), 13)
    y -= 14

    if y < 190:
        pdf.showPage()
        pdf.setFillColor(colors.HexColor("#050505"))
        pdf.rect(0, 0, width, height, fill=1, stroke=0)
        pdf.setFillColor(colors.white)
        y = height - 56

    pdf.setStrokeColor(colors.HexColor("#404048"))
    pdf.line(margin, y, width - margin, y)
    y -= 24

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(margin, y, "Signed by")
    y -= 17
    pdf.setFont("Helvetica", 10)
    pdf.drawString(margin, y, signer_name or "Unknown signer")
    y -= 14
    pdf.drawString(margin, y, signer_email or "No email provided")
    y -= 14
    pdf.drawString(margin, y, f"Signed at: {signed_at.isoformat()}")
    y -= 14
    pdf.drawString(margin, y, f"IP: {ip_address or 'unknown'}")
    y -= 18

    try:
        signature_image = ImageReader(io.BytesIO(signature_bytes))
        pdf.setFillColor(colors.HexColor("#f6f6f7"))
        pdf.roundRect(margin, y - 74, 240, 76, 6, fill=1, stroke=0)
        pdf.drawImage(signature_image, margin, y - 68, width=220, height=66, mask="auto", preserveAspectRatio=True, anchor="sw")
    except Exception as exc:
        logging.warning("Could not render signature image in PDF: %s", exc)
        pdf.drawString(margin, y - 28, "[Signature image unavailable]")
    y -= 90

    pdf.setFillColor(colors.HexColor("#8d8d99"))
    pdf.setFont("Helvetica", 7)
    clipped_agent = (user_agent or "unknown")[:180]
    pdf.drawString(margin, y, f"Browser: {clipped_agent}")
    pdf.save()
    return buffer.getvalue()


def sign_contract(supabase, *, token: str, signer_name: str, signer_email: str, signature_data_url: str, ip_address: str | None, user_agent: str | None, consent: dict | None = None) -> dict:
    contract = load_contract_by_token(supabase, token)
    if not contract:
        return {"success": False, "status": "not_found", "message": "This contract link is invalid."}
    if contract.get("status") == "expired":
        return {"success": False, "status": "expired", "message": "This contract link has expired."}
    if contract.get("status") in {"signed", "cloned"}:
        return {**public_contract_payload(contract), "clone_url": f"/clone/{token}"}
    if contract.get("status") != "draft":
        return {"success": False, "status": contract.get("status"), "message": "This contract can no longer be signed."}

    signature_bytes = decode_signature_data_url(signature_data_url)
    signed_at = now_utc()
    contract_id = str(contract["id"])
    signature_path = f"contracts/{contract_id}/signature-{uuid4().hex}.png"
    pdf_path = f"contracts/{contract_id}/signed-agreement-{uuid4().hex}.pdf"
    pdf_bytes = build_signed_contract_pdf(
        contract,
        signer_name=signer_name,
        signer_email=signer_email,
        signature_bytes=signature_bytes,
        signed_at=signed_at,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    supabase.storage.from_(CONTRACT_BUCKET).upload(signature_path, signature_bytes, {"content-type": "image/png", "upsert": "false"})
    supabase.storage.from_(CONTRACT_BUCKET).upload(pdf_path, pdf_bytes, {"content-type": "application/pdf", "upsert": "false"})

    update = {
        "status": "signed",
        "signer_name": (signer_name or contract.get("signer_name") or "").strip(),
        "signer_email": (signer_email or contract.get("signer_email") or "").strip(),
        "signed_at": signed_at.isoformat(),
        "signature_storage_bucket": CONTRACT_BUCKET,
        "signature_storage_path": signature_path,
        "signed_pdf_bucket": CONTRACT_BUCKET,
        "signed_pdf_path": pdf_path,
        "consent": consent or {},
        "signer_ip": ip_address,
        "signer_user_agent": (user_agent or "")[:500],
        "updated_at": signed_at.isoformat(),
    }
    response = supabase.table("contracts").update(update).eq("id", contract_id).eq("status", "draft").execute()
    saved = (response.data or [{**contract, **update}])[0]
    return {**public_contract_payload(saved), "clone_url": f"/clone/{token}"}


def upload_sample_to_storage(supabase, *, contract_id: str, filename: str, content_type: str, content: bytes) -> dict:
    safe_name = safe_filename(filename, "sample.webm")
    storage_path = f"contracts/{contract_id}/samples/{uuid4().hex}-{safe_name}"
    normalized_type = (content_type or mimetypes.guess_type(safe_name)[0] or "application/octet-stream").lower()
    supabase.storage.from_(CONTRACT_BUCKET).upload(storage_path, content, {"content-type": normalized_type, "upsert": "false"})
    return {
        "file_name": safe_name,
        "storage_bucket": CONTRACT_BUCKET,
        "storage_path": storage_path,
        "content_type": normalized_type,
        "file_size": len(content),
    }


def normalize_content_type(content_type: str | None) -> str:
    return str(content_type or "").split(";", 1)[0].strip().lower()


def create_elevenlabs_ivc_voice(*, api_key: str, voice_name: str, sample_files: list[dict], remove_background_noise: bool = True) -> dict:
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured.")
    url = "https://api.elevenlabs.io/v1/voices/add"
    data = {
        "name": voice_name,
        "remove_background_noise": str(bool(remove_background_noise)).lower(),
    }

    def build_files(field_name: str):
        return [
            (field_name, (sample["file_name"], sample["content"], sample["content_type"]))
            for sample in sample_files
        ]

    response = requests.post(url, headers={"xi-api-key": api_key}, data=data, files=build_files("files"), timeout=120)
    if response.status_code == 400 and "files" in response.text.lower():
        response = requests.post(url, headers={"xi-api-key": api_key}, data=data, files=build_files("files[]"), timeout=120)
    if response.status_code >= 400:
        raise RuntimeError(f"ElevenLabs IVC failed: {response.status_code} {response.text[:500]}")
    return response.json()


def clone_voice(supabase, *, token: str, api_key: str, voice_name: str, uploaded_files: list, remove_background_noise: bool = True) -> dict:
    contract = load_contract_by_token(supabase, token)
    if not contract:
        return {"success": False, "status": "not_found", "message": "This clone link is invalid."}
    if contract.get("status") == "expired":
        return {"success": False, "status": "expired", "message": "This clone link has expired."}
    if contract.get("status") not in {"signed", "cloned"}:
        return {"success": False, "status": "unsigned", "message": "Sign the agreement before cloning your voice."}
    if not uploaded_files:
        return {"success": False, "status": "invalid", "message": "Record or upload at least one voice sample."}
    if len(uploaded_files) > MAX_SAMPLE_COUNT:
        return {"success": False, "status": "too_many_files", "message": f"Upload {MAX_SAMPLE_COUNT} samples or fewer."}

    contract_id = str(contract["id"])
    samples_for_api = []
    saved_samples = []
    for uploaded in uploaded_files:
        filename = safe_filename(getattr(uploaded, "filename", "sample.webm"), "sample.webm")
        content_type = normalize_content_type(getattr(uploaded, "content_type", None) or mimetypes.guess_type(filename)[0] or "application/octet-stream")
        content = uploaded.content if hasattr(uploaded, "content") else None
        if not content:
            return {"success": False, "status": "invalid", "message": "One of the audio samples is empty."}
        if len(content) > MAX_SAMPLE_BYTES:
            return {"success": False, "status": "too_large", "message": "Each audio sample must be 25 MB or smaller."}
        if content_type not in ALLOWED_AUDIO_TYPES:
            return {"success": False, "status": "unsupported", "message": "Use MP3, WAV, M4A, OGG, or WEBM audio."}
        saved_samples.append(upload_sample_to_storage(supabase, contract_id=contract_id, filename=filename, content_type=content_type, content=content))
        samples_for_api.append({"file_name": filename, "content_type": content_type, "content": content})

    clean_voice_name = (voice_name or contract.get("voice_display_name") or contract.get("signer_name") or "Nodemere Custom Voice").strip()
    elevenlabs_result = create_elevenlabs_ivc_voice(
        api_key=api_key,
        voice_name=clean_voice_name,
        sample_files=samples_for_api,
        remove_background_noise=remove_background_noise,
    )
    voice_id = elevenlabs_result.get("voice_id")
    custom_voice_status = "requires_verification" if elevenlabs_result.get("requires_verification") else "ready"
    timestamp = now_utc().isoformat()
    row = {
        "contract_id": contract_id,
        "business_id": contract.get("business_id"),
        "person_id": contract.get("person_id"),
        "user_id": contract.get("user_id"),
        "provider": "elevenlabs",
        "provider_voice_id": voice_id,
        "voice_name": clean_voice_name,
        "speaker_name": contract.get("signer_name"),
        "speaker_email": contract.get("signer_email"),
        "status": custom_voice_status,
        "sample_count": len(saved_samples),
        "sample_storage_paths": saved_samples,
        "provider_response": elevenlabs_result,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    response = supabase.table("custom_voices").insert(row).execute()
    saved_voice = (response.data or [row])[0]
    supabase.table("contracts").update({
        "status": "cloned",
        "elevenlabs_voice_id": voice_id,
        "clone_completed_at": timestamp,
        "updated_at": timestamp,
    }).eq("id", contract_id).execute()
    return {
        "success": True,
        "status": custom_voice_status,
        "voice_id": voice_id,
        "custom_voice_id": str(saved_voice.get("id")),
        "requires_verification": bool(elevenlabs_result.get("requires_verification")),
        "message": "Voice clone created.",
    }
