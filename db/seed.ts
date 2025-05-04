import { db } from "./index";
import * as schema from "@shared/schema";
import { v4 as uuidv4 } from "uuid";

async function seed() {
  try {
    // Check if we already have data
    const existingPresentations = await db.query.presentations.findMany();
    
    if (existingPresentations.length > 0) {
      console.log("Database already contains presentations. Skipping seed.");
      return;
    }
    
    console.log("Seeding database with sample data...");
    
    // Create a sample presentation
    const presentationId = uuidv4();
    await db.insert(schema.presentations).values({
      id: presentationId,
      name: "GrapheneAI_AIBasedResearch_Pharma_Capabilities.pptx",
      submitted: false
    });
    
    // Create slides for the presentation
    const slides = [];
    for (let i = 1; i <= 17; i++) {
      const slideId = uuidv4();
      slides.push({
        presentation_id: presentationId,
        slide_id: slideId,
        slide_number: i,
        image: createPlaceholderImage(i, 17)
      });
    }
    
    await db.insert(schema.slides).values(slides);
    
    // Add sample annotations
    const sampleAnnotations = [
      {
        presentation_id: presentationId,
        slide_id: slides[2].slide_id,  // Slide 3
        tags: JSON.stringify([{ key: "attribute", value: "brands" }])
      },
      {
        presentation_id: presentationId,
        slide_id: slides[5].slide_id,  // Slide 6
        tags: JSON.stringify([
          { key: "category", value: "methodology" },
          { key: "steps", value: "three" }
        ])
      }
    ];
    
    await db.insert(schema.slideAnnotations).values(sampleAnnotations);
    
    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Create a simple placeholder image for seeding
function createPlaceholderImage(slideNumber: number, totalSlides: number): string {
  // Simple SVG placeholder
  const svgImage = `
  <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
    <rect width="800" height="600" fill="white"/>
    <text x="400" y="300" font-family="Arial" font-size="32" text-anchor="middle" fill="black">
      Slide ${slideNumber} of ${totalSlides}
    </text>
    <text x="400" y="350" font-family="Arial" font-size="20" text-anchor="middle" fill="gray">
      GrapheneAI Presentation Sample
    </text>
  </svg>
  `;
  
  // Convert SVG to base64
  const base64 = Buffer.from(svgImage).toString("base64");
  return base64;
}

seed();
