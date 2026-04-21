# main.py
  
import logging
import stripe
import json
from uuid import UUID
from datetime import date, datetime, timezone, timedelta
from typing import List, Optional

# --- Logging Configuration ---
# Sets the root logger to output INFO level messages.
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Logging configured.")
# Silence HTTPX / HTTPCORE internal debug logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("hpack").setLevel(logging.WARNING)

# --- End Logging Configuration ---

from pydantic import BaseModel, Field, EmailStr
from fastapi import FastAPI, HTTPException, status, Depends, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from gotrue.errors import AuthApiError
from collections import defaultdict
from fastapi import BackgroundTasks
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from jose import JWTError, jwt
from config import supabase, stripe_webhook_secret, SECRET_KEY, ALGORITHM, TEST_MODE

 
from models import (
    UserUpdate, UserResponse, AuthSignUpRequest, LeadCreate,
    LeadResponse, AuthLoginRequest, LeadUpdate, PurchaseCreate,
    PurchaseUpdate, PurchaseResponse, CampaignItemResponse,
    CampaignCreate, CampaignUpdate, CampaignResponse, AIAgentResponse,
    AdminSetting, RepLoginRequest, MoneyTablePlan, MoneyTableRep, RepResponse, RepUpdate,
    PasswordCreate, PasswordUpdate, PasswordResponse, PrizeCreate, PrizeUpdate, PrizeResponse, TierResponse, HelpdeskMessage, OAuthAccountCreate, OAuthAccountResponse
)
from phone_helper import router as phone_helper_router
from dependencies import get_current_user, get_current_rep

# --------------------------------------------------------------------------
# App Initialization
# --------------------------------------------------------------------------
app = FastAPI(title="WYSL API")
# scheduler = AsyncIOScheduler()

app.include_router(phone_helper_router, prefix="/api", tags=["Phone Helper"])


# --------------------------------------------------------------------------
# Scheduler Jobs
# --------------------------------------------------------------------------
# @app.on_event("startup")
# async def startup_event():
#     # Schedule message generation to run every hour
#     # scheduler.add_job(
#     #     generate_messages_for_pending_campaigns,
#     #     trigger=CronTrigger(minute='0', second='0', timezone='UTC'), # Run at the top of every hour UTC
#     #     id="message_generation_schedule",
#     #     name="Generate messages for pending campaigns every hour",
#     #     replace_existing=True
#     # )
#     # scheduler.start()

# @app.on_event("shutdown")
# async def shutdown_event():
#     scheduler.shutdown()

# --------------------------------------------------------------------------
# Pydantic Models
# --------------------------------------------------------------------------
class CreateCheckoutSessionRequest(BaseModel):
    price_id: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str
    user: dict

class RepTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginStatusUpdate(BaseModel):
    is_logged_in: bool

class LeadDetailsForQueue(BaseModel):
    fullName: str
    company: Optional[str] = None

class QueueItemResponse(BaseModel):
    id: UUID
    message: str
    status: str
    created_at: datetime
    age: str
    campaign_name: Optional[str] = None
    lead_details: LeadDetailsForQueue

class WatcherStatusResponse(BaseModel):
    mode: str

class ManualWatcherRunRequest(BaseModel):
    simulated_time: Optional[datetime] = None

class VisitorCreate(BaseModel):
    user_agent: Optional[str] = None
    ip: Optional[str] = None
    iplocation: Optional[str] = None

class ConfigStatusResponse(BaseModel):
    test_mode: bool

# --------------------------------------------------------------------------
# Middleware & Exception Handlers
# --------------------------------------------------------------------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logging.error(f"Validation error for request {request.url}: {exc}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# --- CORS Configuration based on TEST_MODE ---
if TEST_MODE:
    origins = [
        "http://localhost:5173",  # For local development
        "http://172.20.10.2:5173", # For local network access
    ]
