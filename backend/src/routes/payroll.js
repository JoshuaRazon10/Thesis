const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');
const { sendHttpSMS } = require('../utils/smsUtils');

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

      const daysAbsent = Math.max(totalWorkDays - daysWorked, 0);

      // 8 & 9. Fetch dynamic teacher deductions (SSS, PhilHealth, etc.)
      const teacherDeductionsRes = await db.query('SELECT deduction_name, amount FROM tbl_teacher_deductions WHERE teacher_id = ?', [teacher.teacher_id]);
      
      let totalDeductions = 0.00;
      const deductionsList = [];
      for (const d of teacherDeductionsRes) {
        totalDeductions += parseFloat(d.amount);
        deductionsList.push({ name: d.deduction_name, amount: parseFloat(d.amount) });
      }

      // 10. Net pay (with a fallback to ensure it never drops below 0)
      const netPay = Math.max(grossPay - totalDeductions, 0);

      // 11. Insert payroll record
      const result = await db.query(
        `INSERT INTO tbl_payroll_records
         (period_id, teacher_id, total_hours, regular_hours, overtime_hours, hourly_rate, gross_pay, total_deductions, deductions_details, net_pay, days_worked, days_absent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          periodId, teacher.teacher_id,
          totalHours.toFixed(2), regularHours.toFixed(2), overtimeHours.toFixed(2),
          hourlyRate.toFixed(2), grossPay.toFixed(2),
          totalDeductions.toFixed(2), JSON.stringify(deductionsList),
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
        total_deductions: parseFloat(totalDeductions.toFixed(2)),
        deductions_details: deductionsList,
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
    const { regular_hours, overtime_hours, total_deductions } = req.body;

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
    const newTotalDed = total_deductions !== undefined ? parseFloat(total_deductions) : parseFloat(record.total_deductions);
    const newNet = Math.max(newGross - newTotalDed, 0);

    await db.query(
      `UPDATE tbl_payroll_records
       SET regular_hours = ?, overtime_hours = ?, total_hours = ?, gross_pay = ?, total_deductions = ?, net_pay = ?
       WHERE payroll_id = ?`,
      [
        newRegular.toFixed(2), newOT.toFixed(2), (newRegular + newOT).toFixed(2),
        newGross.toFixed(2), newTotalDed.toFixed(2), newNet.toFixed(2),
        req.params.id
      ]
    );

    res.json({ success: true, message: 'Payroll record updated successfully.' });
  } catch (err) {
    console.error('Edit payroll record error:', err);
    res.status(500).json({ success: false, message: 'Failed to update payroll record.' });
  }
});

// POST /api/payroll/records/:id/send-sms - Send detailed payroll computation via SMS
router.post('/records/:id/send-sms', async (req, res) => {
  try {
    const records = await db.query(
      `SELECT pr.*, t.first_name, t.last_name, t.middle_name, t.role, t.contact_no, pp.period_name, pp.start_date, pp.end_date
       FROM tbl_payroll_records pr
       JOIN tbl_teachers t ON pr.teacher_id = t.teacher_id
       JOIN tbl_payroll_period pp ON pr.period_id = pp.period_id
       WHERE pr.payroll_id = ?`,
      [req.params.id]
    );

    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll record not found.' });
    }

    const r = records[0];
    if (!r.contact_no) {
      return res.status(400).json({ success: false, message: 'Teacher contact number is not set. Please set it in their profile first.' });
    }

    // Parse deductions details
    let deductions = [];
    if (r.deductions_details) {
      try {
        deductions = typeof r.deductions_details === 'string' ? JSON.parse(r.deductions_details) : r.deductions_details;
      } catch (e) {
        deductions = [];
      }
    }

    // Build full calculation message
    const teacherName = `${r.first_name} ${r.last_name}`;
    const deductionsStr = deductions.length > 0 
      ? deductions.map(d => `- ${d.name}: ₱${Number(d.amount).toFixed(2)}`).join('\n')
      : 'None';

    const smsMessage = `[CHCC] Salary Breakdown for ${teacherName} (${r.period_name}):
Hourly Rate: ₱${Number(r.hourly_rate).toFixed(2)}
Hours: ${Number(r.total_hours).toFixed(1)}h (Reg: ${Number(r.regular_hours).toFixed(1)}h, OT: ${Number(r.overtime_hours).toFixed(1)}h)
------------------
Gross Pay: ₱${Number(r.gross_pay).toFixed(2)}
Deductions:
${deductionsStr}
Total Deductions: -₱${Number(r.total_deductions).toFixed(2)}
------------------
Net Pay: ₱${Number(r.net_pay).toFixed(2)}
Thank you.`;

    const smsRes = await db.query(
      'INSERT INTO tbl_sms_notifications (parent_id, attendance_id, message, recipient_phone, status) VALUES (NULL, NULL, ?, ?, ?)',
      [smsMessage, r.contact_no, 'pending']
    );
    
    // Send SMS
    await sendHttpSMS(smsRes.insertId, r.contact_no, smsMessage);

    res.json({ success: true, message: 'Payslip breakdown SMS sent successfully!' });
  } catch (err) {
    console.error('Send SMS error:', err);
    res.status(500).json({ success: false, message: 'Failed to send SMS.' });
  }
});

// GET /api/payroll/records/:id/timelogs - Get daily timelogs for a payroll record
router.get('/records/:id/timelogs', async (req, res) => {
  try {
    const records = await db.query(
      `SELECT pr.teacher_id, pp.start_date, pp.end_date
       FROM tbl_payroll_records pr
       JOIN tbl_payroll_period pp ON pr.period_id = pp.period_id
       WHERE pr.payroll_id = ?`,
      [req.params.id]
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Record not found.' });
    }
    const r = records[0];
    const timelogs = await db.query(
      'SELECT log_date, hours_worked FROM tbl_teacher_timelog WHERE teacher_id = ? AND log_date >= ? AND log_date <= ? ORDER BY log_date ASC',
      [r.teacher_id, r.start_date, r.end_date]
    );
    res.json({ success: true, data: timelogs });
  } catch (err) {
    console.error('Get record timelogs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch timelogs.' });
  }
});

// POST /api/payroll/periods/:id/finalize - Finalize period
router.post('/periods/:id/finalize', async (req, res) => {
  try {
    // 1. Fetch the period and check if draft
    const periods = await db.query('SELECT * FROM tbl_payroll_period WHERE period_id = ?', [req.params.id]);
    if (periods.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll period not found.' });
    }
    const period = periods[0];
    if (period.status === 'finalized') {
      return res.status(400).json({ success: false, message: 'Payroll period is already finalized.' });
    }

    // 2. Fetch all payroll records computed for this period
    const records = await db.query(
      `SELECT pr.*, t.first_name, t.last_name, t.middle_name, t.role, t.contact_no, pp.period_name, pp.start_date, pp.end_date
       FROM tbl_payroll_records pr
       JOIN tbl_teachers t ON pr.teacher_id = t.teacher_id
       JOIN tbl_payroll_period pp ON pr.period_id = pp.period_id
       WHERE pr.period_id = ?`,
      [req.params.id]
    );

    if (records.length === 0) {
      return res.status(400).json({ success: false, message: 'No payroll records computed. Please compute payroll first before finalization.' });
    }

    // 3. Update period status to finalized
    await db.query(
      "UPDATE tbl_payroll_period SET status = 'finalized' WHERE period_id = ? AND status = 'draft'",
      [req.params.id]
    );

    // 4. Batch generate payslip records and dispatch SMS
    for (const r of records) {
      // Fetch timelogs for daily breakdown
      const timelogs = await db.query(
        'SELECT log_date, hours_worked FROM tbl_teacher_timelog WHERE teacher_id = ? AND log_date >= ? AND log_date <= ? ORDER BY log_date ASC',
        [r.teacher_id, r.start_date, r.end_date]
      );
      const logDetails = timelogs.map(t => ({
        log_date: t.log_date,
        hours_worked: parseFloat(t.hours_worked || 0)
      }));

      // Build payslipData JSON structure
      const payslipData = {
        school: 'Basic Education of Concepcion Holy Cross College, Inc.',
        title: 'PAYSLIP',
        period_name: r.period_name,
        start_date: r.start_date,
        end_date: r.end_date,
        teacher: {
          name: `${r.last_name}, ${r.first_name} ${r.middle_name || ''}`.trim(),
          role: r.role
        },
        earnings: {
          regular_hours: parseFloat(r.regular_hours),
          overtime_hours: parseFloat(r.overtime_hours),
          hourly_rate: parseFloat(r.hourly_rate),
          gross_pay: parseFloat(r.gross_pay)
        },
        deductions: {
          details: typeof r.deductions_details === 'string' ? JSON.parse(r.deductions_details) : (r.deductions_details || []),
          total_deductions: parseFloat(r.total_deductions)
        },
        summary: {
          days_worked: r.days_worked,
          days_absent: r.days_absent,
          total_hours: parseFloat(r.total_hours),
          net_pay: parseFloat(r.net_pay),
          daily_logs: logDetails
        }
      };

      // Insert into tbl_payslips if not exists
      const existing = await db.query(
        'SELECT payslip_id FROM tbl_payslips WHERE payroll_id = ? AND teacher_id = ?',
        [r.payroll_id, r.teacher_id]
      );
      
      if (existing.length === 0) {
        await db.query(
          'INSERT INTO tbl_payslips (payroll_id, teacher_id, payslip_data) VALUES (?, ?, ?)',
          [r.payroll_id, r.teacher_id, JSON.stringify(payslipData)]
        );
      }

      // Send SMS notification if phone number exists
      if (r.contact_no) {
        // Parse deductions details
        let deductions = [];
        if (r.deductions_details) {
          try {
            deductions = typeof r.deductions_details === 'string' ? JSON.parse(r.deductions_details) : r.deductions_details;
          } catch (e) {
            deductions = [];
          }
        }

        const teacherName = `${r.first_name} ${r.last_name}`;
        const deductionsStr = deductions.length > 0 
          ? deductions.map(d => `- ${d.name}: ₱${Number(d.amount).toFixed(2)}`).join('\n')
          : 'None';

        const smsMessage = `[CHCC] Salary Breakdown for ${teacherName} (${r.period_name}):
Hourly Rate: ₱${Number(r.hourly_rate).toFixed(2)}
Hours: ${Number(r.total_hours).toFixed(1)}h (Reg: ${Number(r.regular_hours).toFixed(1)}h, OT: ${Number(r.overtime_hours).toFixed(1)}h)
------------------
Gross Pay: ₱${Number(r.gross_pay).toFixed(2)}
Deductions:
${deductionsStr}
Total Deductions: -₱${Number(r.total_deductions).toFixed(2)}
------------------
Net Pay: ₱${Number(r.net_pay).toFixed(2)}
Thank you.`;

        const smsRes = await db.query(
          'INSERT INTO tbl_sms_notifications (parent_id, attendance_id, message, recipient_phone, status) VALUES (NULL, NULL, ?, ?, ?)',
          [smsMessage, r.contact_no, 'pending']
        );
        
        sendHttpSMS(smsRes.insertId, r.contact_no, smsMessage);
      }
    }

    res.json({ success: true, message: 'Payroll period finalized, payslips generated, and teacher SMS notifications dispatched successfully.' });
  } catch (err) {
    console.error('Finalize period error:', err);
    res.status(500).json({ success: false, message: 'Failed to finalize payroll period.' });
  }
});

module.exports = router;
