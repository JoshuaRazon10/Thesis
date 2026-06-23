const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/payslips - List all payslips
router.get('/', async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT ps.*, t.first_name, t.last_name, t.middle_name,
              pr.period_id, pr.net_pay, pr.gross_pay,
              pp.period_name, pp.start_date, pp.end_date
       FROM tbl_payslips ps
       JOIN tbl_payroll_records pr ON ps.payroll_id = pr.payroll_id
       JOIN tbl_teachers t ON ps.teacher_id = t.teacher_id
       JOIN tbl_payroll_period pp ON pr.period_id = pp.period_id
       ORDER BY ps.generated_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List payslips error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch payslips.' });
  }
});

// POST /api/payslips/generate - Generate payslip record
router.post('/generate', async (req, res) => {
  try {
    const { payroll_id, teacher_id } = req.body;

    if (!payroll_id || !teacher_id) {
      return res.status(400).json({ success: false, message: 'Payroll ID and teacher ID are required.' });
    }

    // Get the full payroll record
    const records = await db.query(
      `SELECT pr.*, pp.period_name, pp.start_date, pp.end_date,
              t.first_name, t.last_name, t.middle_name, t.role
       FROM tbl_payroll_records pr
       JOIN tbl_payroll_period pp ON pr.period_id = pp.period_id
       JOIN tbl_teachers t ON pr.teacher_id = t.teacher_id
       WHERE pr.payroll_id = ? AND pr.teacher_id = ?`,
      [payroll_id, teacher_id]
    );

    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Payroll record not found.' });
    }

    const record = records[0];

    // Build payslip data JSON
    const payslipData = {
      school: 'Basic Education of Concepcion Holy Cross College, Inc.',
      title: 'PAYSLIP',
      period_name: record.period_name,
      start_date: record.start_date,
      end_date: record.end_date,
      teacher: {
        name: `${record.last_name}, ${record.first_name} ${record.middle_name || ''}`.trim(),
        role: record.role
      },
      earnings: {
        regular_hours: parseFloat(record.regular_hours),
        overtime_hours: parseFloat(record.overtime_hours),
        hourly_rate: parseFloat(record.hourly_rate),
        gross_pay: parseFloat(record.gross_pay)
      },
      deductions: {
        late_deduction: parseFloat(record.late_deduction),
        absent_deduction: parseFloat(record.absent_deduction),
        total_deductions: parseFloat(record.late_deduction) + parseFloat(record.absent_deduction)
      },
      summary: {
        days_worked: record.days_worked,
        days_absent: record.days_absent,
        total_hours: parseFloat(record.total_hours),
        net_pay: parseFloat(record.net_pay)
      }
    };

    const result = await db.query(
      'INSERT INTO tbl_payslips (payroll_id, teacher_id, payslip_data) VALUES (?, ?, ?)',
      [payroll_id, teacher_id, JSON.stringify(payslipData)]
    );

    res.status(201).json({
      success: true,
      message: 'Payslip generated successfully.',
      data: { payslip_id: result.insertId, payslip_data: payslipData }
    });
  } catch (err) {
    console.error('Generate payslip error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate payslip.' });
  }
});

// GET /api/payslips/:id/download - Return payslip data as JSON
router.get('/:id/download', async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT ps.*, t.first_name, t.last_name
       FROM tbl_payslips ps
       JOIN tbl_teachers t ON ps.teacher_id = t.teacher_id
       WHERE ps.payslip_id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payslip not found.' });
    }

    const payslip = rows[0];
    const payslipData = typeof payslip.payslip_data === 'string'
      ? JSON.parse(payslip.payslip_data)
      : payslip.payslip_data;

    res.json({
      success: true,
      data: {
        payslip_id: payslip.payslip_id,
        teacher_name: `${payslip.last_name}, ${payslip.first_name}`,
        generated_at: payslip.generated_at,
        payslip_data: payslipData
      }
    });
  } catch (err) {
    console.error('Download payslip error:', err);
    res.status(500).json({ success: false, message: 'Failed to download payslip.' });
  }
});

module.exports = router;
