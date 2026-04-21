import stripe
import os
from dotenv import load_dotenv
import json
from time import sleep

load_dotenv()

STRIPE_TEST_KEY = os.getenv("STRIPE_SECRET_TEST_KEY")
STRIPE_LIVE_KEY = os.getenv("STRIPE_API_SECRET_KEY")

# ---- Pricing Matrix (EDIT THESE TO YOUR REAL NUMBERS IN CENTS) ----
pricing_matrix = {
    "unlimited": {
        "monthly": {
            "standard": 600,
            "sales": 2900,
            "social": 600
        },
        "annual": {
            "standard": 6000,
            "sales": 30000,
            "social": 6000
        }
    },
    "unlimited_pro": {
        "monthly": {
            "standard": 900,
            "sales": 4900,
            "social": 900
        },
        "annual": {
            "standard": 8400,
            "sales": 49200,
            "social": 8400
        }
    }
}

plans = {
    "unlimited": "Unlimited",
    "unlimited_pro": "Unlimited Pro"
}

billing_intervals = {
    "monthly": "month",
    "annual": "year"
}


def create_products_and_prices():
    print("\nAre these for production purposes or testing?")
    print("1️⃣  Production")
    print("2️⃣  Testing")
    mode_choice = input("Choose an operation: ").strip()
    if mode_choice == "1":
        stripe.api_key = STRIPE_LIVE_KEY
        mode_str = "LIVE"
    elif mode_choice == "2":
        stripe.api_key = STRIPE_TEST_KEY
        mode_str = "TEST"
    else:
        print("[WARN] ⚠️ Invalid input, defaulting to TEST mode")
        stripe.api_key = STRIPE_TEST_KEY
        mode_str = "TEST"

    print(f"\n[INFO] 🚀 Starting product & price creation in {mode_str} MODE")

    existing_products = {p.name: p.id for p in stripe.Product.list(limit=100).auto_paging_iter() if not getattr(p, "deleted", False)}
    existing_prices = {}
    for p in stripe.Price.list(limit=100).auto_paging_iter():
        if not getattr(p, "deleted", False):
            if getattr(p, "lookup_key", None):
                existing_prices[p.lookup_key] = p.id

    new_products_count = 0
    new_prices_count = 0

    for plan_key, plan_display in plans.items():
        if plan_display in existing_products:
            product_id = existing_products[plan_display]
            print(f"[INFO] ℹ️ Product already exists: {plan_display} (ID: {product_id})")
        else:
            product = stripe.Product.create(name=plan_display)
            product_id = product.id
            existing_products[plan_display] = product_id
            new_products_count += 1
            print(f"[SUCCESS] ✅ Created Product: {plan_display} (ID: {product_id})")

        for billing_key, interval in billing_intervals.items():
            for tier in ["standard", "sales", "social"]:
                amount = pricing_matrix[plan_key][billing_key][tier]
                lookup_key = f"{plan_key}_{billing_key}_{tier}"
                description = f"{plan_display} {billing_key.capitalize()} – {tier.capitalize()}"
                if lookup_key in existing_prices:
                    print(f"[INFO] ℹ️ Price already exists: {lookup_key} | ID: {existing_prices[lookup_key]}")
                else:
                    price = stripe.Price.create(
                        product=product_id,
                        unit_amount=amount,
                        currency="usd",
                        recurring={"interval": interval},
                        lookup_key=lookup_key,
                        nickname=description
                    )
                    existing_prices[lookup_key] = price.id
                    new_prices_count += 1
                    print(f"[SUCCESS] 💲 Created Price: {lookup_key} | ${amount/100:.2f} | Interval: {interval} | ID: {price.id}")

    print(f"\n🎉 Finished creating products and prices")
    print(f"[INFO] Total New Products Created: {new_products_count}")
    print(f"[INFO] Total New Prices Created: {new_prices_count}")


