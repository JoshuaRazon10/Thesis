const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');
const compreface = require('../utils/compreface');

// All routes require authentication
router.use(authMiddleware);

// Auto-migrate: ensure face columns exist
(async () => {
  try {
    await db.query(`ALTER TABLE tbl_parents ADD COLUMN IF NOT EXISTS face_encoding LONGTEXT NULL`);
    console.log('✅ tbl_parents face columns ready');
  } catch (e) {
    // Columns may already exist — ignore
    if (!e.message.includes('Duplicate column')) console.warn('Parent face migration note:', e.message);
  }
})();

// GET /api/parents - List all parents (with student info joined)
router.get('/', async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT p.*, s.student_no, s.first_name AS student_first_name, s.last_name AS student_last_name, s.grade_level, s.section
       FROM tbl_parents p
       LEFT JOIN tbl_students s ON p.student_id = s.student_id
       ORDER BY p.guardian_name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List parents error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch parents.' });
  }
});

// GET /api/parents/:id - Get single parent
router.get('/:id', async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT p.*, s.student_no, s.first_name AS student_first_name, s.last_name AS student_last_name, s.grade_level, s.section
       FROM tbl_parents p
       LEFT JOIN tbl_students s ON p.student_id = s.student_id
       WHERE p.parent_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Parent not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get parent error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch parent.' });
  }
});

// POST /api/parents - Create parent
router.post('/', async (req, res) => {
  try {
    const { student_id, guardian_name, contact_no, face_encoding } = req.body;

    if (!student_id || !guardian_name || !contact_no) {
      return res.status(400).json({ success: false, message: 'Student ID, guardian name, and contact number are required.' });
    }

    // Verify student exists
    const students = await db.query('SELECT student_id FROM tbl_students WHERE student_id = ?', [student_id]);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const result = await db.query(
      'INSERT INTO tbl_parents (student_id, guardian_name, contact_no, face_encoding) VALUES (?, ?, ?, ?)',
      [student_id, guardian_name, contact_no, face_encoding || null]
    );
    const parentId = result.insertId;

    // Register face with CompreFace if provided
    if (face_encoding) {
      const subjectId = `parent_${parentId}`;
      try {
        await compreface.addFace(subjectId, face_encoding);
        console.log(`✅ CompreFace: registered face for ${subjectId}`);
      } catch (cfErr) {
        console.error(`⚠️ CompreFace registration failed for ${subjectId}:`, cfErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Parent/guardian created successfully.',
      data: { parent_id: parentId, student_id, guardian_name, contact_no }
    });
  } catch (err) {
    console.error('Create parent error:', err);
    res.status(500).json({ success: false, message: 'Failed to create parent.' });
  }
});

// PUT /api/parents/:id - Update parent
router.put('/:id', async (req, res) => {
  try {
    const { student_id, guardian_name, contact_no, face_encoding } = req.body;

    // Build dynamic update
    const fields = [];
    const values = [];

    if (student_id !== undefined) { fields.push('student_id = ?'); values.push(student_id); }
    if (guardian_name !== undefined) { fields.push('guardian_name = ?'); values.push(guardian_name); }
    if (contact_no !== undefined) { fields.push('contact_no = ?'); values.push(contact_no); }
    if (face_encoding !== undefined) { fields.push('face_encoding = ?'); values.push(face_encoding || null); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE tbl_parents SET ${fields.join(', ')} WHERE parent_id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Parent not found.' });
    }

    // If face was updated, re-register in CompreFace
    if (face_encoding) {
      const subjectId = `parent_${req.params.id}`;
      try {
        await compreface.deleteAllFaces(subjectId);
        await compreface.addFace(subjectId, face_encoding);
        console.log(`✅ CompreFace: re-registered face for ${subjectId}`);
      } catch (cfErr) {
        console.error(`⚠️ CompreFace re-registration failed for ${subjectId}:`, cfErr.message);
      }
    }

    res.json({ success: true, message: 'Parent/guardian updated successfully.' });
  } catch (err) {
    console.error('Update parent error:', err);
    res.status(500).json({ success: false, message: 'Failed to update parent.' });
  }
});

// DELETE /api/parents/:id - Delete parent
router.delete('/:id', async (req, res) => {
  try {
    // Remove face from CompreFace
    const subjectId = `parent_${req.params.id}`;
    try {
      await compreface.deleteSubject(subjectId);
    } catch (cfErr) {
      console.error(`⚠️ CompreFace delete failed for ${subjectId}:`, cfErr.message);
    }

    const result = await db.query('DELETE FROM tbl_parents WHERE parent_id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Parent not found.' });
    }
    res.json({ success: true, message: 'Parent/guardian deleted successfully.' });
  } catch (err) {
    console.error('Delete parent error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete parent.' });
  }
});

module.exports = router;
