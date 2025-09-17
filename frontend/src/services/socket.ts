import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(WS_URL, {
      auth: {
        token,
      },
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });

    this.socket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Workspace events
  joinWorkspace(workspaceId: string): void {
    this.socket?.emit('join_workspace', workspaceId);
  }

  // Channel events
  joinChannel(channelId: string): void {
    this.socket?.emit('join_channel', channelId);
  }

  leaveChannel(channelId: string): void {
    this.socket?.emit('leave_channel', channelId);
  }

  // Message events
  sendMessage(data: {
    channel_id: string;
    content: string;
    message_type?: string;
    parent_message_id?: string;
  }): void {
    this.socket?.emit('send_message', data);
  }

  editMessage(data: { message_id: string; content: string }): void {
    this.socket?.emit('edit_message', data);
  }

  deleteMessage(data: { message_id: string }): void {
    this.socket?.emit('delete_message', data);
  }

  // Typing events
  startTyping(channelId: string): void {
    this.socket?.emit('typing_start', { channel_id: channelId });
  }

  stopTyping(channelId: string): void {
    this.socket?.emit('typing_stop', { channel_id: channelId });
  }

  // Reaction events
  addReaction(data: { message_id: string; emoji: string }): void {
    this.socket?.emit('add_reaction', data);
  }

  removeReaction(data: { message_id: string; emoji: string }): void {
    this.socket?.emit('remove_reaction', data);
  }

  // Status events
  updateStatus(data: { status: string; status_message?: string }): void {
    this.socket?.emit('update_status', data);
  }

  // Mark as read
  markRead(channelId: string): void {
    this.socket?.emit('mark_read', { channel_id: channelId });
  }

  // Event listeners
  on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket?.off(event, callback);
  }
}

export default new SocketService();
