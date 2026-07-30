const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');
const compreface = require('../utils/compreface');

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/face/recognize
 * 
 * Accepts a base64 face image from the scanner,
 * sends it to CompreFace for recognition, and returns
 * the matched person with their details from MySQL.
 * 
 * Body: { image: "data:image/jpeg;base64,..." }
 * 
 * Response: {
 *   success: true,
 *   match: {
 *     type: "student" | "teacher" | "guard" | "parent",
 *     id: 42,
 *     name: "Juan Dela Cruz",
 *     student_no: "CHCC-2026-0001",
 *     grade_level: "Grade 7",
 *     section: "A",
 *     similarity: 0.985,
 *     face_encoding: "data:image/jpeg;base64,..."
 *   }
 * }
 */
router.post('/recognize', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Image data is required.' });
    }

    // Send to CompreFace for recognition
    const result = await compreface.recognize(image, { limit: 3 });

    if (!result.result || result.result.length === 0) {
      return res.json({ success: true, match: null, message: 'No face detected in image.' });
    }

    const faceResult = result.result[0];
    
    if (!faceResult.subjects || faceResult.subjects.length === 0) {
      return res.json({ 
        success: true, 
        match: null, 
        box: faceResult.box,
        message: 'Face detected but not recognized.' 
      });
    }

    // Get the best match
    const bestMatch = faceResult.subjects[0];
    const similarity = bestMatch.similarity;
    const subjectId = bestMatch.subject; // e.g. "student_42"

    // Minimum similarity threshold — 0.90 = 90% confidence
    const SIMILARITY_THRESHOLD = 0.90;
    if (similarity < SIMILARITY_THRESHOLD) {
      return res.json({ 
        success: true, 
        match: null, 
        box: faceResult.box,
        similarity,
        message: `Face detected but similarity too low (${(similarity * 100).toFixed(1)}%).` 
      });
    }

    // Parse subject ID to get type and database ID
    // Format: "student_42", "teacher_5", "guard_3", "parent_10"
    const parts = subjectId.split('_');
    if (parts.length < 2) {
      return res.json({ 
        success: true, 
        match: null, 
        message: 'Invalid subject ID format.' 
      });
    }

    const personType = parts[0]; // student, teacher, guard, parent
    const personId = parseInt(parts.slice(1).join('_'), 10);

    if (isNaN(personId)) {
      return res.json({ success: true, match: null, message: 'Invalid person ID.' });
    }

    // Look up the person details from MySQL
    let person = null;
    let matchData = null;

    if (personType === 'student') {
      const rows = await db.query(
        `SELECT s.student_id, s.student_no, s.first_name, s.last_name, s.grade_level, s.section, s.face_encoding
         FROM tbl_students s WHERE s.student_id = ?`,
        [personId]
      );
      if (rows.length > 0) {
        person = rows[0];
        matchData = {
          type: 'student',
          id: person.student_id,
          name: `${person.first_name} ${person.last_name}`,
          student_no: person.student_no,
          grade_level: person.grade_level,
          section: person.section,
          similarity,
          face_encoding: person.face_encoding || null,
          box: faceResult.box,
        };
      }
    } else if (personType === 'teacher') {
      const rows = await db.query(
        'SELECT teacher_id, first_name, last_name, role, face_encoding FROM tbl_teachers WHERE teacher_id = ?',
        [personId]
      );
      if (rows.length > 0) {
        person = rows[0];
        matchData = {
          type: 'teacher',
          id: person.teacher_id,
          name: `${person.first_name} ${person.last_name}`,
          role: person.role,
          similarity,
          face_encoding: person.face_encoding || null,
          box: faceResult.box,
        };
      }
    } else if (personType === 'guard') {
      const rows = await db.query(
        'SELECT guard_id, guard_no, full_name, face_encoding FROM tbl_guards WHERE guard_id = ?',
        [personId]
      );
      if (rows.length > 0) {
        person = rows[0];
        matchData = {
          type: 'guard',
          id: person.guard_id,
          name: person.full_name,
          guard_no: person.guard_no,
          similarity,
          face_encoding: person.face_encoding || null,
          box: faceResult.box,
        };
      }
    } else if (personType === 'parent') {
      const rows = await db.query(
        'SELECT parent_id, guardian_name, face_encoding FROM tbl_parents WHERE parent_id = ?',
        [personId]
      );
      if (rows.length > 0) {
        person = rows[0];
        matchData = {
          type: 'parent',
          id: person.parent_id,
          name: person.guardian_name,
          similarity,
          face_encoding: person.face_encoding || null,
          box: faceResult.box,
        };
      }
    }

    if (!matchData) {
      return res.json({ 
        success: true, 
        match: null, 
        message: `Recognized as ${subjectId} but person not found in database.` 
      });
    }

    // Return all top matches for debug display
    const allMatches = faceResult.subjects.map(s => ({
      subject: s.subject,
      similarity: s.similarity,
    }));

    res.json({ 
      success: true, 
      match: matchData,
      allMatches,
    });

  } catch (err) {
    console.error('Face recognize error:', err);
    
    // Provide helpful error messages
    if (err.message && err.message.includes('ECONNREFUSED')) {
      return res.status(503).json({ 
        success: false, 
        message: 'CompreFace is not running. Please start Docker and run: docker compose -f compreface/docker-compose.yml up -d' 
      });
    }
    
    res.status(500).json({ success: false, message: 'Face recognition failed: ' + err.message });
  }
});

/**
 * GET /api/face/health
 * Check if CompreFace is running
 */
router.get('/health', async (req, res) => {
  const ok = await compreface.healthCheck();
  res.json({ 
    success: true, 
    compreface_running: ok,
    compreface_url: process.env.COMPREFACE_URL || 'http://localhost:8000',
  });
});

module.exports = router;
