"""Voice Design boundary. Provider credentials and candidate ownership stay server-side."""
import base64
import hashlib
import hmac
import json
import time
from typing import Literal, Optional
from uuid import NAMESPACE_URL, uuid5

import requests
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .portrait_generation import upload_portrait


class VoiceDesignRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    voice_description: str = Field(min_length=20, max_length=1000)
    model_id: Literal["eleven_multilingual_ttv_v2", "eleven_ttv_v3"] = "eleven_ttv_v3"
    text: Optional[str] = Field(default=None, min_length=100, max_length=1000)
    auto_generate_text: bool = False
    loudness: float = Field(default=0.5, ge=-1, le=1, allow_inf_nan=False)
    guidance_scale: float = Field(default=5, ge=0, le=100, allow_inf_nan=False)
    seed: Optional[int] = Field(default=None, ge=0, le=2147483647)
    should_enhance: bool = False
    quality: Optional[float] = Field(default=None, ge=-1, le=1, allow_inf_nan=False)
    gender: Optional[Literal["Female", "Male"]] = None

    @model_validator(mode="after")
    def valid_script(self):
        if not self.auto_generate_text and not self.text:
            raise ValueError("Provide an audition script or enable automatic text.")
        if self.model_id == 'eleven_ttv_v3' and self.quality is not None:
            raise ValueError('Quality is available only for Voice Design v2.')
        return self


class VoiceSaveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    ticket: str = Field(min_length=20, max_length=10000)
    voice_name: str = Field(min_length=1, max_length=80)
    traits: list[str] = Field(default_factory=list, max_length=6)
    gender: Optional[Literal["Female", "Male", "Androgynous"]] = None
    age: Optional[Literal["Young adult", "Middle-aged", "Mature"]] = None
    portrait_image: Optional[str] = Field(default=None, max_length=12_000_000)
    preview_audio: Optional[str] = Field(default=None, max_length=12_000_000)


def candidate_ticket(candidate_id, description, owner_id, secret, now=None):
    body = base64.urlsafe_b64encode(json.dumps({
        "id": candidate_id, "description": description, "owner": str(owner_id),
        "expires": int(now if now is not None else time.time()) + 3600,
    }, separators=(",", ":")).encode()).decode()
    signature = hmac.new(secret.encode(), ("nodemere-voice-design:" + body).encode(), hashlib.sha256).hexdigest()
    return body + "." + signature


def verify_ticket(ticket, owner_id, secret, now=None):
    try:
        body, signature = ticket.rsplit(".", 1)
        expected = hmac.new(secret.encode(), ("nodemere-voice-design:" + body).encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError()
        data = json.loads(base64.urlsafe_b64decode(body))
        if data["owner"] != str(owner_id) or data["expires"] < (now if now is not None else time.time()):
            raise ValueError()
        return data
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400, "This audition has expired or is unavailable. Generate a new audition.") from None


PREVIEW_OUTPUT_FORMAT = 'mp3_44100_128'

def provider_post(path, payload, api_key, params=None):
    if not api_key:
        raise HTTPException(503, "Voice Design is not configured on this server.")
    try:
        response = requests.post("https://api.elevenlabs.io/v1/text-to-voice" + path,
                                 headers={"xi-api-key": api_key}, json=payload, params=params, timeout=(10, 120))
    except requests.RequestException:
        raise HTTPException(504, "ElevenLabs did not confirm the request. Please try again shortly.") from None
    if response.status_code >= 400:
        try:
            detail = response.json().get('detail', {})
            code = detail.get('status', '') if isinstance(detail, dict) else ''
        except ValueError:
            code = ''
        messages = {
            401: "Voice provider authentication failed. Contact your workspace administrator.",
            403: "Your voice provider plan does not allow this operation.",
            429: "Voice generation is temporarily limited. Please try again shortly.",
        }
        code_messages = {
            'quota_exceeded': 'Your ElevenLabs credit allowance has been reached. Add credits or wait for your allowance to reset.',
            'voice_limit_reached': 'Your ElevenLabs voice library is full. Free a voice slot before saving.',
            'missing_permissions': 'The ElevenLabs API key needs permission to design and save voices.',
        }
        import logging
        logging.warning('Voice Design provider rejection: HTTP %s, code %s', response.status_code, str(code)[:80])
        error = HTTPException(502, code_messages.get(code) or messages.get(response.status_code, f"ElevenLabs could not complete this voice request (HTTP {response.status_code}). Check your description and available voice slots or credits."))
        error.provider_rejected = True
        raise error
    try:
        return response.json()
    except ValueError:
        raise HTTPException(502, "The voice provider returned an unreadable response.") from None


def design_voice(payload, *, api_key, owner_id):
    body = payload.model_dump(exclude_none=True)
    if payload.gender:
        body["gender"] = payload.gender.lower()
    if payload.auto_generate_text:
        body.pop("text", None)
    result = provider_post("/design", body, api_key, params={"output_format": PREVIEW_OUTPUT_FORMAT})
    previews = result.get("previews") or []
    if not previews or any(not p.get("generated_voice_id") or not p.get("audio_base_64") for p in previews):
        raise HTTPException(502, "ElevenLabs did not return playable auditions. Please try again.")
    return {"text": result.get("text", payload.text), "previews": [{
        "generated_voice_id": p["generated_voice_id"], "audio_base_64": p["audio_base_64"],
        "media_type": p.get("media_type", "audio/mpeg"), "duration_secs": p.get("duration_secs", 0),
        "ticket": candidate_ticket(p["generated_voice_id"], payload.voice_description, owner_id, api_key),
    } for p in previews]}


