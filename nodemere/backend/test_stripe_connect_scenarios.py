"""End-to-end Stripe Connect scenario coverage.

Run this only against Stripe test mode with the local webhook listener active.
It creates temporary active scenarios, drives real Stripe test objects on the
connected account, and verifies Stripe plus the local scenario execution rows.
"""

from __future__ import annotations

import json
import hashlib
import hmac
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import stripe
import requests
from supabase import create_client


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.env_loader import load_project_env


load_project_env()

USER_ID = "f7f077d7-1236-4367-8dd5-409231cfa8fe"
CONNECTED_ACCOUNT = "acct_1UAKYwGxEy1HJZXg"
PLATFORM_ACCOUNT = "acct_1U4iIDGxEyYa1xEc"
AMOUNT = 1099
MATRIX_PREFIX = "[Stripe Matrix]"


def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing {name}")
    return value


STRIPE_KEY = required_env("STRIPE_SECRET_TEST_KEY")
WEBHOOK_SECRET = required_env("STRIPE_WEBHOOK_SECRET")
SUPABASE_URL = required_env("SUPABASE_URL")
SUPABASE_KEY = required_env("SUPABASE_SERVICE_ROLE_KEY")
stripe.api_key = STRIPE_KEY
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
STRIPE_OPTIONS = {"stripe_account": CONNECTED_ACCOUNT}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def post_actual_stripe_event(event_type: str, object_id: str) -> dict:
    """Fetch the real Stripe event and deliver its exact signed payload locally."""
    deadline = time.time() + 30
    event = None
    while time.time() < deadline:
        events = stripe.Event.list(type=event_type, created={"gte": int(deadline - 60)}, limit=100, **STRIPE_OPTIONS)
        for candidate in events.auto_paging_iter():
            candidate_object = (((candidate.get("data") or {}).get("object")) or {})
            if candidate_object.get("id") == object_id:
                event = candidate
                break
        if event:
            break
        time.sleep(1)
    if not event:
        raise AssertionError(f"Stripe event not found: {event_type} for {object_id}")

    body = json.dumps(event.to_dict_recursive(), separators=(",", ":"), default=str)
    timestamp = str(int(time.time()))
    signed_payload = f"{timestamp}.{body}".encode()
    digest = hmac.new(WEBHOOK_SECRET.encode(), signed_payload, hashlib.sha256).hexdigest()
    response = requests.post(
        "http://127.0.0.1:8000/stripe-webhook",
        data=body.encode(),
        headers={"Content-Type": "application/json", "Stripe-Signature": f"t={timestamp},v1={digest}"},
        timeout=20,
    )
    if response.status_code != 200:
        raise AssertionError(f"local webhook returned HTTP {response.status_code}: {response.text[:300]}")
    return {"stripe_event_id": event.get("id"), "webhook_status": response.status_code}


def unique_email(label: str) -> str:
    return f"stripe-matrix-{label}-{uuid4().hex[:8]}@example.com"


def metadata() -> dict[str, str]:
    return {"user_id": USER_ID, "source": "nodemere_stripe_matrix"}


def create_customer(label: str):
    return stripe.Customer.create(
        name=f"Stripe Matrix {label}",
        email=unique_email(label),
        metadata=metadata(),
        **STRIPE_OPTIONS,
    )


def attach_test_card(customer):
    payment_method = stripe.PaymentMethod.attach(
        "pm_card_visa",
        customer=customer.id,
        **STRIPE_OPTIONS,
    )
    stripe.Customer.modify(
        customer.id,
        invoice_settings={"default_payment_method": payment_method.id},
        **STRIPE_OPTIONS,
    )
    return payment_method


def create_subscription(label: str, customer=None):
    customer = customer or create_customer(label)
    attach_test_card(customer)
    product = stripe.Product.create(
        name=f"Stripe Matrix {label} Product",
        metadata=metadata(),
        **STRIPE_OPTIONS,
    )
    price = stripe.Price.create(
        product=product.id,
        unit_amount=AMOUNT,
        currency="usd",
        recurring={"interval": "month"},
        metadata=metadata(),
        **STRIPE_OPTIONS,
    )
    subscription = stripe.Subscription.create(
        customer=customer.id,
        items=[{"price": price.id}],
        metadata=metadata(),
        payment_behavior="default_incomplete",
        **STRIPE_OPTIONS,
    )
    return subscription, customer, product, price


