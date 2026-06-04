import os
import requests
from apscheduler.schedulers.background import BackgroundScheduler
import logging

try:
    from .env_loader import load_project_env
except ImportError:
    from env_loader import load_project_env

# Load environment variables from the project/backend .env files.
load_project_env()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Supabase credentials from environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logging.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment variables.")
    logging.error("Please ensure these are set in your .env file or environment.")
    exit(1)

def reset_daily_counts_job():
    """
    Calls the Supabase RPC endpoint to reset daily_passwords_count and daily_messages_count.
    """
    rpc_url = f"{SUPABASE_URL}/rest/v1/rpc/reset_daily_counts"
    headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}'
    }
    payload = {} # The reset_daily_counts function doesn't take any arguments

    try:
        logging.info("Attempting to reset daily counts...")
        response = requests.post(rpc_url, headers=headers, json=payload)
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
        logging.info(f"Daily counts reset successfully. Status: {response.status_code}")
        logging.debug(f"Response: {response.text}")
    except requests.exceptions.RequestException as e:
        logging.error(f"Error resetting daily counts: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logging.error(f"Supabase API Error Response: {e.response.text}")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")

def start_scheduler():
    """
    Initializes and starts the APScheduler to run the reset job.
    """
    scheduler = BackgroundScheduler()
    # Schedule the job to run every 5 minutes
    scheduler.add_job(reset_daily_counts_job, 'interval', minutes=5, id='reset_daily_counts_job')
    scheduler.start()
    logging.info("Scheduler started. Daily counts reset job will run every 5 minutes.")
    logging.info("Press Ctrl+C to exit.")

    try:
        # Keep the main thread alive
        while True:
            import time
            time.sleep(2)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        logging.info("Scheduler shut down.")

if __name__ == '__main__':
    start_scheduler()
