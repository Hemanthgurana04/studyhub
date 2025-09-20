const express = require('express');
const { db } = require('../models/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Create room
router.post('/create', verifyToken, (req, res) => {
  const { name, description, isPrivate, maxParticipants, password } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Room name is required' });
  }

  db.run(
    `INSERT INTO study_rooms (name, description, creator_id, is_private, max_participants, password) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, description || '', req.userId, isPrivate ? 1 : 0, maxParticipants || 50, password || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create room' });
      }

      res.status(201).json({
        message: 'Room created successfully',
        room: {
          id: this.lastID,
          name,
          description,
          isPrivate,
          maxParticipants: maxParticipants || 50
        }
      });
    }
  );
});

// Get public rooms
router.get('/public', (req, res) => {
  db.all(
    `SELECT r.*, u.username as creator_name, COUNT(rp.id) as participant_count
     FROM study_rooms r
     LEFT JOIN users u ON r.creator_id = u.id
     LEFT JOIN room_participants rp ON r.id = rp.room_id
     WHERE r.is_private = 0
     GROUP BY r.id
     ORDER BY r.created_at DESC`,
    [],
    (err, rooms) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ rooms });
    }
  );
});

// Get user's rooms
router.get('/my-rooms', verifyToken, (req, res) => {
  db.all(
    `SELECT r.*, u.username as creator_name, COUNT(rp.id) as participant_count
     FROM study_rooms r
     LEFT JOIN users u ON r.creator_id = u.id
     LEFT JOIN room_participants rp ON r.id = rp.room_id
     WHERE r.creator_id = ?
     GROUP BY r.id
     ORDER BY r.created_at DESC`,
    [req.userId],
    (err, rooms) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ rooms });
    }
  );
});

// Join room
router.post('/join/:roomId', verifyToken, (req, res) => {
  const roomId = req.params.roomId;
  const { password } = req.body;

  // Check if room exists and get details
  db.get('SELECT * FROM study_rooms WHERE id = ?', [roomId], (err, room) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check password for private rooms
    if (room.is_private && room.password && room.password !== password) {
      return res.status(401).json({ error: 'Invalid room password' });
    }

    // Check if already joined
    db.get('SELECT id FROM room_participants WHERE room_id = ? AND user_id = ?',
      [roomId, req.userId], (err, existing) => {
      if (existing) {
        return res.json({ message: 'Already joined room', room });
      }

      // Add to participants
      db.run('INSERT INTO room_participants (room_id, user_id) VALUES (?, ?)',
        [roomId, req.userId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to join room' });
        }

        res.json({ message: 'Successfully joined room', room });
      });
    });
  });
});

// Get room details
router.get('/:roomId', verifyToken, (req, res) => {
  const roomId = req.params.roomId;

  db.get(
    `SELECT r.*, u.username as creator_name
     FROM study_rooms r
     LEFT JOIN users u ON r.creator_id = u.id
     WHERE r.id = ?`,
    [roomId],
    (err, room) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      // Get participants
      db.all(
        `SELECT u.id, u.username, u.full_name
         FROM room_participants rp
         JOIN users u ON rp.user_id = u.id
         WHERE rp.room_id = ?`,
        [roomId],
        (err, participants) => {
          if (err) {
            participants = [];
          }

          res.json({ 
            room: {
              ...room,
              participants
            }
          });
        }
      );
    }
  );
});

module.exports = router;
