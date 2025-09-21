const express = require('express');
const { pool } = require('../models/database');

const router = express.Router();

// Migration endpoint to add email verification columns
router.post('/add-email-verification', async (req, res) => {
  try {
    // Add new columns to existing users table
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP
    `);

    // Update all existing users to be verified (so they can still login)
    await pool.query(`
      UPDATE users 
      SET is_verified = TRUE 
      WHERE is_verified IS NULL
    `);

    console.log('✅ Email verification columns added successfully');
    res.json({ message: 'Database migration completed successfully' });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({ error: 'Migration failed', details: error.message });
  }
});

module.exports = router;
