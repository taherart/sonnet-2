import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zynnrecdqoojcixrqylf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bm5yZWNkcW9vamNpeHJxeWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwMzAzNTcsImV4cCI6MjA1NjYwNjM1N30.tG0Y0ILdbS8ZCh5hYVzVuw2P2NOCDyzvUKBTzCSYYAQ';

export const supabase = createClient(supabaseUrl, supabaseKey);
