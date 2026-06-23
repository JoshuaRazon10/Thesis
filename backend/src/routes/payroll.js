const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/payroll/periods - List all payroll periods
router.get('/periods', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM tbl_payroll_period ORDER BY start_date DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List periods error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll periods.' });
  }
});

// POST /api/payroll/periods - Create payroll period
router.post('/periods', async (req, res) => {
  try {
    const { period_name, start_date, end_date } = req.body;

    if (!period_name || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Period name, start date, and end date are required.' });
    }

    const result = await db.query(
      'INSERT INTO tbl_payroll_period (period_name, start_date, end_date) VALUES (?, ?, ?)',
      [period_name, start_date, end_date]
    );

    res.status(201).json({
      success: true,
      message: 'Payroll period created successfully.',
      data: { period_id: result.insertId, period_name, start_date, end_date, status: 'draft' }
    });
  } catch (err) {
    console.error('Create period error:', err);
    res.status(500).json({ success: false, message: 'Failed to create payroll period.' });
  }
});

// GET /api/payroll/periods/:id - Get single period with payroll records
router.get('/periods/:id', async (req, res) => {
  try {
    const periods = await db.query('SELECT * FROM tbl_payroll_period WHERE period_id = ?', [req.params.id]);
    if (periods.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll period not found.' });
    }

    const records = await db.query(
      `SELECT pr.*, t.first_name, t.last_name, t.middle_name
       FROM tbl_payroll_records pr
       JOIN tbl_teachers t ON pr.teacher_id = t.teacher_id
       WHERE pr.period_id = ?
       ORDER BY t.last_name ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...periods[0], records } });
  } catch (err) {
    console.error('Get period error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll period.' });
  }
});

// POST /api/payroll/periods/:id/generate - Generate payroll for a period
router.post('/periods/:id/generate', async (req, res) => {
  try {
    const periodId = req.params.id;

    // 1. Verify period exists and is in draft
    const periods = await db.query('SELECT * FROM tbl_payroll_period WHERE period_id = ?', [periodId]);
    if (periods.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll period not found.' });
    }
    const period = periods[0];
    if (period.status === 'finalized') {
      return res.status(400).json({ success: false, message: 'Cannot generate payroll for a finalized period.' });
    }

    // Get scheduled time_in from system settings
    const settingsRows = await db.query("SELECT setting_value FROM tbl_system_settings WHERE setting_key = 'teacher_time_in'");
    const scheduledTimeIn = settingsRows.length > 0 ? settingsRows[0].setting_value : '08:00';

    // 2. Get all active teachers
    const teachers = await db.query("SELECT * FROM tbl_teachers WHERE status = 'active'");

    // 3. Calculate work days in the period (weekdays only)
    const startDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);
    let totalWorkDays = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) totalWorkDays++; // exclude weekends
    }

    // Clear existing records for this period (allow regeneration)
    await db.query('DELETE FROM tbl_payroll_records WHERE period_id = ?', [periodId]);

    const generatedRecords = [];

    for (const teacher of teachers) {
      // 4. Get timelogs within the period date range
      const timelogs = await db.query(
        'SELECT * FROM tbl_teacher_timelog WHERE teacher_id = ? AND log_date >= ? AND log_date <= ?',
        [teacher.teacher_id, period.start_date, period.end_date]
      );

      // 5. Get teacher's hourly rate (latest effective before or on end_date)
      const salaryRows = await db.query(
        'SELECT hourly_rate FROM tbl_teacher_salary WHERE teacher_id = ? AND effective_date <= ? ORDER BY effective_date DESC LIMIT 1',
        [teacher.teacher_id, period.end_date]
      );
      const hourlyRate = salaryRows.length > 0 ? parseFloat(salaryRows[0].hourly_rate) : 0;

      // 6. Calculate hours
      let totalHours = 0;
      let regularHours = 0;
      let overtimeHours = 0;
      let totalMinutesLate = 0;
      const daysWorked = timelogs.length;

      for (const log of timelogs) {
        const worked = parseFloat(log.hours_worked) || 0;
        totalHours += worked;

        // Regular hours capped at 8 per day, OT beyond 8
        const dailyRegular = Math.min(worked, 8);
        const dailyOT = Math.max(worked - 8, 0);
        regularHours += dailyRegular;
        overtimeHours += dailyOT;

        totalMinutesLate += (log.minutes_late || 0);
      }

      // 7. Gross pay calculation
      const grossPay = (regularHours * hourlyRate) + (overtimeHours * hourlyRate * 1.25);

      // 8. Late deduction: (total_minutes_late / 60) × hourly_rate
      const lateDeduction = (totalMinutesLate / 60) * hourlyRate;

      // 9. Absent deduction: missing_days × 8 × hourly_rate
      const daysAbsent = Math.max(totalWorkDays - daysWorked, 0);
      const absentDeduction = daysAbsent * 8 * hourlyRate;

      // 10. Net pay
      const netPay = grossPay - lateDeduction - absentDeduction;

      // 11. Insert payroll record
      const result = await db.query(
        `INSERT INTO tbl_payroll_records
         (period_id, teacher_id, total_hours, regular_hours, overtime_hours, hourly_rate, gross_pay, late_deduction, absent_deduction, net_pay, days_worked, days_absent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          periodId, teacher.teacher_id,
          totalHours.toFixed(2), regularHours.toFixed(2), overtimeHours.toFixed(2),
          hourlyRate.toFixed(2), grossPay.toFixed(2),
          lateDeduction.toFixed(2), absentDeduction.toFixed(2),
          netPay.toFixed(2), daysWorked, daysAbsent
        ]
      );

      generatedRecords.push({
        payroll_id: result.insertId,
        teacher_id: teacher.teacher_id,
        teacher_name: `${teacher.last_name}, ${teacher.first_name}`,
        total_hours: parseFloat(totalHours.toFixed(2)),
        regular_hours: parseFloat(regularHours.toFixed(2)),
        overtime_hours: parseFloat(overtimeHours.toFixed(2)),
        hourly_rate: hourlyRate,
        gross_pay: parseFloat(grossPay.toFixed(2)),
        late_deduction: parseFloat(lateDeduction.toFixed(2)),
        absent_deduction: parseFloat(absentDeduction.toFixed(2)),
        net_pay: parseFloat(netPay.toFixed(2)),
        days_worked: daysWorked,
        days_absent: daysAbsent
      });
    }

    res.json({
      success: true,
      message: `Payroll generated for ${generatedRecords.length} teacher(s).`,
      data: { period_id: periodId, total_work_days: totalWorkDays, records: generatedRecords }
    });
  } catch (err) {
    console.error('Generate payroll error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate payroll.' });
  }
});

