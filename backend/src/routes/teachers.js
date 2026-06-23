const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/teachers - List all teachers (join with latest salary)
router.get('/', async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT t.*, ts.hourly_rate, ts.effective_date
       FROM tbl_teachers t
       LEFT JOIN tbl_teacher_salary ts ON t.teacher_id = ts.teacher_id
         AND ts.effective_date = (
           SELECT MAX(ts2.effective_date)
           FROM tbl_teacher_salary ts2
           WHERE ts2.teacher_id = t.teacher_id AND ts2.effective_date <= CURDATE()
         )
       ORDER BY t.last_name ASC, t.first_name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List teachers error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch teachers.' });
  }
});

// GET /api/teachers/:id - Get single teacher with salary info
router.get('/:id', async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT t.*, ts.hourly_rate, ts.effective_date
       FROM tbl_teachers t
       LEFT JOIN tbl_teacher_salary ts ON t.teacher_id = ts.teacher_id
         AND ts.effective_date = (
           SELECT MAX(ts2.effective_date)
           FROM tbl_teacher_salary ts2
           WHERE ts2.teacher_id = t.teacher_id AND ts2.effective_date <= CURDATE()
         )
       WHERE t.teacher_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get teacher error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch teacher.' });
  }
});

// POST /api/teachers - Create teacher
router.post('/', async (req, res) => {
  try {
    const { last_name, first_name, middle_name, role } = req.body;

    if (!last_name || !first_name) {
      return res.status(400).json({ success: false, message: 'Last name and first name are required.' });
    }

    const result = await db.query(
      'INSERT INTO tbl_teachers (last_name, first_name, middle_name, role) VALUES (?, ?, ?, ?)',
      [last_name, first_name, middle_name || null, role || 'Teacher']
    );

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully.',
      data: { teacher_id: result.insertId, last_name, first_name, middle_name, role: role || 'Teacher' }
    });
  } catch (err) {
    console.error('Create teacher error:', err);
    res.status(500).json({ success: false, message: 'Failed to create teacher.' });
  }
});

// PUT /api/teachers/:id - Update teacher
router.put('/:id', async (req, res) => {
  try {
    const { last_name, first_name, middle_name, role, status } = req.body;

    const result = await db.query(
      'UPDATE tbl_teachers SET last_name = COALESCE(?, last_name), first_name = COALESCE(?, first_name), middle_name = COALESCE(?, middle_name), role = COALESCE(?, role), status = COALESCE(?, status) WHERE teacher_id = ?',
      [last_name, first_name, middle_name, role, status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }

    res.json({ success: true, message: 'Teacher updated successfully.' });
  } catch (err) {
    console.error('Update teacher error:', err);
    res.status(500).json({ success: false, message: 'Failed to update teacher.' });
  }
});

// DELETE /api/teachers/:id - Delete teacher
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM tbl_teachers WHERE teacher_id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }
    res.json({ success: true, message: 'Teacher deleted successfully.' });
  } catch (err) {
    console.error('Delete teacher error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete teacher.' });
  }
});

// POST /api/teachers/:id/face - Upload face encoding
router.post('/:id/face', async (req, res) => {
  try {
    const { face_encoding } = req.body;
    if (!face_encoding) {
      return res.status(400).json({ success: false, message: 'Face encoding data is required.' });
    }

    const result = await db.query(
      'UPDATE tbl_teachers SET face_encoding = ? WHERE teacher_id = ?',
      [face_encoding, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }

    res.json({ success: true, message: 'Face encoding saved successfully.' });
  } catch (err) {
    console.error('Upload face error:', err);
    res.status(500).json({ success: false, message: 'Failed to save face encoding.' });
  }
});

// POST /api/teachers/:id/salary - Set hourly rate
router.post('/:id/salary', async (req, res) => {
  try {
    const { hourly_rate, effective_date } = req.body;

    if (!hourly_rate || !effective_date) {
      return res.status(400).json({ success: false, message: 'Hourly rate and effective date are required.' });
    }

    // Verify teacher exists
    const teachers = await db.query('SELECT teacher_id FROM tbl_teachers WHERE teacher_id = ?', [req.params.id]);
    if (teachers.length === 0) {
      return res.status(404).json({ success: false, message: 'Teacher not found.' });
    }

    const result = await db.query(
      'INSERT INTO tbl_teacher_salary (teacher_id, hourly_rate, effective_date) VALUES (?, ?, ?)',
      [req.params.id, hourly_rate, effective_date]
    );

    res.status(201).json({
      success: true,
      message: 'Salary rate set successfully.',
      data: { salary_id: result.insertId, teacher_id: parseInt(req.params.id), hourly_rate, effective_date }
    });
  } catch (err) {
    console.error('Set salary error:', err);
    res.status(500).json({ success: false, message: 'Failed to set salary rate.' });
  }
});

// GET /api/teachers/:id/timelogs - Get teacher's time logs
router.get('/:id/timelogs', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let sql = 'SELECT * FROM tbl_teacher_timelog WHERE teacher_id = ?';
    const params = [req.params.id];

    if (start_date) {
      sql += ' AND log_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND log_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY log_date DESC';
    const rows = await db.query(sql, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get timelogs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch timelogs.' });
  }
});

module.exports = router;
