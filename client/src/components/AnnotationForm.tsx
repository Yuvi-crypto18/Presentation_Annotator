import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Save, X } from "lucide-react";
import { Tag } from "@shared/types";

interface AnnotationFormProps {
  slideId: string;
  annotations: Tag[];
  onSave: (slideId: string, tags: Tag[]) => void;
  isPending: boolean;
}

export default function AnnotationForm({ 
  slideId, 
  annotations, 
  onSave,
  isPending 
}: AnnotationFormProps) {
  const [annotationFields, setAnnotationFields] = useState<Tag[]>([{ key: "", value: "" }]);

  // Update local fields when annotations change from props
  useEffect(() => {
    if (annotations && annotations.length > 0) {
      setAnnotationFields(annotations);
    } else {
      setAnnotationFields([{ key: "", value: "" }]);
    }
  }, [annotations, slideId]);

  const handleAddField = () => {
    setAnnotationFields([...annotationFields, { key: "", value: "" }]);
  };

  const handleRemoveField = (index: number) => {
    const updatedFields = annotationFields.filter((_, i) => i !== index);
    setAnnotationFields(updatedFields.length ? updatedFields : [{ key: "", value: "" }]);
  };

  const handleFieldChange = (index: number, field: "key" | "value", value: string) => {
    const updatedFields = [...annotationFields];
    updatedFields[index][field] = value;
    setAnnotationFields(updatedFields);
  };

  const handleRemoveAnnotation = (key: string) => {
    const updatedFields = annotations.filter(annotation => annotation.key !== key);
    onSave(slideId, updatedFields);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter out empty fields
    const validFields = annotationFields.filter(field => field.key.trim() !== "" && field.value.trim() !== "");
    
    if (validFields.length > 0) {
      onSave(slideId, validFields);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Display existing annotations */}
      {annotations && annotations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Current Annotations</h3>
          <div className="space-y-2">
            {annotations.map((annotation, index) => (
              <div key={index} className="bg-muted rounded-md p-3 flex justify-between items-center">
                <div>
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{annotation.key}:</span> {annotation.value}
                  </p>
                </div>
                <button 
                  type="button" 
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveAnnotation(annotation.key)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Add new annotation fields */}
      <div className="space-y-4 mb-6">
        {annotationFields.map((field, index) => (
          <div key={index} className="mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="md:col-span-1">
                <Label htmlFor={`annotation-key-${index}`} className="mb-1">Key</Label>
                <Input 
                  id={`annotation-key-${index}`}
                  placeholder="Enter key"
                  value={field.key}
                  onChange={(e) => handleFieldChange(index, "key", e.target.value)}
                />
              </div>
              <div className="md:col-span-2 flex items-center">
                <div className="flex-1">
                  <Label htmlFor={`annotation-value-${index}`} className="mb-1">Value</Label>
                  <Input 
                    id={`annotation-value-${index}`}
                    placeholder="Enter value"
                    value={field.value}
                    onChange={(e) => handleFieldChange(index, "value", e.target.value)}
                  />
                </div>
                {index > 0 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    className="ml-2 mt-6"
                    onClick={() => handleRemoveField(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          className="flex items-center text-primary hover:text-primary"
          onClick={handleAddField}
        >
          <PlusCircle className="h-5 w-5 mr-1" />
          Add Another Field
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            "Saving..."
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Annotations
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
