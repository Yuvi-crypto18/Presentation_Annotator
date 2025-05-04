import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import StepIndicator from "@/components/StepIndicator";
import AnnotationForm from "@/components/AnnotationForm";
import { usePresentationStore } from "@/hooks/usePresentationStore";
import { Slide, Tag } from "@shared/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function SlideAnnotation() {
  const params = useParams<{ presentationId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
  const presentationId = params.presentationId;
  const { setPresentationData, slides, annotations, setAnnotations } = usePresentationStore();

  // Fetch presentation data
  const presentationQuery = useQuery({
    queryKey: [`/api/presentations/${presentationId}`],
    enabled: !!presentationId,
  });

  // Fetch slides for the presentation
  const slidesQuery = useQuery({
    queryKey: [`/api/presentations/${presentationId}/slides`],
    enabled: !!presentationId,
  });

  // Fetch existing annotations
  const annotationsQuery = useQuery({
    queryKey: [`/api/presentations/${presentationId}/annotations`],
    enabled: !!presentationId,
  });

  // Save slide annotations
  const saveAnnotationsMutation = useMutation({
    mutationFn: async (data: { slideId: string, tags: Tag[] }) => {
      const response = await apiRequest("POST", `/api/slides/${data.slideId}/annotations`, data.tags);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Annotations saved successfully",
        duration: 2000,
      });
      
      // Update local state with the saved annotations
      setAnnotations(data.slideId, data.tags);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save annotations",
        duration: 3000,
      });
    },
  });

  // Load presentation data once fetched
  useEffect(() => {
    if (presentationQuery.data && slidesQuery.data) {
      const presentationData = presentationQuery.data;
      const slidesData = slidesQuery.data;
      
      setPresentationData(presentationData, slidesData);
    }
  }, [presentationQuery.data, slidesQuery.data, setPresentationData]);

  // Load annotations once fetched
  useEffect(() => {
    if (annotationsQuery.data) {
      const allAnnotations = annotationsQuery.data;
      
      // Set annotations for each slide
      Object.entries(allAnnotations).forEach(([slideId, tags]) => {
        setAnnotations(slideId, tags as Tag[]);
      });
    }
  }, [annotationsQuery.data, setAnnotations]);

  const handlePreviousSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const handleNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handleSaveAnnotations = (slideId: string, tags: Tag[]) => {
    saveAnnotationsMutation.mutate({ slideId, tags });
  };

  const handleGoToReview = () => {
    navigate(`/review/${presentationId}`);
  };

  const handleBackToUpload = () => {
    navigate("/");
  };

  // Check if we're still loading data
  const isLoading = presentationQuery.isLoading || slidesQuery.isLoading || annotationsQuery.isLoading;
  const hasError = presentationQuery.error || slidesQuery.error || annotationsQuery.error;
  
  // Get the current slide
  const currentSlide: Slide | undefined = slides[currentSlideIndex];
  const currentSlideId = currentSlide?.slide_id;
  const currentAnnotations = currentSlideId ? annotations[currentSlideId] || [] : [];

  if (hasError) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {(presentationQuery.error as Error)?.message || 
           (slidesQuery.error as Error)?.message || 
           (annotationsQuery.error as Error)?.message || 
           "An error occurred while loading the presentation"}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <div className="hidden md:block mb-6">
        <StepIndicator activeStep={2} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Slide preview column */}
        <div className="lg:col-span-2">
          <Card className="shadow-lg mb-6">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Slide Preview</h2>
                {!isLoading && (
                  <div className="text-sm text-muted-foreground">
                    {currentSlideIndex + 1} of {slides.length}
                  </div>
                )}
              </div>
              
              {isLoading ? (
                <Skeleton className="w-full h-[400px] bg-muted rounded-lg mb-4" />
              ) : (
                <div className="bg-white rounded-lg overflow-hidden mb-4">
                  <img 
                    src={`/api/slides/${currentSlideId}/image`} 
                    alt={`Slide ${currentSlideIndex + 1}`} 
                    className="w-full h-auto max-h-[500px] object-contain"
                  />
                </div>
              )}
              
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  disabled={currentSlideIndex === 0 || isLoading}
                  onClick={handlePreviousSlide}
                >
                  <ChevronLeft className="h-5 w-5 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={currentSlideIndex === slides.length - 1 || isLoading}
                  onClick={handleNextSlide}
                >
                  Next
                  <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Annotation form column */}
        <div>
          <Card className="shadow-lg mb-6">
            <CardContent className="pt-6">
              <h2 className="text-xl font-semibold mb-4">Add Annotations</h2>
              
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="w-full h-10 bg-muted" />
                  <Skeleton className="w-full h-24 bg-muted" />
                  <Skeleton className="w-full h-10 bg-muted" />
                </div>
              ) : currentSlideId ? (
                <AnnotationForm
                  slideId={currentSlideId}
                  annotations={currentAnnotations}
                  onSave={handleSaveAnnotations}
                  isPending={saveAnnotationsMutation.isPending}
                />
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>No slide data available</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          
          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBackToUpload}>
                  Cancel
                </Button>
                <Button variant="secondary" onClick={handleGoToReview}>
                  Review All Annotations
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
