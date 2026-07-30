const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');
const { sendHttpSMS } = require('../utils/smsUtils');

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
    
    // Students Breakdown (Primary vs Secondary)
    // Assuming Grade 1-6 are primary, 7-12 are secondary. We will just do a simple string match or return 0 if unclassified.
    const breakdownRows = await db.query(
      `SELECT s.grade_level, COUNT(*) as count 
       FROM tbl_attendance_records a 
       JOIN tbl_students s ON a.student_id = s.student_id 
       WHERE a.attendance_date = ? AND a.status IN ('present', 'late') 
       GROUP BY s.grade_level`,
      [today]
    );
    
    let primaryCount = 0;
    let secondaryCount = 0;
    breakdownRows.forEach(row => {
      const lvl = String(row.grade_level).toLowerCase();
      if (lvl.includes('1') || lvl.includes('2') || lvl.includes('3') || lvl.includes('4') || lvl.includes('5') || lvl.includes('6') || lvl.includes('elem') || lvl.includes('prep') || lvl.includes('kinder')) {
        if (lvl.includes('10') || lvl.includes('11') || lvl.includes('12')) {
          secondaryCount += Number(row.count);
        } else {
          primaryCount += Number(row.count);
        }
      } else {
        secondaryCount += Number(row.count); // Default others to secondary for now
      }
    });

    // Weekly history (last 5 days) for the line chart
    const weeklyRows = await db.query(
      `SELECT attendance_date, COUNT(*) as count 
       FROM tbl_attendance_records 
       WHERE attendance_date >= DATE_SUB(?, INTERVAL 4 DAY) 
       AND status IN ('present', 'late') 
       GROUP BY attendance_date 
       ORDER BY attendance_date ASC`,
      [today]
    );

    // Format weekly data into arrays for chart.js
    const weekLabels = [];
    const weekData = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      weekLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' })); // Mon, Tue, etc.
      const found = weeklyRows.find(r => r.attendance_date.toISOString().slice(0, 10) === dateStr);
      weekData.push(found ? found.count : 0);
    }

    // Teachers clocked in today
    const teachersIn = await db.query(
      'SELECT COUNT(*) AS count FROM tbl_teacher_timelog WHERE log_date = ? AND time_in IS NOT NULL',
      [today]
    );
    const totalTeachers = await db.query("SELECT COUNT(*) AS count FROM tbl_teachers WHERE status = 'active'");

    res.json({
      success: true,
      data: {
        date: today,
        present_count: presentRows[0].count,
        absent_count: absentRows[0].count,
        total_students: totalStudents[0].count,
        students_breakdown: {
          primary: primaryCount,
          secondary: secondaryCount
        },
        weekly_chart: {
          labels: weekLabels,
          data: weekData
        },
        teachers_clocked_in: teachersIn[0].count,
        total_teachers: totalTeachers[0].count,
        teacher_status: {
          clock_in: teachersIn[0].count,
          sick: 0,
          excused: 0,
          other: totalTeachers[0].count - teachersIn[0].count // Assuming the rest are just absent/other
        },
        parents_inside: 0, // Not tracked in DB yet
        parents_breakdown: {
          meeting: 0,
          fetching: 0
        }
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
                 t.first_name AS teacher_first_name, t.last_name AS teacher_last_name, t.role AS teacher_role,
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

    const formattedRows = rows.map(log => {
      let fullName = 'Unknown';
      let role = 'System';
      if (log.student_id) {
        fullName = `${log.student_last_name}, ${log.student_first_name}`;
        role = 'Student';
      } else if (log.teacher_id) {
        fullName = `${log.teacher_last_name}, ${log.teacher_first_name}`;
        role = log.teacher_role || 'Teacher';
      } else if (log.guard_id) {
        fullName = log.guard_name || `Guard #${log.guard_id}`;
        role = 'Guard';
      }
      return {
        ...log,
        full_name: fullName,
        role: role
      };
    });

    res.json({ success: true, data: formattedRows });
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

      // -- SMS Integration --
      try {
        const parents = await db.query(
          'SELECT p.parent_id, p.contact_no, p.guardian_name, s.first_name, s.last_name FROM tbl_parents p JOIN tbl_students s ON p.student_id = s.student_id WHERE s.student_id = ?',
          [student_id]
        );
        
        if (parents.length > 0 && parents[0].contact_no) {
          const parent = parents[0];
          const timeFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: 'numeric', hour12: true }).format(new Date());
          
          let smsMessage = '';
          if (log_type === 'IN') {
            smsMessage = `[CHCC] Dear Parent/Guardian ${parent.guardian_name}, this is to inform you that ${parent.first_name} ${parent.last_name} arrived safely at school today at ${timeFormat}. Thank you.`;
          } else {
            smsMessage = `[CHCC] Dear Parent/Guardian, ${parent.first_name} ${parent.last_name} has left the school premises at ${timeFormat}. Thank you.`;
          }

          const smsRes = await db.query(
            'INSERT INTO tbl_sms_notifications (parent_id, attendance_id, message, recipient_phone, status) VALUES (?, NULL, ?, ?, ?)',
            [parent.parent_id, smsMessage, parent.contact_no, 'pending']
          );
          
          sendHttpSMS(smsRes.insertId, parent.contact_no, smsMessage);
        }
      } catch (smsErr) {
        console.error('Error queuing auto SMS:', smsErr);
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
