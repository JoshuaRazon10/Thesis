const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/settings - List all system settings
router.get('/', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM tbl_system_settings ORDER BY setting_key ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List settings error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch settings.' });
  }
});

// PUT /api/settings/:key - Update a system setting by key
router.put('/:key', async (req, res) => {
  try {
    const { value } = req.body;
    const settingKey = req.params.key;

    if (value === undefined || value === null) {
      return res.status(400).json({ success: false, message: 'Setting value is required.' });
    }

    const result = await db.query(
      'UPDATE tbl_system_settings SET setting_value = ? WHERE setting_key = ?',
      [value, settingKey]
    );

    if (result.affectedRows === 0) {
      // If the key doesn't exist, create it
      await db.query(
        'INSERT INTO tbl_system_settings (setting_key, setting_value) VALUES (?, ?)',
        [settingKey, value]
      );
    }

    res.json({ success: true, message: `Setting '${settingKey}' updated successfully.` });
  } catch (err) {
    console.error('Update setting error:', err);
    res.status(500).json({ success: false, message: 'Failed to update setting.' });
  }
});

module.exports = router;
