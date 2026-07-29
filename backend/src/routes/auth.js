const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const normalizedUsername = username.toLowerCase().trim();

    // Require email format to end with @gmail.com or @chcc.edu.ph
    if (!normalizedUsername.endsWith('@gmail.com') && !normalizedUsername.endsWith('@chcc.edu.ph')) {
      return res.status(400).json({ success: false, message: 'Login requires a Gmail or CHCC institutional Google Workspace account.' });
    }

    // Only permit login from the 'admin@chcc.edu.ph' account
    if (normalizedUsername !== 'admin@chcc.edu.ph') {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Secure database lookup using parameterized query (no SQL injection risk)
    const rows = await db.query('SELECT * FROM tbl_admins WHERE username = ?', [normalizedUsername]);
    const admin = rows[0];

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { admin_id: admin.admin_id, username: admin.username, full_name: admin.full_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        admin_id: admin.admin_id,
        username: admin.username,
        full_name: admin.full_name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const rows = await db.query('SELECT admin_id, username, full_name, created_at FROM tbl_admins WHERE admin_id = ?', [req.user.admin_id]);
    const admin = rows[0];

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    res.json({
      success: true,
      user: admin
    });
  } catch (err) {
    console.error('Auth/me error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch admin info.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.user.admin_id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    // Get current admin info securely (parameterized)
    const rows = await db.query('SELECT * FROM tbl_admins WHERE admin_id = ?', [adminId]);
    const admin = rows[0];

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    // Hash new password securely
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    // Update in database securely (parameterized)
    await db.query('UPDATE tbl_admins SET password_hash = ? WHERE admin_id = ?', [newHash, adminId]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

module.exports = router;
