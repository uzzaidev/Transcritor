import React, { useCallback, useState } from 'react';
import { Upload, FileAudio, FileVideo, AlertCircle } from 'lucide-react';
import { MediaFile } from '../types';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): string | null => {
    // Check types
    const validTypes = ['audio/', 'video/', 'application/ogg'];
    const validExtensions = ['.ogg', '.m4a', '.mp3', '.wav', '.webm', '.mp4', '.mpeg', '.mov'];

    // Check MIME type or extension (for robust WhatsApp support)
    const isValidType = validTypes.some(type => file.type.startsWith(type));
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isValidType && !hasValidExtension) {
      return `File "${file.name}" has an unsupported format.`;
    }

    // Limit size (2GB)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      return `File "${file.name}" is too large (max 2GB).`;
    }

    return null;
  };

  const processFiles = (fileList: FileList | File[]) => {
    setError(null);
    const filesArray = Array.from(fileList);
    const validFiles: File[] = [];
    const errors: string[] = [];

    filesArray.forEach(file => {
      const err = validateFile(file);
      if (err) {
        errors.push(err);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      // Show first error or a summary
      setError(errors[0] + (errors.length > 1 ? ` (+${errors.length - 1} others)` : ''));
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [disabled, onFilesSelected]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-10 transition-all duration-300 ease-in-out
          flex flex-col items-center justify-center text-center cursor-pointer group
          ${isDragging
            ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
            : 'border-slate-600 hover:border-slate-400 bg-slate-800/50 hover:bg-slate-800'}
          ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
        `}
      >
        <input
          type="file"
          accept="audio/*,video/*,.ogg,.m4a"
          multiple
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          disabled={disabled}
        />

        <div className="mb-4 p-4 rounded-full bg-slate-700/50 group-hover:bg-slate-700 transition-colors">
          <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-400' : 'text-slate-400'}`} />
        </div>

        <h3 className="text-xl font-semibold text-white mb-2">
          {isDragging ? 'Drop files here!' : 'Upload Audio or Video Files'}
        </h3>

        <p className="text-slate-400 text-sm max-w-sm mb-6">
          Drag and drop your media files here, or click to browse.
          Supports Multiple files. <br />
          <span className="text-blue-400">WhatsApp (.ogg, .m4a) supported.</span>
        </p>

        <div className="flex gap-4 text-xs text-slate-500 uppercase tracking-wider font-medium">
          <span className="flex items-center gap-1"><FileAudio className="w-4 h-4" /> Audio</span>
          <span className="flex items-center gap-1"><FileVideo className="w-4 h-4" /> Video</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
