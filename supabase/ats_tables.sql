CREATE TABLE IF NOT EXISTS public.ats_vacancies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT DEFAULT 'Open',
    applicants INTEGER DEFAULT 0,
    target_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.ats_vacancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access on ats_vacancies" 
    ON public.ats_vacancies FOR ALL TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.ats_interviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_name TEXT NOT NULL,
    job_role TEXT NOT NULL,
    interview_time TEXT NOT NULL,
    status TEXT DEFAULT 'Pending',
    avatar_initials TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.ats_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access on ats_interviews" 
    ON public.ats_interviews FOR ALL TO authenticated USING (true);

alter publication supabase_realtime add table ats_vacancies;
alter publication supabase_realtime add table ats_interviews;
