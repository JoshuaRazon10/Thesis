const express = require('express');
const router = express.Router();
const db = require('../data/db');
const authMiddleware = require('../middleware/auth');
const compreface = require('../utils/compreface');

// All routes require authentication
router.use(authMiddleware);

// GET /api/guards - List all guards
router.get('/', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM tbl_guards ORDER BY full_name ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('List guards error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch guards.' });
  }
});

// GET /api/guards/:id - Get single guard
router.get('/:id', async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM tbl_guards WHERE guard_id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Guard not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get guard error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch guard.' });
  }
});

// POST /api/guards - Create guard
router.post('/', async (req, res) => {
  try {
    const { guard_no, full_name, face_encoding } = req.body;

    if (!guard_no || !full_name) {
      return res.status(400).json({ success: false, message: 'Guard number and full name are required.' });
    }

    const result = await db.query(
      'INSERT INTO tbl_guards (guard_no, full_name, face_encoding) VALUES (?, ?, ?)',
      [guard_no, full_name, face_encoding || null]
    );

    const newGuardId = result.insertId;

    // Register face with CompreFace if provided
    if (face_encoding) {
      const subjectId = `guard_${newGuardId}`;
      try {
        await compreface.addFace(subjectId, face_encoding);
        console.log(`✅ CompreFace: registered face for ${subjectId}`);
      } catch (cfErr) {
        console.error(`⚠️ CompreFace registration failed for ${subjectId}:`, cfErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Guard created successfully.',
      data: { guard_id: newGuardId, guard_no, full_name }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Guard number already exists.' });
    }
    console.error('Create guard error:', err);
    res.status(500).json({ success: false, message: 'Failed to create guard.' });
  }
});

// PUT /api/guards/:id - Update guard
router.put('/:id', async (req, res) => {
  try {
    const { guard_no, full_name, status } = req.body;

    const result = await db.query(
      'UPDATE tbl_guards SET guard_no = COALESCE(?, guard_no), full_name = COALESCE(?, full_name), status = COALESCE(?, status) WHERE guard_id = ?',
      [guard_no, full_name, status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Guard not found.' });
    }

    res.json({ success: true, message: 'Guard updated successfully.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Guard number already exists.' });
    }
    console.error('Update guard error:', err);
    res.status(500).json({ success: false, message: 'Failed to update guard.' });
  }
});

// DELETE /api/guards/:id - Delete guard
router.delete('/:id', async (req, res) => {
  try {
    // Remove face from CompreFace
    const subjectId = `guard_${req.params.id}`;
    try {
      await compreface.deleteSubject(subjectId);
    } catch (cfErr) {
      console.error(`⚠️ CompreFace delete failed for ${subjectId}:`, cfErr.message);
    }

    const result = await db.query('DELETE FROM tbl_guards WHERE guard_id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Guard not found.' });
    }
    res.json({ success: true, message: 'Guard deleted successfully.' });
  } catch (err) {
    console.error('Delete guard error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete guard.' });
  }
});

// POST /api/guards/:id/face - Upload face encoding
router.post('/:id/face', async (req, res) => {
  try {
    const { face_encoding } = req.body;
    if (!face_encoding) {
      return res.status(400).json({ success: false, message: 'Face encoding data is required.' });
    }

    const result = await db.query(
      'UPDATE tbl_guards SET face_encoding = ? WHERE guard_id = ?',
      [face_encoding, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Guard not found.' });
    }

    // Re-register face with CompreFace
    const subjectId = `guard_${req.params.id}`;
    try {
      await compreface.deleteAllFaces(subjectId);
      await compreface.addFace(subjectId, face_encoding);
      console.log(`✅ CompreFace: re-registered face for ${subjectId}`);
    } catch (cfErr) {
      console.error(`⚠️ CompreFace re-registration failed for ${subjectId}:`, cfErr.message);
    }

    res.json({ success: true, message: 'Face encoding saved successfully.' });
  } catch (err) {
    console.error('Upload face error:', err);
    res.status(500).json({ success: false, message: 'Failed to save face encoding.' });
  }
});

module.exports = router;
