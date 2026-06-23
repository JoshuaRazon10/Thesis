const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

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
    const { student_id, guardian_name, contact_no } = req.body;

    if (!student_id || !guardian_name || !contact_no) {
      return res.status(400).json({ success: false, message: 'Student ID, guardian name, and contact number are required.' });
    }

    // Verify student exists
    const students = await db.query('SELECT student_id FROM tbl_students WHERE student_id = ?', [student_id]);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const result = await db.query(
      'INSERT INTO tbl_parents (student_id, guardian_name, contact_no) VALUES (?, ?, ?)',
      [student_id, guardian_name, contact_no]
    );

    res.status(201).json({
      success: true,
      message: 'Parent/guardian created successfully.',
      data: { parent_id: result.insertId, student_id, guardian_name, contact_no }
    });
  } catch (err) {
    console.error('Create parent error:', err);
    res.status(500).json({ success: false, message: 'Failed to create parent.' });
  }
});

// PUT /api/parents/:id - Update parent
router.put('/:id', async (req, res) => {
  try {
    const { student_id, guardian_name, contact_no } = req.body;

    const result = await db.query(
      'UPDATE tbl_parents SET student_id = COALESCE(?, student_id), guardian_name = COALESCE(?, guardian_name), contact_no = COALESCE(?, contact_no) WHERE parent_id = ?',
      [student_id, guardian_name, contact_no, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Parent not found.' });
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
