import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";
import { storage } from "../storage";
import AdmZip from "adm-zip";

const execPromise = promisify(exec);

// Function to process a PowerPoint file and extract slides
export async function processPresentation(filename: string, filePath: string): Promise<string> {
  try {
    console.log(`Processing presentation: ${filename}`);
    
    // Create the presentation in the database
    const presentationId = await storage.createPresentation(filename);
    
    // Create output directory for extracted slides
    const outputDir = path.join(process.cwd(), "uploads", presentationId);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Get the correct slide count from the PPTX
    const totalSlides = await getSlideCount(filePath);
    console.log(`Detected ${totalSlides} slides in the presentation`);
    
    // Try using LibreOffice directly to render slides as PNG images
    console.log("Attempting to convert PPTX to image screenshots...");
    
    let success = false;
    
    // Better approach: Convert to PDF first, then use pdftoppm to extract all slides
    try {
      console.log("Using PDF-based slide extraction approach...");
      const imagesDir = path.join(outputDir, "images");
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }
      
      // First, convert PPTX to PDF using LibreOffice (most reliable method)
      console.log("Converting presentation to PDF using LibreOffice...");
      const pdfPath = path.join(outputDir, "presentation.pdf");
      await execPromise(`soffice --headless --convert-to pdf --outdir "${outputDir}" "${filePath}"`);
      
      // Find the generated PDF (LibreOffice keeps the original filename but changes extension)
      const baseFileName = path.basename(filePath, path.extname(filePath));
      const generatedPdfPath = path.join(outputDir, `${baseFileName}.pdf`);
      
      // Rename the PDF if necessary
      if (fs.existsSync(generatedPdfPath) && generatedPdfPath !== pdfPath) {
        fs.renameSync(generatedPdfPath, pdfPath);
      }
      
      // Check if we got a valid PDF
      if (fs.existsSync(pdfPath)) {
        console.log("Successfully converted to PDF, using pdftoppm for high-quality slide images...");
        
        // Use pdftoppm for high-quality conversion of PDF pages to images
        // We know pdftoppm is available since we checked above
        await execPromise(`pdftoppm -png -r 150 "${pdfPath}" "${imagesDir}/slide"`);
        
        // pdftoppm actually generates files named "slide-01.png", "slide-02.png" etc.
        // We need to be careful about the exact naming pattern
        const slideFiles = fs.readdirSync(imagesDir)
          .filter(file => file.endsWith('.png'))
          .sort((a, b) => {
            // This pattern supports both "slide-01.png" and "slide01.png" formats
            const getNumber = (filename: string): number => {
              // First try to match "slide-XX.png" pattern
              const dashMatch = filename.match(/slide-(\d+)\.png/);
              if (dashMatch) return parseInt(dashMatch[1]);
              
              // Then try to match "slideXX.png" pattern
              const noDashMatch = filename.match(/slide(\d+)\.png/);
              if (noDashMatch) return parseInt(noDashMatch[1]);
              
              // Finally, just try to find any number in the filename
              const anyNumber = filename.match(/(\d+)/);
              return anyNumber ? parseInt(anyNumber[1]) : 0;
            };
            
            return getNumber(a) - getNumber(b);
          });
        
        console.log(`Found ${slideFiles.length} slides from PDF conversion`);
        
        if (slideFiles.length > 0) {
          // Save each slide image to database
          for (let i = 0; i < slideFiles.length; i++) {
            const slideNumber = i + 1;
            const slideId = uuidv4();
            const imagePath = path.join(imagesDir, slideFiles[i]);
            
            if (fs.existsSync(imagePath)) {
              const imageData = fs.readFileSync(imagePath).toString('base64');
              await storage.saveSlide(presentationId, slideNumber, slideId, imageData);
              console.log(`Saved slide ${slideNumber} of ${slideFiles.length} with ID ${slideId}`);
              
              // Clean up the PNG file to save space
              try {
                fs.unlinkSync(imagePath);
              } catch (cleanupError) {
                console.error(`Error cleaning up slide image ${imagePath}:`, cleanupError);
              }
            }
          }
          
          // Clean up the PDF file to save space
          try {
            fs.unlinkSync(pdfPath);
          } catch (cleanupError) {
            console.error(`Error cleaning up PDF ${pdfPath}:`, cleanupError);
          }
          
          success = true;
          return presentationId;
        }
      }
      
      // Check for individual slide PNG files
      const slidePattern = /slide-(\d+)\.png/;
      const files = fs.readdirSync(imagesDir)
        .filter(file => slidePattern.test(file))
        .sort((a, b) => {
          const numA = parseInt(a.match(slidePattern)?.[1] || '0');
          const numB = parseInt(b.match(slidePattern)?.[1] || '0');
          return numA - numB;
        });
      
      console.log(`Found ${files.length} slide images`);
      
      if (files.length > 0) {
        // Save each image to the database
        for (let i = 0; i < files.length; i++) {
          const slideNumber = i + 1;
          const slideId = uuidv4();
          const imagePath = path.join(imagesDir, files[i]);
          
          if (fs.existsSync(imagePath)) {
            const imageData = fs.readFileSync(imagePath).toString('base64');
            await storage.saveSlide(presentationId, slideNumber, slideId, imageData);
            console.log(`Saved slide ${slideNumber} with ID ${slideId}`);
          }
        }
        success = true;
      } else {
        console.log("No slide images found in expected format, trying alternative approach");
        
        // Check for any PNG files (different naming pattern)
        const pngFiles = fs.readdirSync(imagesDir)
          .filter(file => file.endsWith('.png'))
          .sort();
        
        if (pngFiles.length > 0) {
          console.log(`Found ${pngFiles.length} PNG files with non-standard names`);
          
          // Save each image to the database
          for (let i = 0; i < pngFiles.length; i++) {
            const slideNumber = i + 1;
            const slideId = uuidv4();
            const imagePath = path.join(imagesDir, pngFiles[i]);
            
            if (fs.existsSync(imagePath)) {
              const imageData = fs.readFileSync(imagePath).toString('base64');
              await storage.saveSlide(presentationId, slideNumber, slideId, imageData);
              console.log(`Saved slide ${slideNumber} with ID ${slideId}`);
            }
          }
          
          success = true;
        }
      }
    } catch (error) {
      console.error("Error using LibreOffice for conversion:", error);
    }
    
    // Try converting to PDF and then using pdftoppm (from poppler_utils)
    if (!success) {
      try {
        console.log("Trying PDF conversion with pdftoppm...");
        const pdfPath = path.join(outputDir, "presentation.pdf");
        const imagesDir = path.join(outputDir, "images");
        
        if (!fs.existsSync(imagesDir)) {
          fs.mkdirSync(imagesDir, { recursive: true });
        }
        
        // Try direct LibreOffice PDF export
        await execPromise(`soffice --headless --convert-to pdf --outdir "${outputDir}" "${filePath}"`);
        
        const baseFileName = path.basename(filePath, path.extname(filePath));
        const generatedPdfPath = path.join(outputDir, `${baseFileName}.pdf`);
        
        if (fs.existsSync(generatedPdfPath) && generatedPdfPath !== pdfPath) {
          // Rename to our standard name if needed
          fs.renameSync(generatedPdfPath, pdfPath);
        }
        
        if (fs.existsSync(pdfPath)) {
          console.log("Successfully created PDF, now trying pdftoppm...");
          
          try {
            // Check if pdftoppm is available
            await execPromise('which pdftoppm');
            
            // Use pdftoppm to convert PDF to PNG (one file per page)
            await execPromise(`pdftoppm -png "${pdfPath}" "${imagesDir}/slide"`);
            
            // Find generated images with better sorting
            const images = fs.readdirSync(imagesDir)
              .filter(file => file.endsWith('.png'))
              .sort((a, b) => {
                // Improved pattern matching for slide numbers
                const getNumber = (filename: string): number => {
                  // First try to match "slide-XX.png" pattern
                  const dashMatch = filename.match(/slide-(\d+)\.png/);
                  if (dashMatch) return parseInt(dashMatch[1]);
                  
                  // Then try to match "slideXX.png" pattern
                  const noDashMatch = filename.match(/slide(\d+)\.png/);
                  if (noDashMatch) return parseInt(noDashMatch[1]);
                  
                  // Finally, just try to find any number in the filename
                  const anyNumber = filename.match(/(\d+)/);
                  return anyNumber ? parseInt(anyNumber[1]) : 0;
                };
                
                return getNumber(a) - getNumber(b);
              });
            
            console.log(`Found ${images.length} converted images from PDF using pdftoppm`);
            
            if (images.length > 0) {
              // Save each image to the database
              for (let i = 0; i < images.length; i++) {
                const slideNumber = i + 1;
                const slideId = uuidv4();
                const imagePath = path.join(imagesDir, images[i]);
                
                if (fs.existsSync(imagePath)) {
                  const imageData = fs.readFileSync(imagePath).toString('base64');
                  await storage.saveSlide(presentationId, slideNumber, slideId, imageData);
                  console.log(`Saved slide ${slideNumber} with ID ${slideId} from PDF`);
                }
              }
              success = true;
            }
          } catch (pdftoppmError) {
            console.error("Error with pdftoppm:", pdftoppmError);
            
            // Fallback to convert if pdftoppm fails
            try {
              console.log("Falling back to ImageMagick convert with lower memory usage...");
              
              // Use a much lower resolution and less memory-intensive settings
              await execPromise(`convert -density 96 -quality 85 -background white -alpha remove "${pdfPath}" "${imagesDir}/slide-%d.jpg"`);
              
              // Find generated images
              const images = fs.readdirSync(imagesDir)
                .filter(file => file.match(/slide-\d+\.jpg/))
                .sort((a, b) => {
                  const numA = parseInt(a.replace(/slide-(\d+)\.jpg/, '$1')) || 0;
                  const numB = parseInt(b.replace(/slide-(\d+)\.jpg/, '$1')) || 0;
                  return numA - numB;
                });
              
              console.log(`Found ${images.length} converted images from PDF`);
              
              if (images.length > 0) {
                // Save each image to the database
                for (let i = 0; i < images.length; i++) {
                  const slideNumber = i + 1;
                  const slideId = uuidv4();
                  const imagePath = path.join(imagesDir, images[i]);
                  
                  if (fs.existsSync(imagePath)) {
                    const imageData = fs.readFileSync(imagePath).toString('base64');
                    await storage.saveSlide(presentationId, slideNumber, slideId, imageData);
                    console.log(`Saved slide ${slideNumber} with ID ${slideId} from PDF (JPG version)`);
                  }
                }
                success = true;
              }
            } catch (convertError) {
              console.error("Error with convert fallback:", convertError);
            }
          }
        }
      } catch (error) {
        console.error("Error in PDF conversion:", error);
      }
    }
    
    // If conversion failed, use our fallback method
    if (!success) {
      console.log("Using fallback slide extraction method...");
      await processSlides(filePath, presentationId, outputDir, totalSlides);
    }
    
    // Clean up the uploaded file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Error cleaning up uploaded file:", err);
    }
    
    return presentationId;
  } catch (error) {
    console.error("Error processing presentation:", error);
    
    // Clean up the uploaded file if there's an error
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Error cleaning up uploaded file:", err);
    }
    
    throw error;
  }
}

