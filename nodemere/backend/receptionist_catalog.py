"""Private Studio catalog records; hiring is a separate, atomic operation."""
from fastapi import HTTPException
from postgrest.exceptions import APIError


def normalize_created_receptionist(row):
    return {
        "id": f"created:{row['id']}", "catalog_id": None,
        "source": "created_receptionist", "created_receptionist_id": row["id"],
        "full_name": row.get("full_name"), "first_name": row.get("first_name"),
        "description": row.get("description"), "stereotype": "Studio Voice Design",
        "avatar": row.get("selected_portrait_url"), "voice": row.get("voice_preview_url"),
        "traits": row.get("traits") or [], "age": row.get("age"), "gender": row.get("gender"),
        "elevenlabs_voice_id": row.get("voice_id"), "is_active": True,
    }


def private_created_catalog(db, *, owner_id, business_id):
    rows = (db.table("created_receptionists").select("*")
            .eq("user_id", str(owner_id)).eq("business_id", business_id)
            .eq("status", "ready").order("created_at", desc=True).execute().data or [])
    return [normalize_created_receptionist(row) for row in rows if row.get("voice_id") and not row.get("hired_receptionist_id")]


def hire_created_receptionist(db, *, created_id, owner_id, business_id, limit):
    try:
        result = db.rpc("nodemere_hire_created_receptionist", {
            "target_id": int(created_id), "target_owner": str(owner_id),
            "target_business": business_id, "receptionist_limit": limit,
        }).execute().data
    except (TypeError, ValueError):
        raise HTTPException(400, "Invalid created receptionist identifier") from None
    except APIError as error:
        message = str(error)
        if "created_not_found" in message:
            raise HTTPException(404, "Created receptionist not found") from None
        if "created_not_ready" in message:
            raise HTTPException(409, "This receptionist is not ready to hire") from None
        if "created_plan_limit" in message:
            raise HTTPException(402, "Your plan's receptionist limit has been reached") from None
        if "PGRST202" in message:
            raise HTTPException(503, "Catalog hiring is temporarily unavailable") from None
        raise
    if not isinstance(result, dict) or not result.get("receptionist"):
        raise HTTPException(503, "The receptionist hire was not confirmed")
    return result
