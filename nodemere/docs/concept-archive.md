# Concept Archive

This file is a holding area for concepts that are intentionally inactive. Code
in this file is reference material only. It is not imported, mounted, called,
scheduled, registered, or executed by the production application.

## Autonomy Button

### Name

Autonomy Button

### Description

An experimental dashboard control that exposed five autonomy levels. The
control was intended to let an operator choose how independently the AI agent
should act, persist that selection in `account_settings.autonomy_index`, and
pass the selected value into inbound and outbound ElevenLabs call context.

### Existing code

Former dashboard controls from `src/sonar/SonarDashboard.jsx`:

```jsx
const displayZone = controlState?.zone || 1;
const renderAutonomyControl = () => (
  <GradientBleed
    trigger="Autonomy"
    options={['1', '2', '3', '4', '5']}
    variant="prism"
    icon={<Gavel size={12} />}
    value={String(displayZone)}
    onSelect={(val) => setZone(parseInt(val))}
    onOpenChange={(open) => setZoneOpen(open)}
    prismAxis="vertical"
  />
);
const toolbarAutonomyControl = (
  <div className="absolute left-[calc(50%+210px)] top-1/2 z-10 hidden -translate-y-1/2 no-drag xl:block">
    {renderAutonomyControl()}
  </div>
);
const mobileSidebarAutonomyControl = (
  <div className="no-drag relative flex flex-col items-center xl:hidden">
    <GradientBleed
      trigger="Autonomy"
      options={['1', '2', '3', '4', '5']}
      variant="prism"
      icon={<Gavel size={14} />}
      value={String(displayZone)}
      onSelect={(val) => setZone(parseInt(val))}
      onOpenChange={(open) => setZoneOpen(open)}
      showTrigger={false}
      textClassName="text-[11px] tracking-widest"
      buttonPaddingClassName="h-10 w-10 justify-center text-zinc-300"
      optionsGapClassName="gap-3"
      optionsOpenClassName="max-h-64 pb-3"
      underlineOffsetClassName="-right-1"
      orientation="vertical"
    />
  </div>
);
```

Former persistence logic from `src/sonar/hooks/useSonarState.js`:

```js
function normalizeAutonomyIndex(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(5, Math.max(1, parsed));
}

const setZone = useCallback((zone) => {
  const autonomyIndex = normalizeAutonomyIndex(zone);
  let previousZone = controlState.zone;

  setControlState((prev) => {
    previousZone = prev.zone;
    return { ...prev, zone: autonomyIndex };
  });

  const persistAutonomyIndex = async () => {
    if (accountSettingsId) {
      return supabase
        .from('account_settings')
        .update({ autonomy_index: autonomyIndex })
        .eq('id', accountSettingsId);
    }
    return supabase
      .from('account_settings')
      .insert({ user_id: userId, autonomy_index: autonomyIndex });
  };

  void persistAutonomyIndex();
}, [accountSettingsId, controlState.zone]);
```

Former API client entry from `src/sonar/lib/api.js`:

```js
setZone: (zone) => postJSON('/api/control/zone', { zone }),
```

Former backend behavior from `backend/main.py` and
`backend/scenario_engine.py`:

```python
def get_account_autonomy_index_for_user(user_id=None) -> int:
    response = (
        supabase.table("account_settings")
        .select("autonomy_index")
        .eq("user_id", str(user_id))
        .limit(1)
        .execute()
    )
    row = (response.data or [None])[0]
    parsed = int((row or {}).get("autonomy_index") or 1)
    return min(5, max(1, parsed))

@app.post("/api/control/zone")
async def set_control_zone(payload: ZoneRequest, current_user=Depends(get_current_user)):
    user_id = str(current_user.id)
    control_state = get_tenant_control_state(user_id)
    control_state["zone"] = payload.zone
    push_live_event(
        f"Zone set to {payload.zone}.",
        event_type="zone_changed",
        payload={"zone": payload.zone, "user_id": user_id},
    )
    return control_state
```