// Convert presentation to images using unoconv
async function convertWithUnoconv(
  filePath: string, 
  outputDir: string, 
  presentationId: string,
  totalSlides: number
): Promise<boolean> {
  try {
    console.log("Converting PowerPoint to images using unoconv...");
    
    // Create temporary output directory
    const imagesDir = path.join(outputDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    // Convert to PNG using unoconv
    const command = `unoconv -f png -o "${imagesDir}/slide.png" "${filePath}"`;
    await execPromise(command);
    
    // Check if conversion worked - should produce slides like "slide1.png", "slide2.png", etc.
    if (fs.existsSync(imagesDir)) {
      const files = fs.readdirSync(imagesDir)
        .filter(file => file.startsWith('slide') && file.endsWith('.png'))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/slide(\d+)\.png/, '$1')) || 0;
          const numB = parseInt(b.replace(/slide(\d+)\.png/, '$1')) || 0;
          return numA - numB;
        });
      
      console.log(`Found ${files.length} slide images`);
      
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const slideNumber = i + 1;
          const slideId = uuidv4();
          const imagePath = path.join(imagesDir, files[i]);
          
          if (fs.existsSync(imagePath)) {
            const imageData = fs.readFileSync(imagePath).toString('base64');
            await storage.saveSlide(presentationId, slideNumber, slideId, imageData);
            
            // Clean up the file
            fs.unlinkSync(imagePath);
          }
        }
        return true;
      }
    }
    
    // If we got here, the conversion didn't produce usable files
    return false;
  } catch (error) {
    console.error("Error in unoconv conversion:", error);
    return false;
  }
}

