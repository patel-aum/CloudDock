/*
  # Add storage calculation functions

  1. New Functions
    - `increment_storage_used`: Updates user storage with precise byte counting
    - `decrement_storage_used`: Decrements user storage (for file deletions)
    
  2. Changes
    - Added proper byte-level storage tracking
    - Added error handling for storage limits
*/

-- Function to increment storage used
CREATE OR REPLACE FUNCTION increment_storage_used(
  user_id UUID,
  size_increment BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_storage BIGINT;
  is_user_premium BOOLEAN;
  storage_limit BIGINT := 5368709120; -- 5GB in bytes
BEGIN
  -- Get current storage and premium status
  SELECT storage_used, is_premium 
  INTO current_storage, is_user_premium
  FROM user_storage 
  WHERE user_storage.user_id = increment_storage_used.user_id;

  -- Check storage limit for non-premium users
  IF NOT is_user_premium AND (current_storage + size_increment) > storage_limit THEN
    RAISE EXCEPTION 'Storage limit exceeded. Please upgrade to premium.';
  END IF;

  -- Update storage used
  UPDATE user_storage 
  SET 
    storage_used = storage_used + size_increment,
    updated_at = now()
  WHERE user_storage.user_id = increment_storage_used.user_id;
END;
$$;

-- Function to decrement storage used
CREATE OR REPLACE FUNCTION decrement_storage_used(
  user_id UUID,
  size_decrement BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_storage 
  SET 
    storage_used = GREATEST(0, storage_used - size_decrement),
    updated_at = now()
  WHERE user_storage.user_id = decrement_storage_used.user_id;
END;
$$;