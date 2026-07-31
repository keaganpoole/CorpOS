"""Testing-only document upload requests and file persistence."""

import logging
import mimetypes
import os
from pathlib import PurePosixPath
from uuid import uuid4

from .request_service import complete_request, create_request, get_public_request, get_request_status, load_request_by_token

DOCUMENT_REQUEST_TYPE = "document_upload"
DOCUMENT_BUCKET = os.environ.get("DOCUMENT_UPLOAD_BUCKET", "caller-documents")
DOCUMENT_UPLOAD_DEBUG = os.environ.get("DOCUMENT_UPLOAD_DEBUG", "true").strip().lower() in {"1", "true", "yes", "on"}
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf", "image/jpeg", "image/png", "image/webp",
    "text/plain", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def create_document_request(supabase, *, base_url: str, **context) -> dict:
    return create_request(
        supabase, base_url=base_url, path_prefix="upload", request_type=DOCUMENT_REQUEST_TYPE,
        link_key="request_url",
        **context,
    )


def get_document_request(supabase, token: str) -> dict:
    return get_public_request(supabase, token, DOCUMENT_REQUEST_TYPE)


def get_document_request_status(supabase, *, request_id=None, token=None, business_id=None) -> dict:
    result = get_request_status(
        supabase,
        request_id=request_id,
        token=token,
        request_type=DOCUMENT_REQUEST_TYPE,
        business_id=business_id,
    )
    resolved_request_id = result.get("request_id")
    if not resolved_request_id or not result.get("success"):
        return result
    try:
        response = (
            supabase.table("people_docs")
            .select("id,request_id,business_id,person_id,file_name,content_type,file_size,created_at,metadata")
            .eq("request_id", resolved_request_id)
            .order("created_at", desc=True)
            .execute()
        )
        docs = response.data or []
    except Exception as exc:
        logging.error("Failed to fetch docs for request %s: %s", resolved_request_id, exc, exc_info=True)
        docs = []
    return {**result, "documents": docs, "document_count": len(docs)}


def _safe_filename(filename: str) -> str:
    name = PurePosixPath(str(filename or "document").replace("\\", "/")).name
    name = "".join(char for char in name if char.isalnum() or char in {".", "-", "_", " "}).strip()
    return name[:160] or "document"


def store_document(supabase, *, token: str, filename: str, content_type: str, content: bytes) -> dict:
    request = load_request_by_token(supabase, token, DOCUMENT_REQUEST_TYPE)
    if not request:
        return {"success": False, "status": "not_found", "message": "This upload link is invalid."}
    from .request_service import expire_if_needed
    request = expire_if_needed(supabase, request)
    if request.get("status") == "expired":
        return {"success": False, "status": "expired", "message": "This upload link has expired."}
    if request.get("status") != "pending":
        return {"success": False, "status": request.get("status"), "message": "This upload request is no longer accepting files."}
    if not content:
        return {"success": False, "status": "invalid", "message": "Choose a file to upload."}
    if len(content) > MAX_DOCUMENT_BYTES:
        return {"success": False, "status": "too_large", "message": "Files must be 10 MB or smaller."}
    normalized_type = (content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream").lower()
    if normalized_type not in ALLOWED_DOCUMENT_TYPES:
        return {"success": False, "status": "unsupported", "message": "This file type is not supported."}

    person_id = request.get("person_id")
    business_id = request.get("business_id")
    safe_name = _safe_filename(filename)
    storage_path = f"business/{business_id or 'unknown'}/person/{person_id or 'unknown'}/requests/{request['id']}/{uuid4().hex}-{safe_name}"
    try:
        supabase.storage.from_(DOCUMENT_BUCKET).upload(
            storage_path, content, {"content-type": normalized_type, "upsert": "false"}
        )
        row = {
            "request_id": request["id"], "business_id": business_id, "person_id": person_id,
            "file_name": safe_name, "storage_bucket": DOCUMENT_BUCKET, "storage_path": storage_path,
            "content_type": normalized_type, "file_size": len(content), "metadata": {},
        }
        response = supabase.table("people_docs").insert(row).execute()
        saved = (response.data or [row])[0]
        completed = complete_request(supabase, token, DOCUMENT_REQUEST_TYPE, completed_status="completed")
        return {"success": True, "status": "completed", "request_id": str(request["id"]), "document_id": str(saved.get("id")), "file_name": safe_name, "completed_at": completed.get("completed_at")}
    except Exception as exc:
        logging.error("Document upload failed for request %s: %s", request.get("id"), exc, exc_info=True)
        result = {"success": False, "status": "upload_failed", "message": "The file could not be uploaded. Please try again."}
        if DOCUMENT_UPLOAD_DEBUG:
            result["debug"] = str(exc)
        return result
