import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, CheckCircle2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import StepIndicator from "@/components/StepIndicator";
import { usePresentationStore } from "@/hooks/usePresentationStore";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
  DialogClose 
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Presentation, Slide, Tag } from "@shared/types";

export default function ReviewAnnotations() {
  const params = useParams<{ presentationId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const presentationId = params.presentationId;
  const { 
    setPresentationData, 
    slides, 
    annotations, 
    setAnnotations, 
    presentationName
  } = usePresentationStore();

  // Fetch presentation data if not already in store
  const presentationQuery = useQuery<Presentation>({
    queryKey: [`/api/presentations/${presentationId}`],
    enabled: !!presentationId && slides.length === 0,
  });

  // Fetch slides if not already in store
  const slidesQuery = useQuery<Slide[]>({
    queryKey: [`/api/presentations/${presentationId}/slides`],
    enabled: !!presentationId && slides.length === 0,
  });

  // Fetch annotations if not already in store
  const annotationsQuery = useQuery<Record<string, Tag[]>>({
    queryKey: [`/api/presentations/${presentationId}/annotations`],
    enabled: !!presentationId && Object.keys(annotations).length === 0,
  });

  // For SQLite database dialog
  interface SqliteInputData {
    presentation_id: string;
    name: string;
    slide_id: string;
    slide_number: number;
  }
  
  interface SqliteOutputData {
    presentation_id: string;
    slide_id: string;
    tags: string;
  }
  
  const [sqliteInputData, setSqliteInputData] = useState<SqliteInputData[]>([]);
  const [sqliteOutputData, setSqliteOutputData] = useState<SqliteOutputData[]>([]);
  const [sqliteDialogOpen, setSqliteDialogOpen] = useState(false);
  
  // Query for SQLite input data (slides)
  const sqliteInputQuery = useQuery<{
    message: string;
    table: string;
    count: number;
    data: SqliteInputData[];
  }>({
    queryKey: [`/api/sqlite/input/${presentationId}`],
    enabled: false,
  });
  
  // Query for SQLite output data (annotations)
  const sqliteOutputQuery = useQuery<{
    message: string;
    table: string;
    count: number;
    data: SqliteOutputData[];
  }>({
    queryKey: [`/api/sqlite/output/${presentationId}`],
    enabled: false,
  });

  // Load SQLite data when dialog is opened
  const handleOpenSqliteDialog = async () => {
    setSqliteDialogOpen(true);
    
    // Fetch SQLite data
    try {
      if (!sqliteInputQuery.data) {
        await sqliteInputQuery.refetch();
      }
      if (!sqliteOutputQuery.data) {
        await sqliteOutputQuery.refetch();
      }
      
      if (sqliteInputQuery.data) {
        setSqliteInputData(sqliteInputQuery.data.data || []);
      }
      
      if (sqliteOutputQuery.data) {
        setSqliteOutputData(sqliteOutputQuery.data.data || []);
      }
    } catch (error) {
      console.error("Error fetching SQLite data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load SQLite database data",
        duration: 3000,
      });
    }
  };
  
  // Update SQLite data when queries complete
  useEffect(() => {
    if (sqliteInputQuery.data) {
      setSqliteInputData(sqliteInputQuery.data.data || []);
    }
    
    if (sqliteOutputQuery.data) {
      setSqliteOutputData(sqliteOutputQuery.data.data || []);
    }
  }, [sqliteInputQuery.data, sqliteOutputQuery.data]);

  const submitAnnotationsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/presentations/${presentationId}/submit`, null);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "All annotations have been submitted successfully",
        duration: 3000,
      });
      
      // Navigate to success page
      navigate("/success");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit annotations",
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
        setAnnotations(slideId, tags as any[]);
      });
    }
  }, [annotationsQuery.data, setAnnotations]);

  const handleEditSlide = (slideIndex: number) => {
    navigate(`/annotate/${presentationId}`);
    // The slide index will be set in the annotation page
    usePresentationStore.setState({ currentSlideIndex: slideIndex });
  };

  const handleBackToAnnotation = () => {
    navigate(`/annotate/${presentationId}`);
  };

  const handleSubmitAll = () => {
    submitAnnotationsMutation.mutate();
  };

  // Check if we're still loading data
  const isLoading = 
    presentationQuery.isLoading || 
    slidesQuery.isLoading || 
    annotationsQuery.isLoading ||
    (slides.length === 0 && !presentationQuery.error && !slidesQuery.error);
  
  const hasError = presentationQuery.error || slidesQuery.error || annotationsQuery.error;

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

  // Count slides with annotations
  const slidesWithAnnotations = slides.filter(slide => {
    const slideAnnotations = annotations[slide.slide_id] || [];
    return slideAnnotations.length > 0;
  }).length;

  return (
    <div>
      <div className="hidden md:block mb-6">
        <StepIndicator activeStep={3} />
      </div>
      
      <Card className="shadow-lg mb-6">
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold mb-4">Review Annotations</h2>
          <p className="text-muted-foreground mb-6">Review all annotations before final submission.</p>
          
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="w-full h-28 bg-muted rounded-lg" />
              ))}
            </div>
          ) : slides.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No slides found</AlertTitle>
              <AlertDescription>
                No slides were found for this presentation. Please go back and upload a presentation.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {slidesWithAnnotations === 0 && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No annotations</AlertTitle>
                  <AlertDescription>
                    No annotations have been added to any slides yet. Please go back and add annotations.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4 mb-8">
                {slides.map((slide, index) => {
                  const slideAnnotations = annotations[slide.slide_id] || [];
                  
                  return (
                    <div key={slide.slide_id} className="bg-muted rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="bg-white rounded-md overflow-hidden w-20 h-20 flex-shrink-0 mr-4">
                          <img 
                            src={`/api/slides/${slide.slide_id}/image`} 
                            alt={`Slide ${index + 1} Thumbnail`} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-foreground font-medium">
                              Slide {index + 1} of {slides.length}
                            </h3>
                            <Button 
                              variant="link" 
                              className="text-primary hover:text-primary/80 text-sm p-0"
                              onClick={() => handleEditSlide(index)}
                            >
                              Edit
                            </Button>
                          </div>
                          
                          {slideAnnotations.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">No annotations</p>
                          ) : (
                            <div className="space-y-2">
                              {slideAnnotations.map((annotation, idx) => (
                                <div key={idx} className="rounded-md p-2 bg-background text-sm">
                                  <span className="font-medium text-foreground">{annotation.key}:</span>{" "}
                                  <span className="text-muted-foreground">{annotation.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBackToAnnotation}>
                Back to Annotation
              </Button>
              <Button 
                variant="outline"
                onClick={handleOpenSqliteDialog}
                className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
              >
                <Database className="h-4 w-4" />
                View Database
              </Button>
            </div>
            <Button 
              variant="default" 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleSubmitAll}
              disabled={isLoading || submitAnnotationsMutation.isPending || slidesWithAnnotations === 0}
            >
              {submitAnnotationsMutation.isPending ? (
                <>Submitting...</>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Submit All Annotations
                </>
              )}
            </Button>
          </div>
          
          {/* SQLite Database Dialog */}
          <Dialog open={sqliteDialogOpen} onOpenChange={setSqliteDialogOpen}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>SQLite Database Content</DialogTitle>
                <DialogDescription>
                  View the raw data stored in the SQLite database for this presentation.
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="input" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="input">Input Table (Slides)</TabsTrigger>
                  <TabsTrigger value="output">Output Table (Annotations)</TabsTrigger>
                </TabsList>
                
                <TabsContent value="input" className="overflow-hidden flex-1">
                  <ScrollArea className="h-[calc(80vh-180px)]">
                    <div className="p-4 space-y-4">
                      <h3 className="text-lg font-semibold">Input Table Structure</h3>
                      <p className="text-muted-foreground mb-4">
                        The input table stores slide data including their IDs, presentation ID, 
                        and slide numbers.
                      </p>
                      
                      {sqliteInputQuery.isLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-24 w-full" />
                        </div>
                      ) : sqliteInputData.length === 0 ? (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>No data found</AlertTitle>
                          <AlertDescription>
                            No slide data was found in the SQLite database for this presentation.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted text-muted-foreground">
                              <tr>
                                <th className="p-2 text-left">Presentation ID</th>
                                <th className="p-2 text-left">Name</th>
                                <th className="p-2 text-left">Slide ID</th>
                                <th className="p-2 text-left">Slide Number</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sqliteInputData.map((row, index) => (
                                <tr key={index} className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                                  <td className="p-2 border-t">{row.presentation_id}</td>
                                  <td className="p-2 border-t">{row.name}</td>
                                  <td className="p-2 border-t">{row.slide_id}</td>
                                  <td className="p-2 border-t">{row.slide_number}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="output" className="overflow-hidden flex-1">
                  <ScrollArea className="h-[calc(80vh-180px)]">
                    <div className="p-4 space-y-4">
                      <h3 className="text-lg font-semibold">Output Table Structure</h3>
                      <p className="text-muted-foreground mb-4">
                        The output table stores all annotations (key-value pairs) for each slide, 
                        encoded as a JSON string in the tags column.
                      </p>
                      
                      {sqliteOutputQuery.isLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-24 w-full" />
                        </div>
                      ) : sqliteOutputData.length === 0 ? (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>No annotations found</AlertTitle>
                          <AlertDescription>
                            No annotations were found in the SQLite database for this presentation.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted text-muted-foreground">
                              <tr>
                                <th className="p-2 text-left">Presentation ID</th>
                                <th className="p-2 text-left">Slide ID</th>
                                <th className="p-2 text-left">Tags (JSON)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sqliteOutputData.map((row, index) => (
                                <tr key={index} className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                                  <td className="p-2 border-t">{row.presentation_id}</td>
                                  <td className="p-2 border-t">{row.slide_id}</td>
                                  <td className="p-2 border-t font-mono text-xs whitespace-pre-wrap">
                                    {typeof row.tags === 'string' ? row.tags : JSON.stringify(row.tags, null, 2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
              
              <div className="flex justify-end">
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
