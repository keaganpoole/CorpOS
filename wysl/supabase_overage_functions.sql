-- Supabase SQL Migration: Add Overage Limit Functions

-- Function to increment message counts for a user
CREATE OR REPLACE FUNCTION increment_message_counts(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET
    daily_messages_count = COALESCE(daily_messages_count, 0) + 1,
    total_messages_count = COALESCE(total_messages_count, 0) + 1
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to increment password counts for a user
CREATE OR REPLACE FUNCTION increment_password_counts(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET
    daily_passwords_count = COALESCE(daily_passwords_count, 0) + 1,
    total_passwords_count = COALESCE(total_passwords_count, 0) + 1
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to increment prize purchases_count
CREATE OR REPLACE FUNCTION increment_prize_purchases_count(prize_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE prizes
  SET
    purchases_count = COALESCE(purchases_count, 0) + 1
  WHERE id = prize_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to add rep info to prize purchases (JSONB array)
CREATE OR REPLACE FUNCTION add_rep_to_prize_purchases(prize_id_param UUID, rep_info_param JSONB)
RETURNS void AS $$
BEGIN
  UPDATE prizes
  SET
    purchases = COALESCE(purchases, '[]')::jsonb || rep_info_param::jsonb
  WHERE id = prize_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to reset daily message and password counts for all users
CREATE OR REPLACE FUNCTION reset_daily_counts()
RETURNS void AS $$
BEGIN
  UPDATE users
  SET
    daily_messages_count = 0,
    daily_passwords_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Schedule the reset_daily_counts function to run every 5 minutes
SELECT cron.schedule('reset-daily-counts-job', '*/5 * * * *', 'SELECT reset_daily_counts();');

-- Function to handle plan changes and reset related counts
CREATE OR REPLACE FUNCTION set_plan_change_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.plan IS DISTINCT FROM NEW.plan THEN
    NEW.plan_change_popup = NULL;
    NEW.daily_passwords_count = 0;
    NEW.daily_messages_count = 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to activate set_plan_change_defaults function on plan column update
CREATE TRIGGER handle_plan_change_trigger
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_plan_change_defaults();

-- Function to set user plan to 'free' when a subscription is canceled
CREATE OR REPLACE FUNCTION set_user_plan_to_free_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'canceled' THEN
    UPDATE users
    SET plan = 'free', subscription_status = 'canceled'
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to activate set_user_plan_to_free_on_cancel function on subscription status update
CREATE TRIGGER handle_subscription_cancellation_trigger
AFTER UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION set_user_plan_to_free_on_cancel();