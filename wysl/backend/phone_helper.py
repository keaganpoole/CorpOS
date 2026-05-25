# backend/phone_helper.py
import random
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID
from config import supabase, openai_api_key, openai_assistant_id
from dependencies import get_current_user
from models import MessageCreate
import openai
import json

# Initialize OpenAI client
openai.api_key = openai_api_key
 
 
router = APIRouter()

intro_messages = [
    "Hello [first_name]! How can I help you with your phone today?",
    "Hi [first_name], what can I do for you and your phone?",
    "Welcome [first_name]! Ask me anything about your phone.",
    "Hey [first_name]! What's the phone trouble today?",
    "Greetings [first_name]. I'm here to help with your phone questions.",
    "Hi there [first_name]. How can I assist with your phone?",
    "Hello [first_name]. Ready to tackle some phone questions?",
    "Hey [first_name]! Your phone assistant is here to help.",
    "Hi [first_name], let's get your phone issue sorted out.",
    "Welcome [first_name]! What can I help you with today?",
    "Hello [first_name]! I'm your go-to assistant for phone help.",
    "Hi [first_name]! What seems to be the problem with your phone?",
    "Hey [first_name]! Let's figure out this phone issue together.",
    "Greetings [first_name]! How can I make your phone experience better?",
    "Hi there [first_name]. I'm here to answer your phone questions.",
    "Hello [first_name]. Your personal phone helper, at your service.",
    "Hey [first_name]! What can I do to help with your phone today?",
    "Hi [first_name], ready to get started with your phone question?",
    "Welcome [first_name]! Let's solve your phone problems.",
    "Hello [first_name]! How can I assist you with your phone today?",
]

