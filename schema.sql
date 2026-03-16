-- Create the `songs` table
CREATE TABLE IF NOT EXISTS public.songs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    language TEXT DEFAULT 'tamil',
    source_url TEXT,  -- Original URL from christsquare.com (used by bulk importer)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add source_url if it doesn't exist (for existing databases)
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Create the `lyrics` table
CREATE TABLE IF NOT EXISTS public.lyrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE,
    stanza_number INT NOT NULL,
    lyrics TEXT NOT NULL
);

-- Add an index to the songs title for faster searching (using ILIKE in the Flutter app)
CREATE INDEX IF NOT EXISTS songs_title_idx ON public.songs USING GIN (title gin_trgm_ops);

-- Turn on Row Level Security (RLS) but allow anonymous access for this app (since it's an internal presentation tool)
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lyrics ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read and write access
CREATE POLICY "Allow public read access on songs" ON public.songs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on songs" ON public.songs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on songs" ON public.songs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on songs" ON public.songs FOR DELETE USING (true);

CREATE POLICY "Allow public read access on lyrics" ON public.lyrics FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on lyrics" ON public.lyrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on lyrics" ON public.lyrics FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on lyrics" ON public.lyrics FOR DELETE USING (true);

-- Create the `heartbeat_logs` table for daily service heartbeat tracking
CREATE TABLE IF NOT EXISTS public.heartbeat_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name TEXT NOT NULL,
    heartbeat_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ok',
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT heartbeat_logs_service_date_unique UNIQUE (service_name, heartbeat_date)
);

-- Helpful index for timeline reads by service
CREATE INDEX IF NOT EXISTS heartbeat_logs_service_created_idx
    ON public.heartbeat_logs (service_name, created_at DESC);

-- Enable RLS and allow app access
ALTER TABLE public.heartbeat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on heartbeat_logs" ON public.heartbeat_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on heartbeat_logs" ON public.heartbeat_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on heartbeat_logs" ON public.heartbeat_logs FOR UPDATE USING (true);
