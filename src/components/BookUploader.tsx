import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { uploadBook } from '../services/bookService';
import toast from 'react-hot-toast';

export default function BookUploader({ onUploadSuccess }: { onUploadSuccess: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF file');
      return;
    }

    setIsUploading(true);
    try {
      const filePath = await uploadBook(file);
      if (filePath) {
        toast.success('Book uploaded successfully');
        onUploadSuccess();
      } else {
        toast.error('Failed to upload book');
      }
    } catch (error) {
      console.error('Error uploading book:', error);
      toast.error('An error occurred while uploading the book');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
      } transition-colors duration-200`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center">
        <Upload className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium mb-2">Upload School Book PDF</h3>
        <p className="text-sm text-gray-500 mb-4">
          Drag and drop your PDF file here, or click to browse
        </p>
        <label className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md cursor-pointer transition-colors duration-200">
          {isUploading ? 'Uploading...' : 'Select PDF File'}
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>
    </div>
  );
}