@router.post("/threads/initiate", status_code=status.HTTP_201_CREATED)
async def initiate_thread(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    # Check if a thread already exists for this user with status = 'pending'
    existing_thread_response = supabase.table("threads").select("id").eq("user", str(current_user_id)).eq("status", "pending").execute()
    if existing_thread_response.data:
        return {"thread_id": existing_thread_response.data[0]["id"]}

    # Get user's first name
    user_response = supabase.table("users").select("first_name").eq("id", str(current_user_id)).single().execute()
    if not user_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    first_name = user_response.data.get("first_name", "")

    # Select a random intro message
    intro_message = random.choice(intro_messages).replace("[first_name]", first_name)

    # Insert new thread into threads table
    new_thread_response = supabase.table("threads").insert({
        "user": str(current_user_id),
        "status": "pending",
        "message_count": 0,
    }).execute()

    if not new_thread_response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create thread")

    new_thread_id = new_thread_response.data[0]["id"]

    # Insert intro message into messages table
    supabase.table("messages").insert({
        "thread": new_thread_id,
        "direction": "inbound",
        "message": intro_message,
        "user": str(current_user_id),
    }).execute()

    return {"thread_id": new_thread_id}

@router.post("/messages", status_code=status.HTTP_201_CREATED)
async def create_message(message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    # 1. Fetch user
    user_response = supabase.table("users").select("*").eq("id", str(current_user_id)).single().execute()
    if not user_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    user = user_response.data
    user_plan_name = user.get("plan")

    if not user_plan_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not have a subscription plan.")

    # 2. Fetch plan limits based on user's plan name
    plan_response = supabase.table("plans").select("*").eq("plan", user_plan_name).single().execute()
    if not plan_response.data:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Plan '{user_plan_name}' not found.")
    
    plan = plan_response.data

    # 3. Check limits
    total_messages_limit = plan.get("total_messages_limit")
    daily_messages_limit = plan.get("daily_messages_limit")
    
    total_messages_count = user.get("total_messages_count", 0) or 0
    daily_messages_count = user.get("daily_messages_count", 0) or 0

    user_plan_name = user.get("plan_name", "").lower()
    if user_plan_name != "unlimited pro" and total_messages_count >= 20:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You have reached your total message limit. Upgrade to Unlimited Pro to send more messages.")

    if total_messages_limit is not None and total_messages_limit > 0 and total_messages_count >= total_messages_limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="You have reached your total message limit for this billing period.")
    
    if daily_messages_limit is not None and daily_messages_limit > 0 and daily_messages_count >= daily_messages_limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="You have reached your daily message limit.")

    # Insert user message into messages table
    supabase.table("messages").insert({
        "thread": str(message_data.thread_id),
        "direction": "outbound",
        "message": message_data.message,
        "user": str(current_user_id),
    }).execute()

    # Get thread details, including openai_thread_id and title
    thread_response = supabase.table("threads").select("message_count", "openai_thread_id", "title").eq("id", str(message_data.thread_id)).single().execute()
    if not thread_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    thread_data = thread_response.data
    openai_thread_id = thread_data.get("openai_thread_id")
    thread_title = thread_data.get("title")

    # Increment threads.message_count and update status
    new_message_count = thread_data["message_count"] + 1
    update_payload = {
        "message_count": new_message_count,
        "status": "active"
    }

    # Get user data for OpenAI call
    user_response_openai = supabase.table("users").select("first_name", "device", "comfort_level", "associate").eq("id", str(current_user_id)).single().execute()
    if not user_response_openai.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user_data_openai = user_response_openai.data
    
    try:
        # Base context for the message
        context_parts = [
            f"My name is {user_data_openai.get('first_name')}.",
            f"My device is a {user_data_openai.get('device', {}).get('make')} {user_data_openai.get('device', {}).get('model')} running {user_data_openai.get('device', {}).get('os_version')}.",
            f"My comfort level with technology is {user_data_openai.get('comfort_level')}.",
            f"The associate helping me is {user_data_openai.get('associate')}."
        ]

        # Conditionally add the 'disregard this' instruction for the title
        if thread_title:
            context_parts.append('title: "disregard this".')
        
        # Add the user's actual message
        context_parts.append(f"Here is my message: {message_data.message}")

        # Join all parts to form the final message
        contextual_message = " ".join(context_parts)

        # If no openai_thread_id exists, create a new thread
        if not openai_thread_id:
            thread = openai.beta.threads.create(
                messages=[
                    {"role": "user", "content": contextual_message}
                ]
            )
            openai_thread_id = thread.id
            update_payload["openai_thread_id"] = openai_thread_id
        else:
            # Add the new message (with full context) to the existing thread
            openai.beta.threads.messages.create(
                thread_id=openai_thread_id,
                role="user",
                content=contextual_message
            )

        # Update the thread in Supabase with the new message count, status, and potentially the new openai_thread_id
        supabase.table("threads").update(update_payload).eq("id", str(message_data.thread_id)).execute()

        # Create a run to get the assistant's response
        run = openai.beta.threads.runs.create(
            thread_id=openai_thread_id,
            assistant_id=openai_assistant_id,
        )

        # Wait for the run to complete
        while run.status != "completed":
            run = openai.beta.threads.runs.retrieve(thread_id=openai_thread_id, run_id=run.id)

        # Get the messages from the thread
        messages = openai.beta.threads.messages.list(thread_id=openai_thread_id)
        
        # The first message is the latest one from the assistant
        raw_ai_message = messages.data[0].content[0].text.value
        
        final_message_to_user = raw_ai_message
        
        try:
            # Try to parse the message as JSON
            parsed_data = json.loads(raw_ai_message)
            final_message_to_user = parsed_data.get("message", raw_ai_message)
            
            # Prepare user profile updates
            user_update_payload = {}
            if "associate" in parsed_data:
                user_update_payload["associate"] = parsed_data["associate"]
            if "device" in parsed_data:
                # It's safer to merge rather than overwrite the device JSON
                existing_device_info = user_data_openai.get("device", {}) or {}
                existing_device_info.update(parsed_data["device"])
                user_update_payload["device"] = existing_device_info

            # If there's anything to update in the user profile, do it
            if user_update_payload:
                supabase.table("users").update(user_update_payload).eq("id", str(current_user_id)).execute()

            # Check for a title from the AI and update the thread only if it doesn't already have one
            title_from_ai = parsed_data.get("title")
            if title_from_ai and not thread_title:
                supabase.table("threads").update({
                    "title": title_from_ai
                }).eq("id", str(message_data.thread_id)).execute()

        except json.JSONDecodeError:
            # It's not a JSON string, so we treat it as a plain text message.
            pass
        except Exception as e:
            # Handle other potential errors during parsing or supabase update
            print(f"Error processing AI response: {e}")

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"OpenAI API call failed: {str(e)}")

    # Insert AI response into messages table
    supabase.table("messages").insert({
        "thread": str(message_data.thread_id),
        "direction": "inbound",
        "message": final_message_to_user,
        "user": str(current_user_id),
    }).execute()
    
    # 4. Increment message counts
    supabase.rpc('increment_message_counts', {'user_id_param': str(current_user_id)}).execute()

    return {"message": final_message_to_user}

@router.get("/threads", status_code=status.HTTP_200_OK)
async def get_threads(current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    response = supabase.table("threads").select("id", "title").eq("user", str(current_user_id)).eq("status", "active").order("created_at", desc=True).execute()
    return response.data

@router.get("/threads/{thread_id}/messages", status_code=status.HTTP_200_OK)
async def get_messages_for_thread(thread_id: UUID, current_user: dict = Depends(get_current_user)):
    current_user_id = current_user.id
    # verify user owns thread
    thread_response = supabase.table("threads").select("id").eq("id", str(thread_id)).eq("user", str(current_user_id)).single().execute()
    if not thread_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    response = supabase.table("messages").select("message", "direction").eq("thread", str(thread_id)).order("created_at").execute()
    return response.data
