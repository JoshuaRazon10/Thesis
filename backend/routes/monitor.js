const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/monitor/students-inside
// Returns students currently on campus (arrived today, haven't departed yet)
router.get('/students-inside', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.student_id,
        CONCAT(s.first_name, ' ', s.last_name) AS full_name,
        s.section,
        s.grade_level,
        a.arrival_time
      FROM tbl_attendance_logs a
      JOIN tbl_students s ON a.student_id = s.student_id
      WHERE a.date_recorded = CURDATE()
        AND a.departure_time IS NULL
        AND a.log_type = 'student'
      ORDER BY s.grade_level ASC, s.last_name ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching students inside:', error);
    res.status(500).json({ error: 'Failed to fetch students currently inside campus.' });
  }
});

// GET /api/monitor/teachers-inside
// Returns teachers currently on campus (arrived today, haven't departed yet)
router.get('/teachers-inside', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        t.teacher_id,
        CONCAT(t.first_name, ' ', t.last_name) AS full_name,
        t.subject,
        a.arrival_time
      FROM tbl_attendance_logs a
      JOIN tbl_teachers t ON a.teacher_id = t.teacher_id
      WHERE a.date_recorded = CURDATE()
        AND a.departure_time IS NULL
        AND a.log_type = 'teacher'
      ORDER BY t.last_name ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching teachers inside:', error);
    res.status(500).json({ error: 'Failed to fetch teachers currently inside campus.' });
  }
});

// GET /api/monitor/summary
// Returns a summary of who is currently on campus
router.get('/summary', async (req, res) => {
  try {
    const [studentRows] = await pool.query(`
      SELECT COUNT(*) AS studentsInside
      FROM tbl_attendance_logs
      WHERE date_recorded = CURDATE()
        AND departure_time IS NULL
        AND log_type = 'student'
    `);

    const [teacherRows] = await pool.query(`
      SELECT COUNT(*) AS teachersInside
      FROM tbl_attendance_logs
      WHERE date_recorded = CURDATE()
        AND departure_time IS NULL
        AND log_type = 'teacher'
    `);

    const [gradeLevelRows] = await pool.query(`
      SELECT COUNT(DISTINCT s.grade_level) AS gradeLevels
      FROM tbl_attendance_logs a
      JOIN tbl_students s ON a.student_id = s.student_id
      WHERE a.date_recorded = CURDATE()
        AND a.departure_time IS NULL
        AND a.log_type = 'student'
    `);

    const studentsInside = studentRows[0].studentsInside;
    const teachersInside = teacherRows[0].teachersInside;
    const gradeLevels = gradeLevelRows[0].gradeLevels;

    res.json({
      studentsInside,
      teachersInside,
      gradeLevels,
      totalOnCampus: studentsInside + teachersInside,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch campus summary.' });
  }
});

module.exports = router;
