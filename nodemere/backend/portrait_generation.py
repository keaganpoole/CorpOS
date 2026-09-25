"""Generate premium, business-aware receptionist portraits for Nodemere Audition."""
import base64
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import HTTPException
from openai import OpenAI, RateLimitError
from pydantic import BaseModel, ConfigDict, Field


class PortraitGenerationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    gender: Optional[str] = Field(default=None, max_length=30)
    age: Optional[str] = Field(default=None, max_length=30)
    voice_traits: list[str] = Field(default_factory=list, max_length=8)
    voice_description: str = Field(default="", max_length=1000)


def _business_context(db, owner_id: str) -> tuple[str, str, str, str]:
    business = (db.table("businesses").select("name,industry,about_us").eq("user_id", owner_id)
                .limit(1).execute().data or [None])[0] or {}
    config = (db.table("account_settings").select("preferences").eq("user_id", owner_id)
              .limit(1).execute().data or [None])[0] or {}
    preferences = config.get("preferences") if isinstance(config.get("preferences"), dict) else {}
    general_preferences = preferences.get("general") if isinstance(preferences.get("general"), dict) else {}
    industry = business.get("industry")
    if isinstance(industry, dict):
        industry = industry.get("industry") or industry.get("name") or ""
    return (str(business.get("name") or "the business").strip(),
            str(industry or "professional services").strip(),
            str(general_preferences.get("brand_color") or "").strip(),
            str(business.get("about_us") or "").strip()[:600])


