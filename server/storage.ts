import { db } from "@db";
import { presentations, slides, slideAnnotations } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { Tag } from "@shared/types";
import { v4 as uuidv4 } from "uuid";
import { sqliteStorage } from "./services/sqliteService";

export const storage = {
  async createPresentation(name: string): Promise<string> {
    // Generate a UUID for the presentation ID
    const presentationId = uuidv4();
    
    // Insert with the explicit ID
    await db.insert(presentations)
      .values({ 
        id: presentationId,
        name 
      });
    
    return presentationId;
  },
  
  async getPresentation(id: string) {
    return await db.query.presentations.findFirst({
      where: eq(presentations.id, id)
    });
  },
  
  async saveSlide(presentationId: string, slideNumber: number, slideId: string, imageBase64: string) {
    // Save to PostgreSQL
    await db.insert(slides)
      .values({
        presentation_id: presentationId,
        slide_id: slideId,
        slide_number: slideNumber,
        image: imageBase64
      });
      
    // Also save to SQLite input table
    try {
      // Get the presentation name
      const presentation = await this.getPresentation(presentationId);
      
      if (presentation) {
        // Insert into SQLite input table
        sqliteStorage.insertSlide(
          presentationId,
          presentation.name,
          slideId,
          slideNumber,
          imageBase64
        );
      }
    } catch (error) {
      console.error("Error saving to SQLite input table:", error);
      // Continue even if SQLite storage fails
    }
  },
  
  async getSlides(presentationId: string) {
    return await db.query.slides.findMany({
      where: eq(slides.presentation_id, presentationId),
      orderBy: slides.slide_number
    });
  },
  
  async getSlide(slideId: string) {
    return await db.query.slides.findFirst({
      where: eq(slides.slide_id, slideId)
    });
  },
  
  async saveAnnotations(slideId: string, tags: Tag[]) {
    // First, delete existing annotations for this slide
    await db.delete(slideAnnotations)
      .where(eq(slideAnnotations.slide_id, slideId));
    
    // Then insert the new annotations in PostgreSQL
    if (tags.length > 0) {
      const slide = await this.getSlide(slideId);
      
      if (!slide) {
        throw new Error("Slide not found");
      }
      
      // Insert new annotations
      await db.insert(slideAnnotations)
        .values({
          slide_id: slideId,
          presentation_id: slide.presentation_id,
          tags: JSON.stringify(tags)
        });
      
      // Also save to SQLite output table
      try {
        sqliteStorage.insertAnnotations(slide.presentation_id, slideId, tags);
      } catch (error) {
        console.error("Error saving to SQLite output table:", error);
        // Continue even if SQLite storage fails
      }
    }
  },
  
  async getAnnotations(presentationId: string) {
    const annotations = await db.query.slideAnnotations.findMany({
      where: eq(slideAnnotations.presentation_id, presentationId)
    });
    
    // Format the annotations as { slideId: tags }
    const result: Record<string, Tag[]> = {};
    
    annotations.forEach(annotation => {
      result[annotation.slide_id] = JSON.parse(annotation.tags);
    });
    
    return result;
  },
  
  async submitPresentation(presentationId: string) {
    await db.update(presentations)
      .set({ submitted: true })
      .where(eq(presentations.id, presentationId));
  },
  
  // Get slides from SQLite database
  async getSQLiteSlides(presentationId: string) {
    try {
      return sqliteStorage.getSlides(presentationId);
    } catch (error) {
      console.error("Error getting slides from SQLite:", error);
      return [];
    }
  },
  
  // Get annotations from SQLite database
  async getSQLiteAnnotations(presentationId: string) {
    try {
      return sqliteStorage.getAnnotations(presentationId);
    } catch (error) {
      console.error("Error getting annotations from SQLite:", error);
      return [];
    }
  }
};
