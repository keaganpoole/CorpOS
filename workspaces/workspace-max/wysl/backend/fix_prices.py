#!/usr/bin/env python3
"""Fix Stripe prices — archive old prices and create new ones with correct amounts (cents)."""
import os
import stripe
from dotenv import load_dotenv

load_dotenv()

TEST_MODE = False  # Set to False for live mode

STRIPE_TEST_KEY = os.getenv("STRIPE_SECRET_TEST_KEY")
STRIPE_LIVE_KEY = os.getenv("STRIPE_API_SECRET_KEY")

stripe.api_key = STRIPE_TEST_KEY if TEST_MODE else STRIPE_LIVE_KEY
mode_label = "TEST" if TEST_MODE else "LIVE"
print(f"\n=== FIXING STRIPE PRICES ({mode_label} MODE) ===\n")

# Correct pricing in DOLLARS — Stripe needs CENTS (multiply by 100)
CORRECT_PRICES = {
    "Ultra": {
        "Standard": {"monthly": 999,   "annually": 799},
        "Sales":    {"monthly": 1249,  "annually": 999},
        "Social":   {"monthly": 999,   "annually": 799},
    },
    "Pro": {
        "Standard": {"monthly": 499,   "annually": 399},
        "Sales":    {"monthly": 624,   "annually": 499},
        "Social":   {"monthly": 499,   "annually": 399},
    },
    "Essentials": {
        "Standard": {"monthly": 99,    "annually": 79},
        "Sales":    {"monthly": 124,   "annually": 99},
        "Social":   {"monthly": 99,    "annually": 79},
    },
    "Free": {
        "Standard": {"monthly": 0,     "annually": 0},
        "Sales":    {"monthly": 0,     "annually": 0},
        "Social":   {"monthly": 0,     "annually": 0},
    },
}

# 1. Fetch all active products
products = {p.name: p for p in stripe.Product.list(active=True, limit=100).auto_paging_iter()}
print(f"Found {len(products)} products: {', '.join(products.keys())}\n")

# 2. Fetch all active prices
all_prices = list(stripe.Price.list(active=True, limit=100).auto_paging_iter())
print(f"Found {len(all_prices)} active prices\n")

# 3. Archive old prices and create corrected ones
for plan_name, sources in CORRECT_PRICES.items():
    product = products.get(plan_name)
    if not product:
        print(f"⚠️  Product '{plan_name}' not found in Stripe, skipping")
        continue

    print(f"📦 {plan_name} (ID: {product.id})")

    for source, intervals in sources.items():
        for interval_key, correct_dollar_amount in intervals.items():
            correct_cents = correct_dollar_amount * 100
            interval = "month" if interval_key == "monthly" else "year"

            # Find existing price for this product/source/interval
            existing = [
                pr for pr in all_prices
                if pr.product == product.id
                and pr.recurring.interval == interval
                and (getattr(pr.metadata, "source", "") or "").lower() == source.lower()
            ]

            for old_price in existing:
                # Archive old price
                stripe.Price.modify(old_price.id, active=False)
                old_dollars = old_price.unit_amount / 100
                print(f"  🗑️  Archived: {source} {interval_key} | ${old_dollars:.2f} ({old_price.id})")

            # Create new price with correct amount
            if correct_cents > 0:
                new_price = stripe.Price.create(
                    product=product.id,
                    unit_amount=correct_cents,
                    currency="usd",
                    recurring={"interval": interval},
                    metadata={"source": source},
                )
                new_dollars = new_price.unit_amount / 100
                print(f"  ✅ Created:  {source} {interval_key} | ${new_dollars:.2f} ({new_price.id})")
            else:
                # Free plan — create with 0 amount
                new_price = stripe.Price.create(
                    product=product.id,
                    unit_amount=0,
                    currency="usd",
                    recurring={"interval": interval},
                    metadata={"source": source},
                )
                print(f"  ✅ Created:  {source} {interval_key} | Free ({new_price.id})")

    print()

print("=== DONE ===\n")
