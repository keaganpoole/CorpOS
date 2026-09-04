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
CLONED_RECEPTIONIST_AVATAR_BUCKET = os.environ.get("CLONED_RECEPTIONIST_AVATAR_BUCKET", "avatars")
CONTRACT_TTL_DAYS = int(os.environ.get("VOICE_CONTRACT_TTL_DAYS", "30"))
MAX_SIGNATURE_BYTES = 1_000_000
MAX_SAMPLE_BYTES = 25 * 1024 * 1024
MAX_SAMPLE_COUNT = 6
MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024
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
ALLOWED_PROFILE_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

AGREEMENT_TITLE = "Voice Clone Consent, Authorization, Biometric Notice, and Limited License Agreement"
DEFAULT_AGREEMENT_VERSION = "voice-clone-consent-v2-2026-08-04"

# Legal copy requires final review by qualified counsel before production release. Do not represent this workflow as guaranteeing compliance with every jurisdiction.
DEFAULT_AGREEMENT_SECTIONS = {
    "voice": """1. Identity, Age, and Authority\n\nBy accepting this section and signing below, you certify that the name and email you provide identify you, that you are at least 18 years old, and that you have the legal capacity to enter this Agreement. You certify that every recording submitted through this personal voice-cloning flow contains your own natural voice and that you have the right and authority to provide it. You may not submit a recording that is stolen, scraped, secretly recorded, deceptively obtained, or supplied without the voice owner's authorization.\n\nThis flow is not authorized for another person's voice, including a celebrity, employee, customer, contractor, family member, or any other third party. Any third-party voice requires an independently approved, legally valid process. You may not use the resulting voice for deceptive impersonation. Nodemere or its authorized voice technology provider may require or perform authorization checks where available. False, misleading, or unauthorized certifications may result in rejection, suspension, removal of the voice, account action, and other remedies available under law or contract.""",
    "identity": """2. Voice Cloning, Voice Data, and Third-Party Processing\n\nNodemere will receive the recordings you submit and transmit them to Nodemere's authorized third-party voice technology provider to create a synthetic or AI-generated version of your voice. The provider may analyze vocal characteristics and operate voice-generation technology. The resulting voice can generate words, sentences, tones, and conversations that you never personally recorded or spoke. Generated output may be inaccurate, unexpected, awkward, misleading, offensive, or inconsistent with your beliefs or intentions; it is not automatically your personal statement, endorsement, promise, opinion, or live participation.\n\nThe information involved may include original recordings, audio files and metadata, vocal characteristics, derived voice data, a synthetic voice model or configuration, a provider voice identifier, verification information, generated audio, and related security or service records. Nodemere stores submitted recordings and related records in private service storage and transmits the recordings to the authorized provider. The current provider is ElevenLabs. Nodemere and the provider may retain voice-related data as needed to create, operate, secure, support, verify, moderate, troubleshoot, and document the service. The provider may require additional authorization or verification.\n\nBiometric notice: voice recordings and derived vocal characteristics may be regulated as biometric or biometric-related information in some jurisdictions. Nodemere and its authorized providers may process this information to create and operate the voice, verify authorization where supported, prevent fraud or abuse, maintain security, moderate misuse, preserve evidence of consent, improve service reliability, and meet legal obligations. Nodemere does not sell, lease, trade, or publish your natural voice or recordings through this consent. Provider retention, model-training, service-improvement, moderation, security, and backup practices are governed by the applicable provider terms and disclosures; Nodemere does not promise that a provider will never retain data or use it for those purposes.\n\nNodemere retains voice-related records only as long as needed for service operation, security, legal obligations, dispute resolution, and the purposes described in this Agreement. No deletion request guarantees immediate removal from every system. Backups, security logs, consent evidence, previously generated audio, calls, recordings, transcripts, summaries, and legally required business records may remain temporarily or be retained after a voice is disabled or removed.\n\nYou may withdraw authorization for future use of your cloned voice by emailing support@nodemere.ai. The request must come from you or a legally authorized person, and Nodemere may verify identity before acting. Nodemere will acknowledge a valid request and initiate removal; the operational target is completion within seven calendar days after Nodemere confirms receipt, unless more time is reasonably required for identity verification, a technical issue, fraud prevention, legal compliance, or provider-side processing. The seven-day period does not begin merely when an email is sent. Where technically possible, Nodemere may disable future generation before provider-side deletion is finalized. Provider-side removal may be asynchronous. Nodemere must not represent provider-side deletion as complete until it has been completed or confirmed through the applicable process.""",
    "usage": """3. Limited License, Defined Business Use, and Call Responsibilities\n\nYou grant Nodemere a limited, nonexclusive, revocable-for-future-use, worldwide-only-as-technically-required, nontransferable license, sublicensable only to necessary service providers and subprocessors, to receive, store, transmit, process, analyze, and verify the submitted recordings; create and host the synthetic voice; generate speech, previews, and test audio; preserve consent evidence; and operate, secure, troubleshoot, moderate, and maintain the service. This permission is limited to approved business interactions through Nodemere, such as customer support, appointment scheduling, reminders, lead follow-up, voicemail, testing, and previews.\n\nThe voice may be used to generate dialogue that you never personally recorded or spoke. Nodemere may control or influence that dialogue through its service, artificial intelligence, business instructions, and approved use settings. Voice-owner authorization does not authorize calls to recipients. The business customer remains responsible for required called-party consent, artificial-voice or prerecorded-voice rules, telemarketing and do-not-call requirements, caller identification, call-time limits, call recording and transcription notice, AI disclosure, privacy obligations, industry-specific rules, and lawful outbound campaigns. Nodemere may restrict, suspend, or disable abusive or unlawful use.\n\nThis Agreement does not authorize marketing calls, telemarketing, cold calling, political calls, fundraising, public advertisements, promotional videos, social-media content, public demonstrations, training materials, resale, voice marketplaces, public voice libraries, entertainment content, adult content, personalized endorsements, or use outside your approved Nodemere business purpose. Separate, express written authorization is required for any such use. You may not use the voice for fraud, scams, identity theft, deceptive impersonation, financial impersonation, false endorsements, harassment, threats, defamation, discrimination, extortion, criminal activity, unauthorized political persuasion, unlawful telemarketing, calls without required recipient consent, caller-ID circumvention, misleading a person into believing you are live, sexual exploitation, nonconsensual intimate content, or unauthorized medical, legal, or financial impersonation.\n\nYou retain your natural voice, identity, publicity rights, and all rights not expressly licensed here. Nodemere does not receive permission to use your name, image, likeness, biography, or endorsement outside the defined service. Nodemere retains its service technology and workflows; the authorized provider retains its technology and models. Original recordings, synthetic voice configurations, generated audio, call records, transcripts, summaries, and consent records are handled according to this Agreement and applicable service records. You receive no royalties, residuals, licensing revenue, or other compensation unless a separate signed agreement states otherwise.\n\nVoice cloning carries risks, including unauthorized access, misuse, impersonation, data breaches, third-party processing, and unexpected generated speech. Nodemere does not promise end-to-end encryption, zero access, absolute security, immediate deletion from all systems, or legal compliance in every jurisdiction. Withdrawal applies prospectively and does not make earlier authorized processing unlawful.""",
}
DEFAULT_AGREEMENT_BODY = f"{AGREEMENT_TITLE}\n\n" + "\n\n".join(DEFAULT_AGREEMENT_SECTIONS.values())
CONSENT_KEYS = tuple(DEFAULT_AGREEMENT_SECTIONS.keys())


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


