import { supabase } from '../lib/supabase';
import { Book, ProcessingProgress, Question, BookWithProgress } from '../types';
import { getGradeDifficultyLevel, formatFileName } from '../lib/utils';

export async function uploadBook(file: File): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('books')
    .upload(`${Date.now()}_${file.name}`, file);

  if (error) {
    console.error('Error uploading book:', error);
    return null;
  }

  return data.path;
}

export async function getBooks(): Promise<BookWithProgress[]> {
  const { data: books, error: booksError } = await supabase
    .from('books_metadata')
    .select('*')
    .order('created_at', { ascending: false });

  if (booksError) {
    console.error('Error fetching books:', booksError);
    return [];
  }

  const { data: progress, error: progressError } = await supabase
    .from('processing_progress')
    .select('*');

  if (progressError) {
    console.error('Error fetching progress:', progressError);
    return books || [];
  }

  return (books || []).map((book: Book) => {
    const bookProgress = progress ? progress.find((p: ProcessingProgress) => p.file_path === book.file_path) : null;
    return {
      ...book,
      progress: bookProgress
    };
  });
}

export async function extractMetadata(filePath: string): Promise<boolean> {
  try {
    // Call the Supabase Edge Function for metadata extraction
    const { data, error } = await supabase.functions.invoke('extract-metadata', {
      body: { filePath }
    });

    if (error) {
      console.error('Error extracting metadata:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error calling metadata extraction function:', error);
    return false;
  }
}

export async function startQuestionGeneration(filePath: string): Promise<boolean> {
  try {
    // Call the Supabase Edge Function for question generation
    const { data, error } = await supabase.functions.invoke('generate-questions', {
      body: { filePath }
    });

    if (error) {
      console.error('Error starting question generation:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error calling question generation function:', error);
    return false;
  }
}

export async function cancelProcessing(filePath: string): Promise<boolean> {
  const { error } = await supabase
    .from('processing_progress')
    .update({ status: 'not_started' })
    .eq('file_path', filePath);

  if (error) {
    console.error('Error canceling processing:', error);
    return false;
  }

  return true;
}

export async function scanForNewBooks(): Promise<boolean> {
  try {
    // First, check if we need to create the tables if they don't exist
    await ensureTablesExist();
    
    // Try to call the Supabase Edge Function for basic scan
    try {
      const { data, error } = await supabase.functions.invoke('basic-scan', {});
      
      if (!error) {
        console.log('Edge function scan result:', data);
        return true;
      }
      
      console.warn('Edge function failed, falling back to direct scan:', error);
    } catch (edgeFunctionError) {
      console.warn('Edge function error, falling back to direct scan:', edgeFunctionError);
    }
    
    // If edge function fails or isn't deployed, perform direct scan
    return await performBasicScan();
  } catch (error) {
    console.error('Error scanning for new books:', error);
    return false;
  }
}

// Direct scan function that runs in the browser
async function performBasicScan(): Promise<boolean> {
  console.log('Performing direct basic scan...');
  
  // List all files in the books bucket
  const { data: storageFiles, error: storageError } = await supabase.storage
    .from('books')
    .list('', {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

  if (storageError) {
    console.error('Failed to list storage files:', storageError);
    return false;
  }

  console.log('Files in storage:', storageFiles);

  // Get all books in the metadata table
  const { data: existingBooks, error: booksError } = await supabase
    .from('books_metadata')
    .select('file_path');

  if (booksError) {
    console.error('Failed to get existing books:', booksError);
    return false;
  }

  console.log('Existing books in metadata:', existingBooks);

  // Find files that are not in the metadata table
  const existingPaths = existingBooks ? existingBooks.map(book => book.file_path) : [];
  
  const newFiles = storageFiles
    .filter(file => {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const isNotInMetadata = !existingPaths.includes(file.name);
      console.log(`File ${file.name}: isPdf=${isPdf}, isNotInMetadata=${isNotInMetadata}`);
      return isPdf && isNotInMetadata;
    });

  console.log('New files to add:', newFiles);

  // Add new files to the metadata table
  const newBooksData = newFiles.map(file => ({
    file_path: file.name,
    grade: null,
    subject: null,
    semester: null
  }));

  if (newBooksData.length > 0) {
    console.log('Inserting new books:', newBooksData);
    const { error: insertError } = await supabase
      .from('books_metadata')
      .insert(newBooksData);

    if (insertError) {
      console.error('Failed to insert new books:', insertError);
      return false;
    }
    
    console.log('Successfully inserted new books');
  } else {
    console.log('No new books to insert');
  }

  return true;
}

// Ensure required tables exist
async function ensureTablesExist(): Promise<void> {
  console.log('Ensuring tables exist...');
  
  // Check if books_metadata table exists
  const { error: metadataError } = await supabase
    .from('books_metadata')
    .select('id')
    .limit(1);

  if (metadataError) {
    console.log('Metadata table error:', metadataError);
    if (metadataError.code === '42P01') { // Table doesn't exist
      console.log('Creating books_metadata table...');
      try {
        // Try to create the table using RPC
        await supabase.rpc('create_books_metadata_table');
      } catch (rpcError) {
        console.error('RPC error creating books_metadata table:', rpcError);
        // Fallback: Create the table using SQL
        await createBooksMetadataTable();
      }
    }
  }

  // Check if processing_progress table exists
  const { error: progressError } = await supabase
    .from('processing_progress')
    .select('id')
    .limit(1);

  if (progressError) {
    console.log('Progress table error:', progressError);
    if (progressError.code === '42P01') { // Table doesn't exist
      console.log('Creating processing_progress table...');
      try {
        // Try to create the table using RPC
        await supabase.rpc('create_processing_progress_table');
      } catch (rpcError) {
        console.error('RPC error creating processing_progress table:', rpcError);
        // Fallback: Create the table using SQL
        await createProcessingProgressTable();
      }
    }
  }

  // Check if questions table exists
  const { error: questionsError } = await supabase
    .from('questions')
    .select('id')
    .limit(1);

  if (questionsError) {
    console.log('Questions table error:', questionsError);
    if (questionsError.code === '42P01') { // Table doesn't exist
      console.log('Creating questions table...');
      try {
        // Try to create the table using RPC
        await supabase.rpc('create_questions_table');
      } catch (rpcError) {
        console.error('RPC error creating questions table:', rpcError);
        // Fallback: Create the table using SQL
        await createQuestionsTable();
      }
    }
  }
}

// Fallback functions to create tables if RPC fails
async function createBooksMetadataTable(): Promise<void> {
  const { error } = await supabase.from('books_metadata').insert([
    {
      file_path: 'temp_initialization_record',
      grade: '0',
      subject: 'temp',
      semester: '0'
    }
  ]);
  
  if (error && error.code !== '23505') { // Ignore duplicate key error
    console.error('Error creating books_metadata table:', error);
  }
}

async function createProcessingProgressTable(): Promise<void> {
  const { error } = await supabase.from('processing_progress').insert([
    {
      file_path: 'temp_initialization_record',
      status: 'not_started',
      last_processed_page: 0,
      questions_generated: 0
    }
  ]);
  
  if (error && error.code !== '23505') { // Ignore duplicate key error
    console.error('Error creating processing_progress table:', error);
  }
}

async function createQuestionsTable(): Promise<void> {
  const { error } = await supabase.from('questions').insert([
    {
      book_id: 0,
      question_number: 0,
      question_text: 'temp',
      choice_1: 'temp',
      choice_2: 'temp',
      choice_3: 'temp',
      choice_4: 'temp',
      correct_choice: 'temp',
      category: 'temp',
      difficulty_level: 'easy'
    }
  ]);
  
  if (error && error.code !== '23505') { // Ignore duplicate key error
    console.error('Error creating questions table:', error);
  }
}

export async function exportQuestionsToCSV(bookId: number): Promise<string | null> {
  try {
    // Get book metadata
    const { data: book, error: bookError } = await supabase
      .from('books_metadata')
      .select('*')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      console.error('Error fetching book metadata:', bookError);
      return null;
    }

    // Get questions for this book
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('book_id', bookId);

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return null;
    }

    // Format CSV content
    const csvHeader = 'question_number,category,difficulty_level,question_text,choice_1,choice_2,choice_3,choice_4,correct_choice\n';
    const csvRows = questions.map((q: Question) => 
      `${q.question_number},${q.category},${q.difficulty_level},"${q.question_text.replace(/"/g, '""')}","${q.choice_1.replace(/"/g, '""')}","${q.choice_2.replace(/"/g, '""')}","${q.choice_3.replace(/"/g, '""')}","${q.choice_4.replace(/"/g, '""')}","${q.correct_choice.replace(/"/g, '""')}"`
    ).join('\n');
    
    const csvContent = csvHeader + csvRows;
    const fileName = formatFileName(book.grade || '0', book.subject || 'Unknown', book.semester || '00');
    
    // Upload CSV to output bucket
    const { data, error } = await supabase.storage
      .from('output')
      .upload(fileName, csvContent, {
        contentType: 'text/csv',
        upsert: true
      });

    if (error) {
      console.error('Error uploading CSV:', error);
      return null;
    }

    return fileName;
  } catch (error) {
    console.error('Error exporting questions to CSV:', error);
    return null;
  }
}