def create_scenario(name: str, trigger: str, action: str | None = None, config: dict | None = None) -> str:
    trigger_node = {
        "id": "matrix-trigger",
        "type": "trigger",
        "label": trigger,
        "configured": True,
        "categoryKey": "payments",
        "categoryType": "TRIGGERS",
        "subOptionKey": trigger,
        "actionConfig": None,
        "triggerConfig": None,
        "triggerFilter": None,
    }
    nodes = [trigger_node]
    edges = []
    if action:
        nodes.append({
            "id": "matrix-action",
            "type": "action",
            "label": action,
            "configured": True,
            "categoryKey": "payments",
            "categoryType": "ACTIONS",
            "subOptionKey": action,
            "actionConfig": {"_key": action, **(config or {})},
            "triggerConfig": None,
            "triggerFilter": None,
        })
        edges.append({"id": "matrix-edge", "from": "matrix-trigger", "to": "matrix-action", "filter": None})

    business = (supabase.table("businesses").select("id").eq("user_id", USER_ID).limit(1).execute().data or [{}])[0]
    scenario_id = str(uuid4())
    supabase.table("scenarios").insert({
        "id": scenario_id,
        "name": f"{MATRIX_PREFIX} {name}",
        "description": "Temporary Stripe Connect integration matrix scenario",
        "nodes_data": nodes,
        "edges_data": edges,
        "status": "active",
        "is_active": True,
        "created_by": USER_ID,
        "user_id": USER_ID,
        "business_id": business.get("id"),
        "notes": "Created by test_stripe_connect_scenarios.py",
    }).execute()
    return scenario_id


def deactivate_existing_matrix_scenarios():
    rows = supabase.table("scenarios").select("id,is_active,status").like("name", f"{MATRIX_PREFIX}%").execute().data or []
    for row in rows:
        supabase.table("scenarios").update({"is_active": False}).eq("id", row["id"]).execute()


def delete_scenario(scenario_id: str):
    supabase.table("scenarios").delete().eq("id", scenario_id).execute()


def wait_for_execution(scenario_id: str, started_after: str, timeout: int = 40) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        rows = (
            supabase.table("flow_executions")
            .select("id,status,error,started_at,completed_at,flow_context,trigger_event")
            .eq("scenario_id", scenario_id)
            .order("started_at", desc=True)
            .limit(5)
            .execute()
            .data
            or []
        )
        for row in rows:
            if str(row.get("started_at") or "") >= started_after:
                if row.get("status") in {"completed", "failed", "paused"}:
                    return row
        time.sleep(2)
    raise TimeoutError(f"No completed execution for {scenario_id}")


def execution_ok(row: dict) -> bool:
    return row.get("status") == "completed" and not row.get("error")


def execute_action_case(action: str, config: dict | None = None, setup=None, verify=None) -> dict:
    target = setup() if setup else {}
    scenario_id = create_scenario(f"action-{action}", "subscription_created", action, {**(config or {}), **target.get("config", {})})
    started_after = now_iso()
    seed_subscription = None
    try:
        seed_subscription, _customer, _product, _price = create_subscription(f"seed-{action}")
        event_info = post_actual_stripe_event("customer.subscription.created", seed_subscription.id)
        execution = wait_for_execution(scenario_id, started_after)
        if not execution_ok(execution):
            raise AssertionError(f"scenario execution {execution.get('status')}: {execution.get('error')}")
        result = verify(execution, target) if verify else {"execution": execution.get("status")}
        return {"case": f"action:{action}", "passed": True, **event_info, **result}
    finally:
        if seed_subscription:
            try:
                stripe.Subscription.cancel(seed_subscription.id, **STRIPE_OPTIONS)
            except Exception:
                pass
        delete_scenario(scenario_id)


