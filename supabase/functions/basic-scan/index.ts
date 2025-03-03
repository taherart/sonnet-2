// supabase/functions/basic-scan/index.ts
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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://zynnrecdqoojcixrqylf.supabase.co';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bm5yZWNkcW9vamNpeHJxeWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwMzAzNTcsImV4cCI6MjA1NjYwNjM1N30.tG0Y0ILdbS8ZCh5hYVzVuw2P2NOCDyzvUKBTzCSYYAQ';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Ensure tables exist
    await ensureTables(supabase);

    // List all files in the books bucket
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from('books')
      .list();

    if (storageError) {
      return new Response(
        JSON.stringify({ error: 'Failed to list storage files', details: storageError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get all books in the metadata table
    const { data: existingBooks, error: booksError } = await supabase
      .from('books_metadata')
      .select('file_path');

    if (booksError) {
      return new Response(
        JSON.stringify({ error: 'Failed to get existing books', details: booksError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Find files that are not in the metadata table
    const existingPaths = existingBooks.map(book => book.file_path);
    const newFiles = storageFiles
      .filter(file => file.name.toLowerCase().endsWith('.pdf'))
      .filter(file => !existingPaths.includes(file.name));

    // Add new files to the metadata table
    const newBooksData = newFiles.map(file => ({
      file_path: file.name,
      grade: null,
      subject: null,
      semester: null
    }));

    if (newBooksData.length > 0) {
      const { error: insertError } = await supabase
        .from('books_metadata')
        .insert(newBooksData);

      if (insertError) {
        return new Response(
          JSON.stringify({ error: 'Failed to insert new books', details: insertError }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Basic scan completed',
        newBooksCount: newBooksData.length,
        totalBooksCount: existingPaths.length + newBooksData.length
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

async function ensureTables(supabase) {
  // Check if books_metadata table exists
  const { error: metadataError } = await supabase
    .from('books_metadata')
    .select('id')
    .limit(1);

  if (metadataError && metadataError.code === '42P01') {
    // Create books_metadata table
    await supabase.rpc('create_books_metadata_table', {});
  }

  // Check if processing_progress table exists
  const { error: progressError } = await supabase
    .from('processing_progress')
    .select('id')
    .limit(1);

  if (progressError && progressError.code === '42P01') {
    // Create processing_progress table
    await supabase.rpc('create_processing_progress_table', {});
  }

  // Check if questions table exists
  const { error: questionsError } = await supabase
    .from('questions')
    .select('id')
    .limit(1);

  if (questionsError && questionsError.code === '42P01') {
    // Create questions table
    await supabase.rpc('create_questions_table', {});
  }
}
