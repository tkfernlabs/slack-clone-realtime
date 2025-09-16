const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Send message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { channel_id, content, message_type, parent_message_id } = req.body;
    const userId = req.userId;

    // Check if user is member of channel
    const membership = await db.query(
      'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [channel_id, userId]
    );

    if (membership.rows.length === 0) {
      // Check if it's a public channel
      const channel = await db.query(
        'SELECT is_private FROM channels WHERE id = $1',
        [channel_id]
      );

      if (channel.rows.length === 0 || channel.rows[0].is_private) {
        return res.status(403).json({ error: 'No access to send messages in this channel' });
      }
    }

    // Create message
    const message = await db.query(
      `INSERT INTO messages (channel_id, user_id, content, message_type, parent_message_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [channel_id, userId, content, message_type || 'text', parent_message_id]
    );

    // Update channel's updated_at
    await db.query(
      'UPDATE channels SET updated_at = NOW() WHERE id = $1',
      [channel_id]
    );

    // Update last_read_at for sender
    await db.query(
      'UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = $1 AND user_id = $2',
      [channel_id, userId]
    );

    // If it's a thread reply, update thread info
    if (parent_message_id) {
      await db.query(
        `INSERT INTO threads (message_id, reply_count, last_reply_at, participants) 
         VALUES ($1, 1, NOW(), ARRAY[$2]::UUID[])
         ON CONFLICT (message_id) 
         DO UPDATE SET 
           reply_count = threads.reply_count + 1,
           last_reply_at = NOW(),
           participants = ARRAY(
             SELECT DISTINCT unnest(
               threads.participants || $2::UUID
             )
           )`,
        [parent_message_id, userId]
      );
    }

    // Get complete message with user info
    const completeMessage = await db.query(
      `SELECT m.*, 
              u.username, u.display_name, u.avatar_url,
              (SELECT COUNT(*) FROM reactions WHERE message_id = m.id) as reaction_count,
              (SELECT COUNT(*) FROM messages WHERE parent_message_id = m.id) as reply_count
       FROM messages m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.id = $1`,
      [message.rows[0].id]
    );

    res.status(201).json(completeMessage.rows[0]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get channel messages
router.get('/channel/:channelId', authMiddleware, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 50, before, after } = req.query;
    const userId = req.userId;

    // Check if user has access
    const membership = await db.query(
      'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId]
    );

    if (membership.rows.length === 0) {
      const channel = await db.query(
        'SELECT is_private FROM channels WHERE id = $1',
        [channelId]
      );

      if (channel.rows.length === 0 || channel.rows[0].is_private) {
        return res.status(403).json({ error: 'No access to this channel' });
      }
    }

    let query = `
      SELECT m.*, 
             u.username, u.display_name, u.avatar_url, u.status, u.is_online,
             (SELECT COUNT(*) FROM reactions WHERE message_id = m.id) as reaction_count,
             (SELECT COUNT(*) FROM messages WHERE parent_message_id = m.id) as reply_count,
             (SELECT json_agg(json_build_object(
               'emoji', r.emoji,
               'count', (SELECT COUNT(*) FROM reactions r2 WHERE r2.message_id = m.id AND r2.emoji = r.emoji),
               'users', (SELECT array_agg(r2.user_id) FROM reactions r2 WHERE r2.message_id = m.id AND r2.emoji = r.emoji)
             )) FROM (SELECT DISTINCT emoji FROM reactions WHERE message_id = m.id) r) as reactions
      FROM messages m 
      JOIN users u ON m.user_id = u.id 
      WHERE m.channel_id = $1 AND m.parent_message_id IS NULL AND m.is_deleted = false
    `;

    const params = [channelId];
    let paramCount = 2;

    if (before) {
      query += ` AND m.created_at < $${paramCount}`;
      params.push(before);
      paramCount++;
    }

    if (after) {
      query += ` AND m.created_at > $${paramCount}`;
      params.push(after);
      paramCount++;
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const messages = await db.query(query, params);

    // Update last_read_at
    if (membership.rows.length > 0) {
      await db.query(
        'UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
      );
    }

    res.json(messages.rows.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get thread messages
router.get('/:messageId/thread', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.userId;

    // Get parent message
    const parentMessage = await db.query(
      `SELECT m.*, c.id as channel_id 
       FROM messages m 
       JOIN channels c ON m.channel_id = c.id 
       WHERE m.id = $1`,
      [messageId]
    );

    if (parentMessage.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const channelId = parentMessage.rows[0].channel_id;

    // Check if user has access to channel
    const membership = await db.query(
      'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
      [channelId, userId]
    );

    if (membership.rows.length === 0) {
      const channel = await db.query(
        'SELECT is_private FROM channels WHERE id = $1',
        [channelId]
      );

      if (channel.rows[0].is_private) {
        return res.status(403).json({ error: 'No access to this thread' });
      }
    }

    // Get thread messages
    const messages = await db.query(
      `SELECT m.*, 
              u.username, u.display_name, u.avatar_url, u.status, u.is_online,
              (SELECT COUNT(*) FROM reactions WHERE message_id = m.id) as reaction_count
       FROM messages m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.parent_message_id = $1 AND m.is_deleted = false
       ORDER BY m.created_at ASC`,
      [messageId]
    );

    res.json({
      parent: parentMessage.rows[0],
      replies: messages.rows
    });
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update message
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    // Check if user owns the message
    const message = await db.query(
      'SELECT * FROM messages WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (message.rows.length === 0) {
      return res.status(403).json({ error: 'Cannot edit this message' });
    }

    // Update message
    const updated = await db.query(
      `UPDATE messages 
       SET content = $1, is_edited = true, edited_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [content, id]
    );

    // Get complete message with user info
    const completeMessage = await db.query(
      `SELECT m.*, 
              u.username, u.display_name, u.avatar_url,
              (SELECT COUNT(*) FROM reactions WHERE message_id = m.id) as reaction_count,
              (SELECT COUNT(*) FROM messages WHERE parent_message_id = m.id) as reply_count
       FROM messages m 
       JOIN users u ON m.user_id = u.id 
       WHERE m.id = $1`,
      [id]
    );

    res.json(completeMessage.rows[0]);
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete message
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if user owns the message
    const message = await db.query(
      'SELECT * FROM messages WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (message.rows.length === 0) {
      return res.status(403).json({ error: 'Cannot delete this message' });
    }

    // Soft delete
    await db.query(
      `UPDATE messages 
       SET is_deleted = true, deleted_at = NOW(), content = '[Message deleted]' 
       WHERE id = $1`,
      [id]
    );

    res.json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add reaction
router.post('/:id/reactions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.userId;

    // Check if reaction already exists
    const existing = await db.query(
      'SELECT * FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [id, userId, emoji]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Reaction already exists' });
    }

    // Add reaction
    const reaction = await db.query(
      `INSERT INTO reactions (message_id, user_id, emoji) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [id, userId, emoji]
    );

    res.status(201).json(reaction.rows[0]);
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove reaction
router.delete('/:id/reactions/:emoji', authMiddleware, async (req, res) => {
  try {
    const { id, emoji } = req.params;
    const userId = req.userId;

    await db.query(
      'DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [id, userId, emoji]
    );

    res.json({ message: 'Reaction removed' });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