The former call-context integrations read the persisted value in the inbound
route, outbound scenario executor, and quality-test context. Those live reads
were removed. Production call contexts now use the safe baseline value `1`
where the downstream integration still expects the compatibility field.

### Unfinished notes

- The autonomy scale had no finalized product definition, permissions model,
  or documented behavior for each level.
- The button was removed from desktop and mobile dashboard surfaces.
- The `/api/control/zone` route and client method were removed so the concept
  cannot be triggered through the application.
- Account-settings subscriptions no longer read or write autonomy state.
- The scenario engine no longer queries or applies a user-selected autonomy
  level.
- To resume this concept, define the five levels and their behavioral impact,
  then reintroduce the archived code through a deliberate product decision.

## Visual concept prototype

### Name

Prism wordmark landing-page prototype

### Description

An unfinished standalone visual prototype showing a large “One. Stunning.
CRM.” wordmark with refracted red, blue, and green animation layers. It was a
concept exploration and was never connected to the production dashboard.

### Existing code

The complete contents of the former `concepts.txt` file are preserved below:

```jsx
import React from 'react';

export default function App() {
  return (
    <div
      className="min-h-screen bg-[#000000] text-neutral-100 canvas-font flex flex-col justify-center items-center p-8 select-none overflow-hidden relative"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap');

        .canvas-font {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        @keyframes prismRedMove {
          0% { transform: translate(-14px, -4px) scale(1.03); opacity: 0; filter: blur(3px); }
          15% { opacity: 0.95; }
          55% { transform: translate(-3px, -1px) scale(1.01); opacity: 0.5; }
          80% { opacity: 0.15; }
          100% { transform: translate(0, 0) scale(1); opacity: 0; filter: blur(0); }
        }

        @keyframes prismBlueMove {
          0% { transform: translate(14px, 4px) scale(1.03); opacity: 0; filter: blur(3px); }
          15% { opacity: 0.95; }
          55% { transform: translate(3px, 1px) scale(1.01); opacity: 0.5; }
          80% { opacity: 0.15; }
          100% { transform: translate(0, 0) scale(1); opacity: 0; filter: blur(0); }
        }

        @keyframes prismGreenMove {
          0% { transform: scale(1.1); opacity: 0; filter: blur(10px); }
          30% { opacity: 0.7; filter: blur(3px); }
          100% { transform: scale(1); opacity: 1; filter: blur(0); }
        }

        @keyframes flashSettle {
          0% { filter: brightness(4.5) contrast(1.5) drop-shadow(0 0 35px rgba(255,255,255,0.9)); }
          25% { filter: brightness(1.8) contrast(1.2) drop-shadow(0 0 15px rgba(255,255,255,0.3)); }
          100% { filter: brightness(1) contrast(1) drop-shadow(0 2px 10px rgba(255,255,255,0.15)); }
        }
      `}</style>

      <div className="absolute w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-gradient-to-b from-[#111111] via-transparent to-transparent rounded-full filter blur-[120px] pointer-events-none opacity-80 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="w-full text-center relative z-10 max-w-5xl">
        <h1 className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-5 text-[10vw] sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight canvas-font leading-none text-center">
          <span className="bg-gradient-to-b from-white via-neutral-100 to-[#a3a3a3] bg-clip-text text-transparent pb-1">
            One.
          </span>

          <span className="relative inline-block mx-1">
            <span className="relative inline-block">
              <span
                className="absolute inset-0 select-none text-[#ff0055] mix-blend-screen pointer-events-none"
                style={{
                  animationName: 'prismRedMove',
                  animationDuration: '1.2s',
                  animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  animationIterationCount: 1,
                  animationFillMode: 'forwards',
                }}
              >
                Stunning.
              </span>

              <span
                className="absolute inset-0 select-none text-[#00ffcc] mix-blend-screen pointer-events-none"
                style={{
                  animationName: 'prismBlueMove',
                  animationDuration: '1.2s',
                  animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  animationIterationCount: 1,
                  animationFillMode: 'forwards',
                }}
              >
                Stunning.
              </span>

              <span
                className="relative inline-block bg-gradient-to-b from-[#ffffff] via-[#e2e8f0] to-[#94a3b8] bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(255,255,255,0.1)]"
                style={{
                  animationName: 'prismGreenMove, flashSettle',
                  animationDuration: '1.2s, 0.9s',
                  animationDelay: '0s, 0.24s',
                  animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1), ease-out',
                  animationIterationCount: '1, 1',
                  animationFillMode: 'forwards',
                }}
              >
                Stunning.
              </span>
            </span>
          </span>

          <span className="bg-gradient-to-b from-white via-neutral-100 to-[#a3a3a3] bg-clip-text text-transparent pb-1">
            CRM.
          </span>
        </h1>

        <p className="mt-8 text-neutral-400 text-xs sm:text-sm max-w-lg mx-auto tracking-wide font-normal leading-relaxed text-center px-4 opacity-90">
          Transform customer data into a beautiful, visual workspace built for clarity, organization, and control.
        </p>
      </div>
    </div>
  );
}
```

### Unfinished notes

- This prototype has no production route, data, or interactions.
- It should only be revived after a deliberate decision about where the visual
  language belongs and how it should be adapted to the product system.

## Verification link sending

### Name

System-email delivery of caller verification links

### Description

An abandoned backend feature intended to email an already-created caller
verification link to the customer's email address using a Nodemere-owned Gmail
mailbox. It resolved the existing person record, selected the business name,
validated the secure URL, rendered a plain-text and HTML email, refreshed a
Gmail OAuth access token, and sent the message through the Gmail API. The
document-upload email flow used the same lower-level service and remains
separate; this archived concept covers verification-link sending only.

### Existing code

The verification-specific orchestration that was removed from
`backend/main.py` was:

```python
async def send_verification_link_tool(request: Request):
    payload = await parse_request_payload(request)
    context = build_verification_request_context(payload)
    if not caller_authentication_allowed(
        user_id=context.get("user_id"),
        business_id=context.get("business_id"),
    ):
        raise HTTPException(status_code=403, detail="Caller authentication is disabled in account preferences.")
    request_result = create_verification_session(
        supabase_admin,
        base_url=verification_base_url,
        **context,
    )
    return deliver_existing_secure_link_by_email(
        request_result=request_result,
        context=context,
        payload=payload,
        kind="verification",
    )
