"""Monthly Audition creation quota, separate from hired receptionist limits."""
from datetime import datetime, timezone

from fastapi import HTTPException


LIMITS = {"free": 2, "essentials": 5, "pro": 15, "ultra": 15}


def quota_snapshot(db, owner_id, plan):
    month_start = datetime.now(timezone.utc).date().replace(day=1).isoformat()
    rows = (db.table("audition_creation_usage").select("id")
            .eq("user_id", str(owner_id)).eq("month_start", month_start).execute().data or [])
    limit = LIMITS.get(plan, LIMITS["free"])
    return {"plan": plan, "used": len(rows), "limit": limit,
            "remaining": max(0, limit - len(rows)), "month_start": month_start,
            "capped": len(rows) >= limit}


def require_creation_slot(db, owner_id, plan):
    snapshot = quota_snapshot(db, owner_id, plan)
    if snapshot["capped"]:
        raise quota_error(snapshot)
    return snapshot


def quota_error(snapshot):
    return HTTPException(402, {"code": "audition_creation_limit_reached",
                               "message": "You've reached your monthly receptionist creation limit. Upgrade your plan to create more.",
                               **snapshot})


def reserve_creation(db, owner_id, business_id, candidate_id, plan):
    try:
        result = db.rpc("nodemere_reserve_audition_creation", {
            "target_owner": str(owner_id), "target_business": business_id,
            "candidate_id": candidate_id,
        }).execute()
        if result.data == -1:
            raise HTTPException(409, "This audition creation is already being processed.")
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        if "audition_creation_limit_reached" in str(exc):
            raise quota_error(quota_snapshot(db, owner_id, plan)) from None
        raise


def finish_creation(db, owner_id, business_id, candidate_id, completed):
    db.rpc("nodemere_finish_audition_creation", {
        "target_owner": str(owner_id), "target_business": business_id,
        "candidate_id": candidate_id, "completed": completed,
    }).execute()
