/*
  # Initial Schema Setup for PhotosXP

  1. New Tables
    - `user_storage`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `storage_used` (bigint)
      - `is_premium` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `photos`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `s3_key` (text)
      - `filename` (text)
      - `size` (bigint)
      - `mime_type` (text)
      - `created_at` (timestamp)
      - `metadata` (jsonb)

  2. Security
    - Enable RLS on all tables
    - Add policies for user access control
*/

-- Create user_storage table
CREATE TABLE IF NOT EXISTS user_storage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  storage_used bigint DEFAULT 0,
  is_premium boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_storage UNIQUE (user_id)
);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  s3_key text NOT NULL,
  filename text NOT NULL,
  size bigint NOT NULL,
  mime_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE user_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create policies for user_storage
CREATE POLICY "Users can view own storage data"
  ON user_storage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own storage data"
  ON user_storage
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for photos
CREATE POLICY "Users can view own photos"
  ON photos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own photos"
  ON photos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own photos"
  ON photos
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to create user storage record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_storage (user_id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user storage record
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();