def _saved_catalog_result(row):
    return {"id": row["id"], "voice_name": row.get("voice_name"), "voice_id": row.get("voice_id"),
            "created_receptionist_id": row["id"]}


def _upload_preview(db, audio, *, owner_id, candidate_id):
    if not audio:
        return None
    try:
        content = base64.b64decode(audio, validate=True)
    except (ValueError, base64.binascii.Error):
        raise HTTPException(400, "The selected voice preview is invalid.") from None
    if not content or len(content) > 8_000_000:
        raise HTTPException(400, "The selected voice preview is too large.")
    storage = db.storage.from_("voices")
    path = f"generated-receptionists/{owner_id}/{candidate_id}.mp3"
    try:
        storage.upload(path, content, {"content-type": "audio/mpeg", "upsert": "true"})
        return storage.get_public_url(path)
    except Exception:
        raise HTTPException(503, "The selected voice preview could not be saved.") from None


def save_voice(payload, *, db, api_key, owner_id, business_id):
    if not api_key:
        raise HTTPException(503, "Voice Design is not configured on this server.")
    candidate = verify_ticket(payload.ticket, owner_id, api_key)
    def existing():
        rows = (db.table("created_receptionists").select("*").eq("user_id", str(owner_id))
                .eq("business_id", business_id).eq("design_candidate_id", candidate["id"]).limit(1).execute().data or [])
        return rows[0] if rows else None
    row = existing()
    if row and row.get("status") in {"ready", "converted"} and row.get("voice_id"):
        return _saved_catalog_result(row)
    if row and row.get("status") != "draft":
        raise HTTPException(409, "This voice save is still being confirmed. Contact support before saving it again.")
    try:
        if row:
            reserved = (db.table("created_receptionists").update({"status": "generating"})
                        .eq("id", row["id"]).eq("user_id", str(owner_id)).eq("business_id", business_id)
                        .eq("status", "draft").execute().data or [])
        else:
            reserved = db.table("created_receptionists").insert({
                "user_id": str(owner_id), "business_id": business_id, "status": "generating",
                "design_candidate_id": candidate["id"], "full_name": payload.voice_name,
                "first_name": payload.voice_name.split()[0],
            }).execute().data or []
    except Exception:
        row = existing()
        if row and row.get("status") in {"ready", "converted"} and row.get("voice_id"):
            return _saved_catalog_result(row)
        raise HTTPException(409, "This voice save is already being processed. Please wait before trying again.") from None
    if not reserved:
        raise HTTPException(409, "This voice save is already being processed.")
    row = reserved[0]
    def update(values):
        return (db.table("created_receptionists").update(values).eq("id", row["id"])
                .eq("user_id", str(owner_id)).eq("business_id", business_id).execute().data or [])
    business_name = "Nodemere"
    try:
        business_rows = db.table("businesses").select("name").eq("id", business_id).limit(1).execute().data or []
        if business_rows:
            business_name = str(business_rows[0].get("name") or "Nodemere").strip() or "Nodemere"
    except Exception:
        pass
    voice_description = candidate["description"]
    if business_name.lower() not in voice_description.lower():
        voice_description = f"{voice_description.rstrip()} The receptionist represents {business_name} and should sound natural when welcoming callers to the business."
    asset_id = str(uuid5(NAMESPACE_URL, f"nodemere:voice-design:{owner_id}:{candidate['id']}"))
    try:
        portrait_url = upload_portrait(db, payload.portrait_image, owner_id=str(owner_id), voice_id=asset_id)
        preview_url = _upload_preview(db, payload.preview_audio, owner_id=str(owner_id), candidate_id=asset_id)
    except Exception:
        update({"status": "draft"})  # No provider write was attempted; retry is safe.
        raise
    try:
        voice = provider_post("", {"voice_name": payload.voice_name, "voice_description": voice_description,
                                   "generated_voice_id": candidate["id"],
                                   "gender": payload.gender.lower() if payload.gender else None}, api_key)
    except HTTPException as error:
        if getattr(error, "provider_rejected", False):
            update({"status": "draft"})
        # Ambiguous timeouts keep the reservation; never create the provider voice twice.
        raise
    voice_id = voice.get("voice_id")
    if not voice_id:
        raise HTTPException(502, "The provider did not confirm a saved voice. Contact support before trying again.")
    try:
        created = update({
            "status": "ready", "full_name": payload.voice_name, "first_name": payload.voice_name.split()[0],
            "gender": payload.gender, "age": payload.age, "description": voice_description,
            "traits": [str(t)[:40] for t in payload.traits], "voice_id": voice_id,
            "voice_name": payload.voice_name, "voice_description": voice_description,
            "voice_preview_url": preview_url or voice.get("preview_url"),
            "portrait_options": ([{"id": "selected", "url": portrait_url}] if portrait_url else []),
            "selected_portrait_id": "selected" if portrait_url else None,
            "selected_portrait_url": portrait_url,
        })
    except Exception:
        raise HTTPException(503, "Your voice was saved, but the catalog could not confirm it. Contact support before retrying.") from None
    if not created:
        raise HTTPException(503, "Your voice was saved, but the catalog could not confirm it. Contact support before retrying.")
    return _saved_catalog_result(created[0])