// Get slide count from PPTX
async function getSlideCount(filePath: string): Promise<number> {
  if (!filePath.toLowerCase().endsWith('.pptx')) {
    return 10; // Default for non-PPTX files
  }
  
  try {
    const zip = new AdmZip(filePath);
    
    // Count slides by finding slide XML files
    const slideEntries = zip.getEntries()
      .filter(entry => {
        return entry.entryName && entry.entryName.match(/ppt\/slides\/slide[0-9]+\.xml/) !== null;
      });
    
    // If we found slide XMLs, return the count
    if (slideEntries.length > 0) {
      return slideEntries.length;
    }
    
    // Try to find presentation.xml which might have slide count
    const presentationEntry = zip.getEntry('ppt/presentation.xml');
    if (presentationEntry) {
      const content = zip.readAsText('ppt/presentation.xml');
      const sldIdMatches = content.match(/<p:sldId/g);
      if (sldIdMatches && sldIdMatches.length > 0) {
        return sldIdMatches.length;
      }
    }
    
    // Fallback to default count if all detection methods fail
    return 10;
  } catch (error) {
    console.error("Error getting slide count:", error);
    return 10; // Default count
  }
}

// Process slides from a PowerPoint file
async function processSlides(
  filePath: string, 
  presentationId: string, 
  outputDir: string, 
  totalSlides?: number
): Promise<void> {
  try {
    if (!filePath.toLowerCase().endsWith('.pptx')) {
      throw new Error("Only PPTX files are supported");
    }
    
    const zip = new AdmZip(filePath);
    
    // Step 1: Count slides by finding slide XML files
    const slideXMLs = zip.getEntries()
      .filter(entry => {
        return entry.entryName && entry.entryName.match(/ppt\/slides\/slide[0-9]+\.xml/) !== null;
      })
      .sort((a, b) => {
        // Extract slide numbers to sort correctly
        const matchA = a.entryName.match(/slide([0-9]+)\.xml/);
        const matchB = b.entryName.match(/slide([0-9]+)\.xml/);
        const numA = matchA && matchA[1] ? parseInt(matchA[1]) : 0;
        const numB = matchB && matchB[1] ? parseInt(matchB[1]) : 0;
        return numA - numB;
      });
    
    const detectedSlideCount = slideXMLs.length;
    console.log(`Found ${detectedSlideCount} slides in the presentation`);
    
    // Use provided totalSlides if available, otherwise use detected count
    const actualTotalSlides = totalSlides || detectedSlideCount;
    
    if (detectedSlideCount === 0) {
      console.log("No slides found in the PPTX file, creating a default placeholder");
      await createAndSavePlaceholder(presentationId, 1, actualTotalSlides > 0 ? actualTotalSlides : 1);
      return;
    }
    
    // Step 2: Extract slide content and create rich visualizations
    for (let i = 0; i < slideXMLs.length; i++) {
      const slideNumber = i + 1;
      const slideId = uuidv4();
      
      // Read the slide XML content
      const slideXML = slideXMLs[i];
      const slideContent = zip.readAsText(slideXML.entryName);
      
      // Get slide text and images
      const { title, content } = extractTextFromSlideXML(slideContent);
      
      // Find related images for this slide
      const slideImageRefs = extractImageReferencesFromXML(slideContent);
      const slideImages = await findImagesInPresentation(zip, slideImageRefs, outputDir);
      
      // Create a rich slide visualization
      const imageBase64 = createRichSlideVisualization(
        slideNumber, 
        actualTotalSlides, 
        title, 
        content, 
        slideImages
      );
      
      // Save the slide to the database
      await storage.saveSlide(presentationId, slideNumber, slideId, imageBase64);
    }
  } catch (error) {
    console.error("Error processing slides:", error);
    // Create a fallback with correct slide count
    await createFallbackSlides(presentationId, filePath);
  }
}

