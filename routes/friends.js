const express = require('express');
const { pool } = require('../models/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Send friend request
router.post('/request', verifyToken, async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    // Find user by username
    const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUserId = userResult.rows[0].id;

    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if request already exists
    const existingRequest = await pool.query(`
      SELECT id FROM friendships 
      WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)
    `, [req.userId, targetUserId]);

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }

    // Create friend request
    await pool.query(
      'INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, $3)',
      [req.userId, targetUserId, 'pending']
    );

    res.json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Accept friend request
router.post('/accept/:requestId', verifyToken, async (req, res) => {
  const requestId = req.params.requestId;

  try {
    const result = await pool.query(
      'UPDATE friendships SET status = $1 WHERE id = $2 AND addressee_id = $3',
      ['accepted', requestId, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// Decline friend request
router.post('/decline/:requestId', verifyToken, async (req, res) => {
  const requestId = req.params.requestId;

  try {
    const result = await pool.query(
      'UPDATE friendships SET status = $1 WHERE id = $2 AND addressee_id = $3',
      ['declined', requestId, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Decline friend request error:', error);
    res.status(500).json({ error: 'Failed to decline friend request' });
  }
});

// Get friends list
router.get('/list', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.full_name, u.avatar_url, f.created_at as friends_since
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.requester_id = $1 THEN f.addressee_id = u.id
          ELSE f.requester_id = u.id
        END
      )
      WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = $2
    `, [req.userId, 'accepted']);

    res.json({ friends: result.rows });
  } catch (error) {
    console.error('Get friends list error:', error);
    res.status(500).json({ error: 'Failed to load friends' });
  }
});

// Get pending friend requests
router.get('/requests', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.id, u.id as user_id, u.username, u.full_name, u.avatar_url, f.created_at
      FROM friendships f
      JOIN users u ON f.requester_id = u.id
      WHERE f.addressee_id = $1 AND f.status = $2
    `, [req.userId, 'pending']);

    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Failed to load friend requests' });
  }
});

module.exports = router;