def _prompt(*, business_name: str, industry: str, brand_color: str, business_description: str, payload: PortraitGenerationRequest, option: int) -> str:
    gender = payload.gender or "a warm, polished person"
    age = payload.age or "adult"
    traits = ", ".join(payload.voice_traits[:6]) or "warm, confident, attentive"
    palette = f"Use {brand_color} as a restrained, tasteful accent in the clothing or one small accessory; never use it as a loud full-frame color cast." if brand_color else "Use a refined neutral wardrobe with one tasteful, understated accent color."
    traits_lower = {trait.lower() for trait in payload.voice_traits}
    expressive = traits_lower.intersection({"playful", "outgoing", "charming", "friendly", "motivational"})
    if "calm" in traits_lower or "caring" in traits_lower:
        posture_note = "Use a relaxed, open posture: shoulders lowered, comfortably leaning back slightly in the chair, one arm resting naturally, with an easy attentive expression. Keep it professional and believable, never slouched or careless."
    elif "motivational" in traits_lower or "serious" in traits_lower:
        posture_note = "Use an upright, engaged posture: shoulders open, leaning slightly toward the workstation, focused on the computer or caller as if actively solving something. Make the body language purposeful and confident."
    elif "playful" in traits_lower or "charming" in traits_lower:
        posture_note = "Use an expressive, confident posture: a slight conversational lean, relaxed shoulders, an open gesture or subtle head tilt, and lively body language that feels spontaneous rather than posed."
    else:
        posture_note = "Use a natural, approachable posture with relaxed shoulders, balanced seated alignment, and a small conversational gesture rather than a formal corporate pose."
    personality_note = (
        "Make the moment feel candid and expressive rather than posed: the receptionist is caught mid-conversation, speaking animatedly on a discreet headset or phone, with natural gesture and lively facial expression."
        if expressive else
        "Make the moment feel natural and observed rather than posed: the receptionist is focused on a realistic front-desk task with a subtle, genuine expression and relaxed body language."
    )
    variations = [
        "a three-quarter camera angle as they turn slightly toward a caller, caught mid-sentence with a natural hand gesture",
        "a candid over-the-desk perspective as they glance between the caller and the workstation, with a relaxed half-smile",
    ]
    business_note = f"Verified business context: {business_description}" if business_description else "No detailed business context is available."
    return f"""Create a premium stylized-CGI receptionist portrait for a business in the {industry} industry. The business context is for wardrobe and atmosphere only. NEVER render the business name or any business-specific wording inside the image. Use the supplied reference images as permanent master visual-style references only: match their visual system, not their identity, face, hairstyle, pose, room layout, exact objects, or literal business.

The target is polished cinematic stylized realism: a refined animated-character design rendered with sophisticated three-dimensional CGI materials. It must sit between believable human rendering and high-end animated illustration. It must NOT look like a photograph, generic AI headshot, flat illustration, anime, cel shading, painterly art, low-poly model, plastic toy, or realistic stock portrait. The semi-cartoon character quality is intentional and essential.

CHARACTER: The receptionist is {gender}, {age}, with {traits} energy. Give them beautifully sculpted facial geometry, soft rounded forms, refined anatomy, slightly stylized proportions, expressive gently enlarged eyes, deep glossy irises, crisp pupils, clean sclera, dimensional corneal highlights, individually separated lashes, groomed brow hairs, softly luminous satin skin with subtle subsurface scattering, sculpted lips with restrained gloss, and premium hair with layered strands, silky flow, fine flyaways, controlled shine, and rich internal shadow. Keep the character warm, believable, elegant, and highly polished. {posture_note} {personality_note} {variations[option % len(variations)]}.

ENVIRONMENT: {business_note} The business is described as operating in the {industry} industry. Every setting must be a modern, renovated, updated professional interior with contemporary finishes, clean architecture, thoughtful lighting, and well-maintained materials. This modern-office standard is mandatory regardless of industry: even an auto repair business, trade, salon, or relaxed workplace should show a polished contemporary front office or reception area, never a dated, rundown, grimy, cluttered, or neglected room. Use the industry to guide the details and props only when the context is reliable. If the industry or description is missing, vague, contradictory, or uncertain, use a tasteful modern general office or reception interior and a stylish smart-casual outfit. Do not default to a corporate uniform, generic white button-up, stiff suit, severe blazer, conservative ponytail, or bland office hairstyle. Clothing should look intentionally styled, flattering, modern, and appropriate for the business: use a refined blazer or polished formalwear only for law, finance, medical, executive, or similarly formal settings; use a stylish plain tee, knit top, overshirt, or practical casual workwear for salons, studios, retail, trades, auto body, fitness, or other relaxed businesses. Add one or two tasteful personal details when appropriate, such as styled hair, elegant earrings, a subtle necklace, or a discreet modern smartwatch, without making the character flashy or distracting. Include a believable receptionist workstation with a slim computer monitor showing only an abstract blurred interface with no readable content, a keyboard, mouse, and one subtle Bluetooth headset or discreet earpiece when it fits the composition. Use practical, organized, upscale materials such as a desk, shelving, soft furnishings, wood, glass, or metal. Keep the background secondary, softly layered and subtly out of focus while still visibly designed.

COLOR: {palette} The brand color is an accent instruction, not a background wash, logo, signage, or text color. If no brand color is provided, use restrained neutrals and a tasteful accent chosen from the wardrobe and environment.

LIGHTING AND FINISH: Use soft warm cinematic indoor lighting, smooth highlight rolloff, gentle shadow transitions, believable ambient depth, refined material separation, subtle depth of field, and a premium final-render finish. The character and environment must feel like they came from the same art direction team, shader system, lighting philosophy, and production pipeline as the references.

COMPOSITION: Use a balanced 4:5 portrait composition with a dynamic, natural camera placement rather than a symmetrical corporate headshot. Do not face the camera squarely with a generic corporate smile. Capture a specific candid moment: turning toward a caller, speaking naturally through a discreet headset, reaching toward the keyboard, reviewing an abstract screen, gesturing mid-conversation, or leaning comfortably in the chair. The pose, camera angle, expression, wardrobe styling, and moment must vary between options. Show one person only, framed from the chest up or seated behind the workstation, with enough environment to establish the setting. Keep the face as the visual anchor while allowing the keyboard, mouse, monitor edge, and headset to read as contextual details. No distracting pose, no hands covering the face, no background people.

STRICT EXCLUSIONS — HARD IMAGE CONSTRAINT: The image must contain zero text. No words, letters, numbers, symbols, glyphs, typography, pseudo-text, scribbles, labels, logos, watermarks, signage, posters, certificates, documents, menus, packaging, badges, name tags, readable or unreadable UI, keyboard lettering, branded marks, framed portraits, wall photos of people, or business names. Do not place text anywhere in the foreground, background, clothing, accessories, screens, walls, props, or reflections. Do not create signs or screens that merely look like text. Screens must be blank, softly blurred, or replaced with abstract geometric color blocks only. If an object might normally contain writing, make it plain, blank, or omit it. If the business context conflicts with this rule, the no-text rule wins. Do not copy the reference characters or create an exact celebrity or real-person likeness."""


