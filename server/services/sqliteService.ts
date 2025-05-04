import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Tag } from '../../shared/types';

// Ensure the database directory exists
const DB_DIR = path.join(process.cwd(), 'db');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize the SQLite database
const dbPath = path.join(DB_DIR, 'presentation_data.sqlite');
const db = new Database(dbPath);

// Initialize the database with our tables
function initDatabase() {
  // Create the input table (slide data)
  db.exec(`
    CREATE TABLE IF NOT EXISTS input (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presentation_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slide_id TEXT NOT NULL,
      slide_number INTEGER NOT NULL,
      image TEXT
    )
  `);

  // Create the output table (annotations)
  db.exec(`
    CREATE TABLE IF NOT EXISTS output (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presentation_id TEXT NOT NULL,
      slide_id TEXT NOT NULL,
      tags TEXT NOT NULL
    )
  `);

  console.log('SQLite database initialized with input and output tables');
}

// Insert a slide into the input table
function insertSlide(
  presentationId: string,
  name: string,
  slideId: string,
  slideNumber: number,
  image?: string
) {
  const stmt = db.prepare(`
    INSERT INTO input (presentation_id, name, slide_id, slide_number, image)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(presentationId, name, slideId, slideNumber, image || 'BLOB');
  return result.lastInsertRowid;
}

// Insert annotations into the output table
function insertAnnotations(
  presentationId: string,
  slideId: string,
  tags: Tag[]
) {
  // Convert tags array to JSON string
  const tagsJSON = JSON.stringify(tags);
  
  // Check if a record already exists for this slide
  const existing = db.prepare(`
    SELECT id FROM output
    WHERE presentation_id = ? AND slide_id = ?
  `).get(presentationId, slideId) as { id: number } | undefined;
  
  if (existing) {
    // Update existing record
    const stmt = db.prepare(`
      UPDATE output
      SET tags = ?
      WHERE presentation_id = ? AND slide_id = ?
    `);
    stmt.run(tagsJSON, presentationId, slideId);
    return existing.id;
  } else {
    // Insert new record
    const stmt = db.prepare(`
      INSERT INTO output (presentation_id, slide_id, tags)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(presentationId, slideId, tagsJSON);
    return result.lastInsertRowid;
  }
}

// Get all slides for a presentation from the input table
function getSlides(presentationId: string) {
  const stmt = db.prepare(`
    SELECT * FROM input
    WHERE presentation_id = ?
    ORDER BY slide_number ASC
  `);
  
  return stmt.all(presentationId);
}

// Get a single slide from the input table
function getSlide(slideId: string) {
  const stmt = db.prepare(`
    SELECT * FROM input
    WHERE slide_id = ?
  `);
  
  return stmt.get(slideId);
}

// Get all annotations for a presentation from the output table
function getAnnotations(presentationId: string) {
  const stmt = db.prepare(`
    SELECT slide_id, tags
    FROM output
    WHERE presentation_id = ?
  `);
  
  const results = stmt.all(presentationId);
  
  // Convert the JSON strings back to Tag arrays
  return results.map((row: any) => ({
    slideId: row.slide_id,
    tags: JSON.parse(row.tags) as Tag[]
  }));
}

// Get annotations for a specific slide
function getSlideAnnotations(slideId: string) {
  const stmt = db.prepare(`
    SELECT tags
    FROM output
    WHERE slide_id = ?
  `);
  
  const result = stmt.get(slideId) as { tags: string } | undefined;
  
  if (result && result.tags) {
    return JSON.parse(result.tags) as Tag[];
  }
  
  return [];
}

// Close the database connection when the app is shutting down
process.on('exit', () => {
  db.close();
});

// Initialize the database when this module is imported
initDatabase();

// Export the functions
export const sqliteStorage = {
  insertSlide,
  insertAnnotations,
  getSlides,
  getSlide,
  getAnnotations,
  getSlideAnnotations
};