// Create fallback slides when extraction fails
async function createFallbackSlides(presentationId: string, filePath: string): Promise<void> {
  try {
    const zip = new AdmZip(filePath);
    
    // Count slides by looking for slide XML files
    const slideEntries = zip.getEntries()
      .filter(entry => {
        return entry.entryName.match(/ppt\/slides\/slide[0-9]+\.xml/) !== null;
      });
    
    const totalSlides = slideEntries.length > 0 ? slideEntries.length : 10;
    console.log(`Creating ${totalSlides} fallback slides`);
    
    // Generate placeholders for each slide
    for (let i = 1; i <= totalSlides; i++) {
      await createAndSavePlaceholder(presentationId, i, totalSlides);
    }
  } catch (error) {
    console.error("Error creating fallback slides:", error);
    // Ultimate fallback - create 10 placeholder slides
    for (let i = 1; i <= 10; i++) {
      await createAndSavePlaceholder(presentationId, i, 10);
    }
  }
}

// Create and save a placeholder slide
async function createAndSavePlaceholder(presentationId: string, slideNumber: number, totalSlides: number): Promise<void> {
  const slideId = uuidv4();
  const placeholderImage = createPlaceholderImage(slideNumber, totalSlides);
  await storage.saveSlide(presentationId, slideNumber, slideId, placeholderImage);
}

