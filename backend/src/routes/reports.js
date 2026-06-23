const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/reports/attendance/daily - Daily attendance report
router.get('/attendance/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().slice(0, 10);

    const records = await db.query(
      `SELECT ar.*, s.student_no, s.first_name, s.last_name, s.grade_level, s.section
       FROM tbl_attendance_records ar
       JOIN tbl_students s ON ar.student_id = s.student_id
       WHERE ar.attendance_date = ?
       ORDER BY s.grade_level, s.section, s.last_name`,
      [reportDate]
    );

    const summary = await db.query(
      `SELECT
         COUNT(*) AS total_records,
         SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
         SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
         SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late,
         SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) AS excused
       FROM tbl_attendance_records WHERE attendance_date = ?`,
      [reportDate]
    );

    res.json({
      success: true,
      data: {
        report_type: 'daily',
        school: 'Basic Education of Concepcion Holy Cross College, Inc.',
        date: reportDate,
        summary: summary[0],
        records
      }
    });
  } catch (err) {
    console.error('Daily report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate daily report.' });
  }
});

// GET /api/reports/attendance/weekly - Weekly attendance report
router.get('/attendance/weekly', async (req, res) => {
  try {
    const { start_date } = req.query;
    if (!start_date) {
      return res.status(400).json({ success: false, message: 'start_date query parameter is required.' });
    }

    // Calculate end of week (start_date + 6 days)
    const start = new Date(start_date);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const endDate = end.toISOString().slice(0, 10);

    const dailySummaries = await db.query(
      `SELECT
         attendance_date,
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
         SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
         SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late
       FROM tbl_attendance_records
       WHERE attendance_date >= ? AND attendance_date <= ?
       GROUP BY attendance_date
       ORDER BY attendance_date`,
      [start_date, endDate]
    );

    res.json({
      success: true,
      data: {
        report_type: 'weekly',
        school: 'Basic Education of Concepcion Holy Cross College, Inc.',
        start_date,
        end_date: endDate,
        daily_summaries: dailySummaries
      }
    });
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate weekly report.' });
  }
});

// GET /api/reports/attendance/monthly - Monthly attendance report
router.get('/attendance/monthly', async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year query parameters are required.' });
    }

    const paddedMonth = String(month).padStart(2, '0');

    // Per-student summary for the month
    const studentSummaries = await db.query(
      `SELECT
         s.student_id, s.student_no, s.first_name, s.last_name, s.grade_level, s.section,
         COUNT(ar.record_id) AS total_days_recorded,
         SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present_days,
         SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
         SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) AS late_days
       FROM tbl_students s
       LEFT JOIN tbl_attendance_records ar ON s.student_id = ar.student_id
         AND MONTH(ar.attendance_date) = ? AND YEAR(ar.attendance_date) = ?
       WHERE s.status = 'active'
       GROUP BY s.student_id
       ORDER BY s.grade_level, s.section, s.last_name`,
      [month, year]
    );

    // Overall monthly summary
    const overallSummary = await db.query(
      `SELECT
         COUNT(*) AS total_records,
         SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
         SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
         SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late
       FROM tbl_attendance_records
       WHERE MONTH(attendance_date) = ? AND YEAR(attendance_date) = ?`,
      [month, year]
    );

    res.json({
      success: true,
      data: {
        report_type: 'monthly',
        school: 'Basic Education of Concepcion Holy Cross College, Inc.',
        month: paddedMonth,
        year,
        overall_summary: overallSummary[0],
        student_summaries: studentSummaries
      }
    });
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate monthly report.' });
  }
});

// GET /api/reports/attendance/export/csv - Export attendance as CSV text
router.get('/attendance/export/csv', async (req, res) => {
  try {
    const { date, month, year } = req.query;

    let sql = `SELECT ar.attendance_date, s.student_no, s.last_name, s.first_name,
                      s.grade_level, s.section, ar.status, ar.time_in, ar.time_out, ar.remarks
               FROM tbl_attendance_records ar
               JOIN tbl_students s ON ar.student_id = s.student_id
               WHERE 1=1`;
    const params = [];

    if (date) {
      sql += ' AND ar.attendance_date = ?';
      params.push(date);
    } else if (month && year) {
      sql += ' AND MONTH(ar.attendance_date) = ? AND YEAR(ar.attendance_date) = ?';
      params.push(month, year);
    }

    sql += ' ORDER BY ar.attendance_date, s.grade_level, s.section, s.last_name';
    const rows = await db.query(sql, params);

    // Build CSV
    const header = 'Date,Student No,Last Name,First Name,Grade Level,Section,Status,Time In,Time Out,Remarks';
    const csvRows = rows.map(r =>
      `${r.attendance_date},${r.student_no},"${r.last_name}","${r.first_name}",${r.grade_level || ''},${r.section || ''},${r.status},${r.time_in || ''},${r.time_out || ''},"${r.remarks || ''}"`
    );

    const csv = [header, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.csv');
    res.send(csv);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ success: false, message: 'Failed to export attendance CSV.' });
  }
});

module.exports = router;
