"""Outbound payment quotes and Stripe Checkout for the customer bound to the call."""
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from hashlib import sha256
from hmac import compare_digest, new as hmac_new
from uuid import NAMESPACE_URL, uuid4, uuid5

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, StrictBool

from .email_delivery_service import EmailDeliveryError, send_secure_link_email


class PaymentLookup(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customer_email: EmailStr
    conversation_history: SecretStr = Field(max_length=512000)
    service_name: str | None = Field(None, max_length=160)


class PaymentSend(PaymentLookup):
    confirmed_amount_cents: int = Field(gt=0, le=99999999, strict=True)
    confirmed: StrictBool
    quote_id: str = Field(min_length=1, max_length=64)


def digest(value):
    return sha256(str(value).encode()).hexdigest()


def contact_digits(value):
    digits = "".join(c for c in str(value or "") if c.isascii() and c.isdigit())
    return "1" + digits if len(digits) == 10 else digits


def outbound_payment_claims(person, dialed, appointment=None):
    email = str(person.get("email") or "").strip().casefold()
    phone = contact_digits(person.get("phone"))
    if not person.get("id") or not email or not phone or contact_digits(dialed) != phone:
        return {}
    claims = {"payment_call": str(uuid4()), "payment_person": str(person["id"]),
              "payment_contact": digest(phone + "|" + email)}
    if (appointment and appointment.get("id") and appointment.get("service_id")
            and str(appointment.get("person_id")) == claims["payment_person"]):
        claims["payment_appointment"] = str(appointment["id"])
        claims["payment_service"] = str(appointment["service_id"])
    return claims


def cents(value):
    try:
        amount = Decimal(str(value)) * 100
        if amount.is_finite() and 0 < amount <= 99999999 and amount == amount.to_integral_value():
            return int(amount)
    except (ValueError, InvalidOperation):
        pass
    return None


def quote_for(person, service_name, services):
    if service_name:
        matches = [s for s in services if str(s["name"]).strip().casefold() == service_name.strip().casefold()]
        if len(matches) != 1 or matches[0].get("price_type") != "fixed":
            return None
        service = matches[0]
        amount, purpose, source = cents(service.get("price_min")), service["name"], "service:" + str(service["id"])
    else:
        # A separately invoiced balance must be settled against its existing invoice.
        if person.get("invoice_id") or str(person.get("payment_status") or "").lower() in {"paid", "succeeded"}:
            return None
        amount, purpose, source = cents(person.get("balance_due")), "Balance due", "balance"
    return {"amount_cents": amount, "currency": "usd", "purpose": purpose, "source": source} if amount else None


def _provider_state(api, row, options):
    session_id = row.get("stripe_session_id")
    intent_id = row.get("stripe_payment_intent_id")
    session = None
    if session_id:
        session = api.stripe.checkout.Session.retrieve(session_id, expand=["payment_intent.latest_charge"], **options)
        intent = session.get("payment_intent")
    elif intent_id:
        intent = api.stripe.PaymentIntent.retrieve(intent_id, expand=["latest_charge"], **options)
    else:
        return "pending", None
    if isinstance(intent, str):
        intent = api.stripe.PaymentIntent.retrieve(intent, expand=["latest_charge"], **options)
    if intent and intent.get("status") == "succeeded":
        received, currency = intent.get("amount_received"), intent.get("currency")
        if (received is not None and received != int(row["amount"])) or (currency and currency != row["currency"]):
            raise HTTPException(409, "The recorded payment amount could not be verified.")
    return _intent_status(api, intent, session, int(row["amount"]), options), session


def _intent_status(api, intent, session, amount, options):
    if intent and intent.get("status") == "succeeded":
        charge = intent.get("latest_charge") or {}
        if isinstance(charge, str):
            charge = api.stripe.Charge.retrieve(charge, **options)
        refunded = int(charge.get("amount_refunded") or 0)
        if refunded:
            return ("refunded" if refunded >= amount else "partial_refund")
        return "paid"
    if session and session.get("status") == "expired":
        return "expired"
    if intent and (intent.get("status") == "canceled" or intent.get("last_payment_error")):
        return "failed"
    return "pending"


def verify_caller_turns(payload):
    # ElevenLabs supplies this parameter from its reserved system variable.
    # Do not persist or log history, including unrelated turns or tool data.
    try:
        history = json.loads(payload.conversation_history.get_secret_value())
    except (ValueError, RecursionError):
        history = None
    entries = history.get("entries") if isinstance(history, dict) else None
    if not isinstance(entries, list):
        raise HTTPException(409, "Caller-stated email unavailable. Ask the customer to state their email.")
    last_email = None
    send_attempted = False
    previous_quote = None
    lookup_completed = quote_spoken = customer_replied = False
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if isinstance(payload, PaymentSend):
            # Resolved webhook bodies can put tool results on an agent turn.
            results = (entry.get("tool_results") or []) if entry.get("role") in {"agent", "tool"} else []
            result_names = {result.get("tool_name") for result in results if isinstance(result, dict)}
            if "get_payments" in result_names:
                lookup_completed, quote_spoken, customer_replied = True, False, False
            if entry.get("role") == "agent":
                if lookup_completed and entry.get("message"):
                    quote_spoken = True
                for request in entry.get("tool_requests") or []:
                    if isinstance(request, dict) and request.get("tool_name") == "send_payment_link":
                        params = request.get("params_as_json")
                        previous_quote = params.get("quote_id") if isinstance(params, dict) else None
            if "send_payment_link" in result_names and previous_quote in (None, payload.quote_id):
                send_attempted = True
        if entry.get("role") != "user" or not isinstance(entry.get("message"), str):
            continue
        if quote_spoken and entry["message"].strip():
            customer_replied = True
        message = entry["message"].casefold()
        for word, symbol in (("at", "@"), ("dot", "."), ("plus", "+"), ("underscore", "_"), ("dash", "-")):
            message = re.sub(r"\s+" + word + r"\s+", lambda _: symbol, message)
        message = re.sub(r"\s*([@])\s*", r"\1", message)
        emails = re.findall(r"[\w.!#$%&'*+/=?^_`{|}~-]+@(?:[\w-]+\.)+[\w-]+", message)
        if emails:
            last_email = emails[-1]
    if last_email != str(payload.customer_email).casefold():
        raise HTTPException(409, "Ask the caller to state or spell their full email before looking up a payment.")
    if isinstance(payload, PaymentSend) and send_attempted:
        raise HTTPException(409, "A send was already attempted on this call. Offer staff follow-up.")
    if isinstance(payload, PaymentSend) and not customer_replied:
        raise HTTPException(409, "Read the quote and destination to the customer and wait for their agreement.")


def handle_payment(api, claims, payload):
    owner, business_id = claims.get("sub"), claims.get("business_id")
    person_id = claims.get("payment_person")
    if not all((owner, business_id, person_id, claims.get("payment_call"), claims.get("payment_contact"))):
        raise HTTPException(403, "A customer-bound outbound call is required.")
    verify_caller_turns(payload)
    api.require_payment_access(owner)
    person = api.load_person_by_id_for_user(owner, person_id) or {}
    email = str(person.get("email") or "").strip()
    phone = contact_digits(person.get("phone"))
    if (str(person.get("business_id")) != str(business_id) or str(person.get("id")) != person_id
            or email.casefold() != str(payload.customer_email).casefold()
            or digest(phone + "|" + email.casefold()) != claims["payment_contact"]):
        raise HTTPException(403, "Customer details could not be verified.")
    options = api._get_connected_stripe_request_options(owner)
    if api.is_payment_test_mode():
        is_explicit_stripe_test = (
            api.is_real_stripe_test_mode()
            and isinstance(options.get("api_key"), str)
            and options["api_key"].startswith(("sk_test_", "rk_test_"))
        )
        if not is_explicit_stripe_test:
            raise HTTPException(409, "Checkout is unavailable in local simulation mode.")
    account = options["stripe_account"]
    mode = "test" if "_test_" in options["api_key"] else "live"
    def records():
        return api.supabase.table("payments").select("*").eq("business_id", business_id).eq("user_id", owner).eq("person_id", person_id)
    services = []
    if payload.service_name:
        # Match literal names, including names containing wildcard characters.
        services = api.supabase.table("services").select("id,name,price_min,price_type").eq(
            "business_id", business_id).eq("is_active", True).eq("name", payload.service_name.strip()).limit(2).execute().data
    quote = quote_for(person, payload.service_name, services)
    if quote:
        signed_fields = (claims["payment_call"], person_id, account, mode, quote["source"], str(quote["amount_cents"]), claims["payment_contact"])
        quote["quote_id"] = hmac_new(api.internal_tool_secret.encode(), "|".join(signed_fields).encode(), sha256).hexdigest()[:32]
    if isinstance(payload, PaymentSend):
        if (not payload.confirmed or not quote
                or quote["amount_cents"] != payload.confirmed_amount_cents
                or not compare_digest(quote["quote_id"].encode(), payload.quote_id.encode())):
            raise HTTPException(409, "A current price and explicit agreement are required.")
        return _send(api, claims, quote, email, options, mode, records)

    rows = records().order("created_at", desc=True).limit(10).execute().data or []

    def read_record(row):
        meta = row.get("metadata") or {}
        if meta.get("voice_mode") and (meta["voice_mode"] != mode or meta.get("account") != account):
            return None
        if not (row.get("stripe_session_id") or row.get("stripe_payment_intent_id")):
            return None
        try:
            status, session = _provider_state(api, row, options)
        except api.stripe.InvalidRequestError as exc:
            if getattr(exc, "code", "") == "resource_missing":
                return None
            raise
        intent = (session or {}).get("payment_intent")
        intent_id = intent.get("id") if isinstance(intent, dict) else intent
        return (intent_id or row.get("stripe_payment_intent_id"),
                {"amount_cents": row["amount"], "currency": row["currency"], "status": status,
                 "created_at": row.get("created_at"), "purpose": meta.get("purpose") or "Payment"})

    # All database reads stay in the authenticated request. Only independent
    # Stripe reads use workers, each with the explicit connected account.
    with ThreadPoolExecutor(max_workers=4) as pool:
        verified = [result for result in pool.map(read_record, rows) if result]
    history = [record for _, record in verified]
    known_intents = {intent_id for intent_id, _ in verified}
    customer_id = person.get("stripe_customer_id")
    if customer_id:
        # Older Checkout rows did not persist person_id locally. Require the
        # original server-written owner and person metadata on the actual intent.
        try:
            old = api.stripe.PaymentIntent.list(customer=customer_id, limit=10, expand=["data.latest_charge"], **options)
        except api.stripe.InvalidRequestError as exc:
            if getattr(exc, "code", "") != "resource_missing":
                raise
            old = {"data": []}
        for intent in old["data"]:
            metadata = intent.get("metadata") or {}
            if (intent["id"] in known_intents or metadata.get("user_id") != owner
                    or metadata.get("person_id") != person_id or intent.get("customer") != customer_id):
                continue
            amount = intent["amount"]
            history.append({"amount_cents": amount, "currency": intent["currency"],
                            "status": _intent_status(api, intent, None, amount, options),
                            "created_at": datetime.fromtimestamp(intent["created"], timezone.utc).isoformat(),
                            "purpose": "Payment"})
    history.sort(key=lambda item: item["created_at"] or "", reverse=True)
    return {"quote": quote, "payments": history[:10], "history_scope": "Recent verified payments for this customer."}


def _send(api, claims, quote, email, options, mode, records):
    owner, business_id, person_id = claims["sub"], claims["business_id"], claims["payment_person"]
    amount = quote["amount_cents"]
    account = options["stripe_account"]
    # A CRM balance has no invoice identifier. A settled balance of the same
    # amount must be reconciled before it can be collected again.
    appointment = claims.get("payment_appointment") if quote["source"] == "service:" + str(claims.get("payment_service")) else None
    occurrence = appointment or "outstanding"
    key = str(uuid5(NAMESPACE_URL, "|".join([owner, str(business_id), person_id, account, mode, quote["source"], occurrence])))
    mail_config = api._system_resend_configuration()
    if mail_config.missing_fields():
        raise HTTPException(503, "Payment email is unavailable.")

    def read(record_id):
        return next(iter(records().eq("id", record_id).limit(1).execute().data or []), None)
    row = read(key)
    status, session = "pending", None
    # Expired sessions cannot collect a second charge. A changed CRM balance
    # may start a new checkout only after the old session has settled.
    visited_sessions = set()
    while row and row.get("stripe_session_id"):
        if row["stripe_session_id"] in visited_sessions:
            raise HTTPException(409, "Payment history requires review.")
        visited_sessions.add(row["stripe_session_id"])
        successor_key = str(uuid5(NAMESPACE_URL, "voice-successor:" + row["stripe_session_id"]))
        successor = read(successor_key)
        if successor:
            key, row = successor_key, successor
            continue
        status, session = _provider_state(api, row, options)
        changed_balance = quote["source"] == "balance" and int(row["amount"]) != amount
        new_service_order = (quote["source"].startswith("service:") and not appointment
                             and row["metadata"].get("origin_call") != claims["payment_call"])
        if status == "expired" or (status == "paid" and (changed_balance or new_service_order)):
            key, row = successor_key, None
            status, session = "pending", None
        break
    public_url = api.get_public_backend_base_url()
    if not public_url:
        raise HTTPException(503, "The customer checkout return URL is unavailable.")
    if row is None:
        business = api.load_business_by_id(business_id)
        if not business:
            raise HTTPException(409, "Business unavailable.")
        metadata = {"voice_mode": mode, "account": account, "recipient": digest(email.casefold()),
                    "purpose": quote["purpose"], "origin_call": claims["payment_call"], "sender_name": business.get("name") or "Your business"}
        values = {"id": key, "business_id": business_id, "user_id": owner, "person_id": person_id,
                  "amount": amount, "currency": "usd", "status": "pending", "payment_method": "link",
                  "created_at": datetime.now(timezone.utc).isoformat(),
                  "metadata": metadata}
        if appointment:
            values["appointment_id"] = appointment
        try:
            api.supabase.table("payments").insert(values).execute()
        except Exception:
            if not read(key):
                raise
        row = read(key)
    if row and row.get("stripe_session_id") and not session:
        status, session = _provider_state(api, row, options)
    if not row or int(row["amount"]) != amount or row["metadata"]["recipient"] != digest(email.casefold()):
        raise HTTPException(409, "Payment details changed. A staff review is required.")
    meta = row["metadata"]
    if status != "pending":
        return {"status": status}
    if not session:
        created = datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - created >= timedelta(hours=23):
            raise HTTPException(409, "This earlier payment request requires review.")
        metadata = api.build_scenario_customer_metadata(user_id=owner, person_id=person_id)
        metadata.update(api.customer_payment_fee_metadata(amount, 0, 0))
        metadata["nodemere_payment_id"] = key
        fee = api.calculate_platform_application_fee(amount)
        if fee <= 0:
            raise HTTPException(409, "No platform fee is configured for this amount.")
        session = api.create_customer_checkout(amount, "usd", metadata, fee, api.get_payment_frontend_base_url(),
                                               options, return_url=public_url + "/payments/checkout-return",
                                               customer_email=email, idempotency_key="voice-checkout-" + key)
        saved = api.supabase.table("payments").update({"stripe_session_id": session.id}).eq(
            "business_id", business_id).eq("user_id", owner).eq("id", key).execute().data
        if not saved:
            raise HTTPException(503, "Payment link could not be recorded.")
    if session.get("status") != "open" or not session.get("url"):
        raise HTTPException(409, "This payment link is no longer open.")
    if meta.get("email_sent"):
        return {"status": "sent"}
    try:
        delivered = send_secure_link_email(kind="payment", recipient_email=email, business_name=meta["sender_name"],
                                           secure_link=session.url, configuration=mail_config,
                                           idempotency_key="voice-email-" + session.id)
    except EmailDeliveryError:
        raise HTTPException(503, "Email sending is unconfirmed. Stop sending on this call and offer staff follow-up.") from None
    if not delivered.get("message_id"):
        raise HTTPException(503, "Email sending is unconfirmed. Stop sending on this call and offer staff follow-up.")
    api.supabase.table("payments").update({"metadata": {**meta, "email_sent": True}}).eq(
        "business_id", business_id).eq("user_id", owner).eq("id", key).execute()
    return {"status": "sent"}
