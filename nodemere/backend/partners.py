"""Partner-only API, first-party attribution, and scheduled reward reconciliation."""

import asyncio
from datetime import date, datetime, timezone
import hashlib
import hmac
import logging
import os
import re
from uuid import UUID

import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from postgrest.exceptions import APIError
from pydantic import BaseModel, EmailStr, Field, SecretStr
from supabase_auth.errors import AuthApiError

from .email_delivery_service import RESEND_SEND_URL, SystemResendConfiguration
from .authorization import PARTNER_ROLE
from .partner_billing import iso_time, paid_progress, stripe_paid_periods, timestamp


VISITOR_COOKIE = "nodemere_referral"
MARKER_COOKIE = "nodemere_referral_present"
REFERRAL_FIELDS = (
    "customer_id,referral_id,partner_id,business_id,clicked_at,registered_at,business_registered_at,"
    "expires_at,paid_seconds,paid_at,qualified_at,paid_on,status,amount_cents"
)
PARTNER_FIELDS = "id,full_name,email,code,short_code,email_updates,payout_contact,created_at"
STATUSES = {"registered", "qualifying", "held", "ready", "owed", "paid", "expired", "rejected"}
MAIL_COPY = {
    "registered": ("A business registered through your link", "A business you referred has registered for Nodemere."),
    "subscribed": ("A referred business subscribed", "A business you referred started a qualifying paid subscription."),
    "qualified": ("You earned a $100 referral reward", "Your referral completed 30 paid days. Your $100 reward is ready for manual review."),
}


