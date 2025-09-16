const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const user = await db.query(
      `SELECT id, username, email, display_name, avatar_url, 
              status, status_message, is_online, last_seen, created_at 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.rows[0]);
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await db.query(
      `SELECT id, username, email, display_name, avatar_url, 
              status, status_message, is_online, last_seen, created_at 
       FROM users WHERE id = $1`,
      [id]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { display_name, avatar_url, status_message } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (display_name !== undefined) {
      updates.push(`display_name = $${paramCount}`);
      values.push(display_name);
      paramCount++;
    }

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount}`);
      values.push(avatar_url);
      paramCount++;
    }

    if (status_message !== undefined) {
      updates.push(`status_message = $${paramCount}`);
      values.push(status_message);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const user = await db.query(
      `UPDATE users SET ${updates.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING id, username, email, display_name, avatar_url, 
                 status, status_message, is_online, last_seen`,
      values
    );

    res.json(user.rows[0]);
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user status
router.put('/me/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { status, status_message } = req.body;

    const validStatuses = ['online', 'away', 'dnd', 'offline'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const user = await db.query(
      `UPDATE users 
       SET status = COALESCE($1, status), 
           status_message = COALESCE($2, status_message),
           updated_at = NOW() 
       WHERE id = $3 
       RETURNING id, username, status, status_message`,
      [status, status_message, userId]
    );

    res.json(user.rows[0]);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users
router.get('/search/:workspaceId', authMiddleware, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { q } = req.query;
    const userId = req.userId;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    // Check if user is member of workspace
    const membership = await db.query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const users = await db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status, u.is_online 
       FROM users u 
       JOIN workspace_members wm ON u.id = wm.user_id 
       WHERE wm.workspace_id = $1 
       AND (LOWER(u.username) LIKE LOWER($2) OR LOWER(u.display_name) LIKE LOWER($2))
       AND u.id != $3
       LIMIT 20`,
      [workspaceId, `%${q}%`, userId]
    );

    res.json(users.rows);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get or create direct message channel
router.post('/direct-message', authMiddleware, async (req, res) => {
  try {
    const { workspace_id, target_user_id } = req.body;
    const userId = req.userId;

    if (userId === target_user_id) {
      return res.status(400).json({ error: 'Cannot create DM with yourself' });
    }

    // Ensure consistent ordering
    const user1 = userId < target_user_id ? userId : target_user_id;
    const user2 = userId < target_user_id ? target_user_id : userId;

    // Check if DM already exists
    let dm = await db.query(
      `SELECT dm.*, c.id as channel_id 
       FROM direct_messages dm 
       JOIN channels c ON c.workspace_id = dm.workspace_id 
       WHERE dm.workspace_id = $1 AND dm.user1_id = $2 AND dm.user2_id = $3 
       AND c.is_direct = true 
       AND c.name = CONCAT('dm-', $2::text, '-', $3::text)`,
      [workspace_id, user1, user2]
    );

    if (dm.rows.length === 0) {
      // Create DM record
      await db.query(
        `INSERT INTO direct_messages (workspace_id, user1_id, user2_id) 
         VALUES ($1, $2, $3)`,
        [workspace_id, user1, user2]
      );

      // Create channel for DM
      const channel = await db.query(
        `INSERT INTO channels (workspace_id, name, is_private, is_direct, created_by) 
         VALUES ($1, $2, true, true, $3) 
         RETURNING *`,
        [`${workspace_id}`, `dm-${user1}-${user2}`, userId]
      );

      // Add both users as members
      await db.query(
        `INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2), ($1, $3)`,
        [channel.rows[0].id, user1, user2]
      );

      dm = await db.query(
        `SELECT dm.*, $4 as channel_id 
         FROM direct_messages dm 
         WHERE dm.workspace_id = $1 AND dm.user1_id = $2 AND dm.user2_id = $3`,
        [workspace_id, user1, user2, channel.rows[0].id]
      );
    }

    // Get other user's info
    const otherUser = await db.query(
      `SELECT id, username, display_name, avatar_url, status, is_online 
       FROM users WHERE id = $1`,
      [target_user_id]
    );

    res.json({
      ...dm.rows[0],
      other_user: otherUser.rows[0]
    });
  } catch (error) {
    console.error('Create DM error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's direct messages
router.get('/direct-messages/:workspaceId', authMiddleware, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.userId;

    const dms = await db.query(
      `SELECT 
        c.id as channel_id,
        c.name,
        c.updated_at,
        dm.created_at as dm_created_at,
        CASE 
          WHEN dm.user1_id = $2 THEN dm.user2_id 
          ELSE dm.user1_id 
        END as other_user_id,
        u.username as other_username,
        u.display_name as other_display_name,
        u.avatar_url as other_avatar_url,
        u.status as other_status,
        u.is_online as other_is_online,
        cm.last_read_at,
        (SELECT COUNT(*) 
         FROM messages m 
         WHERE m.channel_id = c.id 
         AND m.created_at > cm.last_read_at) as unread_count,
        (SELECT content 
         FROM messages 
         WHERE channel_id = c.id 
         ORDER BY created_at DESC 
         LIMIT 1) as last_message
       FROM direct_messages dm
       JOIN channels c ON c.workspace_id = dm.workspace_id 
         AND c.is_direct = true 
         AND c.name = CONCAT('dm-', dm.user1_id::text, '-', dm.user2_id::text)
       JOIN users u ON u.id = CASE 
         WHEN dm.user1_id = $2 THEN dm.user2_id 
         ELSE dm.user1_id 
       END
       LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = $2
       WHERE dm.workspace_id = $1 
       AND (dm.user1_id = $2 OR dm.user2_id = $2)
       ORDER BY c.updated_at DESC`,
      [workspaceId, userId]
    );

    res.json(dms.rows);
  } catch (error) {
    console.error('Get DMs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { current_password, new_password } = req.body;

    // Get current password hash
    const user = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(current_password, user.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