def agreement_hash(agreement_body: str) -> str:
    return hashlib.sha256(agreement_body.encode("utf-8")).hexdigest()


def ensure_current_draft_agreement(supabase, contract: dict) -> dict:
    """Invalidate unsigned acceptance evidence when the agreement version changes."""
    if contract.get("status") != "draft" or contract.get("agreement_version") == DEFAULT_AGREEMENT_VERSION:
        return contract
    timestamp = now_utc().isoformat()
    update = {
        "agreement_version": DEFAULT_AGREEMENT_VERSION,
        "agreement_body": DEFAULT_AGREEMENT_BODY,
        "consent": {},
        "updated_at": timestamp,
    }
    response = supabase.table("contracts").update(update).eq("id", contract["id"]).eq("status", "draft").execute()
    return (response.data or [{**contract, **update}])[0]


def get_current_consent_records(supabase, contract: dict) -> list[dict]:
    return legacy_consent_records(contract)


def legacy_consent_records(contract: dict, agreement_text_hash: str | None = None) -> list[dict]:
    consent = contract.get("consent") if isinstance(contract.get("consent"), dict) else {}
    accepted_at = consent.get("accepted_at") or consent.get("updated_at") or contract.get("updated_at")
    records = []
    for key in CONSENT_KEYS:
        value = consent.get(key)
        if value is True or (isinstance(value, dict) and value.get("accepted")):
            records.append({
                "id": f"legacy-{contract.get('id')}-{key}",
                "consent_key": key,
                "agreement_version": contract.get("agreement_version") or DEFAULT_AGREEMENT_VERSION,
                "agreement_text_hash": agreement_text_hash or agreement_hash(contract.get("agreement_body") or DEFAULT_AGREEMENT_BODY),
                "accepted_at": (value.get("accepted_at") if isinstance(value, dict) else accepted_at),
            })
    return records


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
        "agreement_title": AGREEMENT_TITLE,
        "agreement_sections": DEFAULT_AGREEMENT_SECTIONS if (contract.get("agreement_version") or DEFAULT_AGREEMENT_VERSION) == DEFAULT_AGREEMENT_VERSION else {},
        "expires_at": contract.get("expires_at"),
        "signed_at": contract.get("signed_at"),
        "clone_completed_at": contract.get("clone_completed_at"),
        "elevenlabs_voice_id": contract.get("elevenlabs_voice_id"),
        "metadata": {
            "business_name": metadata.get("business_name") or "Nodemere",
        },
    }


