const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');
const { sendHttpSMS } = require('../utils/smsUtils');

// All routes require authentication
router.use(authMiddleware);

// GET /api/sms - List all SMS notifications
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT sn.*, p.guardian_name, p.contact_no
               FROM tbl_sms_notifications sn
               LEFT JOIN tbl_parents p ON sn.parent_id = p.parent_id`;
    const params = [];

    if (status) {
      sql += ' WHERE sn.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY sn.created_at DESC';
    const rows = await db.query(sql, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List SMS error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch SMS notifications.' });
  }
});

// GET /api/sms/pending - Count pending SMS
router.get('/pending', async (req, res) => {
  try {
    const rows = await db.query("SELECT COUNT(*) AS count FROM tbl_sms_notifications WHERE status = 'pending'");
    res.json({ success: true, data: { pending_count: rows[0].count } });
  } catch (err) {
    console.error('Pending SMS error:', err);
    res.status(500).json({ success: false, message: 'Failed to count pending SMS.' });
  }
});

// POST /api/sms/send - Create SMS notification record (placeholder)
router.post('/send', async (req, res) => {
  try {
    const { parent_id, attendance_id, message } = req.body;

    if (!parent_id) {
      return res.status(400).json({ success: false, message: 'Parent ID is required.' });
    }

    // Get parent contact info
    const parents = await db.query(
      'SELECT p.*, s.first_name, s.last_name FROM tbl_parents p JOIN tbl_students s ON p.student_id = s.student_id WHERE p.parent_id = ?',
      [parent_id]
    );

    if (parents.length === 0) {
      return res.status(404).json({ success: false, message: 'Parent not found.' });
    }

    const parent = parents[0];
    const smsMessage = message ||
      `[Basic Education of Concepcion Holy Cross College, Inc.] ` +
      `Dear ${parent.guardian_name}, your child ${parent.first_name} ${parent.last_name} has been marked present today. Thank you.`;

    // Insert SMS record as pending
    const result = await db.query(
      'INSERT INTO tbl_sms_notifications (parent_id, attendance_id, message, recipient_phone, status) VALUES (?, ?, ?, ?, ?)',
      [parent_id, attendance_id || null, smsMessage, parent.contact_no, 'pending']
    );

    // Call HttpSMS API in the background
    sendHttpSMS(result.insertId, parent.contact_no, smsMessage);

    res.status(201).json({
      success: true,
      message: 'SMS notification queued successfully.',
      data: { sms_id: result.insertId, status: 'pending' }
    });
  } catch (err) {
    console.error('Send SMS error:', err);
    res.status(500).json({ success: false, message: 'Failed to create SMS notification.' });
  }
});

module.exports = router;
