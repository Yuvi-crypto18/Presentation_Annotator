import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { usePresentationStore } from "@/hooks/usePresentationStore";

export default function Success() {
  const [, navigate] = useLocation();
  const { resetStore } = usePresentationStore();

  const handleStartNew = () => {
    // Reset the store
    resetStore();
    // Navigate back to home
    navigate("/");
  };

  return (
    <div>
      <Card className="shadow-lg p-8 text-center">
        <CardContent className="pt-6">
          <div className="rounded-full bg-green-600/20 h-20 w-20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Success!</h2>
          <p className="text-muted-foreground mb-6">All annotations have been saved successfully.</p>
          <Button onClick={handleStartNew}>
            Annotate Another Presentation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
