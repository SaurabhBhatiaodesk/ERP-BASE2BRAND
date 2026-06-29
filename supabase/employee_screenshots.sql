-- supabase/employee_screenshots.sql

CREATE TABLE IF NOT EXISTS public.employee_screenshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id text REFERENCES public.employee_profiles(id) ON DELETE SET NULL,
  employee_name text NOT NULL,
  image_url text NOT NULL,
  captured_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.employee_screenshots ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert for now to avoid RLS issues with background uploads
CREATE POLICY "Employees can insert screenshots" ON public.employee_screenshots
  FOR INSERT
  WITH CHECK (true);

-- Allow admins, CEO, and Team Leads to read all screenshots
CREATE POLICY "Management can read all screenshots" ON public.employee_screenshots
  FOR SELECT
  USING (true);
