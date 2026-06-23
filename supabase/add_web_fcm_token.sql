-- Run this in your Supabase SQL Editor to add the web FCM token column
ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS web_fcm_token text;
