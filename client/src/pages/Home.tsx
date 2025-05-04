import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, Cloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import StepIndicator from "@/components/StepIndicator";
import UploadScreen from "@/components/UploadScreen";

export default function Home() {
  const [location, navigate] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const response = await apiRequest("POST", "/api/presentations", undefined, formData);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "PowerPoint file processed successfully!",
        duration: 3000,
      });
      
      // Navigate to annotation page
      setTimeout(() => {
        navigate(`/annotate/${data.presentation_id}`);
      }, 500);
    },
    onError: (error: any) => {
      setError(error.message || "Failed to process PowerPoint file. Please try again.");
      setProgress(0);
      setFile(null);
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    setError(null);
    
    if (!selectedFile) return;
    
    // Validate file type
    const allowedTypes = [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ];
    
    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Invalid file type. Please upload a PowerPoint file (.ppt or .pptx)");
      return;
    }
    
    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
    if (selectedFile.size > maxSize) {
      setError("File size exceeds 20MB limit");
      return;
    }
    
    setFile(selectedFile);
  };

  const handleUpload = () => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append("presentation", file);
    
    setProgress(0);
    uploadMutation.mutate(formData);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
    <div>
      <div className="hidden md:block mb-6">
        <StepIndicator activeStep={1} />
      </div>
      
      <div className="bg-card rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload a PowerPoint file</h2>
        <p className="text-muted-foreground mb-6">Upload a PowerPoint file to begin annotating slides.</p>
        
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <UploadScreen 
          file={file}
          onFileChange={handleFileChange}
          onRemoveFile={handleRemoveFile}
          fileInputRef={fileInputRef}
        />
        
        {file && !uploadMutation.isPending && (
          <div className="mt-6">
            <Button 
              className="w-full" 
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
            >
              Upload and Process
            </Button>
          </div>
        )}
        
        {uploadMutation.isPending && (
          <div className="mt-6 bg-muted rounded-lg p-4">
            <div className="flex items-center mb-2">
              <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" />
              <p className="text-foreground">Processing PowerPoint file...</p>
            </div>
            <Progress value={progress} className="h-2.5" />
          </div>
        )}
      </div>
    </div>
  );
}
