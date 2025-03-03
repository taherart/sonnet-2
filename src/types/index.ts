export interface Book {
  id: number;
  file_path: string;
  grade: string | null;
  subject: string | null;
  semester: string | null;
  created_at: string;
}

export interface ProcessingProgress {
  id: number;
  file_path: string;
  status: 'not_started' | 'processing' | 'completed';
  last_processed_page: number;
  questions_generated: number;
  created_at: string;
}

export interface Question {
  id: number;
  book_id: number;
  question_number: number;
  question_text: string;
  choice_1: string;
  choice_2: string;
  choice_3: string;
  choice_4: string;
  correct_choice: string;
  category: string;
  difficulty_level: 'easy' | 'medium' | 'hard';
  created_at: string;
}

export interface BookWithProgress extends Book {
  progress?: ProcessingProgress;
}
