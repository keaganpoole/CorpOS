from datetime import date, datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field

# =============================================================================
# PLAN MODELS
# =============================================================================
class PlanBase(BaseModel):
    plan: str
    description: Optional[str] = None
    monthly_price: float = 0
    annual_price: float = 0
    stripe_price_id_monthly: Optional[str] = None
    stripe_price_id_annually: Optional[str] = None
    is_recommended: bool = False
    plan_label: Optional[str] = None
    commission_tier1: Optional[float] = None
    commission_tier2: Optional[float] = None
    revenue: Optional[float] = 0

    class Config:
        from_attributes = True
        populate_by_name = True

class PlanResponse(PlanBase):
    id: UUID
    created_at: Optional[datetime] = None

# =============================================================================
# TIER MODELS
# =============================================================================
class TierBase(BaseModel):
    name: Optional[str] = None
    multiplier_new_acquisition: Optional[float] = None
    multiplier_rebill: Optional[float] = None

    class Config:
        from_attributes = True
        populate_by_name = True

class TierResponse(TierBase):
    id: UUID

# =============================================================================
# REP MODELS
# =============================================================================
class RepBase(BaseModel):
    rep_id: Optional[str] = None
    commission_weekly: Optional[float] = 0
    commission_annually: Optional[float] = 0
    tier: Optional[str] = None
    sales_count_weekly: Optional[float] = 0
    sales_count_monthly: Optional[float] = 0
    sales_count_annually: Optional[float] = 0
    plan_count_free: Optional[float] = 0
    plan_count_trials: Optional[float] = 0
    plan_count_unlimited: Optional[float] = 0
    plan_count_unlimited_pro: Optional[float] = 0
    rep_password: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    associate_full_name: Optional[str] = None
    full_name: Optional[str] = None
    marketplace_intro_popup: Optional[bool] = True
    points: Optional[float] = 0
    goal_week: bool = False
    goal_month: bool = False

    class Config:
        from_attributes = True
        populate_by_name = True

class RepResponse(RepBase):
    id: UUID
    created_at: datetime
    last_updated: Optional[datetime] = None

class RepLoginRequest(BaseModel):
    rep_id: str
    password: str

class RepUpdate(BaseModel):
    points: Optional[float] = None

    class Config:
        populate_by_name = True

# =============================================================================
# MONEY TABLE MODELS
# =============================================================================
class MoneyTableRep(BaseModel):
    first_name: str
    last_name: str
    points: float

class MoneyTablePlan(BaseModel):
    plan: str
    plan_label: str
    total_annual_payouts: float
    reps: List[MoneyTableRep]


# =============================================================================
# PURCHASE MODELS
# =============================================================================
class PurchaseBase(BaseModel):
    purchase: Optional[str] = None
    postpaid: Optional[bool] = None
    early_upgrade: Optional[bool] = None
    insured: Optional[bool] = None
    upgrade_eligible_date: Optional[date] = None

    class Config:
        from_attributes = True
        populate_by_name = True

class PurchaseCreate(PurchaseBase):
    lead: UUID
    purchase: str

class PurchaseUpdate(BaseModel):
    postpaid: Optional[bool] = None
    early_upgrade: Optional[bool] = None
    insured: Optional[bool] = None
    upgrade_eligible_date: Optional[date] = None

    class Config:
        populate_by_name = True

class PurchaseResponse(PurchaseBase):
    id: UUID
    user: UUID
    lead: UUID
    created_at: datetime


