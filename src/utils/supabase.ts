import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://snxsdnlxelzcoqpfrtci.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueHNkbmx4ZWx6Y29xcGZydGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzI5NjUsImV4cCI6MjA3OTkwODk2NX0.S6q__XKhgty8V4mYxSUe4qoQ5KTXZgjGzqS1beQk3Tc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);