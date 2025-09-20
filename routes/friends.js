const express = require('express');
const { db } = require('../models/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Send friend request
router.post('/request', verifyToken, (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  // Find user by username
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.id === req.userId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if request already exists
    db.get(
      `SELECT id FROM friendships 
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
      [req.userId, user.id, user.id, req.userId],
      (err, existing) => {
        if (existing) {
          return res.status(400).json({ error: 'Friend request already exists' });
        }

        // Create friend request
        db.run(
          'INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, ?)',
          [req.userId, user.id, 'pending'],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to send friend request' });
            }

            res.json({ message: 'Friend request sent successfully' });
          }
        );
      }
    );
  });
});

// Accept friend request
router.post('/accept/:requestId', verifyToken, (req, res) => {
  const requestId = req.params.requestId;

  db.run(
    'UPDATE friendships SET status = ? WHERE id = ? AND addressee_id = ?',
    ['accepted', requestId, req.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Friend request not found' });
      }

      res.json({ message: 'Friend request accepted' });
    }
  );
});

// Decline friend request
router.post('/decline/:requestId', verifyToken, (req, res) => {
  const requestId = req.params.requestId;

  db.run(
    'UPDATE friendships SET status = ? WHERE id = ? AND addressee_id = ?',
    ['declined', requestId, req.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Friend request not found' });
      }

      res.json({ message: 'Friend request declined' });
    }
  );
});

// Get friends list
router.get('/list', verifyToken, (req, res) => {
  db.all(
    `SELECT u.id, u.username, u.full_name, u.avatar_url, f.created_at as friends_since
     FROM friendships f
     JOIN users u ON (
       CASE 
         WHEN f.requester_id = ? THEN f.addressee_id = u.id
         ELSE f.requester_id = u.id
       END
     )
     WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = ?`,
    [req.userId, req.userId, req.userId, 'accepted'],
    (err, friends) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ friends });
    }
  );
});

// Get pending friend requests
router.get('/requests', verifyToken, (req, res) => {
  db.all(
    `SELECT f.id, u.id as user_id, u.username, u.full_name, u.avatar_url, f.created_at
     FROM friendships f
     JOIN users u ON f.requester_id = u.id
     WHERE f.addressee_id = ? AND f.status = ?`,
    [req.userId, 'pending'],
    (err, requests) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ requests });
    }
  );
});

module.exports = router;