// PUT /api/payroll/records/:id - Edit payroll record before finalizing
router.put('/records/:id', async (req, res) => {
  try {
    const { regular_hours, overtime_hours, late_deduction, absent_deduction } = req.body;

    // Check if the record's period is still draft
    const records = await db.query(
      `SELECT pr.*, pp.status AS period_status
       FROM tbl_payroll_records pr
       JOIN tbl_payroll_period pp ON pr.period_id = pp.period_id
       WHERE pr.payroll_id = ?`,
      [req.params.id]
    );

    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll record not found.' });
    }
    if (records[0].period_status === 'finalized') {
      return res.status(400).json({ success: false, message: 'Cannot edit records of a finalized period.' });
    }

    const record = records[0];
    const newRegular = regular_hours !== undefined ? parseFloat(regular_hours) : parseFloat(record.regular_hours);
    const newOT = overtime_hours !== undefined ? parseFloat(overtime_hours) : parseFloat(record.overtime_hours);
    const rate = parseFloat(record.hourly_rate);
    const newGross = (newRegular * rate) + (newOT * rate * 1.25);
    const newLateDed = late_deduction !== undefined ? parseFloat(late_deduction) : parseFloat(record.late_deduction);
    const newAbsentDed = absent_deduction !== undefined ? parseFloat(absent_deduction) : parseFloat(record.absent_deduction);
    const newNet = newGross - newLateDed - newAbsentDed;

    await db.query(
      `UPDATE tbl_payroll_records
       SET regular_hours = ?, overtime_hours = ?, total_hours = ?, gross_pay = ?, late_deduction = ?, absent_deduction = ?, net_pay = ?
       WHERE payroll_id = ?`,
      [
        newRegular.toFixed(2), newOT.toFixed(2), (newRegular + newOT).toFixed(2),
        newGross.toFixed(2), newLateDed.toFixed(2), newAbsentDed.toFixed(2), newNet.toFixed(2),
        req.params.id
      ]
    );

    res.json({ success: true, message: 'Payroll record updated successfully.' });
  } catch (err) {
    console.error('Edit payroll record error:', err);
    res.status(500).json({ success: false, message: 'Failed to update payroll record.' });
  }
});

// POST /api/payroll/periods/:id/finalize - Finalize period
router.post('/periods/:id/finalize', async (req, res) => {
  try {
    const result = await db.query(
      "UPDATE tbl_payroll_period SET status = 'finalized' WHERE period_id = ? AND status = 'draft'",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'Period not found or already finalized.' });
    }

    res.json({ success: true, message: 'Payroll period finalized successfully.' });
  } catch (err) {
    console.error('Finalize period error:', err);
    res.status(500).json({ success: false, message: 'Failed to finalize payroll period.' });
  }
});

module.exports = router;