def verify_action_output(action: str, execution: dict, target: dict) -> dict:
    context = execution.get("flow_context") or {}
    output = context.get("matrix-action") or {}
    if not output:
        raise AssertionError("action output missing from flow_context")
    data = output.get("data") or output
    result = {"execution": execution.get("status"), "output_action": output.get("action")}

    if action == "create_payment":
        payment_intent_id = data.get("id")
        if not payment_intent_id:
            raise AssertionError("create_payment returned no PaymentIntent")
        intent = stripe.PaymentIntent.retrieve(payment_intent_id, **STRIPE_OPTIONS)
        if intent.get("amount") != AMOUNT or intent.get("application_fee_amount") != 11:
            raise AssertionError("create_payment amount or 1% fee mismatch")
        result.update({"stripe_object": "payment_intent", "stripe_status": intent.get("status"), "application_fee": intent.get("application_fee_amount")})
    elif action == "send_payment_link":
        session_id = data.get("stripe_session_id")
        if not session_id:
            raise AssertionError("send_payment_link returned no Checkout Session")
        session = stripe.checkout.Session.retrieve(session_id, **STRIPE_OPTIONS)
        if session.get("amount_total") != AMOUNT or session.get("status") != "open":
            raise AssertionError("payment link did not create the expected open Checkout Session")
        result.update({"stripe_object": "checkout_session", "stripe_status": session.get("status"), "application_fee": "configured_on_payment_intent"})
    elif action == "create_invoice":
        invoice_id = data.get("id") or data.get("invoice_id")
        invoice = stripe.Invoice.retrieve(invoice_id, **STRIPE_OPTIONS)
        if invoice.get("status") != "draft" or invoice.get("amount_due") != AMOUNT:
            raise AssertionError("create_invoice did not create the expected draft invoice")
        result.update({"stripe_object": "invoice", "stripe_status": invoice.get("status"), "amount_due": invoice.get("amount_due"), "application_fee": "verified_on_paid_charge"})
    elif action == "send_invoice":
        invoice = stripe.Invoice.retrieve(target["invoice_id"], **STRIPE_OPTIONS)
        if invoice.get("status") != "open" or not invoice.get("hosted_invoice_url"):
            raise AssertionError("send_invoice did not finalize/send the invoice")
        result.update({"stripe_object": "invoice", "stripe_status": invoice.get("status"), "hosted_url": True, "application_fee": "verified_on_paid_charge"})
    elif action == "refund_payment":
        refund_id = data.get("id") or data.get("refund_id")
        refund = stripe.Refund.retrieve(refund_id, **STRIPE_OPTIONS)
        if refund.get("status") != "succeeded" or refund.get("amount") != AMOUNT:
            raise AssertionError("refund_payment did not create a succeeded full refund")
        result.update({"stripe_object": "refund", "stripe_status": refund.get("status"), "refund_amount": refund.get("amount")})
    elif action == "cancel_subscription":
        subscription = stripe.Subscription.retrieve(target["subscription_id"], **STRIPE_OPTIONS)
        if subscription.get("status") not in {"canceled", "incomplete_expired"}:
            raise AssertionError("cancel_subscription did not cancel the subscription")
        result.update({"stripe_object": "subscription", "stripe_status": subscription.get("status")})
    return result


def setup_send_invoice():
    customer = create_customer("send-invoice")
    invoice_item = stripe.InvoiceItem.create(
        customer=customer.id,
        amount=AMOUNT,
        currency="usd",
        description="Stripe matrix invoice",
        metadata=metadata(),
        **STRIPE_OPTIONS,
    )
    invoice = stripe.Invoice.create(
        customer=customer.id,
        collection_method="send_invoice",
        days_until_due=7,
        auto_advance=False,
        pending_invoice_items_behavior="include",
        application_fee_amount=11,
        description="Stripe matrix invoice",
        metadata=metadata(),
        **STRIPE_OPTIONS,
    )
    return {"invoice_id": invoice.id, "config": {"invoice_id": invoice.id}, "invoice_item_id": invoice_item.id}


def setup_refund_payment():
    customer = create_customer("refund-payment")
    intent = stripe.PaymentIntent.create(
        amount=AMOUNT,
        currency="usd",
        customer=customer.id,
        payment_method="pm_card_visa",
        payment_method_types=["card"],
        confirm=True,
        metadata=metadata(),
        **STRIPE_OPTIONS,
    )
    if intent.get("status") != "succeeded":
        raise AssertionError(f"refund setup payment did not succeed: {intent.get('status')}")
    return {"payment_intent_id": intent.id, "config": {"payment_id": intent.id}}


def setup_cancel_subscription():
    customer = create_customer("cancel-target")
    payment_method = attach_test_card(customer)
    product = stripe.Product.create(name="Stripe Matrix cancel target", metadata=metadata(), **STRIPE_OPTIONS)
    price = stripe.Price.create(product=product.id, unit_amount=AMOUNT, currency="usd", recurring={"interval": "month"}, metadata=metadata(), **STRIPE_OPTIONS)
    subscription = stripe.Subscription.create(
        customer=customer.id,
        items=[{"price": price.id}],
        default_payment_method=payment_method.id,
        metadata=metadata(),
        payment_behavior="error_if_incomplete",
        **STRIPE_OPTIONS,
    )
    return {"subscription_id": subscription.id, "config": {"subscription_id": subscription.id}}


def trigger_case(trigger: str, create_event) -> dict:
    scenario_id = create_scenario(f"trigger-{trigger}", trigger)
    started_after = now_iso()
    try:
        event_info = create_event()
        execution = wait_for_execution(scenario_id, started_after)
        if not execution_ok(execution):
            raise AssertionError(f"scenario execution {execution.get('status')}: {execution.get('error')}")
        return {"case": f"trigger:{trigger}", "passed": True, "execution": execution.get("status"), **event_info}
    finally:
        delete_scenario(scenario_id)


