// Presentation type
export interface Presentation {
  presentation_id: string;
  name: string;
  submitted: boolean;
  created_at: string;
}

// Slide type
export interface Slide {
  id: number;
  presentation_id: string;
  slide_id: string;
  slide_number: number;
  image?: string; // Base64 encoded image
}

// Tag (key-value pair) type
export interface Tag {
  key: string;
  value: string;
}

// Slide annotation type
export interface SlideAnnotation {
  id: number;
  presentation_id: string;
  slide_id: string;
  tags: string; // JSON string of key-value pairs
}

// Formatted annotation type
export interface AnnotationsMap {
  [slideId: string]: Tag[];
}
