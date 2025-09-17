const db = require('./db');

const setupCallHandlers = (io, socket, userSockets) => {
  // Initiate a call
  socket.on('call:initiate', async (data) => {
    const { targetUserId, channelId, workspaceId, callType = 'audio' } = data;
    
    console.log(`Call initiation request from ${socket.userId} to ${targetUserId}`);
    
    try {
      // Create call record in database
      const callResult = await db.query(
        `INSERT INTO calls (caller_id, recipient_id, channel_id, workspace_id, call_type, status, started_at)
         VALUES ($1, $2, $3, $4, $5, 'ringing', NOW())
         RETURNING *`,
        [socket.userId, targetUserId, channelId, workspaceId, callType]
      );
      
      const call = callResult.rows[0];
      console.log(`Call record created with ID: ${call.id}`);
      
      // Get caller info
      const callerResult = await db.query(
        'SELECT id, username, display_name, avatar_url FROM users WHERE id = $1',
        [socket.userId]
      );
      const caller = callerResult.rows[0];
      
      // Check if recipient is online
      const targetSocketId = userSockets.get(targetUserId);
      console.log(`Target user ${targetUserId} socket: ${targetSocketId}`);
      
      if (targetSocketId) {
        // Send incoming call notification to recipient
        io.to(targetSocketId).emit('call:incoming', {
          callId: call.id,
          caller,
          channelId,
          workspaceId,
          callType
        });
        
        console.log(`Sent incoming call notification to ${targetUserId}`);
        
        // Notify caller that call is initiated
        socket.emit('call:initiated', {
          callId: call.id,
          recipientId: targetUserId,
          status: 'ringing'
        });
      } else {
        // Recipient is offline
        console.log(`Recipient ${targetUserId} is offline`);
        socket.emit('call:recipient_unavailable', {
          recipientId: targetUserId,
          reason: 'offline'
        });
        
        // Update call status
        await db.query(
          'UPDATE calls SET status = $1, ended_at = NOW() WHERE id = $2',
          ['missed', call.id]
        );
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      socket.emit('call:error', { message: 'Failed to initiate call', error: error.message });
    }
  });
  
  // Accept a call
  socket.on('call:accept', async (data) => {
    const { callId } = data;
    
    try {
      // Update call status
      const callResult = await db.query(
        `UPDATE calls SET status = 'connected', connected_at = NOW()
         WHERE id = $1 AND recipient_id = $2
         RETURNING *`,
        [callId, socket.userId]
      );
      
      if (callResult.rows.length === 0) {
        socket.emit('call:error', { message: 'Invalid call' });
        return;
      }
      
      const call = callResult.rows[0];
      const callerSocketId = userSockets.get(call.caller_id);
      
      if (callerSocketId) {
        // Notify caller that call is accepted
        io.to(callerSocketId).emit('call:accepted', {
          callId: call.id,
          acceptedBy: socket.userId
        });
      }
      
      // Create a room for the call
      const callRoom = `call:${callId}`;
      socket.join(callRoom);
      
      // Add caller to the room if online
      if (callerSocketId) {
        const callerSocket = io.sockets.sockets.get(callerSocketId);
        if (callerSocket) {
          callerSocket.join(callRoom);
        }
      }
    } catch (error) {
      console.error('Error accepting call:', error);
      socket.emit('call:error', { message: 'Failed to accept call' });
    }
  });
  
  // Reject a call
  socket.on('call:reject', async (data) => {
    const { callId, reason = 'rejected' } = data;
    
    try {
      // Update call status
      const callResult = await db.query(
        `UPDATE calls SET status = $1, ended_at = NOW()
         WHERE id = $2 AND recipient_id = $3
         RETURNING *`,
        [reason, callId, socket.userId]
      );
      
      if (callResult.rows.length === 0) {
        socket.emit('call:error', { message: 'Invalid call' });
        return;
      }
      
      const call = callResult.rows[0];
      const callerSocketId = userSockets.get(call.caller_id);
      
      if (callerSocketId) {
        // Notify caller that call is rejected
        io.to(callerSocketId).emit('call:rejected', {
          callId: call.id,
          reason,
          rejectedBy: socket.userId
        });
      }
    } catch (error) {
      console.error('Error rejecting call:', error);
      socket.emit('call:error', { message: 'Failed to reject call' });
    }
  });
  
  // End a call
  socket.on('call:end', async (data) => {
    const { callId } = data;
    
    try {
      // Get call details
      const callResult = await db.query(
        'SELECT * FROM calls WHERE id = $1 AND (caller_id = $2 OR recipient_id = $2)',
        [callId, socket.userId]
      );
      
      if (callResult.rows.length === 0) {
        socket.emit('call:error', { message: 'Invalid call' });
        return;
      }
      
      const call = callResult.rows[0];
      
      // Update call status and duration
      await db.query(
        `UPDATE calls 
         SET status = 'ended', 
             ended_at = NOW(),
             duration = EXTRACT(EPOCH FROM (NOW() - connected_at))::INTEGER
         WHERE id = $1`,
        [callId]
      );
      
      // Notify the other party
      const otherUserId = call.caller_id === socket.userId ? call.recipient_id : call.caller_id;
      const otherSocketId = userSockets.get(otherUserId);
      
      if (otherSocketId) {
        io.to(otherSocketId).emit('call:ended', {
          callId: call.id,
          endedBy: socket.userId
        });
      }
      
      // Leave call room
      const callRoom = `call:${callId}`;
      socket.leave(callRoom);
    } catch (error) {
      console.error('Error ending call:', error);
      socket.emit('call:error', { message: 'Failed to end call' });
    }
  });
  
  // WebRTC Signaling: Offer
  socket.on('webrtc:offer', async (data) => {
    const { targetUserId, offer, callId } = data;
    const targetSocketId = userSockets.get(targetUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc:offer', {
        offer,
        callId,
        fromUserId: socket.userId
      });
    }
  });
  
  // WebRTC Signaling: Answer
  socket.on('webrtc:answer', async (data) => {
    const { targetUserId, answer, callId } = data;
    const targetSocketId = userSockets.get(targetUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc:answer', {
        answer,
        callId,
        fromUserId: socket.userId
      });
    }
  });
  
  // WebRTC Signaling: ICE Candidate
  socket.on('webrtc:ice-candidate', async (data) => {
    const { targetUserId, candidate, callId } = data;
    const targetSocketId = userSockets.get(targetUserId);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('webrtc:ice-candidate', {
        candidate,
        callId,
        fromUserId: socket.userId
      });
    }
  });
  
  // Toggle mute
  socket.on('call:toggle-mute', async (data) => {
    const { callId, isMuted } = data;
    
    // Broadcast to call room
    const callRoom = `call:${callId}`;
    socket.to(callRoom).emit('call:user-muted', {
      userId: socket.userId,
      isMuted
    });
  });
  
  // Get active calls for a user
  socket.on('call:get-active', async () => {
    try {
      const result = await db.query(
        `SELECT c.*, 
                u1.username as caller_username, u1.display_name as caller_display_name,
                u2.username as recipient_username, u2.display_name as recipient_display_name
         FROM calls c
         JOIN users u1 ON c.caller_id = u1.id
         JOIN users u2 ON c.recipient_id = u2.id
         WHERE (c.caller_id = $1 OR c.recipient_id = $1)
         AND c.status IN ('ringing', 'connected')
         ORDER BY c.started_at DESC`,
        [socket.userId]
      );
      
      socket.emit('call:active-calls', result.rows);
    } catch (error) {
      console.error('Error getting active calls:', error);
      socket.emit('call:error', { message: 'Failed to get active calls' });
    }
  });
};

module.exports = setupCallHandlers;