def fetch_and_display_products():
    print("\nFetch products in which mode?")
    print("1️⃣  Production")
    print("2️⃣  Testing")
    print("3️⃣  All")
    mode_choice = input("Choose an operation: ").strip()

    mode_list = []
    if mode_choice == "1":
        mode_list = [("LIVE", STRIPE_LIVE_KEY)]
    elif mode_choice == "2":
        mode_list = [("TEST", STRIPE_TEST_KEY)]
    elif mode_choice == "3":
        mode_list = [("LIVE", STRIPE_LIVE_KEY), ("TEST", STRIPE_TEST_KEY)]
    else:
        print("[WARN] ⚠️ Invalid input, defaulting to TEST only")
        mode_list = [("TEST", STRIPE_TEST_KEY)]

    print("\nDo you want to print the raw JSON response for products and prices?")
    print("1️⃣  Yes")
    print("2️⃣  No (formatted output)")
    json_output_choice = input("Choose an option: ").strip()
    print_raw_json = (json_output_choice == "1")

    if print_raw_json:
        print("\n[INFO] Fetching raw JSON data...")


    for mode_str, key in mode_list:
        stripe.api_key = key
        # Only include active products (exclude archived)
        all_products = [p for p in stripe.Product.list(limit=100).auto_paging_iter() if getattr(p, "active", False)]
        if not all_products:
            print(f"\n[INFO] No products found in {mode_str} mode.")
            continue

        if print_raw_json:
            # Fetch all prices for all products in this mode to include in raw output
            all_prices_in_mode = []
            for product in all_products:
                prices_for_product = [pr for pr in stripe.Price.list(product=product.id, limit=100).auto_paging_iter() if getattr(pr, "active", False)]
                all_prices_in_mode.extend(prices_for_product)
            
            raw_data = {
                "products": [p.to_dict() for p in all_products],
                "prices": [p.to_dict() for p in all_prices_in_mode]
            }
            print(f"\n===== {mode_str} MODE RAW JSON =====\n")
            print(json.dumps(raw_data, indent=2))
        else:
            print(f"\n===== {mode_str} MODE PRODUCTS =====\n")
            for product in all_products:
                print(f"📦 {product.name} | ID: {product.id}")
                prices = [pr for pr in stripe.Price.list(product=product.id, limit=100).auto_paging_iter() if getattr(pr, "active", False)]
                if not prices:
                    print("   ⚠️ No prices for this product")
                    continue
                prices_by_interval = {"month": [], "year": []}
                for pr in prices:
                    interval = pr.recurring["interval"] if pr.recurring else "one_time"
                    prices_by_interval.setdefault(interval, []).append(pr)

                interval_names = [("month", "Monthly"), ("year", "Yearly")]
                for key, display_name in interval_names:
                    if key not in prices_by_interval or not prices_by_interval[key]:
                        continue
                    print(f"   📅 {display_name}")
                    tier_order = ["standard", "sales", "social"]
                    for tier in tier_order:
                        for pr in prices_by_interval[key]:
                            if getattr(pr, "lookup_key", None) and pr.lookup_key.endswith(tier):
                                print(f"      ⚪ {tier.capitalize()} | ${pr.unit_amount/100:.2f} | ID: {pr.id}")
                print("\n")


def main_menu():
    try:
        while True:
            print("\n================ STRIPE MANAGER =================")
            print("Choose an option:")
            print("1️⃣  Create Products & Prices")
            print("2️⃣  Fetch & Display Existing Products & Prices")
            print("3️⃣  Exit")
            choice = input("Choose an operation: ").strip()

            if choice == "1":
                create_products_and_prices()
            elif choice == "2":
                fetch_and_display_products()
            elif choice == "3":
                print("\n[INFO] Exiting Stripe Manager. Goodbye!")
                break
            else:
                print("[WARN] ⚠️ Invalid choice. Please enter 1, 2, or 3.")
    except KeyboardInterrupt:
        print("\n[INFO] 🚨 Keyboard interrupt detected. Exiting cleanly.")


if __name__ == "__main__":
    main_menu()