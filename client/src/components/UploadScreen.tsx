import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Cloud, X } from "lucide-react";

interface UploadScreenProps {
  file: File | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export default function UploadScreen({ 
  file, 
  onFileChange, 
  onRemoveFile,
  fileInputRef 
}: UploadScreenProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const inputElement = fileInputRef.current;
      if (inputElement) {
        // Create a DataTransfer to set the file input's files
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(e.dataTransfer.files[0]);
        inputElement.files = dataTransfer.files;
        
        // Trigger change event
        const event = new Event('change', { bubbles: true });
        inputElement.dispatchEvent(event);
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + " KB";
    const mb = kb / 1024;
    if (mb < 1024) return mb.toFixed(1) + " MB";
    const gb = mb / 1024;
    return gb.toFixed(1) + " GB";
  };

  return (
    <div className="mb-6">
      <div 
        className={`
          border-2 border-dashed rounded-lg p-8 text-center
          ${isDragging ? 'border-primary bg-primary/10' : 'border-muted'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center">
          <Cloud className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">Drag and drop file here</p>
          <p className="text-xs text-muted-foreground mb-4">Limit 20MB per file • PPTX</p>
          <Button onClick={handleBrowseFiles}>
            Browse files
          </Button>
          <input 
            type="file" 
            id="file-input" 
            className="hidden" 
            accept=".ppt,.pptx" 
            onChange={onFileChange}
            ref={fileInputRef}
          />
        </div>
      </div>
      
      {file && (
        <div className="mt-6">
          <div className="bg-muted rounded-lg p-4 flex items-center">
            <div className="flex-shrink-0 mr-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
            <div>
              <button 
                className="text-muted-foreground hover:text-destructive"
                onClick={onRemoveFile}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
