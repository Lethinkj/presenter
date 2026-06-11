import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xxvhhgberfkqvwjzkoia.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4dmhoZ2JlcmZrcXZ3anprb2lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzODcyNjksImV4cCI6MjA4ODk2MzI2OX0.GLvwq5RUcTBM7yZxiSmi7sa7NQ4ItmIUrkoCJzkC8I0';

export const supabase = createClient(supabaseUrl, supabaseKey);
