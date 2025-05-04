import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { processPresentation } from "./services/presentationService";
import { sqliteStorage } from "./services/sqliteService";

// Configure multer storage for temporary PowerPoint files
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Please upload a .ppt or .pptx file"));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // API Routes
  // Upload and process a presentation
  app.post("/api/presentations", upload.single("presentation"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { originalname, path: filePath } = req.file;

      // Process the PowerPoint file and store slides in the database
      const presentationId = await processPresentation(originalname, filePath);

      // Return the presentation ID to the client
      res.status(201).json({ 
        message: "Presentation processed successfully", 
        presentation_id: presentationId 
      });
    } catch (error) {
      console.error("Error processing presentation:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to process presentation" 
      });
    }
  });

  // Get a specific presentation
  app.get("/api/presentations/:id", async (req: Request, res: Response) => {
    try {
      const presentationId = req.params.id;
      const presentation = await storage.getPresentation(presentationId);
      
      if (!presentation) {
        return res.status(404).json({ message: "Presentation not found" });
      }
      
      res.json(presentation);
    } catch (error) {
      console.error("Error fetching presentation:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch presentation" 
      });
    }
  });

  // Get all slides for a presentation
  app.get("/api/presentations/:id/slides", async (req: Request, res: Response) => {
    try {
      const presentationId = req.params.id;
      const slides = await storage.getSlides(presentationId);
      
      res.json(slides);
    } catch (error) {
      console.error("Error fetching slides:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch slides" 
      });
    }
  });

  // Get slide image
  app.get("/api/slides/:id/image", async (req: Request, res: Response) => {
    try {
      const slideId = req.params.id;
      const slide = await storage.getSlide(slideId);
      
      if (!slide || !slide.image) {
        return res.status(404).json({ message: "Slide image not found" });
      }
      
      // Get the raw binary data first
      const imageBuffer = Buffer.from(slide.image, "base64");
      
      // Detect content type based on signature
      let contentType = 'image/png'; // Default to PNG
      
      // First check for SVG (we know many of our images are SVG)
      if (slide.image.startsWith('PHN2Zy') || slide.image.startsWith('PD94bWw=')) {
        // Base64 encoding of "<svg" or "<?xml"
        const svgString = imageBuffer.toString('utf8');
        if (svgString.includes('<svg') || svgString.includes('<?xml')) {
          contentType = 'image/svg+xml';
          
          // Set SVG-specific headers for proper rendering
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          
          // If SVG contains foreignObject or namespaces for XHTML
          if (svgString.includes('<foreignObject') || svgString.includes('xmlns:xhtml')) {
            // Send with XML declaration for proper parsing
            if (!svgString.startsWith('<?xml')) {
              res.send('<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString);
            } else {
              res.send(svgString);
            }
          } else {
            // Regular SVG without XHTML content
            res.send(svgString);
          }
          return;
        }
      }
      
      // Check for binary image formats
      if (imageBuffer.length > 2) {
        if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
          // JPEG begins with FF D8
          contentType = 'image/jpeg';
        } else if (imageBuffer.length > 8 && 
                  imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && 
                  imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
          // PNG begins with 89 50 4E 47 (‰PNG)
          contentType = 'image/png';
        } else if (imageBuffer.length > 3 && 
                  imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49 && 
                  imageBuffer[2] === 0x46) {
          // GIF begins with GIF
          contentType = 'image/gif';
        }
      }
      
      // Send binary data with appropriate content type
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(imageBuffer);
    } catch (error) {
      console.error("Error fetching slide image:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch slide image" 
      });
    }
  });

  // Get annotations for a presentation
  app.get("/api/presentations/:id/annotations", async (req: Request, res: Response) => {
    try {
      const presentationId = req.params.id;
      const annotations = await storage.getAnnotations(presentationId);
      
      res.json(annotations);
    } catch (error) {
      console.error("Error fetching annotations:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch annotations" 
      });
    }
  });

  // Add or update annotations for a slide
  app.post("/api/slides/:id/annotations", async (req: Request, res: Response) => {
    try {
      const slideId = req.params.id;
      const tags = req.body;
      
      if (!Array.isArray(tags)) {
        return res.status(400).json({ message: "Invalid tags format. Expected an array of key-value pairs" });
      }
      
      // Save the annotations
      await storage.saveAnnotations(slideId, tags);
      
      res.json({ 
        message: "Annotations saved successfully", 
        slideId,
        tags 
      });
    } catch (error) {
      console.error("Error saving annotations:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to save annotations" 
      });
    }
  });

  // Submit all annotations for a presentation
  app.post("/api/presentations/:id/submit", async (req: Request, res: Response) => {
    try {
      const presentationId = req.params.id;
      
      // Mark the presentation as submitted
      await storage.submitPresentation(presentationId);
      
      res.json({ message: "Annotations submitted successfully" });
    } catch (error) {
      console.error("Error submitting annotations:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to submit annotations" 
      });
    }
  });

  // SQLite Data Access Endpoints
  
  // Get slides from SQLite database (input table)
  app.get("/api/sqlite/input/:presentationId", async (req: Request, res: Response) => {
    try {
      const presentationId = req.params.presentationId;
      const slides = await sqliteStorage.getSlides(presentationId);
      
      res.json({ 
        message: "SQLite input table data retrieved successfully",
        table: "input",
        count: slides.length,
        data: slides
      });
    } catch (error) {
      console.error("Error fetching SQLite input data:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch SQLite input data" 
      });
    }
  });
  
  // Get annotations from SQLite database (output table)
  app.get("/api/sqlite/output/:presentationId", async (req: Request, res: Response) => {
    try {
      const presentationId = req.params.presentationId;
      const annotations = await sqliteStorage.getAnnotations(presentationId);
      
      res.json({ 
        message: "SQLite output table data retrieved successfully",
        table: "output",
        count: annotations.length,
        data: annotations
      });
    } catch (error) {
      console.error("Error fetching SQLite output data:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch SQLite output data" 
      });
    }
  });

  return httpServer;
}