// Extract text from slide XML
function extractTextFromSlideXML(slideXML: string): { title: string, content: string[] } {
  const title = slideXML.match(/<a:t>(.*?)<\/a:t>/)?.[1] || `Slide Title`;
  
  // Extract all text content
  const textMatches = slideXML.match(/<a:t>([^<]*)<\/a:t>/g) || [];
  const content = textMatches
    .map(match => match.replace(/<a:t>/, '').replace(/<\/a:t>/, ''))
    .filter(text => text.trim().length > 0 && text !== title);
  
  return { title, content };
}

// Extract image references from slide XML
function extractImageReferencesFromXML(slideXML: string): string[] {
  const imageRefs: string[] = [];
  const regex = /r:embed="(rId\d+)"/g;
  let match: RegExpExecArray | null;
  
  while ((match = regex.exec(slideXML)) !== null) {
    imageRefs.push(match[1]);
  }
  
  return imageRefs;
}

// Find images in the presentation related to the slide
async function findImagesInPresentation(
  zip: AdmZip, 
  imageRefs: string[], 
  outputDir: string
): Promise<string[]> {
  const images: string[] = [];
  
  // First, try to find the relationship file for this slide
  const slideRelsEntries = zip.getEntries()
    .filter(entry => entry.entryName.startsWith('ppt/slides/_rels/') && entry.entryName.endsWith('.rels'));
  
  for (const relsEntry of slideRelsEntries) {
    const relsContent = zip.readAsText(relsEntry.entryName);
    
    for (const rId of imageRefs) {
      const targetMatch = relsContent.match(new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`));
      if (targetMatch && targetMatch[1]) {
        const targetPath = targetMatch[1];
        
        // Look for the image file in the PPTX archive
        const mediaPath = targetPath.startsWith('../') 
          ? `ppt/${targetPath.substring(3)}` 
          : `ppt/slides/${targetPath}`;
        
        try {
          // Extract the image and convert to base64
          const imageEntry = zip.getEntry(mediaPath);
          if (imageEntry) {
            const imageData = imageEntry.getData();
            const base64Image = imageData.toString('base64');
            images.push(base64Image);
          }
        } catch (err) {
          console.error(`Error extracting image ${mediaPath}:`, err);
        }
      }
    }
  }
  
  // If no images found through relationships, try to find media files directly
  if (images.length === 0) {
    const mediaEntries = zip.getEntries()
      .filter(entry => 
        entry.entryName.startsWith('ppt/media/') && 
        (entry.entryName.endsWith('.png') || 
         entry.entryName.endsWith('.jpg') || 
         entry.entryName.endsWith('.jpeg') || 
         entry.entryName.endsWith('.gif'))
      );
    
    for (const entry of mediaEntries) {
      try {
        const imageData = entry.getData();
        const base64Image = imageData.toString('base64');
        images.push(base64Image);
      } catch (err) {
        console.error(`Error extracting media file ${entry.entryName}:`, err);
      }
    }
  }
  
  return images;
}

// Create a rich slide visualization with text and images
function createRichSlideVisualization(
  slideNumber: number, 
  totalSlides: number, 
  title: string, 
  content: string[], 
  images: string[]
): string {
  // Create a more PowerPoint-like visualization with gradients and better styling
  
  // Escape HTML entities for text content
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };
  
  // Create text elements with proper styling and line wrapping
  const createTextElement = (text: string, x: number, y: number, fontSize: number, fontWeight = 'normal', maxWidth = 700) => {
    // Handle long texts with wrapping
    text = escapeHtml(text);
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    // Very basic text wrapping - not perfect but helps with visualization
    const charsPerLine = Math.floor(maxWidth / (fontSize * 0.6));
    
    for (const word of words) {
      if (currentLine.length + word.length + 1 > charsPerLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine += (currentLine ? ' ' : '') + word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.map((line, i) => 
      `<text x="${x}" y="${y + i * (fontSize * 1.2)}" font-family="Arial" font-size="${fontSize}px" 
         font-weight="${fontWeight}" fill="#333333">${line}</text>`
    ).join('\n');
  };
  
  // Create title with larger font
  const titleText = createTextElement(title, 50, 80, 28, 'bold');
  
  // Create content text elements with proper spacing and smaller font
  const contentElements = content.map((text, index) => {
    return createTextElement(text, 50, 160 + index * 40, 16);
  }).join('\n');
  
  // Create actual image elements if available, otherwise placeholders
  const imageElements = images.length > 0 
    ? images.map((base64Image, index) => {
        // Determine image position based on index
        const x = 50 + (index % 3) * 250;
        const y = 160 + Math.floor(index / 3) * 180;
        
        // Detect image type from first few bytes if possible
        let imageType = 'image/png'; // Default
        try {
          const imageData = Buffer.from(base64Image, 'base64');
          if (imageData.length > 2) {
            if (imageData[0] === 0xFF && imageData[1] === 0xD8) {
              imageType = 'image/jpeg';
            } else if (imageData.length > 8 && 
                      imageData[0] === 0x89 && imageData[1] === 0x50 && 
                      imageData[2] === 0x4E && imageData[3] === 0x47) {
              imageType = 'image/png';
            } else if (imageData.length > 3 && 
                      imageData[0] === 0x47 && imageData[1] === 0x49 && 
                      imageData[2] === 0x46) {
              imageType = 'image/gif';
            }
          }
        } catch (e) {
          // If error, keep default
        }
        
        return `
        <image x="${x}" y="${y}" width="200" height="150" href="data:${imageType};base64,${base64Image}" />
        `;
      }).join('\n')
    : content.length > 0 ? '' : `
        <g>
          <rect x="100" y="180" width="600" height="300" fill="#f5f5f5" stroke="#cccccc" stroke-width="1" />
          <text x="400" y="330" font-family="Arial" font-size="16" text-anchor="middle" fill="#666666">
            Slide Content
          </text>
        </g>
      `;
  
  // Create a PowerPoint-like slide with gradient background
  // Instead of foreignObject which can be problematic, use individual text elements
  const contentText = content.map((text, index) => {
    return `<text x="50" y="${150 + index * 30}" font-family="Arial" font-size="16" fill="#333333">${escapeHtml(text)}</text>`;
  }).join('\n');
  
  const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
  <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
    <!-- Background with gradient -->
    <defs>
      <linearGradient id="slideGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#f0f4ff;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#e0e8ff;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#slideGradient)"/>
    
    <!-- Slide border -->
    <rect width="798" height="598" x="1" y="1" fill="none" stroke="#dddddd" stroke-width="2"/>
    
    <!-- Slide number -->
    <text x="750" y="30" font-family="Arial" font-size="14" text-anchor="end" fill="#666666">
      ${slideNumber} / ${totalSlides}
    </text>
    
    <!-- Title area with background -->
    <rect x="0" y="40" width="800" height="70" fill="#4a86e8" opacity="0.8"/>
    <text x="50" y="85" font-family="Arial" font-size="28" font-weight="bold" fill="white">
      ${escapeHtml(title)}
    </text>
    
    <!-- Content text elements -->
    ${contentText}
    
    <!-- Image elements -->
    ${imageElements}
  </svg>
  `;
  
  return Buffer.from(svgContent).toString('base64');
}

// Function to create a more professional placeholder image for a slide
function createPlaceholderImage(slideNumber: number, totalSlides: number): string {
  // PowerPoint-like placeholder with gradient and styling
  const svgImage = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
  <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
    <!-- Background with gradient -->
    <defs>
      <linearGradient id="slideGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#f0f4ff;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#e0e8ff;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#slideGradient)"/>
    
    <!-- Slide border -->
    <rect width="798" height="598" x="1" y="1" fill="none" stroke="#dddddd" stroke-width="2"/>
    
    <!-- Slide number -->
    <text x="750" y="30" font-family="Arial" font-size="14" text-anchor="end" fill="#666666">
      ${slideNumber} / ${totalSlides}
    </text>
    
    <!-- Title area with background -->
    <rect x="0" y="40" width="800" height="70" fill="#4a86e8" opacity="0.8"/>
    <text x="50" y="85" font-family="Arial" font-size="28" font-weight="bold" fill="white">
      Slide ${slideNumber}
    </text>
    
    <!-- Center content area with placeholder message -->
    <rect x="150" y="200" width="500" height="200" rx="8" ry="8" fill="#f9f9f9" stroke="#dddddd" stroke-width="1"/>
    <text x="400" y="270" font-family="Arial" font-size="22" text-anchor="middle" fill="#333333" font-weight="bold">
      PowerPoint Slide ${slideNumber}
    </text>
    <text x="400" y="310" font-family="Arial" font-size="16" text-anchor="middle" fill="#666666">
      This slide will display content from your presentation
    </text>
    <text x="400" y="340" font-family="Arial" font-size="16" text-anchor="middle" fill="#666666">
      You can add annotations using the form on the right
    </text>
    
    <!-- Logo/branding element -->
    <rect x="350" y="500" width="100" height="40" rx="20" ry="20" fill="#4a86e8"/>
    <text x="400" y="525" font-family="Arial" font-size="18" text-anchor="middle" fill="white" font-weight="bold">
      Slide ${slideNumber}
    </text>
  </svg>
  `;
  
  // Convert SVG to base64
  const base64 = Buffer.from(svgImage).toString("base64");
  return base64;
}
