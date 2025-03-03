// supabase/functions/generate-questions/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { filePath } = await req.json();
    
    if (!filePath) {
      return new Response(
        JSON.stringify({ error: 'File path is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://zynnrecdqoojcixrqylf.supabase.co';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bm5yZWNkcW9vamNpeHJxeWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwMzAzNTcsImV4cCI6MjA1NjYwNjM1N30.tG0Y0ILdbS8ZCh5hYVzVuw2P2NOCDyzvUKBTzCSYYAQ';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get book metadata
    const { data: bookData, error: bookError } = await supabase
      .from('books_metadata')
      .select('*')
      .eq('file_path', filePath)
      .single();

    if (bookError || !bookData) {
      return new Response(
        JSON.stringify({ error: 'Book metadata not found', details: bookError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Get processing progress
    const { data: progressData, error: progressError } = await supabase
      .from('processing_progress')
      .select('*')
      .eq('file_path', filePath)
      .single();

    if (progressError) {
      return new Response(
        JSON.stringify({ error: 'Failed to get processing progress', details: progressError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Update status to processing
    await supabase
      .from('processing_progress')
      .update({ status: 'processing' })
      .eq('file_path', filePath);

    // In a real implementation, you would start a background process to generate questions
    // For this example, we'll simulate starting the process and return immediately

    // Determine difficulty level based on grade
    let difficultyLevel = '01';
    const grade = parseInt(bookData.grade, 10);
    
    if (grade === 3) difficultyLevel = '01';
    else if (grade === 4) difficultyLevel = '02';
    else if (grade === 5) difficultyLevel = '03';
    else if (grade === 6) difficultyLevel = '04';
    else if (grade === 7) difficultyLevel = '05';
    else if (grade === 8 || grade === 9) difficultyLevel = '06';
    else if (grade === 10 || grade === 11) difficultyLevel = '07';
    else if (grade === 12) difficultyLevel = '08';

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Question generation started',
        bookId: bookData.id,
        startPage: progressData.last_processed_page + 1,
        difficultyLevel
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
