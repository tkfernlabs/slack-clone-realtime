import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Message, Thread } from '../../types';
import { messageApi } from '../../services/api';
import socketService from '../../services/socket';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface ThreadViewProps {
  parentMessage: Message;
  onClose: () => void;
}

const ThreadView: React.FC<ThreadViewProps> = ({ parentMessage, onClose }) => {
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThread();
    setupSocketListeners();

    return () => {
      cleanupSocketListeners();
    };
  }, [parentMessage.id]);

  useEffect(() => {
    scrollToBottom();
  }, [thread?.replies]);

  const loadThread = async () => {
    setLoading(true);
    try {
      const response = await messageApi.getThread(parentMessage.id);
      setThread(response.data);
    } catch (error) {
      console.error('Error loading thread:', error);
      toast.error('Failed to load thread');
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    socketService.on('new_message', handleNewMessage);
    socketService.on('message_edited', handleMessageEdited);
    socketService.on('message_deleted', handleMessageDeleted);
    socketService.on('thread_updated', handleThreadUpdated);
  };

  const cleanupSocketListeners = () => {
    socketService.off('new_message', handleNewMessage);
    socketService.off('message_edited', handleMessageEdited);
    socketService.off('message_deleted', handleMessageDeleted);
    socketService.off('thread_updated', handleThreadUpdated);
  };

  const handleNewMessage = (message: Message) => {
    if (message.parent_message_id === parentMessage.id) {
      setThread(prev => prev ? {
        ...prev,
        replies: [...prev.replies, message]
      } : null);
    }
  };

  const handleMessageEdited = (editedMessage: Message) => {
    setThread(prev => {
      if (!prev) return null;
      
      if (editedMessage.id === prev.parent.id) {
        return { ...prev, parent: editedMessage };
      }
      
      return {
        ...prev,
        replies: prev.replies.map(msg => 
          msg.id === editedMessage.id ? editedMessage : msg
        )
      };
    });
  };

  const handleMessageDeleted = (data: { message_id: string }) => {
    setThread(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        replies: prev.replies.map(msg => 
          msg.id === data.message_id 
            ? { ...msg, is_deleted: true, content: '[Message deleted]' }
            : msg
        )
      };
    });
  };

  const handleThreadUpdated = (data: { message_id: string; new_reply: Message }) => {
    if (data.message_id === parentMessage.id) {
      loadThread();
    }
  };

  const handleSendReply = async (content: string) => {
    try {
      // Use socket to send the message for real-time updates
      socketService.sendMessage({
        channel_id: parentMessage.channel_id,
        content,
        parent_message_id: parentMessage.id,
      });
      
      // The reply will be received through the socket listeners
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Failed to send reply');
    }
  };

  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      await messageApi.updateMessage(messageId, content);
      toast.success('Message edited');
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await messageApi.deleteMessage(messageId);
      toast.success('Message deleted');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  };

  const handleReaction = async (messageId: string, emoji: string, add: boolean) => {
    try {
      if (add) {
        await messageApi.addReaction(messageId, emoji);
      } else {
        await messageApi.removeReaction(messageId, emoji);
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
      toast.error('Failed to update reaction');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Thread Header */}
      <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slack-text">Thread</h3>
          <p className="text-sm text-gray-500">
            {parentMessage.display_name} • {format(new Date(parentMessage.created_at), 'h:mm a')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Thread Messages */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple"></div>
          </div>
        ) : thread ? (
          <>
            {/* Parent Message */}
            <div className="border-b border-gray-200 pb-4">
              <MessageList
                messages={[thread.parent]}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onReaction={handleReaction}
                isThread={true}
              />
            </div>

            {/* Replies Count */}
            {thread.replies.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-200">
                <p className="text-sm font-semibold text-slack-text">
                  {thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}
                </p>
              </div>
            )}

            {/* Replies */}
            <div className="px-0 py-2">
              {thread.replies.length > 0 ? (
                <MessageList
                  messages={thread.replies}
                  onEditMessage={handleEditMessage}
                  onDeleteMessage={handleDeleteMessage}
                  onReaction={handleReaction}
                  isThread={true}
                />
              ) : (
                <div className="px-5 py-8 text-center text-gray-500">
                  No replies yet. Start the conversation!
                </div>
              )}
            </div>

            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Thread not found
          </div>
        )}
      </div>

      {/* Reply Input */}
      {thread && (
        <MessageInput
          placeholder="Reply..."
          onSendMessage={handleSendReply}
          isThread={true}
        />
      )}
    </div>
  );
};

export default ThreadView;