def _generate_one(client: OpenAI, prompt: str, model: str) -> dict:
    result = client.images.generate(model=model, prompt=prompt, size="1024x1280", quality="medium", n=1)
    item = (result.data or [None])[0]
    encoded = getattr(item, "b64_json", None) if item else None
    if not encoded:
        raise RuntimeError("OpenAI did not return a portrait image")
    return {"data_url": f"data:image/png;base64,{encoded}"}


def generate_portraits(payload: PortraitGenerationRequest, *, db, api_key: str, owner_id: str) -> dict:
    logging.info("portrait generation configuration loaded=%s", bool(api_key))
    if not api_key:
        raise HTTPException(503, "Portrait generation is not configured on this server.")
    business_name, industry, brand_color, business_description = _business_context(db, owner_id)
    # Medium quality keeps audition previews affordable while preserving the portrait dimensions.
    model = os.environ.get("OPENAI_RECEPTIONIST_IMAGE_MODEL", "gpt-image-1-mini")
    client = OpenAI(api_key=api_key, timeout=150)
    prompts = [_prompt(business_name=business_name, industry=industry, brand_color=brand_color, business_description=business_description, payload=payload, option=index) for index in range(2)]
    try:
        with ThreadPoolExecutor(max_workers=3) as executor:
            images = list(executor.map(lambda prompt: _generate_one(client, prompt, model), prompts))
    except RateLimitError as exc:
        error_text = str(exc).lower()
        if "insufficient_quota" in error_text or "credit_balance_exhausted" in error_text:
            raise HTTPException(402, "OpenAI image generation has no credits remaining. Add credits to the OpenAI project and retry this portrait step.") from exc
        raise HTTPException(429, "OpenAI image generation is temporarily rate-limited. Please wait a moment and retry.") from exc
    except Exception as exc:
        logging.exception("receptionist portrait generation failed")
        raise HTTPException(502, "The portrait studio could not finish these options. Please try again.") from exc
    return {"images": [{"id": f"portrait-{index + 1}", **image} for index, image in enumerate(images)], "model": model}


def upload_portrait(db, data_url: Optional[str], *, owner_id: str, voice_id: str) -> Optional[str]:
    if not data_url:
        return None
    prefix = "data:image/png;base64,"
    if not data_url.startswith(prefix) or len(data_url) > 12_000_000:
        raise HTTPException(400, "The selected portrait is invalid.")
    try:
        content = base64.b64decode(data_url[len(prefix):], validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise HTTPException(400, "The selected portrait is invalid.") from exc
    if not content or len(content) > 8_000_000:
        raise HTTPException(400, "The selected portrait is too large.")
    path = f"generated-receptionists/{owner_id}/{voice_id}.png"
    try:
        storage = db.storage.from_("business-avatars")
        storage.upload(path, content, {"content-type": "image/png", "upsert": "true"})
        return storage.get_public_url(path)
    except Exception as exc:
        logging.exception("receptionist portrait upload failed")
        raise HTTPException(503, "The selected portrait could not be saved.") from exc
