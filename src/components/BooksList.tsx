import React from 'react';
import { BookWithProgress } from '../types';
import { getFileNameFromPath } from '../lib/utils';
import { FileText, AlertCircle, CheckCircle, Clock, Play, Pause, Download, ExternalLink } from 'lucide-react';
import { extractMetadata, startQuestionGeneration, cancelProcessing, exportQuestionsToCSV } from '../services/bookService';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface BooksListProps {
  books: BookWithProgress[];
  onAction: () => void;
}

export default function BooksList({ books, onAction }: BooksListProps) {
  const handleExtractMetadata = async (filePath: string) => {
    toast.promise(extractMetadata(filePath), {
      loading: 'Extracting metadata...',
      success: () => {
        onAction();
        return 'Metadata extracted successfully';
      },
      error: 'Failed to extract metadata',
    });
  };

  const handleStartGeneration = async (filePath: string) => {
    toast.promise(startQuestionGeneration(filePath), {
      loading: 'Starting question generation...',
      success: () => {
        onAction();
        return 'Question generation started';
      },
      error: 'Failed to start question generation',
    });
  };

  const handleCancelProcessing = async (filePath: string) => {
    toast.promise(cancelProcessing(filePath), {
      loading: 'Canceling processing...',
      success: () => {
        onAction();
        return 'Processing canceled';
      },
      error: 'Failed to cancel processing',
    });
  };

  const handleExportCSV = async (bookId: number) => {
    toast.promise(exportQuestionsToCSV(bookId), {
      loading: 'Exporting questions to CSV...',
      success: (fileName) => {
        if (fileName) {
          return `Questions exported to ${fileName}`;
        }
        return 'Questions exported successfully';
      },
      error: 'Failed to export questions',
    });
  };

  const handleViewPDF = async (filePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('books')
        .createSignedUrl(filePath, 60); // 60 seconds expiry

      if (error) {
        toast.error('Failed to generate URL for PDF');
        return;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error generating signed URL:', error);
      toast.error('Failed to open PDF');
    }
  };

  const getStatusIcon = (book: BookWithProgress) => {
    if (!book.progress) {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }

    switch (book.progress.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getProgressText = (book: BookWithProgress) => {
    if (!book.progress) {
      return 'Not started';
    }

    if (book.progress.status === 'completed') {
      return `Completed (${book.progress.questions_generated} questions)`;
    }

    if (book.progress.status === 'processing') {
      return `Processing: ${book.progress.questions_generated} questions, page ${book.progress.last_processed_page}`;
    }

    return 'Not started';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white rounded-lg overflow-hidden">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metadata</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {books.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                No books found. Upload a book or scan for existing books.
              </td>
            </tr>
          ) : (
            books.map((book) => (
              <tr key={book.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-gray-400 mr-3" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 block">
                        {getFileNameFromPath(book.file_path)}
                      </span>
                      <button 
                        onClick={() => handleViewPDF(book.file_path)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center mt-1"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View PDF
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {book.grade && book.subject && book.semester ? (
                    <div className="text-sm text-gray-900">
                      <div>Grade: {book.grade}</div>
                      <div>Subject: {book.subject}</div>
                      <div>Semester: {book.semester}</div>
                    </div>
                  ) : (
                    <span className="text-sm text-yellow-500">Metadata not extracted</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getStatusIcon(book)}
                    <span className="ml-2 text-sm text-gray-900">{getProgressText(book)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex space-x-2">
                    {!book.grade && (
                      <button
                        onClick={() => handleExtractMetadata(book.file_path)}
                        className="bg-purple-600 hover:bg-purple-700 text-white py-1 px-3 rounded-md text-sm"
                        title="Extract Metadata"
                      >
                        Extract Metadata
                      </button>
                    )}
                    
                    {book.grade && (!book.progress || book.progress.status === 'not_started') && (
                      <button
                        onClick={() => handleStartGeneration(book.file_path)}
                        className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded-md text-sm flex items-center"
                        title="Start Question Generation"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Start
                      </button>
                    )}
                    
                    {book.progress && book.progress.status === 'processing' && (
                      <button
                        onClick={() => handleCancelProcessing(book.file_path)}
                        className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-md text-sm flex items-center"
                        title="Cancel Processing"
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Cancel
                      </button>
                    )}
                    
                    {book.progress && book.progress.status === 'completed' && (
                      <button
                        onClick={() => handleExportCSV(book.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded-md text-sm flex items-center"
                        title="Download CSV"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Export CSV
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
