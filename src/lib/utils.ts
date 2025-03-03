import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getFileNameFromPath(filePath: string): string {
  if (!filePath) return 'Unknown';
  
  // Extract just the filename from the path
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

export function getGradeDifficultyLevel(grade: string): string {
  const gradeNum = parseInt(grade, 10);
  
  if (isNaN(gradeNum)) {
    return 'medium';
  }
  
  if (gradeNum <= 3) {
    return 'easy';
  } else if (gradeNum <= 6) {
    return 'medium';
  } else {
    return 'hard';
  }
}

export function formatFileName(grade: string, subject: string, semester: string): string {
  // Clean up inputs
  const cleanGrade = grade.replace(/[^a-zA-Z0-9]/g, '');
  const cleanSubject = subject.replace(/[^a-zA-Z0-9]/g, '');
  const cleanSemester = semester.replace(/[^a-zA-Z0-9]/g, '');
  
  // Format: Grade_Subject_Semester_Questions.csv
  return `Grade${cleanGrade}_${cleanSubject}_Semester${cleanSemester}_Questions.csv`;
}
