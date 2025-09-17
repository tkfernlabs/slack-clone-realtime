import React, { useState, useEffect, useRef } from 'react';
import { User, Phone, Video, Info, Search, Star, Circle } from 'lucide-react';
import { DirectMessage, Message } from '../../types';
import { messageApi, userApi } from '../../services/api';
import socketService from '../../services/socket';
import webrtcService from '../../services/webrtc';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { AudioCallModal } from '../AudioCallModal';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

interface DirectMessageViewProps {
  directMessage: DirectMessage;
  workspaceId: string;
  onThreadSelect: (message: Message) => void;
}

const DirectMessageView: React.FC<DirectMessageViewProps> = ({ 
  directMessage, 
  workspaceId,
  onThreadSelect 
}) => {
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showCallModal, setShowCallModal] = useState(false);
  const [otherUser, setOtherUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    loadMessages();
    loadOtherUser();
    joinChannel();
    setupSocketListeners();

    return () => {
      cleanupSocketListeners();
      socketService.leaveChannel(directMessage.channel_id);
    };
  }, [directMessage.channel_id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const response = await messageApi.getChannelMessages(directMessage.channel_id);
      setMessages(response.data);
      socketService.markRead(directMessage.channel_id);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadOtherUser = async () => {
    try {
      // Get the other user's details
      const response = await userApi.getUser(directMessage.other_user_id);
      setOtherUser(response.data);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const joinChannel = () => {
    socketService.joinChannel(directMessage.channel_id);
  };

  const setupSocketListeners = () => {
    // Set up WebRTC service with socket
    const socket = socketService.getSocket();
    if (socket) {
      webrtcService.setSocket(socket);
    }

    // Listen for incoming calls
    const handleCallStateChange = (state: any) => {
      if (state.status === 'ringing' || state.status === 'calling' || state.status === 'connected') {
        setShowCallModal(true);
      }
    };
    webrtcService.setOnStateChange(handleCallStateChange);

    socketService.on('new_message', handleNewMessage);
    socketService.on('message_edited', handleMessageEdited);
    socketService.on('message_deleted', handleMessageDeleted);
    socketService.on('reaction_added', handleReactionAdded);
    socketService.on('reaction_removed', handleReactionRemoved);
    socketService.on('typing_indicator', handleTypingIndicator);
  };

  const cleanupSocketListeners = () => {
    socketService.off('new_message', handleNewMessage);
    socketService.off('message_edited', handleMessageEdited);
    socketService.off('message_deleted', handleMessageDeleted);
    socketService.off('reaction_added', handleReactionAdded);
    socketService.off('reaction_removed', handleReactionRemoved);
    socketService.off('typing_indicator', handleTypingIndicator);
  };

  const handleNewMessage = (data: any) => {
    if (data.channel_id === directMessage.channel_id) {
      setMessages(prev => [...prev, data.message]);
      scrollToBottom();
    }
  };

  const handleMessageEdited = (data: any) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === data.message.id ? data.message : msg
      )
    );
  };

  const handleMessageDeleted = (data: any) => {
    setMessages(prev => prev.filter(msg => msg.id !== data.message_id));
  };

  const handleReactionAdded = (data: any) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === data.message_id) {
          const reactions = msg.reactions || [];
          const existingReaction = reactions.find(r => r.emoji === data.reaction.emoji);
          
          if (existingReaction) {
            return {
              ...msg,
              reactions: reactions.map(r =>
                r.emoji === data.reaction.emoji
                  ? { ...r, count: r.count + 1, users: [...r.users, data.reaction.user] }
                  : r
              ),
            };
          } else {
            return {
              ...msg,
              reactions: [...reactions, { 
                emoji: data.reaction.emoji, 
                count: 1, 
                users: [data.reaction.user] 
              }],
            };
          }
        }
        return msg;
      })
    );
  };

  const handleReactionRemoved = (data: any) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === data.message_id) {
          const reactions = msg.reactions || [];
          return {
            ...msg,
            reactions: reactions
              .map(r => {
                if (r.emoji === data.reaction.emoji) {
                  const newUsers = r.users.filter((u: any) => u.id !== data.user_id);
                  return { ...r, count: newUsers.length, users: newUsers };
                }
                return r;
              })
              .filter(r => r.count > 0),
          };
        }
        return msg;
      })
    );
  };

  const handleTypingIndicator = (data: any) => {
    if (data.channel_id !== directMessage.channel_id || data.user.id === currentUser?.id) {
      return;
    }

    // Clear existing timeout for this user
    const existingTimeout = typingTimeouts.current.get(data.user.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Update typing users
    setTypingUsers(prev => new Map(prev).set(data.user.id, data.user.display_name));

    // Set timeout to remove typing indicator
    const timeout = setTimeout(() => {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(data.user.id);
        return newMap;
      });
      typingTimeouts.current.delete(data.user.id);
    }, 3000);

    typingTimeouts.current.set(data.user.id, timeout);
  };

  const handleSendMessage = async (content: string) => {
    try {
      socketService.sendMessage({
        channel_id: directMessage.channel_id,
        content,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      socketService.editMessage({
        message_id: messageId,
        content,
      });
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      socketService.deleteMessage({
        message_id: messageId,
      });
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

  const handleStartAudioCall = async () => {
    try {
      if (!directMessage.other_user_id) {
        toast.error('Unable to identify the user to call');
        return;
      }

      // Start the call
      await webrtcService.initiateCall(
        directMessage.other_user_id,
        directMessage.channel_id,
        workspaceId
      );
      
      setShowCallModal(true);
    } catch (error) {
      console.error('Error starting audio call:', error);
      toast.error('Failed to start audio call. Please check your microphone permissions.');
    }
  };

  const handleStartVideoCall = () => {
    toast('Video calls coming soon! Audio calls are now available.');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const typingUsersArray = Array.from(typingUsers.values());

  return (
    <div className="flex flex-col h-full bg-white">
      {/* DM Header */}
      <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
              {directMessage.other_avatar_url ? (
                <img 
                  src={directMessage.other_avatar_url} 
                  alt={directMessage.other_display_name}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <User className="w-4 h-4 text-gray-600" />
              )}
            </div>
            <Circle 
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
                directMessage.other_is_online ? 'text-slack-presence' : 'text-gray-500'
              } fill-current`}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slack-text flex items-center">
              {directMessage.other_display_name}
            </h2>
            <p className="text-sm text-gray-500">
              {directMessage.other_is_online ? 'Active' : 'Away'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleStartAudioCall}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
            title="Start audio call"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button 
            onClick={handleStartVideoCall}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
            title="Start video call"
          >
            <Video className="w-5 h-5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
            <Star className="w-5 h-5" />
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
            {/* DM Info */}
            <div className="py-8 border-b border-gray-200 mb-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
                  {directMessage.other_avatar_url ? (
                    <img 
                      src={directMessage.other_avatar_url} 
                      alt={directMessage.other_display_name}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <User className="w-6 h-6 text-gray-600" />
                  )}
                </div>
                <h1 className="text-2xl font-bold text-slack-text">
                  {directMessage.other_display_name}
                </h1>
              </div>
              {directMessage.other_status_message && (
                <p className="text-gray-500 text-sm">{directMessage.other_status_message}</p>
              )}
              <p className="text-gray-500 text-sm mt-2">
                This is the beginning of your direct message history with {directMessage.other_display_name}.
              </p>
            </div>

            {/* Messages */}
            <MessageList
              messages={messages}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onThreadClick={onThreadSelect}
              onReaction={handleReaction}
            />

            {/* Typing Indicator */}
            {typingUsersArray.length > 0 && (
              <div className="px-2 py-2 text-sm text-gray-500">
                {typingUsersArray.join(', ')} {typingUsersArray.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        channelName={`@${directMessage.other_display_name}`}
        onSendMessage={handleSendMessage}
        channelId={directMessage.channel_id}
      />

      {/* Audio Call Modal */}
      <AudioCallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
      />
    </div>
  );
};

export default DirectMessageView;