def get_custom_voice_for_contract(supabase, contract_id: str) -> dict | None:
    try:
        response = (
            supabase.table("custom_voices")
            .select("*")
            .eq("contract_id", str(contract_id))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return (response.data or [None])[0]
    except Exception as exc:
        logging.warning('contract_service.get_custom_voice_for_contract.event_186')
        return None


def attach_custom_voice_payload(supabase, payload: dict) -> dict:
    contract_id = payload.get("contract_id")
    if not contract_id:
        return payload
    custom_voice = get_custom_voice_for_contract(supabase, contract_id)
    if not custom_voice:
        return payload
    metadata = custom_voice.get("metadata") if isinstance(custom_voice.get("metadata"), dict) else {}
    receptionist_profile = metadata.get("receptionist_profile") if isinstance(metadata.get("receptionist_profile"), dict) else {}
    payload.update({
        "custom_voice_id": str(custom_voice.get("id")),
        "voice_id": custom_voice.get("provider_voice_id"),
        "elevenlabs_voice_id": custom_voice.get("provider_voice_id") or payload.get("elevenlabs_voice_id"),
        "receptionist_profile": receptionist_profile,
    })
    return payload


def get_contract_public_state(supabase, token: str) -> dict:
    contract = load_contract_by_token(supabase, token)
    if not contract:
        return {"success": False, "status": "not_found", "message": "This contract link is invalid."}
    if contract.get("status") == "expired":
        return {"success": False, "status": "expired", "message": "This contract link has expired."}
    contract = ensure_current_draft_agreement(supabase, contract)
    payload = public_contract_payload(contract)
    consent_records = get_current_consent_records(supabase, contract)
    if not consent_records:
        consent_records = legacy_consent_records(contract)
    payload["accepted_consents"] = consent_records
    return attach_custom_voice_payload(supabase, payload)


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
        logging.warning('contract_service.build_signed_contract_pdf.event_351')
        pdf.drawString(margin, y - 28, "[Signature image unavailable]")
    y -= 90

    pdf.setFillColor(colors.HexColor("#8d8d99"))
    pdf.setFont("Helvetica", 7)
    clipped_agent = (user_agent or "unknown")[:180]
    pdf.drawString(margin, y, f"Browser: {clipped_agent}")
    pdf.save()
    return buffer.getvalue()


def record_checkbox_consent(supabase, *, token: str, consent_key: str, ip_address: str | None, user_agent: str | None) -> dict:
    if consent_key not in CONSENT_KEYS:
        return {"success": False, "status": "invalid", "message": "Unknown voice consent authorization."}
    contract = load_contract_by_token(supabase, token)
    if not contract:
        return {"success": False, "status": "not_found", "message": "This contract link is invalid."}
    if contract.get("status") != "draft":
        return {"success": False, "status": contract.get("status"), "message": "This authorization can no longer be changed."}
    contract = ensure_current_draft_agreement(supabase, contract)
    current_hash = agreement_hash(contract.get("agreement_body") or DEFAULT_AGREEMENT_BODY)
    consent = contract.get("consent") if isinstance(contract.get("consent"), dict) else {}
    existing = consent.get(consent_key)
    if isinstance(existing, dict) and existing.get("accepted") and existing.get("agreement_text_hash") == current_hash:
        return {"success": True, "consent": existing, "already_accepted": True}
    accepted_at = now_utc().isoformat()
    consent[consent_key] = {
        "accepted": True,
        "consent_key": consent_key,
        "agreement_title": AGREEMENT_TITLE,
        "agreement_version": contract["agreement_version"],
        "agreement_text_hash": current_hash,
        "accepted_at": accepted_at,
        "accepted_ip": ip_address,
        "accepted_user_agent": (user_agent or "")[:500],
    }
    supabase.table("contracts").update({
        "consent": consent,
        "updated_at": accepted_at,
    }).eq("id", contract["id"]).eq("status", "draft").execute()
    return {"success": True, "consent": consent[consent_key], "already_accepted": False}


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
    contract = ensure_current_draft_agreement(supabase, contract)
    accepted_records = get_current_consent_records(supabase, contract)
    current_hash = agreement_hash(contract.get("agreement_body") or DEFAULT_AGREEMENT_BODY)
    if not accepted_records:
        accepted_records = legacy_consent_records(contract, current_hash)
    accepted_keys = {
        record.get("consent_key")
        for record in accepted_records
        if record.get("agreement_text_hash") == current_hash
    }
    if set(CONSENT_KEYS) - accepted_keys:
        return {"success": False, "status": "incomplete_consent", "message": "Review each authorization and sign the agreement to continue."}

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
        "consent": {
            **(contract.get("consent") if isinstance(contract.get("consent"), dict) else {}),
            "agreement_version": contract["agreement_version"],
            "agreement_text_hash": current_hash,
            "final_certification_at": signed_at.isoformat(),
            "accepted_consents": sorted(accepted_keys),
        },
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
        "sha256": hashlib.sha256(content).hexdigest(),
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
        from .upload_validation import validate_audio
        try: validate_audio(content,content_type)
        except ValueError: return {"success":False,"status":"unsupported","message":"The file is not a supported audio container."}
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
        "provider_response": {"voice_id":voice_id},
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


def parse_receptionist_traits(value) -> list[str]:
    if isinstance(value, list):
        raw_traits = value
    else:
        raw_traits = re.split(r"[,;\n]+", str(value or ""))
    traits = []
    seen = set()
    for raw in raw_traits:
        trait = re.sub(r"\s+", " ", str(raw or "").strip())
        if not trait:
            continue
        trait = trait[:32]
        key = trait.lower()
        if key in seen:
            continue
        seen.add(key)
        traits.append(trait)
        if len(traits) >= 6:
            break
    return traits


def normalize_receptionist_profile(*, first_name: str, last_name: str, age, description: str, traits) -> dict:
    clean_first = re.sub(r"\s+", " ", str(first_name or "").strip())[:80]
    clean_last = re.sub(r"\s+", " ", str(last_name or "").strip())[:80]
    clean_description = re.sub(r"\s+", " ", str(description or "").strip())[:420]
    try:
        clean_age = int(age)
    except (TypeError, ValueError):
        clean_age = None
    clean_traits = parse_receptionist_traits(traits)
    if not clean_first:
        raise ValueError("First name is required.")
    if not clean_last:
        raise ValueError("Last name is required.")
    if clean_age is None or clean_age < 18 or clean_age > 99:
        raise ValueError("Age must be between 18 and 99.")
    if len(clean_description) < 20:
        raise ValueError("Description must be at least 20 characters.")
    if not clean_traits:
        raise ValueError("Add at least one trait.")
    return {
        "first_name": clean_first,
        "last_name": clean_last,
        "full_name": f"{clean_first} {clean_last}".strip(),
        "age": clean_age,
        "description": clean_description,
        "traits": clean_traits,
    }


def save_cloned_receptionist_profile(
    supabase,
    *,
    token: str,
    first_name: str,
    last_name: str,
    age,
    description: str,
    traits,
    image_filename: str | None,
    image_content_type: str | None,
    image_content: bytes | None,
) -> dict:
    contract = load_contract_by_token(supabase, token)
    if not contract:
        return {"success": False, "status": "not_found", "message": "This clone link is invalid."}
    if contract.get("status") != "cloned":
        return {"success": False, "status": contract.get("status"), "message": "Create the voice clone before setting up the receptionist."}
    custom_voice = get_custom_voice_for_contract(supabase, str(contract["id"]))
    if not custom_voice:
        return {"success": False, "status": "not_found", "message": "The cloned voice record could not be found."}
    if not custom_voice.get("provider_voice_id"):
        return {"success": False, "status": "invalid", "message": "The cloned voice is missing a provider voice ID."}

    profile = normalize_receptionist_profile(
        first_name=first_name,
        last_name=last_name,
        age=age,
        description=description,
        traits=traits,
    )
    metadata = custom_voice.get("metadata") if isinstance(custom_voice.get("metadata"), dict) else {}
    existing_profile = metadata.get("receptionist_profile") if isinstance(metadata.get("receptionist_profile"), dict) else {}
    avatar_url = existing_profile.get("avatar") or existing_profile.get("profile_image")
    storage_path = existing_profile.get("image_storage_path")
    if image_content:
        normalized_type = normalize_content_type(image_content_type)
        extension = ALLOWED_PROFILE_IMAGE_TYPES.get(normalized_type)
        if not extension:
            raise ValueError("Upload a JPEG, PNG, or WEBP image.")
        if len(image_content) > MAX_PROFILE_IMAGE_BYTES:
            raise ValueError("Image must be 5 MB or smaller.")

        from .upload_validation import normalize_avatar
        image_content=normalize_avatar(image_content)
        normalized_type='image/png'
        safe_name = 'avatar.png'
        storage_path = f"cloned-receptionists/{safe_storage_segment(contract.get('user_id') or contract.get('business_id') or 'public')}/{custom_voice['id']}/avatar-{uuid4().hex}-{safe_name}"
        supabase.storage.from_(CLONED_RECEPTIONIST_AVATAR_BUCKET).upload(
            storage_path,
            image_content,
            {"content-type": normalized_type, "upsert": "false"},
        )
        public_response = supabase.storage.from_(CLONED_RECEPTIONIST_AVATAR_BUCKET).get_public_url(storage_path)
        avatar_url = public_response if isinstance(public_response, str) else public_response.get("publicUrl")
        if not avatar_url:
            raise RuntimeError("Supabase did not return a public image URL.")
    if not avatar_url:
        raise ValueError("Upload a receptionist image.")

    timestamp = now_utc().isoformat()
    receptionist_profile = {
        **profile,
        "avatar": avatar_url,
        "profile_image": avatar_url,
        "image_storage_bucket": CLONED_RECEPTIONIST_AVATAR_BUCKET,
        "image_storage_path": storage_path,
        "source": "voice_clone",
        "custom_voice_id": str(custom_voice.get("id")),
        "provider_voice_id": custom_voice.get("provider_voice_id"),
        "elevenlabs_voice_id": custom_voice.get("provider_voice_id"),
        "completed_at": timestamp,
    }
    metadata["receptionist_profile"] = receptionist_profile
    update = {
        "voice_name": profile["full_name"],
        "speaker_name": profile["full_name"],
        "metadata": metadata,
        "updated_at": timestamp,
    }
    response = supabase.table("custom_voices").update(update).eq("id", str(custom_voice["id"])).execute()
    saved = (response.data or [{**custom_voice, **update}])[0]
    return {
        "success": True,
        "status": saved.get("status") or custom_voice.get("status"),
        "custom_voice_id": str(saved.get("id")),
        "voice_id": saved.get("provider_voice_id"),
        "receptionist_profile": receptionist_profile,
        "message": "Cloned receptionist saved.",
    }