else:
    origins = [
        "https://keyquarters.com",  # For production frontend
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# --------------------------------------------------------------------------
# Visitor Tracking Endpoints
# --------------------------------------------------------------------------
@app.post("/track-visitor", status_code=status.HTTP_200_OK, tags=["Visitor Tracking"])
async def track_visitor(request: Request, visitor_data: VisitorCreate):
    user_agent = visitor_data.user_agent
    client_ip = request.client.host if request.client else "unknown"
    iplocation = visitor_data.iplocation # Assume iplocation might be provided, or fetch if not
    logging.debug(f"Tracking visitor with client_ip: {client_ip}, user_agent: {user_agent}")

    # If iplocation is not provided, try to fetch it
    if not iplocation and client_ip and client_ip != "unknown" and client_ip != "127.0.0.1":
        try:
            async with httpx.AsyncClient() as client:
                ip_api_url = f"http://ip-api.com/json/{client_ip}"
                response = await client.get(ip_api_url, timeout=3)
                if response.status_code == 200:
                    ip_info = response.json()
                    if ip_info and ip_info.get("status") == "success":
                        iplocation = f"{ip_info.get('city')}, {ip_info.get('regionName')}, {ip_info.get('country')}"
                        logging.debug(f"Successfully fetched iplocation: {iplocation}")
                    else:
                        logging.warning(f"IP-API failed for {client_ip}: {ip_info.get('message', 'Unknown error')}")
                else:
                    logging.warning(f"Failed to fetch IP location for {client_ip}. Status: {response.status_code}")
        except httpx.RequestError as e:
            logging.error(f"HTTPX error fetching IP location for {client_ip}: {e}", exc_info=True)
        except Exception as e:
            logging.error(f"Unexpected error fetching IP location for {client_ip}: {e}", exc_info=True)
    else:
        logging.debug(f"Skipping IP location fetch. iplocation provided: {bool(iplocation)}, client_ip: {client_ip}")
    
    if not user_agent:
        logging.warning("Received /track-visitor request with no user_agent.")
        return {"message": "User agent is required for tracking.", "status": "skipped"}

    try:
        # Check if visitor with this user_agent already exists, select 'visits' as well
        response = supabase.table('visitors').select('id', 'visits').eq('user_agent', user_agent).execute()

        if response.data:
            # Visitor exists, update last_visited and increment visits
            existing_visitor = response.data[0]
            current_visits = existing_visitor.get('visits', 0)
            logging.debug(f"Current visits for {user_agent}: {current_visits}")
            
            update_data = {
                "visits": current_visits + 1,
                "last_visited": datetime.now(timezone.utc).isoformat(),
                "iplocation": iplocation # Ensure iplocation is updated for returning visitors
            }
            logging.debug(f"Updating visits to: {current_visits + 1}")
            update_response = supabase.table('visitors').update(update_data).eq('user_agent', user_agent).execute()

            if update_response.data:
                logging.info(f"Returning visitor updated: {user_agent}, new visits: {current_visits + 1}")
                return {"message": "Returning visitor updated."}
            else:
                logging.error(f"Failed to update returning visitor: {update_response.error}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update returning visitor.")
        else:
            # Insert new visitor record
            insert_data = {
                "user_agent": user_agent,
                "ip": client_ip,
                "iplocation": iplocation,
                "visits": 1,
                "last_visited": datetime.now(timezone.utc).isoformat()
            }
            insert_response = supabase.table('visitors').insert(insert_data).execute()
            
            if insert_response.data:
                logging.info(f"New visitor tracked: {user_agent}, IP: {client_ip}, Location: {iplocation}")
                return {"message": "Visitor tracked successfully."}
            else:
                logging.error(f"Failed to insert new visitor: {insert_response.error}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to track visitor.")
    except Exception as e:
        logging.error(f"Error tracking visitor: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# --------------------------------------------------------------------------
# Auth Helpers
# --------------------------------------------------------------------------
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --------------------------------------------------------------------------
# API Endpoints
# --------------------------------------------------------------------------

@app.get("/", tags=["Health Check"])
def root():
    return {"status": "ok", "message": "Welcome to the WYSL API"}

@app.get("/config/status", response_model=ConfigStatusResponse, tags=["Config"])
async def get_config_status():
    """Returns the current configuration status, like TEST_MODE."""
    return {"test_mode": TEST_MODE}

# --- Messages Endpoint for Queue ---
@app.get("/messages/queue", response_model=List[QueueItemResponse], tags=["Messages"])
async def get_queue_messages(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('messages').select(
            'id, message, status, created_at, leads!inner(first_name, last_name, company, lead_campaigns(campaigns(name)))'
        ).eq(
            'status', 'pending approval'
        ).eq(
            'leads.user', str(current_user_id)
        ).execute()

        if not response.data:
            return []

        formatted_data = []
        for item in response.data:
            lead_info = item.get('leads')
            if not lead_info:
                continue

            campaign_name = None
            if lead_info.get('lead_campaigns') and lead_info['lead_campaigns'][0].get('campaigns'):
                campaign_name = lead_info['lead_campaigns'][0]['campaigns'].get('name')

            created_at_dt = datetime.fromisoformat(item.get('created_at').replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            time_diff = now - created_at_dt

            if time_diff.total_seconds() < 3600:
                age_str = f"{int(time_diff.total_seconds() // 60)} minutes ago"
            elif time_diff.total_seconds() < 86400:
                age_str = f"{int(time_diff.total_seconds() // 3600)} hours ago"
            else:
                age_str = f"{time_diff.days} days ago"

            formatted_item = QueueItemResponse(
                id=item.get('id'),
                message=item.get('message'),
                status=item.get('status'),
                created_at=item.get('created_at'),
                age=age_str,
                campaign_name=campaign_name,
                lead_details=LeadDetailsForQueue(
                    fullName=f"{lead_info.get('first_name', '')} {lead_info.get('last_name', '')}".strip(),
                    company=lead_info.get('company')
                )
            )
            formatted_data.append(formatted_item)
        
        return formatted_data

    except Exception as e:
        logging.error(f"Failed to get queue for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve queue messages.")

@app.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Messages"])
async def delete_message(message_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        message_info = supabase.table('messages').select('lead').eq('id', str(message_id)).single().execute()
        if not message_info.data or not message_info.data.get('lead'):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found or lead association missing.")
        lead_id = message_info.data['lead']
        
        ownership_check = supabase.table('leads').select('id').eq('id', str(lead_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied: You do not own this message's associated lead.")
        
        supabase.table('messages').delete().eq('id', str(message_id)).execute()
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Failed to delete message {message_id} for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete message.")

@app.put("/messages/{message_id}/status", status_code=status.HTTP_200_OK, tags=["Messages"])
async def update_message_status(message_id: UUID, updated_message_content: dict, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        new_message_text = updated_message_content.get('message')
        if new_message_text is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message content is required.")

        message_info = supabase.table('messages').select('lead').eq('id', str(message_id)).single().execute()
        if not message_info.data or not message_info.data.get('lead'):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found or lead association missing.")
        lead_id = message_info.data['lead']
        
        ownership_check = supabase.table('leads').select('id').eq('id', str(lead_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied: You do not own this message's associated lead.")
        
        update_data = {
            'status': 'ready',
            'message': new_message_text
        }
        
        response = supabase.table('messages').update(update_data).eq('id', str(message_id)).execute()
        
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found or update failed.")
        
        return {"message": "Message status updated to 'ready' and content saved."}
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Failed to update message {message_id} status for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update message status.")

# --- Authentication Endpoint ---
@app.post("/token", response_model=TokenResponse, tags=["Authentication"])
async def login_for_access_token(form_data: AuthLoginRequest):
    try:
        response = supabase.auth.sign_in_with_password({"email": form_data.email, "password": form_data.password})
        if response.session:
            return response.session.model_dump()
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login failed: No session returned.")
    except AuthApiError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=e.message or "Invalid email or password", headers={"WWW-Authenticate": "Bearer"})
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

# --- Breakroom (Reps) Endpoints ---
@app.post("/breakroom/login", response_model=RepTokenResponse, tags=["Reps"])
async def login_for_rep_access_token(form_data: RepLoginRequest):
    logging.info("--- [STEP 1] Breakroom login process started. ---")
    try:
        logging.info(f"--- [STEP 2] Querying database for rep_id: '{form_data.rep_id}'. ---")
        rep_response = supabase.table('reps').select('*').eq('rep_id', form_data.rep_id).single().execute()
        
        if not rep_response.data:
            logging.warning(f"--- [FAIL] Rep login failed: Rep ID '{form_data.rep_id}' not found in the database. ---")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rep ID not found.")
        
        logging.info("--- [STEP 3] Rep ID found in the database. Proceeding to password verification. ---")
        rep = rep_response.data
        
        received_password = form_data.password
        db_password = rep.get('rep_password')
        
        logging.info(f"--- [STEP 4] Comparing passwords. Received: '{received_password}' (Length: {len(received_password)}), Database: '{db_password}' (Length: {len(db_password) if db_password else 'N/A'}). ---")
        
        passwords_match = received_password == db_password
        
        if not passwords_match:
            logging.warning(f"--- [FAIL] Password mismatch for rep_id '{form_data.rep_id}'. ---")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password.")

        logging.info("--- [STEP 5] Passwords match. Creating access token. ---")
        access_token_expires = timedelta(minutes=60)
        access_token = create_access_token(
            data={"sub": rep.get('rep_id')}, expires_delta=access_token_expires
        )
        
        logging.info("--- [SUCCESS] Access token created. Login successful. ---")
        return {"access_token": access_token, "token_type": "bearer"}

    except HTTPException as e:
        # Re-raising HTTPException to let FastAPI handle it, no extra logging needed here.
        raise e
    except Exception as e:
        logging.error(f"--- [ERROR] An unexpected error occurred during login for rep_id {form_data.rep_id}: {e} ---", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An internal error occurred.")

@app.get("/reps/me", response_model=RepResponse, tags=["Reps"])
async def read_current_rep(current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('reps').select('*').eq('rep_id', current_rep_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Current rep's profile not found.")
        return RepResponse.model_validate(response.data).model_dump()
    except Exception as e:
        logging.error(f"Error fetching rep profile for rep_id {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.patch("/reps/{rep_id}/deduct-points", response_model=RepResponse, tags=["Reps"])
async def deduct_rep_points(rep_id: UUID, points_data: dict, current_rep_id: str = Depends(get_current_rep)):
    points_to_deduct = points_data.get("points_to_deduct")
    if points_to_deduct is None or not isinstance(points_to_deduct, (int, float)) or points_to_deduct < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valid 'points_to_deduct' (non-negative number) is required.")

    try:
        rep_profile_response = supabase.table('reps').select('id', 'rep_id', 'points').eq('id', str(rep_id)).single().execute()
        if not rep_profile_response.data or rep_profile_response.data.get('rep_id') != current_rep_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to update this rep's profile.")

        current_points = rep_profile_response.data.get('points', 0)
        if current_points < points_to_deduct:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient points.")

        updated_points = current_points - points_to_deduct
        response = supabase.table('reps').update({'points': updated_points}).eq('id', str(rep_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rep not found or points update failed.")
        
        return RepResponse.model_validate(response.data[0]).model_dump()
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error deducting points for rep {rep_id} by {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/money-table", response_model=List[MoneyTablePlan], tags=["Reps"])
async def get_money_table_data(current_rep: str = Depends(get_current_rep)):
    try:
        # 1. Fetch all data
        plans_response = supabase.table('plans').select('plan, plan_label').execute()
        reps_response = supabase.table('reps').select('rep_id, first_name, last_name, points').execute()
        users_response = supabase.table('users').select('plan, associate').execute()

        if not plans_response.data or not reps_response.data:
            return []

        # 2. Process data into easily accessible structures
        reps_map = {rep['rep_id']: rep for rep in reps_response.data}
        
        plan_to_reps = defaultdict(set)
        for user in users_response.data:
            if user.get('plan') and user.get('associate'):
                plan_to_reps[user['plan']].add(user['associate'])

        # 3. Build the final response
        money_table_data = []
        for plan in plans_response.data:
            plan_name = plan['plan']
            associated_rep_ids = plan_to_reps[plan_name]
            
            plan_reps = []
            total_monthly_commission = 0
            
            for rep_id in associated_rep_ids:
                if rep_id in reps_map:
                    rep_data = reps_map[rep_id]
                    plan_reps.append(MoneyTableRep(
                        first_name=rep_data.get('first_name', ''),
                        last_name=rep_data.get('last_name', ''),
                        points=rep_data.get('points', 0)
                    ))
                    total_monthly_commission += rep_data.get('points', 0)
            
            money_table_data.append(MoneyTablePlan(
                plan=plan_name,
                plan_label=plan.get('plan_label', plan_name.capitalize()),
                total_annual_payouts=total_monthly_commission * 12,
                reps=plan_reps
            ))
            
        return money_table_data

    except Exception as e:
        logging.error(f"Error fetching money table data: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve money table data.")



# --- Billing Endpoints ---
@app.get("/plans", tags=["Billing"])
async def get_plans():
    try:
        products = stripe.Product.list(active=True, limit=100)
        prices = stripe.Price.list(active=True, limit=100)
        return {"products": products.data, "prices": prices.data}
    except Exception as e:
        logging.error(f"Error fetching plans: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch plans")

@app.post("/create-checkout-session", tags=["Billing"])
async def create_checkout_session(request: CreateCheckoutSessionRequest, current_user: dict = Depends(get_current_user)):
  current_user_id = current_user.id
  try:
    user_profile = supabase.table('users').select('email', 'stripe_customer_id', 'started_trial').eq('id', str(current_user_id)).single().execute()
    if not user_profile.data:
      raise HTTPException(status_code=404, detail="User not found")
    
    customer_id = user_profile.data.get('stripe_customer_id')
    user_email = user_profile.data.get('email')

    if not customer_id:
      customer = stripe.Customer.create(email=user_email, metadata={'supabase_user_id': str(current_user_id)})
      customer_id = customer.id
      supabase.table('users').update({'stripe_customer_id': customer_id}).eq('id', str(current_user_id)).execute()

    # Dynamically set the base URL based on TEST_MODE
    if TEST_MODE:
        base_url = "http://localhost:5173"
    else:
        base_url = "https://keyquarters.com"

    price_to_use = request.price_id
    checkout_session_data = {
      'customer': customer_id,
      'payment_method_types': ['card'],
      'line_items': [{'price': price_to_use, 'quantity': 1}],
      'mode': 'subscription',
      'allow_promotion_codes': True,
      'subscription_data': {'metadata': {'supabase_user_id': str(current_user_id)}},
      'success_url': f'{base_url}/dashboard?session_id={{CHECKOUT_SESSION_ID}}',
      'cancel_url': f'{base_url}/pricing?canceled=true',
    }

    # Conditionally add 14-day trial
    user_has_started_trial = user_profile.data.get('started_trial', False)
    if not user_has_started_trial:
      checkout_session_data['subscription_data']['trial_period_days'] = 14

    checkout_session = stripe.checkout.Session.create(**checkout_session_data)


    return {"sessionId": checkout_session.id, "url": checkout_session.url}

  except stripe.error.InvalidRequestError as e:
    if "No such customer" in str(e):
      logging.warning(f"Stale customer ID for user {current_user_id}. Creating a new one.")
      supabase.table('users').update({'stripe_customer_id': None}).eq('id', str(current_user_id)).execute()
      return await create_checkout_session(request, current_user_id)
    else:
      logging.error(f"Stripe InvalidRequestError: {e}", exc_info=True)
      raise HTTPException(status_code=500, detail=str(e))
  except Exception as e:
    logging.error(f"Error creating checkout session for user {current_user_id}: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="An internal error occurred.")

@app.post("/stripe-webhook", tags=["Billing"])
async def stripe_webhook(request: Request, stripe_signature: str = Header(None)):
    try:
        event = stripe.Webhook.construct_event(payload=await request.body(), sig_header=stripe_signature, secret=stripe_webhook_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        customer_id = session.get('customer')
        subscription_id = session.get('subscription')
        subscription = stripe.Subscription.retrieve(subscription_id)

        plan_name = "free"  # Default to free
        source = None
        billing_period = None

        if 'items' in subscription and 'data' in subscription['items'] and subscription['items']['data']:
            price_data = subscription['items']['data'][0]['price']
            
            # Extract source from price metadata
            # The user has added a 'source' key to the metadata of the Stripe price.
            source = price_data.get('metadata', {}).get('source')
            source = source.lower() # Store source in lowercase

            # Extract billing period
            if price_data.get('recurring') and price_data['recurring'].get('interval'):
                interval = price_data['recurring']['interval']
                if interval == 'month':
                    billing_period = 'monthly'
                elif interval == 'year':
                    billing_period = 'yearly'

            # Extract plan name from product
            if price_data.get('product'):
                product = stripe.Product.retrieve(price_data.get('product'))
                if product.name:
                    plan_name = product.name.lower() # Store plan name in lowercase

        logging.info(f"Extracted Plan: {plan_name}, Source: {source}, Billing Period: {billing_period}")

        # Determine subscription status based on trial presence
        subscription_status = subscription.get('status')
        # If there's a trial_start, it means the subscription is currently in trial
        if subscription.get('trial_start'):
            subscription_status = "trialing"

        # Fetch current user data to check existing plan
        user_data_response = supabase.table('users').select('plan').eq('stripe_customer_id', customer_id).single().execute()
        current_plan = user_data_response.data.get('plan') if user_data_response.data else None

        update_data = {
            'stripe_subscription_id': subscription.get('id'),
            'subscription_status': subscription_status,
            'source': source, # New field
            'billing_period': billing_period, # New field
            'plan': plan_name,
            'trial_start_date': date.fromtimestamp(subscription.get('trial_start')).isoformat() if subscription.get('trial_start') else None,
            'trial_end_date': date.fromtimestamp(subscription.get('trial_end')).isoformat() if subscription.get('trial_end') else None,
            'months_subscribed': 0,
            'started_trial': True if subscription.get('trial_start') else False
        }
        
        if current_plan != plan_name:
            update_data['plan_change_popup'] = None

        supabase.table('users').update(update_data).eq('stripe_customer_id', customer_id).execute()
        logging.info(f"Checkout session completed for user with customer ID: {customer_id}. Plan changed: {current_plan} -> {plan_name}")

    elif event['type'] == 'invoice.paid':
        invoice = event['data']['object']
        try:
            customer_id = invoice.get('customer')
            amount_paid = invoice.get('amount_paid') # amount_paid is in cents
            
            if not customer_id or amount_paid is None or amount_paid <= 0:
                logging.warning(f"Skipping invoice.paid event due to missing data. Customer: {customer_id}, Amount: {amount_paid}")
                return {"status": "skipped"}
            
            # 1. Update user's subscription_status to "active" and increment months_subscribed
            user_data_response = supabase.table('users').select('id, associate, months_subscribed, subscription_status, stripe_subscription_id').eq('stripe_customer_id', customer_id).single().execute()

            if user_data_response.data:
                user_id = user_data_response.data['id']
                associate_rep_id = user_data_response.data.get('associate')
                current_months_subscribed = user_data_response.data.get('months_subscribed', 0)
                current_subscription_status = user_data_response.data.get('subscription_status')
                # Get the subscription_id from your Supabase record, not the webhook payload
                subscription_id_from_db = user_data_response.data.get('stripe_subscription_id')

                # Validate that the subscription ID from the DB exists before proceeding
                if not subscription_id_from_db:
                    logging.error(f"User {user_id} has no stripe_subscription_id in Supabase. Skipping invoice.paid processing.")
                    return {"status": "skipped - no subscription ID in database"}

                # Update user's subscription status to active and increment months_subscribed
                updated_months_subscribed = current_months_subscribed + 1
                user_update_data = {
                    'subscription_status': 'active',
                    'months_subscribed': updated_months_subscribed,
                    'log': None, # Clear any previous failure logs on success
                    'card_retries': 0, # Reset card retries on success
                    'latest_charge_attempt': datetime.now(timezone.utc).isoformat() # Update last attempt
                }
                
                user_status_update_response = supabase.table('users').update(user_update_data).eq('id', user_id).execute() # type: ignore
                if not user_status_update_response.data:
                    logging.error(f"Supabase update for user {user_id} subscription status affected no rows.", exc_info=True)
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update user's subscription status.")
                logging.info(f"User {user_id} subscription status updated to 'active' and months_subscribed incremented to {updated_months_subscribed}.")

                # 2. Commission Calculation for Rep
                if associate_rep_id:
                    logging.info(f"Attempting to find rep with full name: {associate_rep_id}")
                    rep_data_response = supabase.table('reps').select('id, tier, points').eq('associate_full_name', associate_rep_id).single().execute()
                    logging.debug(f"Rep data response: {rep_data_response.data}")
                    
                    if rep_data_response.data:
                        rep_db_id = rep_data_response.data['id']
                        rep_tier_name = rep_data_response.data.get('tier')
                        rep_current_points = rep_data_response.data.get('points') or 0 # Ensure points default to 0 if None

                        if rep_tier_name:
                            tier_data_response = supabase.table('tiers').select('multiplier_new_acquisition, multiplier_rebill').eq('name', rep_tier_name).single().execute() # type: ignore
                            logging.debug(f"Tier data response for tier '{rep_tier_name}': {tier_data_response.data}")
                            if tier_data_response.data:
                                multiplier = 0
                                # Use the previous status to determine the multiplier
                                if current_subscription_status == 'trialing':
                                    multiplier = tier_data_response.data.get('multiplier_new_acquisition', 0)
                                    logging.info(f"Applying new acquisition multiplier for rep {associate_rep_id}.")
                                else:
                                    multiplier = tier_data_response.data.get('multiplier_rebill', 0)
                                    logging.info(f"Applying rebill multiplier for rep {associate_rep_id}.")

                                billed_amount_dollars = amount_paid / 100
                                commission_points = billed_amount_dollars * multiplier
                                
                                # Fetch the final global points multiplier from the master table
                                master_response = supabase.table('master').select('points_multiplier').eq('id', '0').single().execute()
                                final_multiplier = master_response.data.get('points_multiplier', 1.0) if master_response.data else 1.0
                                
                                final_commission_points = commission_points * final_multiplier
                                
                                # Round the final commission points to the nearest whole number
                                rounded_points_to_add = round(final_commission_points)
                                
                                updated_points = rep_current_points + rounded_points_to_add
                                
                                # Fetch current total_points for the user
                                user_current_points_response = supabase.table('users').select('total_points').eq('id', user_id).single().execute() # type: ignore
                                current_total_points = user_current_points_response.data.get('total_points', 0) if user_current_points_response.data else 0
                                new_total_points = current_total_points + rounded_points_to_add

                                # Update the user's record with the last awarded points and total points
                                user_points_update_response = supabase.table('users').update({'last_awarded_points': rounded_points_to_add, 'total_points': new_total_points}).eq('id', user_id).execute() # type: ignore
                                if not user_points_update_response.data:
                                    logging.error(f"Supabase update for user {user_id} with last_awarded_points and total_points affected no rows.", exc_info=True)
                                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update user's awarded points.")
                                logging.info(f"User {user_id} awarded {rounded_points_to_add} points to rep {associate_rep_id}.")
                                logging.info(f"User {user_id} total_points updated to {new_total_points}.")


                                rep_points_update_response = supabase.table('reps').update({'points': updated_points}).eq('id', rep_db_id).execute() # type: ignore
                                if not rep_points_update_response.data:
                                    logging.error(f"Supabase update for rep {rep_db_id} points affected no rows.", exc_info=True)
                                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update rep's points.")
                                logging.info(f"Commission calculated (Tier: {commission_points:.2f}, Final: {final_commission_points:.2f}, Rounded: {rounded_points_to_add}) and added to rep {associate_rep_id}. New total: {updated_points}")
                            else:
                                logging.warning(f"Tier '{rep_tier_name}' not found in 'tiers' table for commission calculation.")
                        else:
                            logging.warning(f"Rep '{associate_rep_id}' does not have a tier assigned for commission calculation.")
                    else:
                        logging.warning(f"Rep '{associate_rep_id}' not found in 'reps' table. Skipping commission update.")
                else:
                    logging.warning(f"User {user_id} does not have an associate for commission calculation.")
            else:
                logging.warning(f"User not found for stripe_customer_id {customer_id} during invoice.paid event.")
        except HTTPException:
            raise # Re-raise HTTPExceptions
        except Exception as e:
            logging.error(f"An unexpected error occurred during invoice.paid event processing for customer {customer_id}: {e}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An internal error occurred during invoice.paid processing: {str(e)}")

    elif event['type'] == 'invoice.payment_failed':
        invoice = event['data']['object']
        customer_id = invoice.get('customer')
        # next_payment_attempt is a timestamp, convert to datetime for logging
        latest_attempt_date = datetime.fromtimestamp(invoice.get('next_payment_attempt')).isoformat() if invoice.get('next_payment_attempt') else datetime.now(timezone.utc).isoformat()
        failure_reason = invoice.get('last_payment_error', {}).get('message', 'Payment failed for unknown reason.')

        if customer_id:
            user_data_response = supabase.table('users').select('id, card_retries').eq('stripe_customer_id', customer_id).single().execute()
            if user_data_response.data:
                user_id = user_data_response.data['id']
                current_card_retries = user_data_response.data.get('card_retries', 0)

                user_update_data = {
                    'subscription_status': 'failed',
                    'log': f"Payment failed: {failure_reason}",
                    'card_retries': current_card_retries + 1,
                    'latest_charge_attempt': datetime.now(timezone.utc).isoformat()
                }
                supabase.table('users').update(user_update_data).eq('id', user_id).execute()
            else:
                logging.error(f"User not found for stripe_customer_id {customer_id} during payment_failed event.")
        else:
            logging.error(f"Customer ID missing in invoice.payment_failed event.")

    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        customer_id = subscription.get('customer')
        subscription_id = subscription.get('id')
        
        if customer_id and subscription_id:
            # Fetch the user from Supabase
            user_data_response = supabase.table('users').select('id, subscription_status, plan').eq('stripe_customer_id', customer_id).single().execute()

            if user_data_response.data:
                user_id = user_data_response.data['id']
                current_subscription_status = user_data_response.data.get('subscription_status')
                current_plan = user_data_response.data.get('plan')

                # Use 'ended_at' from the Stripe subscription object for the cancellation date.
                # If 'ended_at' is not present, use current UTC time.
                ended_at_timestamp = subscription.get('ended_at')
                cancellation_date = date.fromtimestamp(ended_at_timestamp).isoformat() if ended_at_timestamp else datetime.now(timezone.utc).isoformat()

                update_data = {
                    'subscription_status': 'canceled', # Set status to 'canceled'
                    'trial_end_date': cancellation_date, # Set the date when the trial/subscription ended
                    'stripe_subscription_id': None, # Clear the subscription ID as it's deleted
                    'plan': 'free', # Revert to free plan as the subscription is gone
                    'source': None, # Clear source and billing period
                    'billing_period': None,
                    'started_trial': False # Trial is no longer active
                }

                supabase.table('users').update(update_data).eq('id', user_id).execute()
                logging.info(f"User {user_id} (customer {customer_id}) subscription deleted. Status set to 'canceled'. Subscription ID: {subscription_id}")
            else:
                logging.warning(f"User not found for stripe_customer_id {customer_id} during customer.subscription.deleted event.")
        else:
            logging.error(f"Missing customer_id or subscription_id in customer.subscription.deleted event.")
    return {"status": "success"}








# --- User Endpoints ---


@app.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["Users"])
async def create_user(auth_data: AuthSignUpRequest):
    try:
        auth_response = supabase.auth.sign_up({"email": auth_data.email, "password": auth_data.password})
        if not auth_response.user:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Supabase signup failed")
        
        user_id = auth_response.user.id
        profile_data = {"id": str(user_id), "email": auth_data.email, "role": "user"}
        db_response = supabase.table('users').insert(profile_data).execute()
        
        if not db_response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user profile")
        return db_response.data[0]
    except AuthApiError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/users/me", tags=["Users"])
async def read_current_user(current_user: dict = Depends(get_current_user)):
    logging.info(f"read_current_user called for user ID: {current_user.id}")
    try:
        response = supabase.table('users').select('*').eq('id', str(current_user.id)).limit(1).execute()
        logging.info(f"Supabase select response (raw): {response}")
        
        if not response.data or not response.data[0]:
            logging.info(f"User profile not found in public.users for ID: {current_user.id}. Attempting to create default profile.")
            
            user_email = current_user.email
            logging.info(f"Retrieved email from current_user object: {user_email}")

            profile_data = {
                "id": str(current_user.id),
                "email": user_email,
                "role": "user",
                "plan": "free", # Default plan
                "source": None, # Initialize new source column
                "billing_period": None, # Initialize new billing_period column
                "display_intro": False,
                "is_logged_in": True,
                "manual_approval": True,
                "daily_passwords_count": 0,
                "total_passwords_count": 0,
                "daily_messages_count": 0,
                "total_messages_count": 0,
                "daily_events_count": 0,
                "total_events_count": 0,
                "card_retries": 0,
                "months_subscribed": 0,
                "device": {}, # Default empty dict for device
                "total_points": 0, # Initialize total_points for new users
            }
            logging.info(f"Prepared profile_data for insertion: {profile_data}")
            
            insert_response = supabase.table('users').insert(profile_data).execute()
            logging.info(f"Supabase insert response: {insert_response}")

            if not insert_response.data:
                logging.error(f"Failed to create user profile in public.users for ID: {current_user.id}. Supabase response: {insert_response.error}")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user profile after OAuth login.")
            
            # Return the newly created profile
            return UserResponse.model_validate(insert_response.data[0]).model_dump()
        
        return UserResponse.model_validate(response.data[0]).model_dump()
    except Exception as e:
        logging.error(f"Error in read_current_user for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.put("/users/me", tags=["Users"])
async def update_user_profile(user_update_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    update_data = user_update_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    if 'active_ai_agent' in update_data and update_data['active_ai_agent'] is not None:
        update_data['active_ai_agent'] = str(update_data['active_ai_agent'])

    try:
        response = supabase.table('users').update(update_data).eq('id', str(current_user_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found or update failed")
        
        # Explicitly handle potential None values for date fields during response serialization
        user_data = response.data[0]
        if user_data.get('trial_start_date') is None: user_data['trial_start_date'] = None
        if user_data.get('trial_end_date') is None: user_data['trial_end_date'] = None

        return UserResponse.model_validate(user_data).model_dump()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.post("/users/me/login-status", status_code=status.HTTP_204_NO_CONTENT, tags=["Users"])
async def update_login_status(status_update: LoginStatusUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        update_data = status_update.model_dump()
        supabase.table('users').update(update_data).eq('id', str(current_user_id)).execute()
    except Exception as e:
        logging.error(f"ERROR: Could not update login status for user {current_user_id}: {e}")

# --- Leads Endpoints ---

@app.get("/leads", response_model=List[LeadResponse], tags=["Leads"])
async def get_leads_for_user(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('leads').select(
            '*, lead_campaigns(*, campaigns(name)), purchases(*)'
        ).eq(
            'user', str(current_user_id)
        ).execute()
        return response.data
    except Exception as e:
        logging.error(f"Failed to get leads for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"An internal error occurred while fetching leads: {str(e)}"
        )

@app.post("/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED, tags=["Leads"])
async def create_lead_for_user(lead_data: LeadCreate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    new_lead = lead_data.model_dump()
    new_lead['user'] = str(current_user_id)
    try:
        response = supabase.table('leads').insert(new_lead).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create lead")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.put("/leads/{lead_id}", response_model=LeadResponse, tags=["Leads"])
async def update_lead_for_user(lead_id: UUID, lead_update_data: LeadUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    update_data = lead_update_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    if update_data.get("created_at"):
        update_data["created_at"] = update_data["created_at"].isoformat()
    if update_data.get("last_checked"):
        update_data["last_checked"] = update_data["last_checked"].isoformat()
    if update_data.get("last_follow_up"):
        update_data["last_follow_up"] = update_data["last_follow_up"].isoformat()
    
    try:
        ownership_check = supabase.table('leads').select('id').eq('id', str(lead_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found or you do not have permission to edit it.")
        
        response = supabase.table('leads').update(update_data).eq('id', str(lead_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Lead not found or update failed (no rows affected).")
        
        return LeadResponse.model_validate(response.data[0]).model_dump()
    except Exception as e:
        logging.error(f"AN ERROR OCCURRED during lead update for user {current_user_id} and lead {lead_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during lead update: {str(e)}")

@app.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Leads"])
async def delete_lead_for_user(lead_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        ownership_check = supabase.table('leads').select('id').eq('id', str(lead_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found or you do not have permission to delete it.")
        supabase.table('leads').delete().eq('id', str(lead_id)).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# --- Purchases Endpoints ---
@app.post("/purchases", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED, tags=["Purchases"])
async def create_purchase(purchase_data: PurchaseCreate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        lead_owner_check = supabase.table('leads').select('user').eq('id', str(purchase_data.lead)).single().execute()
    except Exception as e:
        logging.error(f"DATABASE ERROR during lead ownership check for lead {purchase_data.lead}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error checking lead ownership.")

    if not lead_owner_check.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Lead {purchase_data.lead} not found.")

    lead_owner_id = lead_owner_check.data['user']

    if str(lead_owner_id) != str(current_user_id):
        logging.warning(f"PERMISSION DENIED: User '{current_user_id}' does not own lead '{purchase_data.lead}'. Owner is '{lead_owner_id}'.")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    new_purchase = purchase_data.model_dump()
    new_purchase['user'] = str(current_user_id)

    if new_purchase.get("upgrade_eligible_date"):
        new_purchase["upgrade_eligible_date"] = new_purchase["upgrade_eligible_date"].isoformat()

    if new_purchase.get("lead"):
        new_purchase["lead"] = str(new_purchase["lead"])

    try:
        response = supabase.table('purchases').insert(new_purchase).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create purchase")
        return response.data[0]
    except Exception as e:
        logging.error(f"DATABASE ERROR creating purchase for lead {purchase_data.lead}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.put("/purchases/{purchase_id}", response_model=PurchaseResponse, tags=["Purchases"])
async def update_purchase(purchase_id: UUID, purchase_update: PurchaseUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        owner_check = supabase.table('purchases').select('user').eq('id', str(purchase_id)).single().execute()
    except Exception as e:
        logging.error(f"DATABASE ERROR during ownership check for purchase {purchase_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error checking purchase ownership.")

    if not owner_check.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Purchase {purchase_id} not found.")

    if str(owner_check.data['user']) != str(current_user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    update_data = purchase_update.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")

    if update_data.get("upgrade_eligible_date"):
        update_data["upgrade_eligible_date"] = update_data["upgrade_eligible_date"].isoformat()

    try:
        response = supabase.table('purchases').update(update_data).eq('id', str(purchase_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found or update failed")
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.delete("/purchases/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Purchases"])
async def delete_purchase(purchase_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        owner_check = supabase.table('purchases').select('user').eq('id', str(purchase_id)).single().execute()
    except Exception as e:
        logging.error(f"DATABASE ERROR during ownership check for purchase {purchase_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error checking purchase ownership.")
    
    if not owner_check.data:
        return

    if str(owner_check.data['user']) != str(current_user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied.")

    try:
        supabase.table('purchases').delete().eq('id', str(purchase_id)).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# =============================================================================
# HELPDESK ENDPOINTS
# =============================================================================
@app.post("/helpdesk", status_code=status.HTTP_201_CREATED, tags=["Helpdesk"])
async def submit_helpdesk_message(message_data: HelpdeskMessage):
    try:
        insert_data = message_data.model_dump()
        if insert_data['user'] is not None:
            insert_data['user'] = str(insert_data['user'])

        response = supabase.table('helpdesk').insert(insert_data).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to submit helpdesk message")
        return {"message": "Helpdesk message submitted successfully!"}
    except Exception as e:
        logging.error(f"Error submitting helpdesk message: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    




# =============================================================================
# AI AGENT ENDPOINTS
# =============================================================================

@app.get("/ai-agents", response_model=List[AIAgentResponse], tags=["AI Agents"])
async def get_available_ai_agents(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('ai_agents').select('*').or_(
            f'access.eq.open,user.eq.{str(current_user_id)}'
        ).execute()
        
        return response.data
    except Exception as e:
        logging.error(f"Error getting available AI agents for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve AI agents")

# =============================================================================
# CAMPAIGN ENDPOINTS
# =============================================================================

@app.post("/campaigns", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED, tags=["Campaigns"])
async def create_campaign(campaign_data: CampaignCreate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    new_campaign = campaign_data.model_dump()
    new_campaign['user'] = str(current_user_id)
    try:
        response = supabase.table('campaigns').insert(new_campaign).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create campaign")
        return response.data[0]
    except Exception as e:
        logging.error(f"Error creating campaign for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/campaigns", response_model=List[CampaignResponse], tags=["Campaigns"])
async def get_campaigns(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('campaigns').select('*').eq('user', str(current_user_id)).execute()
        return response.data
    except Exception as e:
        logging.error(f"Error getting campaigns for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve campaigns")

@app.get("/campaigns/{campaign_id}", response_model=CampaignResponse, tags=["Campaigns"])
async def get_campaign(campaign_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('campaigns').select('*').eq('id', str(campaign_id)).eq('user', str(current_user_id)).single().execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found or permission denied")
        return response.data
    except Exception as e:
        logging.error(f"Error getting campaign {campaign_id} for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve campaign")

@app.put("/campaigns/{campaign_id}", response_model=CampaignResponse, tags=["Campaigns"])
async def update_campaign(campaign_id: UUID, campaign_data: CampaignUpdate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    update_data = campaign_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    try:
        ownership_check = supabase.table('campaigns').select('id').eq('id', str(campaign_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found or permission denied")

        response = supabase.table('campaigns').update(update_data).eq('id', str(campaign_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign update failed")
        return response.data[0]
    except Exception as e:
        logging.error(f"Error updating campaign {campaign_id} for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update campaign")

@app.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Campaigns"])
async def delete_campaign(campaign_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        ownership_check = supabase.table('campaigns').select('id').eq('id', str(campaign_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found or permission denied")

        supabase.table('campaigns').delete().eq('id', str(campaign_id)).execute()
    except Exception as e:
        logging.error(f"Error deleting campaign {campaign_id} for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete campaign")

# =============================================================================
# PRIZE ENDPOINTS
# =============================================================================

@app.post("/prizes", response_model=PrizeResponse, status_code=status.HTTP_201_CREATED, tags=["Prizes"])
async def create_prize(prize_data: PrizeCreate, current_rep_id: str = Depends(get_current_rep)):
    new_prize = prize_data.model_dump()
    try:
        response = supabase.table('prizes').insert(new_prize).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create prize")
        return response.data[0]
    except Exception as e:
        logging.error(f"Error creating prize for rep {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/prizes", response_model=List[PrizeResponse], tags=["Prizes"])
async def get_all_prizes(current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('prizes').select('*').execute()
        return response.data
    except Exception as e:
        logging.error(f"Error getting all prizes for rep {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve prizes")

@app.get("/prizes/{prize_id}", response_model=PrizeResponse, tags=["Prizes"])
async def get_prize(prize_id: UUID, current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('prizes').select('*').eq('id', str(prize_id)).single().execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found")
        return response.data
    except Exception as e:
        logging.error(f"Error getting prize {prize_id} for rep {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve prize")

@app.put("/prizes/{prize_id}", response_model=PrizeResponse, tags=["Prizes"])
async def update_prize(prize_id: UUID, prize_data: PrizeUpdate, current_rep_id: str = Depends(get_current_rep)):
    update_data = prize_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    try:
        response = supabase.table('prizes').update(update_data).eq('id', str(prize_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found or update failed")
        return response.data[0]
    except Exception as e:
        logging.error(f"Error updating prize {prize_id} for rep {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update prize")

@app.delete("/prizes/{prize_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Prizes"])
async def delete_prize(prize_id: UUID, current_rep_id: str = Depends(get_current_rep)):
    try:
        response = supabase.table('prizes').delete().eq('id', str(prize_id)).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found")
    except Exception as e:
        logging.error(f"Error deleting prize {prize_id} for rep {current_rep_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete prize")

@app.post("/prizes/{prize_id}/redeem", response_model=RepResponse, tags=["Prizes"])
async def redeem_prize(prize_id: UUID, current_rep_id: str = Depends(get_current_rep)):
    logging.info(f"--- [REDEEM PRIZE] Redemption process started for prize_id: {prize_id} by rep_id: {current_rep_id} ---")
    try:
        # 1. Fetch prize details
        logging.info(f"--- [REDEEM PRIZE] Fetching prize details for prize_id: {prize_id} ---")
        prize_response = supabase.table('prizes').select('name, points').eq('id', str(prize_id)).single().execute()
        
        if not prize_response.data:
            logging.warning(f"--- [REDEEM PRIZE] Prize not found: {prize_id} ---")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prize not found.")
        
        prize = prize_response.data
        prize_cost = prize.get('points', 0)
        logging.info(f"--- [REDEEM PRIZE] Prize found: {prize.get('name')}, Cost: {prize_cost} points ---")

        # 2. Fetch rep profile
        logging.info(f"--- [REDEEM PRIZE] Fetching rep profile for rep_id: {current_rep_id} ---")
        rep_response = supabase.table('reps').select('id, points, first_name, last_name').eq('rep_id', current_rep_id).single().execute()
        
        if not rep_response.data:
            logging.warning(f"--- [REDEEM PRIZE] Representative profile not found for rep_id: {current_rep_id} ---")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Representative profile not found.")
        
        rep = rep_response.data
        rep_current_points = rep.get('points', 0)
        rep_db_id = rep.get('id')
        rep_first_name = rep.get('first_name')
        rep_last_name = rep.get('last_name')
        logging.info(f"--- [REDEEM PRIZE] Rep found: DB ID: {rep_db_id}, Current Points: {rep_current_points}, Name: {rep_first_name} {rep_last_name} ---")

        # 3. Check if rep has enough points
        if rep_current_points < prize_cost:
            logging.warning(f"--- [REDEEM PRIZE] Insufficient points. Rep has {rep_current_points}, prize costs {prize_cost} ---")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient points to redeem this prize.")

        # 4. Deduct points from rep and increment prize purchases_count
        updated_rep_points = rep_current_points - prize_cost
        logging.info(f"--- [REDEEM PRIZE] Updating rep points to {updated_rep_points} ---")

        # Update rep's points
        update_rep_response = supabase.table('reps').update({'points': updated_rep_points}).eq('id', rep_db_id).execute()
        if update_rep_response.data:
            logging.info(f"--- [REDEEM PRIZE] Rep points updated successfully. ---")
        else:
            logging.error(f"--- [REDEEM PRIZE] Failed to update rep points for rep_db_id: {rep_db_id}. Response: {update_rep_response} ---")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update representative's points.")
        
        # Increment prize's purchases_count using RPC
        logging.info(f"--- [REDEEM PRIZE] Calling RPC to increment prize purchases_count for prize_id: {prize_id} ---")
        rpc_response = supabase.rpc('increment_prize_purchases_count', {'prize_id_param': str(prize_id)}).execute()
        logging.info(f"--- [REDEEM PRIZE] RPC 'increment_prize_purchases_count' executed successfully. Response data: {rpc_response.data} ---")

        # Add rep info to prize purchases JSONB column
        rep_purchase_info = {"first_name": rep_first_name, "last_name": rep_last_name, "redeemed_at": datetime.now(timezone.utc).isoformat()}
        logging.info(f"--- [REDEEM PRIZE] Calling RPC to add rep info to prize purchases for prize_id: {prize_id} with info: {rep_purchase_info} ---")
        add_purchase_response = supabase.rpc('add_rep_to_prize_purchases', {'prize_id_param': str(prize_id), 'rep_info_param': rep_purchase_info}).execute()
        logging.info(f"--- [REDEEM PRIZE] RPC 'add_rep_to_prize_purchases' executed successfully. Response data: {add_purchase_response.data} ---")


        # 5. Fetch and return updated rep profile
        logging.info(f"--- [REDEEM PRIZE] Fetching updated rep profile for rep_id: {current_rep_id} ---")
        updated_rep_profile_response = supabase.table('reps').select('*').eq('rep_id', current_rep_id).single().execute()
        if not updated_rep_profile_response.data:
            logging.error(f"--- [REDEEM PRIZE] Failed to retrieve updated rep profile for rep_id: {current_rep_id} after redemption. ---")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve updated rep profile.")
        
        logging.info(f"--- [REDEEM PRIZE] Prize redemption successful for rep_id: {current_rep_id}. New points: {updated_rep_profile_response.data.get('points')} ---")
        return RepResponse.model_validate(updated_rep_profile_response.data).model_dump()

    except HTTPException as e:
        logging.error(f"--- [REDEEM PRIZE] HTTPException during redemption: {e.detail} (Status: {e.status_code}) ---", exc_info=True)
        raise e
    except Exception as e:
        logging.error(f"--- [REDEEM PRIZE] An unexpected error occurred during prize redemption for prize_id {prize_id} by rep {current_rep_id}: {e} ---", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An internal error occurred during prize redemption.")

# =============================================================================
# PASSWORD ENDPOINTS
# =============================================================================
@app.get("/passwords", response_model=List[PasswordResponse], tags=["Passwords"])
async def get_passwords_for_user(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('passwords').select('id, account, username, password, phone, notes, user, isFavorite, tag, url, oauth, date_created, date_updated').eq('user', str(current_user_id)).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.post("/passwords", response_model=PasswordResponse, status_code=status.HTTP_201_CREATED, tags=["Passwords"])
async def create_password_for_user(password_data: PasswordCreate, current_user: dict = Depends(get_current_user)):
    user_response = supabase.table("users").select("*").eq("id", str(current_user.id)).single().execute()
    if not user_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    user = user_response.data
    user_plan_name = user.get("plan")

    if not user_plan_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have a subscription plan.")

    plan_response = supabase.table("plans").select("*").eq("plan", user_plan_name).single().execute()
    if not plan_response.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Plan '{user_plan_name}' not found.")
    
    plan = plan_response.data

    total_passwords_limit = plan.get("total_passwords_limit")
    daily_passwords_limit = plan.get("daily_passwords_limit")
    
    total_passwords_count = user.get("total_passwords_count", 0) or 0
    daily_passwords_count = user.get("daily_passwords_count", 0) or 0

    if total_passwords_limit is not None and total_passwords_limit > 0 and total_passwords_count >= total_passwords_limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="You have reached your total password creation limit for this billing period.")
    
    if daily_passwords_limit is not None and daily_passwords_limit > 0 and daily_passwords_count >= daily_passwords_limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="You have reached your daily password creation limit.")

    try:
        new_password_data = password_data.model_dump()
        new_password_data['user'] = str(current_user.id)
        if password_data.tag is not None:
            new_password_data['tag'] = password_data.tag
        
        logging.info(f"Attempting to insert new password data: {new_password_data}") # Added logging
        insert_response = supabase.table('passwords').insert(new_password_data).execute()
        
        if not insert_response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create password")
        
        supabase.rpc('increment_password_counts', {'user_id_param': str(current_user.id)}).execute()
            
        return insert_response.data[0]
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.put("/passwords/{password_id}", response_model=PasswordResponse, tags=["Passwords"])
async def update_password_for_user(password_id: UUID, password_update_data: PasswordUpdate, current_user: dict = Depends(get_current_user)):
    update_data = password_update_data.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")
    
    try:
        ownership_check = supabase.table('passwords').select('id').eq('id', str(password_id)).eq('user', str(current_user.id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Password not found or you do not have permission to edit it.")
        
        update_data['date_updated'] = datetime.now(timezone.utc).isoformat()
        response = supabase.table('passwords').update(update_data).eq('id', str(password_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Password not found or update failed (no rows affected).")
        
        return PasswordResponse.model_validate(response.data[0]).model_dump()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred during password update: {str(e)}")

@app.delete("/passwords/{password_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Passwords"])
async def delete_password_for_user(password_id: UUID, current_user: dict = Depends(get_current_user)):
    try:
        ownership_check = supabase.table('passwords').select('id').eq('id', str(password_id)).eq('user', str(current_user.id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Password not found or you do not have permission to delete it.")
        
        supabase.table('passwords').delete().eq('id', str(password_id)).execute()

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# =============================================================================
# LEAD CAMPAIGN ENDPOINTS (Analytics)
# =============================================================================

@app.get("/lead-campaigns", response_model=List[CampaignItemResponse], tags=["Lead Campaigns"])
async def get_all_lead_campaigns(current_user: dict = Depends(get_current_user)):
    try:
        response = supabase.table('lead_campaigns').select(
            '*, lead:leads(id, first_name, last_name), campaign:campaigns(name)'
        ).eq(
            'user', str(current_user_id)
        ).execute()
        
        if not response.data:
            return []

        return response.data
    except Exception as e:
        logging.error(f"Failed to get lead-campaigns for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not retrieve lead campaigns.")

# =============================================================================
# OAUTH ENDPOINTS
# =============================================================================
@app.post("/oauth", response_model=OAuthAccountResponse, status_code=status.HTTP_201_CREATED, tags=["OAuth"])
async def create_oauth_account(oauth_data: OAuthAccountCreate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    new_oauth_account = oauth_data.model_dump()
    new_oauth_account['user'] = str(current_user_id)
    try:
        response = supabase.table('oauth').insert(new_oauth_account).execute()
        if not response.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create OAuth account")
        return response.data[0]
    except Exception as e:
        logging.error(f"Error creating OAuth account for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/oauth", response_model=List[OAuthAccountResponse], tags=["OAuth"])
async def get_oauth_accounts(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        response = supabase.table('oauth').select('*').eq('user', str(current_user_id)).execute()
        return response.data
    except Exception as e:
        logging.error(f"Error getting OAuth accounts for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve OAuth accounts")

@app.delete("/oauth/{oauth_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["OAuth"])
async def delete_oauth_account(oauth_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    try:
        ownership_check = supabase.table('oauth').select('id').eq('id', str(oauth_id)).eq('user', str(current_user_id)).single().execute()
        if not ownership_check.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OAuth account not found or you do not have permission to delete it.")
        
        supabase.table('oauth').delete().eq('id', str(oauth_id)).execute()
    except Exception as e:
        logging.error(f"Error deleting OAuth account {oauth_id} for user {current_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))