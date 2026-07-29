const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/students - List all students
router.get('/', async (req, res) => {
  try {
    const { search, grade_level, section } = req.query;
    let sql = `
      SELECT s.*, p.guardian_name, p.contact_no 
      FROM tbl_students s
      LEFT JOIN tbl_parents p ON s.student_id = p.student_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.student_no LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (grade_level) {
      sql += ' AND s.grade_level = ?';
      params.push(grade_level);
    }
    if (section) {
      sql += ' AND s.section = ?';
      params.push(section);
    }

    sql += ' ORDER BY s.last_name ASC, s.first_name ASC';
    const rows = await db.query(sql, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List students error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch students.' });
  }
});

// GET /api/students/:id - Get single student
router.get('/:id', async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT s.*, p.guardian_name, p.contact_no 
       FROM tbl_students s
       LEFT JOIN tbl_parents p ON s.student_id = p.student_id
       WHERE s.student_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get student error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch student.' });
  }
});

// POST /api/students - Create student
router.post('/', async (req, res) => {
  try {
    const { student_no, last_name, first_name, middle_name, section, grade_level, face_encoding, face_descriptor, guardian_name, contact_no } = req.body;

    if (!student_no || !last_name || !first_name) {
      return res.status(400).json({ success: false, message: 'Student number, last name, and first name are required.' });
    }

    if (!guardian_name || !contact_no) {
      return res.status(400).json({ success: false, message: 'Parent/Guardian name and contact number are required.' });
    }

    if (!face_encoding) {
      return res.status(400).json({ success: false, message: 'Biometric face registration is required. Please complete face verification.' });
    }

    const result = await db.query(
      'INSERT INTO tbl_students (student_no, last_name, first_name, middle_name, section, grade_level, face_encoding, face_descriptor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [student_no, last_name, first_name, middle_name || null, section || null, grade_level || null, face_encoding || null, face_descriptor ? JSON.stringify(face_descriptor) : null]
    );

    const newStudentId = result.insertId;

    await db.query(
      'INSERT INTO tbl_parents (student_id, guardian_name, contact_no) VALUES (?, ?, ?)',
      [newStudentId, guardian_name, contact_no]
    );

    res.status(201).json({
      success: true,
      message: 'Student registered successfully.',
      data: { student_id: newStudentId, student_no, last_name, first_name, middle_name, section, grade_level, guardian_name, contact_no }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Student number already exists.' });
    }
    console.error('Create student error:', err);
    res.status(500).json({ success: false, message: 'Failed to create student.' });
  }
});

// PUT /api/students/:id - Update student
router.put('/:id', async (req, res) => {
  try {
    const { student_no, last_name, first_name, middle_name, section, grade_level, status, guardian_name, contact_no } = req.body;
    const studentId = req.params.id;

    const result = await db.query(
      'UPDATE tbl_students SET student_no = COALESCE(?, student_no), last_name = COALESCE(?, last_name), first_name = COALESCE(?, first_name), middle_name = COALESCE(?, middle_name), section = COALESCE(?, section), grade_level = COALESCE(?, grade_level), status = COALESCE(?, status) WHERE student_id = ?',
      [student_no, last_name, first_name, middle_name, section, grade_level, status, studentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    if (guardian_name !== undefined || contact_no !== undefined) {
      const existingParents = await db.query('SELECT parent_id FROM tbl_parents WHERE student_id = ?', [studentId]);
      if (existingParents.length > 0) {
        await db.query(
          'UPDATE tbl_parents SET guardian_name = COALESCE(?, guardian_name), contact_no = COALESCE(?, contact_no) WHERE student_id = ?',
          [guardian_name || null, contact_no || null, studentId]
        );
      } else if (guardian_name && contact_no) {
        await db.query(
          'INSERT INTO tbl_parents (student_id, guardian_name, contact_no) VALUES (?, ?, ?)',
          [studentId, guardian_name, contact_no]
        );
      }
    }

    res.json({ success: true, message: 'Student updated successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Student number already exists.' });
    }
    console.error('Update student error:', err);
    res.status(500).json({ success: false, message: 'Failed to update student.' });
  }
});

// DELETE /api/students/:id - Delete student
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM tbl_students WHERE student_id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete student.' });
  }
});

// POST /api/students/:id/face - Upload face encoding
router.post('/:id/face', async (req, res) => {
  try {
    const { face_encoding } = req.body;
    if (!face_encoding) {
      return res.status(400).json({ success: false, message: 'Face encoding data is required.' });
    }

    const result = await db.query(
      'UPDATE tbl_students SET face_encoding = ? WHERE student_id = ?',
      [face_encoding, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    res.json({ success: true, message: 'Face encoding saved successfully.' });
  } catch (err) {
    console.error('Upload face error:', err);
    res.status(500).json({ success: false, message: 'Failed to save face encoding.' });
  }
});

module.exports = router;
