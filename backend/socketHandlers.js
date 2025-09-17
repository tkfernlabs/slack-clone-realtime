const db = require('./db');
const setupCallHandlers = require('./callHandlers');

const setupSocketHandlers = (io) => {
  // Store user socket mappings
  const userSockets = new Map();
  const userChannels = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.userId);

    // Store user socket
    if (socket.userId) {
      userSockets.set(socket.userId, socket.id);
      
      // Update user online status
      db.query(
        'UPDATE users SET is_online = true, status = $1, last_seen = NOW() WHERE id = $2',
        ['online', socket.userId]
      ).catch(console.error);

      // Update user presence
      db.query(
        `INSERT INTO user_presence (user_id, status, is_active, last_activity) 
         VALUES ($1, 'online', true, NOW()) 
         ON CONFLICT (user_id) 
         DO UPDATE SET status = 'online', is_active = true, last_activity = NOW()`,
        [socket.userId]
      ).catch(console.error);
    }

    // Join workspace
    socket.on('join_workspace', async (workspaceId) => {
      try {
        // Verify membership
        const membership = await db.query(
          'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
          [workspaceId, socket.userId]
        );

        if (membership.rows.length > 0) {
          socket.join(`workspace:${workspaceId}`);
          
          // Get all channels user is member of
          const channels = await db.query(
            `SELECT c.id FROM channels c 
             JOIN channel_members cm ON c.id = cm.channel_id 
             WHERE c.workspace_id = $1 AND cm.user_id = $2`,
            [workspaceId, socket.userId]
          );

          // Join all channels
          channels.rows.forEach(channel => {
            socket.join(`channel:${channel.id}`);
          });

          // Notify workspace members that user is online
          socket.to(`workspace:${workspaceId}`).emit('user_online', {
            userId: socket.userId,
            status: 'online'
          });

          socket.emit('joined_workspace', { workspaceId });
        }
      } catch (error) {
        console.error('Join workspace error:', error);
        socket.emit('error', { message: 'Failed to join workspace' });
      }
    });

    // Join channel
    socket.on('join_channel', async (channelId) => {
      try {
        // Verify membership or if channel is public
        const membership = await db.query(
          'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
          [channelId, socket.userId]
        );

        const channel = await db.query(
          'SELECT * FROM channels WHERE id = $1',
          [channelId]
        );

        if (membership.rows.length > 0 || !channel.rows[0]?.is_private) {
          socket.join(`channel:${channelId}`);
          
          // Store user's active channels
          if (!userChannels.has(socket.userId)) {
            userChannels.set(socket.userId, new Set());
          }
          userChannels.get(socket.userId).add(channelId);

          socket.emit('joined_channel', { channelId });

          // Notify channel members
          socket.to(`channel:${channelId}`).emit('user_joined_channel', {
            channelId,
            userId: socket.userId
          });
        }
      } catch (error) {
        console.error('Join channel error:', error);
        socket.emit('error', { message: 'Failed to join channel' });
      }
    });

    // Leave channel
    socket.on('leave_channel', (channelId) => {
      socket.leave(`channel:${channelId}`);
      
      if (userChannels.has(socket.userId)) {
        userChannels.get(socket.userId).delete(channelId);
      }

      socket.to(`channel:${channelId}`).emit('user_left_channel', {
        channelId,
        userId: socket.userId
      });
    });

    // Send message
    socket.on('send_message', async (data) => {
      try {
        const { channel_id, content, message_type, parent_message_id } = data;

        // Verify user can send to this channel
        const membership = await db.query(
          'SELECT * FROM channel_members WHERE channel_id = $1 AND user_id = $2',
          [channel_id, socket.userId]
        );

        const channel = await db.query(
          'SELECT * FROM channels WHERE id = $1',
          [channel_id]
        );

        if (membership.rows.length === 0 && channel.rows[0]?.is_private) {
          return socket.emit('error', { message: 'No access to this channel' });
        }

        // Create message
        const message = await db.query(
          `INSERT INTO messages (channel_id, user_id, content, message_type, parent_message_id) 
           VALUES ($1, $2, $3, $4, $5) 
           RETURNING *`,
          [channel_id, socket.userId, content, message_type || 'text', parent_message_id]
        );

        // Update channel
        await db.query(
          'UPDATE channels SET updated_at = NOW() WHERE id = $1',
          [channel_id]
        );

        // Get complete message with user info
        const completeMessage = await db.query(
          `SELECT m.*, 
                  u.username, u.display_name, u.avatar_url, u.status, u.is_online,
                  (SELECT COUNT(*) FROM reactions WHERE message_id = m.id) as reaction_count,
                  (SELECT COUNT(*) FROM messages WHERE parent_message_id = m.id) as reply_count
           FROM messages m 
           JOIN users u ON m.user_id = u.id 
           WHERE m.id = $1`,
          [message.rows[0].id]
        );

        // Emit to channel members
        io.to(`channel:${channel_id}`).emit('new_message', completeMessage.rows[0]);

        // Handle mentions
        const mentions = extractMentions(content);
        if (mentions.length > 0) {
          for (const mention of mentions) {
            const mentionedUser = await db.query(
              'SELECT id FROM users WHERE username = $1',
              [mention.replace('@', '')]
            );

            if (mentionedUser.rows.length > 0) {
              const mentionedUserId = mentionedUser.rows[0].id;
              
              // Store mention
              await db.query(
                `INSERT INTO mentions (message_id, mentioned_user_id, mention_type) 
                 VALUES ($1, $2, 'user')`,
                [message.rows[0].id, mentionedUserId]
              );

              // Notify mentioned user
              const mentionedSocketId = userSockets.get(mentionedUserId);
              if (mentionedSocketId) {
                io.to(mentionedSocketId).emit('mentioned', {
                  message: completeMessage.rows[0],
                  channel_id,
                  workspace_id: channel.rows[0].workspace_id
                });
              }
            }
          }
        }

        // Update thread if it's a reply
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
            [parent_message_id, socket.userId]
          );

          // Notify about thread update
          io.to(`channel:${channel_id}`).emit('thread_updated', {
            message_id: parent_message_id,
            new_reply: completeMessage.rows[0]
          });
        }

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Edit message
    socket.on('edit_message', async (data) => {
      try {
        const { message_id, content } = data;

        // Verify ownership
        const message = await db.query(
          'SELECT * FROM messages WHERE id = $1 AND user_id = $2',
          [message_id, socket.userId]
        );

        if (message.rows.length === 0) {
          return socket.emit('error', { message: 'Cannot edit this message' });
        }

        // Update message
        await db.query(
          `UPDATE messages 
           SET content = $1, is_edited = true, edited_at = NOW() 
           WHERE id = $2`,
          [content, message_id]
        );

        // Get updated message
        const updatedMessage = await db.query(
          `SELECT m.*, 
                  u.username, u.display_name, u.avatar_url
           FROM messages m 
           JOIN users u ON m.user_id = u.id 
           WHERE m.id = $1`,
          [message_id]
        );

        // Notify channel members
        io.to(`channel:${message.rows[0].channel_id}`).emit('message_edited', updatedMessage.rows[0]);

      } catch (error) {
        console.error('Edit message error:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    // Delete message
    socket.on('delete_message', async (data) => {
      try {
        const { message_id } = data;

        // Verify ownership
        const message = await db.query(
          'SELECT * FROM messages WHERE id = $1 AND user_id = $2',
          [message_id, socket.userId]
        );

        if (message.rows.length === 0) {
          return socket.emit('error', { message: 'Cannot delete this message' });
        }

        // Soft delete
        await db.query(
          `UPDATE messages 
           SET is_deleted = true, deleted_at = NOW(), content = '[Message deleted]' 
           WHERE id = $1`,
          [message_id]
        );

        // Notify channel members
        io.to(`channel:${message.rows[0].channel_id}`).emit('message_deleted', {
          message_id,
          channel_id: message.rows[0].channel_id
        });

      } catch (error) {
        console.error('Delete message error:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // Typing indicator
    socket.on('typing_start', async (data) => {
      const { channel_id } = data;
      
      socket.to(`channel:${channel_id}`).emit('user_typing', {
        channel_id,
        userId: socket.userId,
        username: socket.user?.username
      });
    });

    socket.on('typing_stop', async (data) => {
      const { channel_id } = data;
      
      socket.to(`channel:${channel_id}`).emit('user_stopped_typing', {
        channel_id,
        userId: socket.userId
      });
    });

    // Add reaction
    socket.on('add_reaction', async (data) => {
      try {
        const { message_id, emoji } = data;

        // Check if reaction exists
        const existing = await db.query(
          'SELECT * FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
          [message_id, socket.userId, emoji]
        );

        if (existing.rows.length > 0) {
          return;
        }

        // Add reaction
        await db.query(
          `INSERT INTO reactions (message_id, user_id, emoji) 
           VALUES ($1, $2, $3)`,
          [message_id, socket.userId, emoji]
        );

        // Get message channel
        const message = await db.query(
          'SELECT channel_id FROM messages WHERE id = $1',
          [message_id]
        );

        if (message.rows.length > 0) {
          io.to(`channel:${message.rows[0].channel_id}`).emit('reaction_added', {
            message_id,
            user_id: socket.userId,
            emoji
          });
        }

      } catch (error) {
        console.error('Add reaction error:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    // Remove reaction
    socket.on('remove_reaction', async (data) => {
      try {
        const { message_id, emoji } = data;

        await db.query(
          'DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
          [message_id, socket.userId, emoji]
        );

        // Get message channel
        const message = await db.query(
          'SELECT channel_id FROM messages WHERE id = $1',
          [message_id]
        );

        if (message.rows.length > 0) {
          io.to(`channel:${message.rows[0].channel_id}`).emit('reaction_removed', {
            message_id,
            user_id: socket.userId,
            emoji
          });
        }

      } catch (error) {
        console.error('Remove reaction error:', error);
        socket.emit('error', { message: 'Failed to remove reaction' });
      }
    });

    // Update status
    socket.on('update_status', async (data) => {
      try {
        const { status, status_message } = data;

        await db.query(
          `UPDATE users 
           SET status = $1, status_message = $2, updated_at = NOW() 
           WHERE id = $3`,
          [status, status_message, socket.userId]
        );

        // Get user's workspaces
        const workspaces = await db.query(
          'SELECT workspace_id FROM workspace_members WHERE user_id = $1',
          [socket.userId]
        );

        // Notify all workspace members
        workspaces.rows.forEach(ws => {
          io.to(`workspace:${ws.workspace_id}`).emit('user_status_changed', {
            userId: socket.userId,
            status,
            status_message
          });
        });

      } catch (error) {
        console.error('Update status error:', error);
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // Mark channel as read
    socket.on('mark_read', async (data) => {
      try {
        const { channel_id } = data;

        await db.query(
          'UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = $1 AND user_id = $2',
          [channel_id, socket.userId]
        );

        socket.emit('channel_marked_read', { channel_id });

      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Setup call handlers
    setupCallHandlers(io, socket, userSockets);

    // Disconnect
    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.userId);

      if (socket.userId) {
        // Update user offline status
        await db.query(
          'UPDATE users SET is_online = false, status = $1, last_seen = NOW() WHERE id = $2',
          ['offline', socket.userId]
        ).catch(console.error);

        // Update presence
        await db.query(
          `UPDATE user_presence 
           SET status = 'offline', is_active = false, last_activity = NOW() 
           WHERE user_id = $1`,
          [socket.userId]
        ).catch(console.error);

        // Get user's workspaces
        const workspaces = await db.query(
          'SELECT workspace_id FROM workspace_members WHERE user_id = $1',
          [socket.userId]
        ).catch(console.error);

        // Notify workspace members
        if (workspaces?.rows) {
          workspaces.rows.forEach(ws => {
            socket.to(`workspace:${ws.workspace_id}`).emit('user_offline', {
              userId: socket.userId
            });
          });
        }

        // Clean up mappings
        userSockets.delete(socket.userId);
        userChannels.delete(socket.userId);
      }
    });
  });

  // Helper function to extract mentions
  function extractMentions(text) {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[0]);
    }
    
    return mentions;
  }
};

module.exports = setupSocketHandlers;
