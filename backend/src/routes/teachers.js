const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');
const compreface = require('../utils/compreface');

// All routes require authentication
router.use(authMiddleware);

// Auto-migrate: ensure salary & deduction columns exist
(async () => {
  try {
    // 1. Create table for dynamic deductions
    await db.query(`
      CREATE TABLE IF NOT EXISTS tbl_teacher_deductions (
        deduction_id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        deduction_type VARCHAR(50) NOT NULL,
        deduction_name VARCHAR(255) NULL,
        amount DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (teacher_id) REFERENCES tbl_teachers(teacher_id) ON DELETE CASCADE
      )
    `);
    
    // 2. Drop old unused static deduction columns
    const colsToDrop = [
      'deduction_sss', 'deduction_philhealth', 'deduction_pagibig', 
      'deduction_other_name', 'deduction_other_amount'
    ];
    for (const col of colsToDrop) {
      try {
        await db.query(`ALTER TABLE tbl_teachers DROP COLUMN ${col}`);
      } catch (e) {
        // Ignore errors if column already dropped
      }
    }
    console.log('✅ tbl_teacher_deductions ready');

    // 3. Add contact_no column if missing
    try {
      await db.query(`ALTER TABLE tbl_teachers ADD COLUMN contact_no VARCHAR(20) DEFAULT NULL`);
      console.log('✅ tbl_teachers.contact_no added');
    } catch (e) {
      // Column already exists
    }
  } catch (e) {
    console.error('Migration error:', e);
  }
})();

// GET /api/teachers - List all teachers (join with latest salary)
router.get('/', async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT t.*, COALESCE(t.hourly_rate, ts.hourly_rate) AS hourly_rate, ts.effective_date
       FROM tbl_teachers t
       LEFT JOIN tbl_teacher_salary ts ON t.teacher_id = ts.teacher_id
         AND ts.effective_date = (
           SELECT MAX(ts2.effective_date)
           FROM tbl_teacher_salary ts2
           WHERE ts2.teacher_id = t.teacher_id AND ts2.effective_date <= CURDATE()
         )
       ORDER BY t.last_name ASC, t.first_name ASC`
    );
    const deductions = await db.query('SELECT * FROM tbl_teacher_deductions');
    
    rows.forEach(t => {
      t.deductions = deductions.filter(d => d.teacher_id === t.teacher_id);
    });

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
      `SELECT t.*, COALESCE(t.hourly_rate, ts.hourly_rate) AS hourly_rate, ts.effective_date
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

    const teacher = rows[0];
    const deductions = await db.query('SELECT * FROM tbl_teacher_deductions WHERE teacher_id = ?', [req.params.id]);
    teacher.deductions = deductions;

    res.json({ success: true, data: teacher });
  } catch (err) {
    console.error('Get teacher error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch teacher.' });
  }
});

// POST /api/teachers - Create teacher
router.post('/', async (req, res) => {
  try {
    const { 
      last_name, first_name, middle_name, role, 
      hourly_rate, contact_no, deductions, face_encoding
    } = req.body;

    if (!last_name || !first_name) {
      return res.status(400).json({ success: false, message: 'Last name and first name are required.' });
    }

    const result = await db.query(
      `INSERT INTO tbl_teachers (
        last_name, first_name, middle_name, role, hourly_rate, contact_no, face_encoding
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        last_name, first_name, middle_name || null, role || 'Teacher', hourly_rate || null, contact_no || null, face_encoding || null
      ]
    );

    const teacherId = result.insertId;

    if (Array.isArray(deductions) && deductions.length > 0) {
      for (const d of deductions) {
        await db.query(
          `INSERT INTO tbl_teacher_deductions (teacher_id, deduction_type, deduction_name, amount) VALUES (?, ?, ?, ?)`,
          [teacherId, d.deduction_type, d.deduction_name || null, d.amount || 0]
        );
      }
    }

    // Register face with CompreFace if provided
    if (face_encoding) {
      const subjectId = `teacher_${teacherId}`;
      try {
        await compreface.addFace(subjectId, face_encoding);
        console.log(`✅ CompreFace: registered face for ${subjectId}`);
      } catch (cfErr) {
        console.error(`⚠️ CompreFace registration failed for ${subjectId}:`, cfErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully.',
      data: { teacher_id: teacherId, last_name, first_name, middle_name, role: role || 'Teacher' }
    });
  } catch (err) {
    console.error('Create teacher error:', err);
    res.status(500).json({ success: false, message: 'Failed to create teacher.' });
  }
});

// PUT /api/teachers/:id - Update teacher
router.put('/:id', async (req, res) => {
  try {
    const { 
      last_name, first_name, middle_name, role, status,
      hourly_rate, contact_no, deductions
    } = req.body;

    const fields = [];
    const values = [];

    if (last_name !== undefined) { fields.push('last_name = ?'); values.push(last_name); }
    if (first_name !== undefined) { fields.push('first_name = ?'); values.push(first_name); }
    if (middle_name !== undefined) { fields.push('middle_name = ?'); values.push(middle_name); }
    if (role !== undefined) { fields.push('role = ?'); values.push(role); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (hourly_rate !== undefined) { fields.push('hourly_rate = ?'); values.push(hourly_rate || null); }
    if (contact_no !== undefined) { fields.push('contact_no = ?'); values.push(contact_no || null); }

    if (fields.length > 0) {
      values.push(req.params.id);
      const result = await db.query(
        `UPDATE tbl_teachers SET ${fields.join(', ')} WHERE teacher_id = ?`,
        values
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'Teacher not found.' });
      }
    }

    // Replace all deductions
    if (deductions !== undefined) {
      await db.query(`DELETE FROM tbl_teacher_deductions WHERE teacher_id = ?`, [req.params.id]);
      if (Array.isArray(deductions) && deductions.length > 0) {
        for (const d of deductions) {
          await db.query(
            `INSERT INTO tbl_teacher_deductions (teacher_id, deduction_type, deduction_name, amount) VALUES (?, ?, ?, ?)`,
            [req.params.id, d.deduction_type, d.deduction_name || null, d.amount || 0]
          );
        }
      }
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
    // Remove face from CompreFace
    const subjectId = `teacher_${req.params.id}`;
    try {
      await compreface.deleteSubject(subjectId);
    } catch (cfErr) {
      console.error(`⚠️ CompreFace delete failed for ${subjectId}:`, cfErr.message);
    }

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

    // Re-register face with CompreFace
    const subjectId = `teacher_${req.params.id}`;
    try {
      await compreface.deleteAllFaces(subjectId);
      await compreface.addFace(subjectId, face_encoding);
      console.log(`✅ CompreFace: re-registered face for ${subjectId}`);
    } catch (cfErr) {
      console.error(`⚠️ CompreFace re-registration failed for ${subjectId}:`, cfErr.message);
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
