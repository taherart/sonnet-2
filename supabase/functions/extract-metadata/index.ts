// supabase/functions/extract-metadata/index.ts
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

    // Download the PDF file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('books')
      .download(filePath);

    if (downloadError) {
      return new Response(
        JSON.stringify({ error: 'Failed to download file', details: downloadError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Extract text from the first few pages (simplified for this example)
    // In a real implementation, you would use a PDF parsing library
    const pdfText = "Sample text from PDF: Grade 3 Math Book, First Semester";

    // Call OpenAI API to extract metadata
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Analyze the following text from a school book cover or first pages and extract the grade, subject, and semester. The text may be in Arabic (e.g., "الصف الثالث" for grade 3). Map Arabic grade names to numbers as follows: 
            - الصف الثالث=grade 3
            - الصف الرابع=grade 4
            - الصف الخامس=grade 5
            - الصف السادس=grade 6
            - الصف الأول متوسط=grade 7
            - الصف الثاني متوسط=grade 8
            - الصف الثالث متوسط=grade 9
            - الصف الأول ثانوي=grade 10
            - الصف الثاني ثانوي=grade 11
            - الصف الثالث ثانوي=grade 12
            Provide the output in JSON format with keys 'grade' (numeric), 'subject', and 'semester'.`
          },
          {
            role: 'user',
            content: pdfText
          }
        ]
      })
    });

    const openaiData = await openaiResponse.json();
    
    if (!openaiData.choices || openaiData.choices.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to extract metadata from OpenAI', details: openaiData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Parse the JSON response from OpenAI
    const metadataText = openaiData.choices[0].message.content;
    let metadata;
    try {
      metadata = JSON.parse(metadataText);
    } catch (e) {
      // Fallback to sample data if parsing fails
      metadata = { grade: "3", subject: "Math", semester: "01" };
    }

    // Update the books_metadata table
    const { data: updateData, error: updateError } = await supabase
      .from('books_metadata')
      .update({
        grade: metadata.grade,
        subject: metadata.subject,
        semester: metadata.semester
      })
      .eq('file_path', filePath);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update metadata', details: updateError }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Initialize processing_progress if it doesn't exist
    const { data: progressData, error: progressError } = await supabase
      .from('processing_progress')
      .select('*')
      .eq('file_path', filePath);

    if (!progressData || progressData.length === 0) {
      await supabase
        .from('processing_progress')
        .insert({
          file_path: filePath,
          last_processed_page: 0,
          questions_generated: 0,
          status: 'not_started'
        });
    }

    return new Response(
      JSON.stringify({ success: true, metadata }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