# =============================================================================
# USER MODELS
# =============================================================================
class UserBase(BaseModel):
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    plan: Optional[str] = "free"
    onboarded: Optional[bool] = False
    user_agent: Optional[Dict[str, Any]] = None
    stripe: Optional[Dict[str, Any]] = None
    identity_questions: Optional[Any] = None
    display: Optional[Dict[str, Any]] = None
    display_intro: Optional[bool] = False
    created_at: Optional[datetime] = Field(default_factory=datetime.now)
    last_login: Optional[date] = None
    
    # --- FIX #1: Make these fields optional ---
    role: Optional[str] = None
    trial_start_date: Optional[date] = None
    trial_end_date: Optional[date] = None
    
    is_logged_in: Optional[bool] = None
    referral: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    source: Optional[str] = None # New field for the source of the plan (e.g., "standard", "sales")
    billing_period: Optional[str] = None # New field for the billing period (e.g., "monthly", "yearly")
    subscription_status: Optional[str] = None
    manual_approval: Optional[bool] = True
    device: Optional[Dict[str, Any]] = None
    associate: Optional[str] = None
    industry: Optional[str] = None
    intent: Optional[str] = None
    comfort_level: Optional[str] = None
    cancellation_reason: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list)

    # --- FIX #2: Add all missing counter fields from your schema ---
    daily_passwords_count: Optional[int] = 0
    total_passwords_count: Optional[int] = 0
    daily_messages_count: Optional[int] = 0
    total_messages_count: Optional[int] = 0
    daily_events_count: Optional[int] = 0
    total_events_count: Optional[int] = 0
    plan_change_popup: Optional[bool] = None
    breezy_intro_popup: Optional[bool] = None
    theme: Optional[str] = None # Added missing theme field
    months_subscribed: Optional[float] = None
    log: Optional[str] = None
    card_retries: Optional[int] = 0
    total_points: Optional[float] = 0 # New field for total points accumulated by the user
    last_awarded_points: Optional[float] = None # New field for points awarded by this user
    latest_charge_attempt: Optional[datetime] = None
    started_trial: Optional[bool] = False # Added started_trial field
    pref_card_size: Optional[str] = None # Added for user's preferred card size
    hide_tutorial_modal: Optional[bool] = False # New field for tutorial modal
    terms_of_service: Optional[Dict[str, Any]] = Field(default_factory=dict)

    class Config:
        from_attributes = True
        populate_by_name = True

class AuthSignUpRequest(BaseModel):
    email: EmailStr
    password: str
    terms_accepted: bool = False
    legal_version: Optional[str] = None
    certified_permitted_use: bool = False

class UserCreate(UserBase):
    id: UUID

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    onboarded: Optional[bool] = None
    referral: Optional[str] = None
    industry: Optional[str] = None
    intent: Optional[str] = None
    agent_blueprint: Optional[Dict[str, Any]] = None
    manual_approval: Optional[bool] = None
    active_ai_agent: Optional[UUID] = None
    device: Optional[Dict[str, Any]] = None
    associate: Optional[str] = None
    log: Optional[str] = None
    card_retries: Optional[int] = None
    latest_charge_attempt: Optional[datetime] = None
    intro_master_key: Optional[bool] = None # Added for master password setup
    source: Optional[str] = None # Allow updating source
    billing_period: Optional[str] = None # Allow updating billing_period
    identity_questions: Optional[List[Dict[str, Any]]] = None
    pref_card_size: Optional[str] = None # Added for user's preferred card size
    hide_tutorial_modal: Optional[bool] = None # Added for tutorial modal
    terms_of_service: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True

class UserResponse(UserBase):
    id: UUID


# =============================================================================
# USER INTEGRATION MODELS
# =============================================================================
class UserIntegrationBase(BaseModel):
    provider: str
    status: str = "not_connected"
    selected: bool = False
    connected_email: Optional[EmailStr] = None
    scopes: List[str] = Field(default_factory=list)
    provider_metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True
        populate_by_name = True


class UserIntegrationUpdate(BaseModel):
    selected: Optional[bool] = None
    status: Optional[str] = None
    connected_email: Optional[EmailStr] = None
    scopes: Optional[List[str]] = None
    provider_metadata: Optional[Dict[str, Any]] = None

    class Config:
        populate_by_name = True


