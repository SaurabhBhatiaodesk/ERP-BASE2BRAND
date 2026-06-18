-- Add last_active_at column to track when an employee was last active on their desktop
-- Run this in your Supabase SQL Editor

ALTER TABLE public.employee_profiles 
ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Refresh schema cache so APIs can see it
NOTIFY pgrst, 'reload schema';
