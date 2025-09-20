const express = require('express');
const { pool } = require('../models/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Create room
router.post('/create', verifyToken, async (req, res) => {
  const { name, description, isPrivate, maxParticipants, password } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO study_rooms (name, description, creator_id, is_private, max_participants, password) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, description || '', req.userId, isPrivate ? true : false, maxParticipants || 50, password || null]
    );

    const roomId = result.rows[0].id;

    res.status(201).json({
      message: 'Room created successfully',
      room: {
        id: roomId,
        name,
        description,
        isPrivate,
        maxParticipants: maxParticipants || 50
      }
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get public rooms
router.get('/public', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, u.username as creator_name, COUNT(rp.id) as participant_count
      FROM study_rooms r
      LEFT JOIN users u ON r.creator_id = u.id
      LEFT JOIN room_participants rp ON r.id = rp.room_id
      WHERE r.is_private = false
      GROUP BY r.id, u.username
      ORDER BY r.created_at DESC
    `);

    res.json({ rooms: result.rows });
  } catch (error) {
    console.error('Get public rooms error:', error);
    res.status(500).json({ error: 'Failed to load rooms' });
  }
});

// Get user's rooms
router.get('/my-rooms', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, u.username as creator_name, COUNT(rp.id) as participant_count
      FROM study_rooms r
      LEFT JOIN users u ON r.creator_id = u.id
      LEFT JOIN room_participants rp ON r.id = rp.room_id
      WHERE r.creator_id = $1
      GROUP BY r.id, u.username
      ORDER BY r.created_at DESC
    `, [req.userId]);

    res.json({ rooms: result.rows });
  } catch (error) {
    console.error('Get my rooms error:', error);
    res.status(500).json({ error: 'Failed to load rooms' });
  }
});

// Join room
router.post('/join/:roomId', verifyToken, async (req, res) => {
  const roomId = req.params.roomId;
  const { password } = req.body;

  try {
    // Check if room exists
    const roomResult = await pool.query('SELECT * FROM study_rooms WHERE id = $1', [roomId]);
    
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = roomResult.rows[0];

    // Check password for private rooms
    if (room.is_private && room.password && room.password !== password) {
      return res.status(401).json({ error: 'Invalid room password' });
    }

    // Check if already joined
    const existingParticipant = await pool.query(
      'SELECT id FROM room_participants WHERE room_id = $1 AND user_id = $2',
      [roomId, req.userId]
    );

    if (existingParticipant.rows.length > 0) {
      return res.json({ message: 'Already joined room', room });
    }

    // Add to participants
    await pool.query(
      'INSERT INTO room_participants (room_id, user_id) VALUES ($1, $2)',
      [roomId, req.userId]
    );

    res.json({ message: 'Successfully joined room', room });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Get room details
router.get('/:roomId', verifyToken, async (req, res) => {
  const roomId = req.params.roomId;

  try {
    const roomResult = await pool.query(`
      SELECT r.*, u.username as creator_name
      FROM study_rooms r
      LEFT JOIN users u ON r.creator_id = u.id
      WHERE r.id = $1
    `, [roomId]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = roomResult.rows[0];

    // Get participants
    const participantsResult = await pool.query(`
      SELECT u.id, u.username, u.full_name
      FROM room_participants rp
      JOIN users u ON rp.user_id = u.id
      WHERE rp.room_id = $1
    `, [roomId]);

    res.json({ 
      room: {
        ...room,
        participants: participantsResult.rows
      }
    });
  } catch (error) {
    console.error('Get room details error:', error);
    res.status(500).json({ error: 'Failed to get room details' });
  }
});

module.exports = router;
