const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Create channel
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { workspace_id, name, description, is_private } = req.body;
    const userId = req.userId;

    // Check if user is member of workspace
    const membership = await db.query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspace_id, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    // Check if channel name exists in workspace
    const existing = await db.query(
      'SELECT * FROM channels WHERE workspace_id = $1 AND name = $2',
      [workspace_id, name]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Channel name already exists' });
    }

    // Create channel
    const channel = await db.query(
      `INSERT INTO channels (workspace_id, name, description, is_private, created_by) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [workspace_id, name, description, is_private || false, userId]
    );

    // Add creator as member
    await db.query(
      `INSERT INTO channel_members (channel_id, user_id) 
       VALUES ($1, $2)`,
      [channel.rows[0].id, userId]
    );

    res.status(201).json(channel.rows[0]);
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workspace channels
router.get('/workspace/:workspaceId', authMiddleware, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.userId;

    // Check if user is member of workspace
    const membership = await db.query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    // Get channels user is member of
    const channels = await db.query(
      `SELECT c.*, 
              cm.joined_at as user_joined_at,
              cm.last_read_at,
              cm.notification_preference,
              (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count,
              (SELECT COUNT(*) FROM messages WHERE channel_id = c.id AND created_at > cm.last_read_at) as unread_count
       FROM channels c
       LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = $2
       WHERE c.workspace_id = $1 
       AND (c.is_private = false OR cm.user_id IS NOT NULL)
       AND c.is_direct = false
       ORDER BY c.name ASC`,
      [workspaceId, userId]
    );

    res.json(channels.rows);
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get channel details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const channel = await db.query(
      `SELECT c.*, 
              cm.joined_at as user_joined_at,
              cm.last_read_at,
              cm.notification_preference,
              (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count
       FROM channels c
       LEFT JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = $2
       WHERE c.id = $1`,
      [id, userId]
    );

    if (channel.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if user has access
    if (channel.rows[0].is_private && !channel.rows[0].user_joined_at) {
      return res.status(403).json({ error: 'No access to this private channel' });
    }

    res.json(channel.rows[0]);
  } catch (error) {
    console.error('Get channel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get channel members
router.get('/:id/members', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if user is member
    const membership = await db.query(
      'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (membership.rows.length === 0) {
      // Check if it's a public channel
      const channel = await db.query(
        'SELECT is_private FROM channels WHERE id = $1',
        [id]
      );

      if (channel.rows.length === 0 || channel.rows[0].is_private) {
        return res.status(403).json({ error: 'No access to this channel' });
      }
    }

    const members = await db.query(
      `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, 
              u.status, u.status_message, u.is_online, u.last_seen,
              cm.joined_at, cm.last_read_at 
       FROM users u 
       JOIN channel_members cm ON u.id = cm.user_id 
       WHERE cm.channel_id = $1 
       ORDER BY cm.joined_at ASC`,
      [id]
    );

    res.json(members.rows);
  } catch (error) {
    console.error('Get channel members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join channel
router.post('/:id/join', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if already member
    const existing = await db.query(
      'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already a member' });
    }

    // Check if channel is private
    const channel = await db.query(
      'SELECT * FROM channels WHERE id = $1',
      [id]
    );

    if (channel.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.rows[0].is_private) {
      return res.status(403).json({ error: 'Cannot join private channel without invitation' });
    }

    // Add as member
    const member = await db.query(
      `INSERT INTO channel_members (channel_id, user_id) 
       VALUES ($1, $2) 
       RETURNING *`,
      [id, userId]
    );

    res.status(201).json(member.rows[0]);
  } catch (error) {
    console.error('Join channel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave channel
router.post('/:id/leave', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    await db.query(
      'DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({ message: 'Left channel successfully' });
  } catch (error) {
    console.error('Leave channel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update channel
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, topic } = req.body;
    const userId = req.userId;

    // Check if user is member
    const membership = await db.query(
      'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this channel' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (topic !== undefined) {
      updates.push(`topic = $${paramCount}`);
      values.push(topic);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const channel = await db.query(
      `UPDATE channels SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json(channel.rows[0]);
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
