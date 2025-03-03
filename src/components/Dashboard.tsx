import React, { useState, useEffect } from 'react';
import { BookWithProgress } from '../types';
import { getBooks, scanForNewBooks } from '../services/bookService';
import BookUploader from './BookUploader';
import BooksList from './BooksList';
import { Toaster } from 'react-hot-toast';
import { BookOpen, RefreshCw, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [books, setBooks] = useState<BookWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    processed: 0,
    inProgress: 0,
    pending: 0
  });

  const fetchBooks = async () => {
    setIsLoading(true);
    try {
      const booksData = await getBooks();
      setBooks(booksData);
      
      // Calculate stats
      const total = booksData.length;
      const processed = booksData.filter(book => book.progress?.status === 'completed').length;
      const inProgress = booksData.filter(book => book.progress?.status === 'processing').length;
      const pending = total - processed - inProgress;
      
      setStats({ total, processed, inProgress, pending });
    } catch (error) {
      console.error('Error fetching books:', error);
      toast.error('Failed to fetch books');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleScanForNewBooks = async () => {
    setIsScanning(true);
    try {
      const result = await toast.promise(
        scanForNewBooks(),
        {
          loading: 'Scanning for new books...',
          success: 'Scan completed successfully',
          error: 'Failed to scan for new books',
        }
      );
      
      if (result) {
        // Refresh the book list after scanning
        await fetchBooks();
      }
    } catch (error) {
      console.error('Error scanning for new books:', error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster position="top-right" />
      
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center">
          <BookOpen className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800">MCQ Generator Dashboard</h1>
        </div>
        
        <button
          onClick={handleScanForNewBooks}
          disabled={isScanning}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors duration-200"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning...' : 'Scan for New Books'}
        </button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Books</p>
              <h3 className="text-2xl font-bold">{stats.total}</h3>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Processed</p>
              <h3 className="text-2xl font-bold">{stats.processed}</h3>
            </div>
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">In Progress</p>
              <h3 className="text-2xl font-bold">{stats.inProgress}</h3>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <h3 className="text-2xl font-bold">{stats.pending}</h3>
            </div>
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Upload New Book</h2>
          <BookUploader onUploadSuccess={fetchBooks} />
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Books Library</h2>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <BooksList books={books} onAction={fetchBooks} />
          )}
        </div>
      </div>
    </div>
  );
}