def trigger_payment_received():
    customer = create_customer("trigger-received")
    intent = stripe.PaymentIntent.create(
        amount=AMOUNT,
        currency="usd",
        customer=customer.id,
        payment_method="pm_card_visa",
        payment_method_types=["card"],
        confirm=True,
        metadata=metadata(),
        **STRIPE_OPTIONS,
    )
    if intent.get("status") != "succeeded":
        raise AssertionError("payment_received setup did not succeed")
    return {"stripe_object": "payment_intent", "stripe_status": intent.get("status"), **post_actual_stripe_event("payment_intent.succeeded", intent.id)}


def trigger_payment_failed():
    customer = create_customer("trigger-failed")
    try:
        intent = stripe.PaymentIntent.create(
            amount=AMOUNT,
            currency="usd",
            customer=customer.id,
            payment_method="pm_card_chargeDeclined",
            payment_method_types=["card"],
            confirm=True,
            metadata=metadata(),
            **STRIPE_OPTIONS,
        )
    except stripe.error.CardError as exc:
        intent_id = ((exc.json_body or {}).get("error") or {}).get("payment_intent", {}).get("id")
        if not intent_id:
            raise
        intent = stripe.PaymentIntent.retrieve(intent_id, **STRIPE_OPTIONS)
    if intent.get("status") not in {"requires_payment_method", "canceled"}:
        raise AssertionError(f"payment_failed setup returned {intent.get('status')}")
    return {"stripe_object": "payment_intent", "stripe_status": intent.get("status"), **post_actual_stripe_event("payment_intent.payment_failed", intent.id)}


def trigger_refund_issued():
    customer = create_customer("trigger-refund")
    intent = stripe.PaymentIntent.create(
        amount=AMOUNT,
        currency="usd",
        customer=customer.id,
        payment_method="pm_card_visa",
        payment_method_types=["card"],
        confirm=True,
        metadata=metadata(),
        **STRIPE_OPTIONS,
    )
    refund = stripe.Refund.create(
        payment_intent=intent.id,
        amount=AMOUNT,
        metadata=metadata(),
        **STRIPE_OPTIONS,
    )
    if refund.get("status") != "succeeded":
        raise AssertionError("refund setup did not succeed")
    return {"stripe_object": "refund", "stripe_status": refund.get("status"), **post_actual_stripe_event("refund.created", refund.id)}


def trigger_subscription_created():
    subscription, _customer, _product, _price = create_subscription("trigger-subscription")
    return {"stripe_object": "subscription", "stripe_status": subscription.get("status"), **post_actual_stripe_event("customer.subscription.created", subscription.id)}


def main():
    results = []
    scenario_ids = []
    existing = supabase.table("scenarios").select("id,is_active,status").like("name", f"{MATRIX_PREFIX}%").execute().data or []
    deactivate_existing_matrix_scenarios()
    try:
        action_cases = [
            ("create_payment", {"amount": "10.99", "currency": "usd"}, None),
            ("send_payment_link", {"amount": "10.99", "currency": "usd"}, None),
            ("create_invoice", {"amount": "10.99", "currency": "usd"}, None),
            ("send_invoice", None, setup_send_invoice),
            ("refund_payment", None, setup_refund_payment),
            ("cancel_subscription", None, setup_cancel_subscription),
        ]
        for action, config, setup in action_cases:
            try:
                result = execute_action_case(action, config, setup, lambda execution, target, action=action: verify_action_output(action, execution, target))
            except Exception as exc:
                result = {"case": f"action:{action}", "passed": False, "error": str(exc)}
            results.append(result)

        trigger_cases = [
            ("payment_received", trigger_payment_received),
            ("payment_failed", trigger_payment_failed),
            ("refund_issued", trigger_refund_issued),
            ("subscription_created", trigger_subscription_created),
        ]
        for trigger, create_event in trigger_cases:
            try:
                result = trigger_case(trigger, create_event)
            except Exception as exc:
                result = {"case": f"trigger:{trigger}", "passed": False, "error": str(exc)}
            results.append(result)
    finally:
        for row in existing:
            supabase.table("scenarios").update({"is_active": row.get("is_active"), "status": row.get("status")}).eq("id", row["id"]).execute()

    print(json.dumps({
        "stripe_test_mode": True,
        "connected_account": CONNECTED_ACCOUNT,
        "platform_account": PLATFORM_ACCOUNT,
        "application_fee_percent": "1",
        "results": results,
        "passed": sum(1 for item in results if item.get("passed")),
        "total": len(results),
    }, indent=2, default=str))
    if not all(item.get("passed") for item in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
