"""Testing-only document upload requests and file persistence."""

import logging
import mimetypes
import os
from datetime import datetime, timezone
from pathlib import PurePosixPath
from uuid import uuid4

from .request_service import complete_request, create_request, get_public_request, get_request_status, load_request_by_token
from .upload_validation import validate_document, scan_document, EXTENSIONS
from .envelope import seal_file, encryption_required

DOCUMENT_REQUEST_TYPE = "document_upload"
DOCUMENT_BUCKET = os.environ.get("DOCUMENT_UPLOAD_BUCKET", "caller-documents")
DOCUMENT_UPLOAD_DEBUG = False
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
    result = get_public_request(supabase, token, DOCUMENT_REQUEST_TYPE)
    if not result.get("success"):
        return result

    business_name = None
    request = load_request_by_token(supabase, token, DOCUMENT_REQUEST_TYPE)
    business_id = (request or {}).get("business_id")
    if business_id is not None:
        try:
            response = (
                supabase.table("businesses")
                .select("name")
                .eq("id", business_id)
                .limit(1)
                .execute()
            )
            business_name = str((response.data or [{}])[0].get("name") or "").strip() or None
        except Exception as exc:
            logging.warning('document_service.get_document_request.event_50')

    return {**result, "business_name": business_name}


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
        logging.error('document_service.get_document_request_status.event_76')
        docs = []
    return {**result, "documents": docs, "document_count": len(docs)}


def _safe_filename(filename: str) -> str:
    name = PurePosixPath(str(filename or "document").replace("\\", "/")).name
    name = "".join(char for char in name if char.isalnum() or char in {".", "-", "_", " "}).strip()
    return name[:160] or "document"


def store_document(supabase, *, token: str, filename: str, content_type: str, content: bytes, notice_accepted: bool = False) -> dict:
    request = load_request_by_token(supabase, token, DOCUMENT_REQUEST_TYPE)
    if not request:
        return {"success": False, "status": "not_found", "message": "This upload link is invalid."}
    from .request_service import expire_if_needed
    request = expire_if_needed(supabase, request)
    if request.get("status") == "expired":
        return {"success": False, "status": "expired", "message": "This upload link has expired."}
    if request.get("status") != "pending":
        return {"success": False, "status": request.get("status"), "message": "This upload request is no longer accepting files."}
    if notice_accepted is not True:
        return {"success": False, "status": "notice_required", "message": "Confirm the document upload notice before uploading a file."}
    if not content:
        return {"success": False, "status": "invalid", "message": "Choose a file to upload."}
    if len(content) > MAX_DOCUMENT_BYTES:
        return {"success": False, "status": "too_large", "message": "Files must be 10 MB or smaller."}
    try:
        normalized_type = validate_document(content, content_type)
        scan_document(content, normalized_type)
    except Exception:
        return {"success": False, "status": "unsupported", "message": "The file is invalid, unsupported, or contains active content."}

    person_id = request.get("person_id")
    business_id = request.get("business_id")
    if business_id is None or person_id is None:
        return {"success":False,"status":"invalid","message":"The request has no authorized recipient."}
    people = supabase.table("people").select("id").eq("id",person_id).eq("business_id",business_id).limit(1).execute().data
    if not people:
        return {"success":False,"status":"invalid","message":"The request recipient is unavailable."}
    safe_name = _safe_filename(filename)
    storage_path = f"business/{business_id}/person/{person_id}/requests/{request['id']}/{uuid4().hex}{EXTENSIONS[normalized_type]}"
    raw_db = getattr(supabase, 'raw', supabase)
    if encryption_required(raw_db, business_id): storage_path += '.ndmenc'
    uploaded, persisted, insert_attempted = False, False, False
    try:
        stored_content = seal_file(raw_db, content, business_id=business_id, bucket=DOCUMENT_BUCKET, path=storage_path)
        supabase.storage.from_(DOCUMENT_BUCKET).upload(
            storage_path, stored_content, {"content-type": 'application/octet-stream' if storage_path.endswith('.ndmenc') else normalized_type, "upsert": "false"}
        )
        uploaded = True
        row = {
            "id": str(uuid4()),
            "request_id": request["id"], "business_id": business_id, "person_id": person_id,
            "file_name": safe_name, "storage_bucket": DOCUMENT_BUCKET, "storage_path": storage_path,
            "content_type": normalized_type, "file_size": len(content),
            "metadata": {"upload_notice_accepted_at": datetime.now(timezone.utc).isoformat()},
        }
        insert_attempted = True
        response = supabase.table("people_docs").insert(row).execute()
        persisted = True
        saved = (response.data or [row])[0]
        completed = complete_request(supabase, token, DOCUMENT_REQUEST_TYPE, completed_status="completed")
        return {"success": True, "status": "completed", "request_id": str(request["id"]), "document_id": str(saved.get("id")), "file_name": safe_name, "completed_at": completed.get("completed_at")}
    except Exception as exc:
        # A timeout can happen AFTER the insert commits. Never delete a file
        # that might already be referenced by a saved document. Preserve an
        # orphan for later reconciliation instead of risking permanent loss.
        if uploaded and not insert_attempted:
            try: supabase.storage.from_(DOCUMENT_BUCKET).remove([storage_path])
            except Exception: logging.error('document_service.upload_cleanup.event_1')
        logging.error('document_service.store_document.event_126')
        if insert_attempted and not persisted:
            return {"success": False, "status": "upload_unconfirmed", "message": "The upload outcome could not be confirmed. Refresh your documents before retrying."}
        result = {"success": False, "status": "upload_failed", "message": "The file could not be uploaded. Please try again."}
        return result