class UserIntegrationResponse(UserIntegrationBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime


# =============================================================================
# AI AGENT MODELS
# =============================================================================
class AIAgentBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    description: Optional[str] = None
    access: Optional[str] = None

    class Config:
        from_attributes = True
        populate_by_name = True

class AIAgentCreate(AIAgentBase):
    user: UUID

class AIAgentResponse(AIAgentBase):
    id: UUID
    user: Optional[UUID] = None # User can be null for public agents
    created_at: datetime


# =============================================================================
# CAMPAIGN & LEAD MODELS
# =============================================================================
class CampaignBase(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    blueprint: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
        populate_by_name = True

class CampaignCreate(CampaignBase):
    name: str
    blueprint: Dict[str, Any]

class CampaignUpdate(CampaignBase):
    pass # Allows updating any field in CampaignBase

class CampaignResponse(CampaignBase):
    id: UUID
    user: Optional[UUID] = None
    created_at: datetime

class LeadCampaignResponse(BaseModel):
    id: UUID
    status: Optional[str] = None
    last_sent: Optional[datetime] = None
    last_response: Optional[datetime] = None
    inbound_messages_count: Optional[float] = None
    outbound_messages_count: Optional[float] = None
    created_at: datetime
    campaign: Optional[CampaignResponse] = None # Note: This might need adjustment if it was for the old simple response

    class Config:
        from_attributes = True
        populate_by_name = True

class LeadBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    profile: Optional[str] = None
    email: Optional[EmailStr] = None
    notes: Optional[str] = None
    potential_lines: Optional[float] = 0
    add_a_lines: Optional[float] = 0
    referrals: Optional[float] = 0
    upgrades: Optional[float] = 0
    devices: Optional[List[str]] = None
    last_checked: Optional[datetime] = None
    last_follow_up: Optional[datetime] = None

    class Config:
        from_attributes = True
        populate_by_name = True

class LeadCreate(LeadBase):
    first_name: str
    last_name: str

class LeadResponse(LeadBase):
    id: UUID
    user: UUID
    created_at: datetime
    campaigns: List[LeadCampaignResponse] = []
    purchases: List[PurchaseResponse] = []

class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str

class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    profile: Optional[str] = None
    email: Optional[EmailStr] = None
    notes: Optional[str] = None
    potential_lines: Optional[float] = None
    add_a_lines: Optional[float] = None
    referrals: Optional[float] = None
    upgrades: Optional[float] = None
    devices: Optional[List[str]] = None
    last_checked: Optional[datetime] = None
    last_follow_up: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class LeadInfoForCampaign(BaseModel):
    id: UUID
    first_name: str
    last_name: str

class CampaignItemResponse(LeadCampaignResponse):
    lead: LeadInfoForCampaign

    class Config:
        from_attributes = True

# =============================================================================
# ADMIN MODELS
# =============================================================================
class AdminSetting(BaseModel):
    key: str
    value: Dict[str, Any]

    class Config:
        from_attributes = True
        populate_by_name = True

# =============================================================================
# PHONE HELPER MODELS
# =============================================================================
class MessageCreate(BaseModel):
    thread_id: UUID
    message: str


class ThreadCreate(BaseModel):
    lead_id: UUID
    campaign_id: UUID
    user_id: UUID
    ai_agent_id: UUID
    status: str = "active"

class ThreadResponse(BaseModel):
    id: UUID
    created_at: datetime
    lead_id: UUID
    campaign_id: UUID
    user_id: UUID
    ai_agent_id: UUID
    status: str

    class Config:
        from_attributes = True

class MessageResponse(BaseModel):
    id: UUID
    created_at: datetime
    thread_id: UUID
    message: str
    role: str # "user" or "assistant"

    class Config:
        from_attributes = True

# =============================================================================
# PRIZE MODELS
# =============================================================================
class PrizeBase(BaseModel):
    name: Optional[str] = None
    points: Optional[float] = None
    purchases_count: Optional[float] = None
    description: Optional[str] = None
    image: Optional[str] = None

    class Config:
        from_attributes = True
        populate_by_name = True

class PrizeCreate(PrizeBase):
    name: str
    points: float

class PrizeUpdate(PrizeBase):
    pass

class PrizeResponse(PrizeBase):
    id: UUID
    created_at: Optional[datetime] = None

# =============================================================================
# PASSWORD MODELS
# =============================================================================
class PasswordBase(BaseModel):
    account: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    isFavorite: Optional[bool] = Field(default=False, alias='isFavorite')
    tag: Optional[str] = None
    url: Optional[str] = None # Added URL field
    oauth: Optional[str] = None # Added OAuth field

    class Config:
        from_attributes = True
        populate_by_name = True

class PasswordCreate(PasswordBase):
    account: str
    password: str

class PasswordUpdate(PasswordBase):
    pass

class PasswordResponse(PasswordBase):
    id: UUID
    user: UUID
    created_at: Optional[datetime] = None
    date_updated: Optional[datetime] = None

# =============================================================================
# HELPDESK MODELS
# =============================================================================
class HelpdeskMessage(BaseModel):
    user: Optional[UUID] = None
    subject: str
    message: str

    class Config:
        from_attributes = True
        populate_by_name = True

# =============================================================================
# OAUTH MODELS
# =============================================================================
class OAuthAccountBase(BaseModel):
    oauth: str
    email: Optional[str] = None
    password: Optional[str] = None # This will store the encrypted password

    class Config:
        from_attributes = True
        populate_by_name = True

class OAuthAccountCreate(OAuthAccountBase):
    oauth: str # Make oauth required for creation

class OAuthAccountResponse(OAuthAccountBase):
    id: UUID
    user: UUID
    created_at: datetime
