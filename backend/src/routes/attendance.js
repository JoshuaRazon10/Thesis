const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/attendance - List attendance records (with filters)
router.get('/', async (req, res) => {
  try {
    const { date, grade_level, section, student_id } = req.query;
    let sql = `SELECT ar.*, s.student_no, s.first_name, s.last_name, s.grade_level, s.section
               FROM tbl_attendance_records ar
               JOIN tbl_students s ON ar.student_id = s.student_id
               WHERE 1=1`;
    const params = [];

    if (date) {
      sql += ' AND ar.attendance_date = ?';
      params.push(date);
    }
    if (grade_level) {
      sql += ' AND s.grade_level = ?';
      params.push(grade_level);
    }
    if (section) {
      sql += ' AND s.section = ?';
      params.push(section);
    }
    if (student_id) {
      sql += ' AND ar.student_id = ?';
      params.push(student_id);
    }

    sql += ' ORDER BY ar.attendance_date DESC, s.last_name ASC';
    const rows = await db.query(sql, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List attendance error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance records.' });
  }
});

// GET /api/attendance/today/summary - Today's summary
router.get('/today/summary', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Student attendance counts
    const presentRows = await db.query(
      "SELECT COUNT(*) AS count FROM tbl_attendance_records WHERE attendance_date = ? AND status IN ('present', 'late')",
      [today]
    );
    const absentRows = await db.query(
      "SELECT COUNT(*) AS count FROM tbl_attendance_records WHERE attendance_date = ? AND status = 'absent'",
      [today]
    );
    const totalStudents = await db.query("SELECT COUNT(*) AS count FROM tbl_students WHERE status = 'active'");

    // Teachers clocked in today
    const teachersIn = await db.query(
      'SELECT COUNT(*) AS count FROM tbl_teacher_timelog WHERE log_date = ? AND time_in IS NOT NULL',
      [today]
    );

    res.json({
      success: true,
      data: {
        date: today,
        present_count: presentRows[0].count,
        absent_count: absentRows[0].count,
        total_students: totalStudents[0].count,
        teachers_clocked_in: teachersIn[0].count
      }
    });
  } catch (err) {
    console.error('Today summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to get today summary.' });
  }
});

// GET /api/attendance/logs - List raw attendance logs
router.get('/logs', async (req, res) => {
  try {
    const { date, student_id, teacher_id } = req.query;
    let sql = `SELECT al.*,
                 s.student_no, s.first_name AS student_first_name, s.last_name AS student_last_name,
                 t.first_name AS teacher_first_name, t.last_name AS teacher_last_name,
                 g.full_name AS guard_name
               FROM tbl_attendance_logs al
               LEFT JOIN tbl_students s ON al.student_id = s.student_id
               LEFT JOIN tbl_teachers t ON al.teacher_id = t.teacher_id
               LEFT JOIN tbl_guards g ON al.guard_id = g.guard_id
               WHERE 1=1`;
    const params = [];

    if (date) {
      sql += ' AND DATE(al.log_time) = ?';
      params.push(date);
    }
    if (student_id) {
      sql += ' AND al.student_id = ?';
      params.push(student_id);
    }
    if (teacher_id) {
      sql += ' AND al.teacher_id = ?';
      params.push(teacher_id);
    }

    sql += ' ORDER BY al.log_time DESC';
    const rows = await db.query(sql, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List logs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance logs.' });
  }
});

// POST /api/attendance/log - Create attendance log entry
router.post('/log', async (req, res) => {
  try {
    const { student_id, teacher_id, guard_id, log_type, method } = req.body;

    if (!log_type || !['IN', 'OUT'].includes(log_type)) {
      return res.status(400).json({ success: false, message: 'log_type must be IN or OUT.' });
    }
    if (!student_id && !teacher_id) {
      return res.status(400).json({ success: false, message: 'Either student_id or teacher_id is required.' });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Insert raw log
    const logResult = await db.query(
      'INSERT INTO tbl_attendance_logs (student_id, teacher_id, guard_id, log_type, log_time, method) VALUES (?, ?, ?, ?, NOW(), ?)',
      [student_id || null, teacher_id || null, guard_id || null, log_type, method || 'manual']
    );

    // If student attendance log, also update/create attendance record
    if (student_id) {
      if (log_type === 'IN') {
        // Upsert attendance record for today
        await db.query(
          `INSERT INTO tbl_attendance_records (student_id, attendance_date, time_in, status)
           VALUES (?, ?, NOW(), 'present')
           ON DUPLICATE KEY UPDATE time_in = COALESCE(time_in, NOW()), status = 'present'`,
          [student_id, today]
        );
      } else if (log_type === 'OUT') {
        await db.query(
          `UPDATE tbl_attendance_records SET time_out = NOW() WHERE student_id = ? AND attendance_date = ?`,
          [student_id, today]
        );
      }
    }

    // If teacher attendance log, also update teacher timelog
    if (teacher_id) {
      if (log_type === 'IN') {
        // Get scheduled time_in from settings for late calculation
        const settings = await db.query("SELECT setting_value FROM tbl_system_settings WHERE setting_key = 'teacher_time_in'");
        const scheduledTimeIn = settings.length > 0 ? settings[0].setting_value : '08:00';
        const [schedH, schedM] = scheduledTimeIn.split(':').map(Number);
        const minutesLate = Math.max(0, (now.getHours() * 60 + now.getMinutes()) - (schedH * 60 + schedM));

        await db.query(
          `INSERT INTO tbl_teacher_timelog (teacher_id, log_date, time_in, minutes_late)
           VALUES (?, ?, NOW(), ?)
           ON DUPLICATE KEY UPDATE time_in = COALESCE(time_in, NOW()), minutes_late = ?`,
          [teacher_id, today, minutesLate, minutesLate]
        );
      } else if (log_type === 'OUT') {
        // Calculate hours worked
        await db.query(
          `UPDATE tbl_teacher_timelog
           SET time_out = NOW(),
               hours_worked = TIMESTAMPDIFF(MINUTE, time_in, NOW()) / 60.0
           WHERE teacher_id = ? AND log_date = ?`,
          [teacher_id, today]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: `${log_type === 'IN' ? 'Time-in' : 'Time-out'} logged successfully.`,
      data: { log_id: logResult.insertId }
    });
  } catch (err) {
    console.error('Create log error:', err);
    res.status(500).json({ success: false, message: 'Failed to create attendance log.' });
  }
});

module.exports = router;
