"""Measure elapsed, Stripe-backed subscription coverage for partner rewards."""

from datetime import datetime, timezone
from math import ceil

import stripe


PAID_PLANS = {"essentials", "pro", "ultra"}
QUALIFYING_SECONDS = 30 * 24 * 60 * 60


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def iso_time(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat() if value is not None else None


def paid_progress(periods, registered, deadline, as_of):
    """Count the union of paid service intervals, capped at elapsed time."""
    intervals = sorted(
        (max(start, paid, registered), min(end, deadline, as_of))
        for start, end, paid in periods
    )
    total = 0
    last_end = registered
    qualified_at = None
    for start, end in intervals:
        start = max(start, last_end)
        if end <= start:
            continue
        if qualified_at is None and total + end - start >= QUALIFYING_SECONDS:
            qualified_at = start + QUALIFYING_SECONDS - total
        total += end - start
        last_end = end
    return int(total), qualified_at


def stripe_paid_periods(customer, registered, deadline, key):
    # Pin the response shape for this reader without changing the customer
    # checkout or the API version used by the existing billing webhook.
    options = {"api_key": key, "stripe_version": "2025-06-30.basil"}
    paid_lines = []
    credited_until = {}
    prices = {}
    subscriptions = {}
    invoices = stripe.Invoice.list(customer=customer, limit=100,
                                  created={"gte": int(registered), "lte": ceil(deadline)}, **options)
    for invoice in invoices.auto_paging_iter():
        status = invoice.get("status")
        if status not in {"open", "paid", "uncollectible"}:
            continue
        amount = int(invoice.get("amount_due") or 0)
        paid = (invoice.get("status_transitions") or {}).get("paid_at")
        cash_paid = (status == "paid" and paid and paid < deadline and amount > 0
                     and not invoice.get("amount_remaining")
                     and int(invoice.get("amount_paid") or 0) >= amount
                     and not invoice.get("pre_payment_credit_notes_amount")
                     and not invoice.get("post_payment_credit_notes_amount")
                     and (invoice.get("starting_balance") or 0) >= 0)

        lines = stripe.Invoice.list_lines(invoice.id, limit=100, **options)
        eligible = []
        for line in lines.auto_paging_iter():
            parent = line.get("parent") or {}
            details = parent.get("subscription_item_details") or parent.get("invoice_item_details") or {}
            subscription_id = details.get("subscription")
            period = line.get("period") or {}
            start, end = period.get("start"), period.get("end")
            if start is None or end is None:
                continue
            credits = (details.get("proration_details") or {}).get("credited_items") or {}
            for credited_line in credits.get("invoice_line_items") or []:
                credited_until[credited_line] = min(credited_until.get(credited_line, start), start)
            if not cash_paid or not parent.get("subscription_item_details"):
                continue
            price_id = (((line.get("pricing") or {}).get("price_details") or {}).get("price")
                        or (line.get("price") or {}).get("id"))
            net = int(line.get("amount") or 0) - sum(
                credit["amount"] for credit in (line.get("pretax_credit_amounts") or line.get("discount_amounts") or [])
            )
            if not subscription_id or not price_id or net <= 0:
                continue
            if price_id not in prices:
                price = stripe.Price.retrieve(price_id, expand=["product"], **options)
                product = price.get("product") or {}
                prices[price_id] = (str(product.get("name") or "").strip().lower()
                                    if isinstance(product, dict) or hasattr(product, "get") else "")
                if price.get("type") != "recurring":
                    prices[price_id] = ""
            if prices[price_id] not in PAID_PLANS:
                continue
            if subscription_id not in subscriptions:
                subscriptions[subscription_id] = stripe.Subscription.retrieve(subscription_id, **options)
            subscription = subscriptions[subscription_id]
            if subscription.get("customer") != customer:
                continue
            # An immediate cancellation ends service. Scheduled cancellation
            # retains the paid-through interval until the actual end.
            end = min(end, subscription.get("ended_at") or end)
            if min(end, deadline) > max(start, paid, registered):
                eligible.append((line.id, invoice.id, start, end, paid, prices[price_id]))

        if not eligible or not invoice_has_settled_payment(invoice.id, amount, options):
            continue
        paid_lines.extend(eligible)

    periods = []
    evidence = []
    for line_id, invoice_id, start, end, payment_time, plan in paid_lines:
        end = min(end, credited_until.get(line_id, end))
        if end <= max(start, payment_time, registered):
            continue
        periods.append((start, end, payment_time))
        evidence.append({"invoice": invoice_id, "plan": plan, "paid_at": iso_time(payment_time),
                         "start": iso_time(start), "end": iso_time(end)})
    return periods, evidence


def invoice_has_settled_payment(invoice_id, amount_due, options):
    payments = stripe.InvoicePayment.list(invoice=invoice_id, status="paid", limit=100, **options)
    settled = 0
    seen_charges = set()
    for payment in payments.auto_paging_iter():
        source = payment.get("payment") or {}
        charge = None
        if source.get("type") == "payment_intent" and source.get("payment_intent"):
            intent = stripe.PaymentIntent.retrieve(source["payment_intent"], expand=["latest_charge"], **options)
            if intent.get("status") == "succeeded":
                charge = intent.get("latest_charge")
        elif source.get("type") == "charge" and source.get("charge"):
            charge = stripe.Charge.retrieve(source["charge"], **options)
        if not charge or isinstance(charge, str) or charge.id in seen_charges:
            continue
        seen_charges.add(charge.id)
        if (charge.get("paid") and charge.get("captured") and not charge.get("disputed")
                and not charge.get("refunded") and not charge.get("amount_refunded")):
            settled += min(int(payment.get("amount_paid") or 0), int(charge.get("amount_captured") or 0))
    return settled >= amount_due
