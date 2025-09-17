import React, { useState, useEffect, useRef } from 'react';
import { Hash, Users, Pin, Info, Search, Star, Phone } from 'lucide-react';
import { Channel, Message } from '../../types';
import { messageApi } from '../../services/api';
import socketService from '../../services/socket';
import webrtcService from '../../services/webrtc';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { AudioCallModal } from '../AudioCallModal';
import toast from 'react-hot-toast';

interface ChannelViewProps {
  channel: Channel;
  onThreadSelect: (message: Message) => void;
}

const ChannelView: React.FC<ChannelViewProps> = ({ channel, onThreadSelect }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showCallModal, setShowCallModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    loadMessages();
    joinChannel();
    setupSocketListeners();

    return () => {
      cleanupSocketListeners();
      socketService.leaveChannel(channel.id);
    };
  }, [channel.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await messageApi.getChannelMessages(channel.id);
      setMessages(response.data);
      socketService.markRead(channel.id);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const joinChannel = () => {
    socketService.joinChannel(channel.id);
  };

  const setupSocketListeners = () => {
    // Set up WebRTC service with socket
    const socket = socketService.getSocket();
    if (socket) {
      webrtcService.setSocket(socket);
    }

    // Listen for incoming calls
    const handleCallStateChange = (state: any) => {
      if (state.status === 'ringing') {
        setShowCallModal(true);
      }
    };
    webrtcService.setOnStateChange(handleCallStateChange);

    socketService.on('new_message', handleNewMessage);
    socketService.on('message_edited', handleMessageEdited);
    socketService.on('message_deleted', handleMessageDeleted);
    socketService.on('reaction_added', handleReactionAdded);
    socketService.on('reaction_removed', handleReactionRemoved);
    socketService.on('user_typing', handleUserTyping);
    socketService.on('user_stopped_typing', handleUserStoppedTyping);
  };

  const cleanupSocketListeners = () => {
    socketService.off('new_message');
    socketService.off('message_edited');
    socketService.off('message_deleted');
    socketService.off('reaction_added');
    socketService.off('reaction_removed');
    socketService.off('user_typing');
    socketService.off('user_stopped_typing');
  };

  const handleNewMessage = (message: Message) => {
    if (message.channel_id === channel.id && !message.parent_message_id) {
      setMessages(prev => [...prev, message]);
      socketService.markRead(channel.id);
    }
  };

  const handleMessageEdited = (editedMessage: Message) => {
    setMessages(prev => 
      prev.map(msg => msg.id === editedMessage.id ? editedMessage : msg)
    );
    // Show success toast if it's the current user's message
    const currentUserId = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).id : null;
    if (editedMessage.user_id === currentUserId) {
      toast.success('Message edited');
    }
  };

  const handleMessageDeleted = (data: { message_id: string }) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === data.message_id 
          ? { ...msg, is_deleted: true, content: '[Message deleted]' }
          : msg
      )
    );
    // Show success toast if it's the current user's action
    const message = messages.find(m => m.id === data.message_id);
    const currentUserId = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).id : null;
    if (message && message.user_id === currentUserId) {
      toast.success('Message deleted');
    }
  };

  const handleReactionAdded = (data: any) => {
    // Update message reactions
    setMessages(prev => prev.map(msg => {
      if (msg.id === data.message_id) {
        const reactions = msg.reactions || [];
        const existingReaction = reactions.find(r => r.emoji === data.emoji);
        
        if (existingReaction) {
          existingReaction.count++;
          existingReaction.users.push(data.user_id);
        } else {
          reactions.push({
            emoji: data.emoji,
            count: 1,
            users: [data.user_id]
          });
        }
        
        return { ...msg, reactions };
      }
      return msg;
    }));
  };

  const handleReactionRemoved = (data: any) => {
    // Update message reactions
    setMessages(prev => prev.map(msg => {
      if (msg.id === data.message_id) {
        const reactions = msg.reactions || [];
        const reactionIndex = reactions.findIndex(r => r.emoji === data.emoji);
        
        if (reactionIndex !== -1) {
          const reaction = reactions[reactionIndex];
          reaction.count--;
          reaction.users = reaction.users.filter(id => id !== data.user_id);
          
          if (reaction.count === 0) {
            reactions.splice(reactionIndex, 1);
          }
        }
        
        return { ...msg, reactions };
      }
      return msg;
    }));
  };

  const handleUserTyping = (data: { channel_id: string; userId: string; username: string }) => {
    if (data.channel_id === channel.id) {
      setTypingUsers(prev => new Map(prev).set(data.userId, data.username));
      
      // Clear existing timeout
      const existingTimeout = typingTimeouts.current.get(data.userId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      // Set new timeout to remove typing indicator
      const timeout = setTimeout(() => {
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      }, 3000);
      
      typingTimeouts.current.set(data.userId, timeout);
    }
  };

  const handleUserStoppedTyping = (data: { channel_id: string; userId: string }) => {
    if (data.channel_id === channel.id) {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.userId);
        return newMap;
      });
      
      const timeout = typingTimeouts.current.get(data.userId);
      if (timeout) {
        clearTimeout(timeout);
        typingTimeouts.current.delete(data.userId);
      }
    }
  };

  const handleSendMessage = async (content: string) => {
    try {
      // Use Socket.IO to send the message for real-time updates
      socketService.sendMessage({
        channel_id: channel.id,
        content,
      });
      
      // Note: The message will be added to the UI via the 'new_message' event
      // No need to make an HTTP request here
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      // Use Socket.IO for real-time updates
      socketService.editMessage({
        message_id: messageId,
        content,
      });
      // Success toast will be shown when the socket event is received
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      // Use Socket.IO for real-time updates
      socketService.deleteMessage({
        message_id: messageId,
      });
      // Success toast will be shown when the socket event is received
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const handleReaction = async (messageId: string, emoji: string, add: boolean) => {
    try {
      if (add) {
        socketService.addReaction({
          message_id: messageId,
          emoji,
        });
      } else {
        socketService.removeReaction({
          message_id: messageId,
          emoji,
        });
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
      toast.error('Failed to update reaction');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleStartCall = async () => {
    try {
      // For group calls in channels, we need to implement channel-wide calls
      // For now, let's show a toast that this feature is coming soon
      toast('Group calls in channels coming soon! Try calling a user directly from DMs.');
    } catch (error) {
      console.error('Error starting call:', error);
      toast.error('Failed to start call');
    }
  };

  const typingUsersArray = Array.from(typingUsers.values());

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Channel Header */}
      <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Hash className="w-5 h-5 text-gray-500" />
          <div>
            <h2 className="text-lg font-bold text-slack-text flex items-center">
              {channel.name}
              {channel.is_private && (
                <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                  Private
                </span>
              )}
            </h2>
            {channel.topic && (
              <p className="text-sm text-gray-500">{channel.topic}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleStartCall}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
            title="Start audio call"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
            <Star className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
            <Users className="w-5 h-5" />
            <span className="ml-1 text-sm">{channel.member_count || '0'}</span>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
            <Pin className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-5">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple"></div>
          </div>
        ) : (
          <>
            {/* Channel Info */}
            <div className="py-8 border-b border-gray-200 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Hash className="w-8 h-8 text-gray-500" />
                <h1 className="text-2xl font-bold text-slack-text">#{channel.name}</h1>
              </div>
              <p className="text-gray-600">
                {channel.description || `This is the beginning of the #${channel.name} channel.`}
              </p>
            </div>

            {/* Messages */}
            <MessageList
              messages={messages}
              onThreadClick={onThreadSelect}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onReaction={handleReaction}
            />

            {/* Typing Indicator */}
            {typingUsersArray.length > 0 && (
              <div className="px-5 py-2 text-sm text-gray-500 italic">
                {typingUsersArray.length === 1 
                  ? `${typingUsersArray[0]} is typing...`
                  : `${typingUsersArray.join(', ')} are typing...`
                }
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        channelName={channel.name}
        onSendMessage={handleSendMessage}
        channelId={channel.id}
      />

      {/* Audio Call Modal */}
      <AudioCallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
      />
    </div>
  );
};

export default ChannelView;