class PartnerSettings(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email_updates: bool
    payout_contact: str = Field(default="", max_length=300)


class PartnerSignup(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: SecretStr


class RewardAction(BaseModel):
    note: str = Field(default="", max_length=600)
    paid_on: date | None = None


class Partners:
    def __init__(self, database, *, auth_url, auth_key, new_auth_client, stripe_key, resend_key, resend_sender):
        self.db = database
        self.auth_url = (auth_url or "").strip().rstrip("/")
        self.auth_key = auth_key
        self.new_auth_client = new_auth_client
        self.secret = os.getenv("PARTNER_TRACKING_SECRET", "")
        self.origin = os.getenv("PARTNER_FRONTEND_URL", "https://partners.nodemere.ai").rstrip("/")
        self.referral_origin = os.getenv("PARTNER_REFERRAL_URL", "https://nodemere.ai").rstrip("/")
        self.stripe_key = stripe_key
        self.email = SystemResendConfiguration(resend_sender, resend_key)
        self.enabled = bool(self.auth_url and self.auth_key and self.secret)

    def rpc(self, name, **parameters):
        return self.db.rpc(f"partner_{name}", parameters).execute().data

    def require_enabled(self):
        if not self.enabled:
            raise HTTPException(503, "Nodemere Partners is temporarily unavailable.")

    def signup(self, data, request):
        self.require_enabled()
        email = str(data.email).lower()
        name = data.full_name.strip()
        password = data.password.get_secret_value()
        if not name or not 8 <= len(password) <= 256:
            raise HTTPException(422, "Enter a name and a password of 8 to 256 characters.")

        peer = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("x-forwarded-for", peer).rsplit(",", 1)[-1].strip()
        email_key, network_key = (
            hmac.new(self.secret.encode(), value.encode(), hashlib.sha256).hexdigest()
            for value in (f"email:{email}", f"network:{forwarded[:120]}")
        )
        if not self.rpc("signup_allowed", email_key=email_key, network_key=network_key):
            raise HTTPException(429, "Too many signup attempts. Wait a few minutes and try again.")
        try:
            self.db.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": False,
                "role": PARTNER_ROLE,
                "user_metadata": {"full_name": name},
            })
        except AuthApiError as exc:
            if exc.code in {"email_exists", "user_already_exists"}:
                return
            if exc.code in {"weak_password", "password_too_short"}:
                raise HTTPException(422, "Choose a stronger password and try again.") from None
            logging.warning("partners.signup.event_1")
            raise HTTPException(503, "Partner signup is temporarily unavailable.") from None
        path = "/partners/index.html" if self.origin == "http://localhost:5173" else "/"
        try:
            self.new_auth_client().auth.resend({
                "type": "signup", "email": email,
                "options": {"email_redirect_to": f"{self.origin}{path}?view=login"},
            })
        except AuthApiError:
            logging.warning("partners.signup_email.event_1")
            raise HTTPException(503, "Account created. Resend the confirmation email from the log-in screen.") from None

    def capture(self, request, customer_id):
        if not self.enabled:
            return
        visitor = self.visitor(request)
        if visitor:
            try:
                self.rpc("capture_registration", visitor=visitor, customer=str(customer_id))
            except Exception:
                # A referral storage outage must not block customer signup.
                logging.warning("partners.capture.event_1")

    @staticmethod
    def visitor(request):
        try:
            return str(UUID(request.cookies.get(VISITOR_COOKIE, "")))
        except ValueError:
            return None

    def identify(self, token):
        self.require_enabled()
        try:
            response = requests.get(f"{self.auth_url}/auth/v1/user", headers={
                "apikey": self.auth_key,
                "Authorization": f"Bearer {token}",
            }, timeout=8, allow_redirects=False)
            if response.status_code in {400, 401, 403}:
                raise HTTPException(401, "Please sign in with your verified partner account.")
            response.raise_for_status()
            user = response.json()
            user_id = str(UUID(user["id"]))
        except (requests.RequestException, ValueError, KeyError):
            raise HTTPException(503, "Partner sign-in is temporarily unavailable.") from None
        if user.get("role") != PARTNER_ROLE:
            raise HTTPException(403, "Use your Partners account email to log in.")
        if not user.get("email_confirmed_at") or not user.get("email") or user.get("is_anonymous"):
            raise HTTPException(403, "Verify your email to open your partner dashboard.")
        email = str(user["email"]).strip().lower()
        rows = self.db.table("partner_accounts").select(PARTNER_FIELDS).eq("id", user_id).execute().data
        if not rows:
            submitted_name = (user.get("user_metadata") or {}).get("full_name")
            name = (submitted_name.strip()[:120] if isinstance(submitted_name, str) else "") or email[:120]
            try:
                self.db.table("partner_accounts").upsert(
                    {"id": user_id, "email": email, "full_name": name},
                    on_conflict="id", ignore_duplicates=True,
                ).execute()
            except APIError as exc:
                if exc.code == "P9000":
                    raise HTTPException(503, "No referral codes are currently available.") from None
                raise
            rows = self.db.table("partner_accounts").select(PARTNER_FIELDS).eq("id", user_id).execute().data
        account = rows[0]
        if account["email"] != email:
            self.db.table("partner_accounts").update({"email": email}).eq("id", user_id).execute()
            account["email"] = email
        account["is_admin"] = bool(
            self.db.table("partner_admins").select("partner_id").eq("partner_id", user_id).execute().data
        )
        account["referral_url"] = f"{self.referral_origin}/r/{account['short_code']}"
        return account

    def dashboard_rows(self, *, partner_id, state, page, paid_only=False, admin=False):
        columns = REFERRAL_FIELDS
        if admin:
            columns += ",review_flag,billing_checked_at,competing_attribution"
        query = self.db.table("partner_referral_rows").select(columns)
        if partner_id:
            query = query.eq("partner_id", partner_id)
        if paid_only:
            query = query.eq("status", "paid")
        elif state:
            query = query.eq("status", state)
        if not admin:
            query = query.is_("review_flag", "null")
        order = "paid_on" if paid_only else "registered_at"
        rows = query.order(order, desc=True).order("customer_id").range(page * 20, page * 20 + 20).execute().data
        shown = rows[:20]
        self.add_business_names(shown)
        if not admin:
            for row in shown:
                row.pop("customer_id")
                row.pop("business_id")
        return {"rows": shown, "has_more": len(rows) > 20}

    def add_business_names(self, rows):
        if not rows:
            return
        businesses = self.db.table("businesses").select("id,name").in_(
            "id", [row["business_id"] for row in rows]
        ).execute().data
        profiles = self.db.table("users").select("id,plan,subscription_status").in_(
            "id", [row["customer_id"] for row in rows]
        ).execute().data
        names = {str(row["id"]): row.get("name") for row in businesses}
        plans = {row["id"]: row for row in profiles}
        for row in rows:
            row["business_name"] = names.get(str(row["business_id"])) or "Business name unavailable"
            profile = plans.get(row["customer_id"], {})
            plan = str(profile.get("plan") or "").strip().lower()
            row["plan"] = plan.title() if plan in {"free", "essentials", "pro", "ultra"} else "Unavailable"
            row["subscription_status"] = profile.get("subscription_status") if row["plan"] != "Free" else None

    def reconcile(self, referral, *, keep_lease=False):
        if not self.stripe_key:
            raise RuntimeError("Partner Stripe reader is unavailable")
        rows = self.db.table("users").select("stripe_customer_id").eq("id", referral["customer_id"]).execute().data
        customer = rows[0].get("stripe_customer_id") if rows else None
        registered = timestamp(referral["registered_at"])
        deadline = timestamp(referral["expires_at"])
        periods, evidence = [], []
        if customer and not customer.startswith("sim_cus_"):
            periods, evidence = stripe_paid_periods(customer, registered, deadline, self.stripe_key)
        paid_seconds, qualified = paid_progress(periods, registered, deadline, datetime.now(timezone.utc).timestamp())
        paid_at = min((max(start, paid, registered) for start, _, paid in periods), default=None)
        return self.rpc("billing_result", target=referral["customer_id"], lease=referral["check_token"],
                        paid_time=iso_time(paid_at), seconds_paid=paid_seconds, qualified_time=iso_time(qualified),
                        evidence=evidence, keep_lease=keep_lease and qualified is not None)

    def record_action(self, target, admin, action, data):
        if action not in {"approve", "reject", "pay"}:
            raise HTTPException(404, "Unknown reward action.")
        reward = self.db.table("partner_rewards").select("status").eq("customer_id", target).execute().data
        if not reward:
            raise HTTPException(404, "Reward unavailable.")
        existing = reward[0]["status"]
        desired = {"approve": "owed", "reject": "rejected", "pay": "paid"}[action]
        if desired == existing or (action == "approve" and existing == "paid"):
            return {"status": existing}
        note = data.note.strip()
        if action == "reject" and not note:
            raise HTTPException(422, "Enter a rejection reason.")
        if action == "pay" and (not data.paid_on or data.paid_on > datetime.now(timezone.utc).date()):
            raise HTTPException(422, "Enter a payment date on or before today.")
        lease = None
        if action == "approve":
            if existing != "ready":
                raise HTTPException(409, "This reward has changed. Refresh the review queue.")
            jobs = self.rpc("billing_jobs", target=target)
            if not jobs:
                raise HTTPException(409, "This reward is being reviewed. Try again in a moment.")
            try:
                if not self.reconcile(jobs[0], keep_lease=True):
                    raise HTTPException(409, "This reward has changed. Refresh the review queue.")
            except HTTPException:
                raise
            except Exception:
                logging.warning("partners.admin_billing.event_1")
                raise HTTPException(503, "Stripe billing could not be verified. Try again after review.") from None
            lease = jobs[0]["check_token"]
        status = self.rpc("reward_action", target=target, admin=admin, requested_action=action,
                          action_note=note, payment_date=data.paid_on.isoformat() if data.paid_on else None,
                          lease=lease)
        if status == "forbidden":
            raise HTTPException(403, "Partner administrator access is required.")
        if status == "missing":
            raise HTTPException(404, "Reward unavailable.")
        if status == "conflict":
            raise HTTPException(409, "This reward has changed. Refresh the review queue.")
        return {"status": status}

    def send_notifications(self):
        if self.email.missing_fields():
            return
        for job in self.rpc("email_jobs"):
            title, body = MAIL_COPY[job["event"]]
            try:
                response = requests.post(RESEND_SEND_URL, headers={
                    "Authorization": f"Bearer {self.email.api_key}",
                    "Idempotency-Key": f"nodemere-partners/{job['id']}",
                }, json={
                    "from": self.email.sender_email,
                    "to": [job["recipient"]],
                    "subject": title,
                    "text": f"{body}\n\nOpen your Nodemere Partners dashboard: {self.origin}/",
                }, timeout=8)
                response.raise_for_status()
                self.db.table("partner_email_outbox").update({
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", job["id"]).execute()
            except requests.RequestException:
                logging.warning("partners.notification.event_1")

    async def run(self):
        while True:
            try:
                await asyncio.to_thread(self.rpc, "register_businesses")
                if self.stripe_key:
                    jobs = await asyncio.to_thread(self.rpc, "billing_jobs")
                    results = await asyncio.gather(
                        *(asyncio.to_thread(self.reconcile, referral) for referral in jobs),
                        return_exceptions=True,
                    )
                    if any(isinstance(result, Exception) for result in results):
                        logging.warning("partners.billing.event_1")
                await asyncio.to_thread(self.send_notifications)
            except Exception:
                logging.warning("partners.worker.event_1")
            await asyncio.sleep(30)

    def router(self, customer_identity):
        router = APIRouter(tags=["Partners"])
        bearer = HTTPBearer()

        def account(token: HTTPAuthorizationCredentials = Depends(bearer)):
            return self.identify(token.credentials)

        def admin(user=Depends(account)):
            if not user["is_admin"]:
                raise HTTPException(403, "Partner administrator access is required.")
            return user

        @router.get("/r/{code}", include_in_schema=False)
        def click(code: str, request: Request):
            response = RedirectResponse("/", status_code=302, headers={"Cache-Control": "private, no-store"})
            if not self.enabled or not re.fullmatch(r"(?:[1-9][0-9]{3}|[a-f0-9]{12})", code):
                return response
            if (request.headers.get("sec-purpose") or request.headers.get("purpose")) or request.headers.get("sec-fetch-mode") not in {None, "navigate"}:
                return response
            if request.headers.get("sec-fetch-dest") not in {None, "document"}:
                return response
            agent = request.headers.get("user-agent", "")
            if not agent or re.search(r"bot|crawler|spider|preview|slackbot|facebookexternalhit", agent, re.I):
                return response
            # Render supplies the proxy peer chain and Vercel preserves its
            # verified client hop. Hash a bounded value before storing it.
            network = request.headers.get("x-vercel-forwarded-for") or (
                request.client.host if request.client else "unknown"
            )
            fingerprint = hmac.new(self.secret.encode(), network[:150].encode(), hashlib.sha256).hexdigest()
            try:
                visitor = self.rpc("track_click", ref_code=code, visitor=self.visitor(request),
                                   visitor_fingerprint=fingerprint)
            except Exception:
                logging.warning("partners.click.event_1")
                return response
            if visitor and visitor != self.visitor(request):
                secure = not self.referral_origin.startswith("http://localhost")
                for name, value in ((VISITOR_COOKIE, visitor), (MARKER_COOKIE, "1")):
                    response.set_cookie(name, value, max_age=180 * 86400, secure=secure,
                                        httponly=name == VISITOR_COOKIE, samesite="lax")
            return response

        @router.post("/api/partner-attribution/capture", status_code=204)
        def capture(request: Request, customer=Depends(customer_identity)):
            self.capture(request, customer.id)

        @router.post("/api/partners/signup", status_code=204)
        def signup(data: PartnerSignup, request: Request):
            self.signup(data, request)

        @router.get("/api/partners/account")
        def read_account(user=Depends(account)):
            return user

        @router.patch("/api/partners/account")
        def save_account(settings: PartnerSettings, user=Depends(account)):
            name = settings.full_name.strip()
            if not name:
                raise HTTPException(422, "Enter your full name.")
            values = {"full_name": name, "email_updates": settings.email_updates,
                      "payout_contact": settings.payout_contact.strip()}
            self.db.table("partner_accounts").update(values).eq("id", user["id"]).execute()
            return {**user, **values}

        @router.get("/api/partners/dashboard")
        def dashboard(days: int | None = Query(30), user=Depends(account)):
            if days not in {0, 7, 30, 90, 365}:
                raise HTTPException(422, "Choose a supported date range.")
            return {
                "totals": self.rpc("totals", owner=user["id"]),
                "analytics": self.rpc("analytics", owner=user["id"], days=days or None),
            }

        @router.get("/api/partners/referrals")
        def referrals(state: str = "", page: int = Query(0, ge=0), user=Depends(account)):
            if state and state not in STATUSES:
                raise HTTPException(422, "Unknown referral status.")
            return self.dashboard_rows(partner_id=user["id"], state=state, page=page)

        @router.get("/api/partners/payments")
        def payments(page: int = Query(0, ge=0), user=Depends(account)):
            return self.dashboard_rows(partner_id=user["id"], state="", page=page, paid_only=True)

        @router.get("/api/partners/admin/partners")
        def directory(page: int = Query(0, ge=0), search: str = Query("", max_length=120), user=Depends(admin)):
            query = self.db.table("partner_accounts").select(PARTNER_FIELDS)
            search = re.sub(r"[%_*(),]", "", search).strip()
            if search:
                query = query.ilike("full_name", f"%{search}%")
            rows = query.order("created_at", desc=True).order("id").range(page * 20, page * 20 + 20).execute().data
            shown = rows[:20]
            if shown:
                alerts = self.db.table("partner_click_alerts").select("partner_id,suppressed_clicks").in_(
                    "partner_id", [row["id"] for row in shown]
                ).execute().data
                counts = {row["partner_id"]: row["suppressed_clicks"] for row in alerts}
                for row in shown:
                    row["suppressed_clicks"] = counts.get(row["id"], 0)
            return {"rows": shown, "has_more": len(rows) > 20}

        @router.get("/api/partners/admin/referrals")
        def review(partner: UUID | None = None, state: str = "", page: int = Query(0, ge=0), user=Depends(admin)):
            if state and state not in STATUSES:
                raise HTTPException(422, "Unknown referral status.")
            owner = str(partner) if partner else None
            result = self.dashboard_rows(partner_id=owner, state=state, page=page, admin=True)
            ids = list({row["partner_id"] for row in result["rows"]})
            partners = self.db.table("partner_accounts").select("id,full_name").in_("id", ids).execute().data if ids else []
            names = {row["id"]: row["full_name"] for row in partners}
            for row in result["rows"]:
                row["partner_name"] = names.get(row["partner_id"])
            return {**result, "totals": self.rpc("totals", owner=owner)}

        @router.get("/api/partners/admin/referrals/{target}")
        def detail(target: UUID, user=Depends(admin)):
            rows = self.db.table("partner_referral_rows").select(
                "clicked_at,registered_at,business_registered_at,expires_at,paid_at,qualified_at,"
                "billing_checked_at,billing_evidence,review_flag,competing_attribution"
            ).eq("customer_id", str(target)).limit(1).execute().data
            if not rows:
                raise HTTPException(404, "Referral unavailable.")
            events = self.db.table("partner_reward_events").select("action,actor_id,note,created_at").eq(
                "customer_id", str(target)
            ).order("id", desc=True).execute().data
            actor_ids = list({row["actor_id"] for row in events if row["actor_id"]})
            if actor_ids:
                actors = self.db.table("partner_accounts").select("id,full_name").in_("id", actor_ids).execute().data
                names = {row["id"]: row["full_name"] for row in actors}
                for event in events:
                    event["actor_name"] = names.get(event["actor_id"])
            return {**rows[0], "events": events}

        @router.post("/api/partners/admin/referrals/{target}/{action}")
        def update_reward(target: UUID, action: str, data: RewardAction, user=Depends(admin)):
            return self.record_action(str(target), user["id"], action, data)

        return router