```

The shared delivery call used by that flow was:

```python
delivery = send_secure_link_email(
    kind="verification",
    recipient_email=recipient_email,
    business_name=business_name,
    secure_link=str(request_result["verification_url"]),
    configuration=_system_gmail_configuration(),
)
```

The lower-level implementation remains in `backend/email_delivery_service.py`
as reference code shared with document-upload delivery. Its verification
branch includes `EMAIL_KIND = Literal["verification", "document_upload"]`,
the `Verify your identity` email copy, `build_secure_link_email(...)`,
`_get_gmail_access_token(...)`, and `send_secure_link_email(...)`.

The removed production routes were:

```python
POST /api/tools/send-verification-link
POST /api/tools/request-authentication
POST /api/tools/request_authentication
POST /api/tools/auth-request
POST /api/tools/auth_request
```

The legacy `/api/tools/{tool_name}` dispatcher also previously handled
`send-verification-link`, `request-authentication`, and `auth-request` by
creating a verification session and sending its URL by email.

### Unfinished notes

- The feature required system Gmail OAuth configuration and a reliable
  customer-email source, which added deployment and operational complexity.
- It was not completed as a product requirement and should not be revived
  without a simpler delivery design and explicit security review.
- Verification-page loading, completion, and status checking remain separate
  production functionality; only verification-link email sending was disabled.
- The dedicated sending routes and legacy dispatcher branch are removed, so
  the application cannot initialize, schedule, register, or trigger this
  concept.
