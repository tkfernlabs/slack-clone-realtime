import React, { useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { MoreHorizontal, Edit2, Trash2, MessageSquare, Smile } from 'lucide-react';
import { Message } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import EmojiPicker from 'emoji-picker-react';

interface MessageListProps {
  messages: Message[];
  onThreadClick?: (message: Message) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onReaction: (messageId: string, emoji: string, add: boolean) => void;
  isThread?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  onThreadClick,
  onEditMessage,
  onDeleteMessage,
  onReaction,
  isThread = false,
}) => {
  const { user } = useAuth();
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    }
    return format(date, 'MMM d at h:mm a');
  };

  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return 'Today';
    } else if (isYesterday(date)) {
      return 'Yesterday';
    }
    return format(date, 'EEEE, MMMM d');
  };

  const handleEditStart = (message: Message) => {
    setEditingMessage(message.id);
    setEditContent(message.content);
  };

  const handleEditSave = () => {
    if (editingMessage && editContent.trim()) {
      onEditMessage(editingMessage, editContent.trim());
      setEditingMessage(null);
      setEditContent('');
    }
  };

  const handleEditCancel = () => {
    setEditingMessage(null);
    setEditContent('');
  };

  const handleEmojiSelect = (emoji: any, messageId: string) => {
    onReaction(messageId, emoji.emoji, true);
    setShowEmojiPicker(null);
  };

  const handleReactionClick = (messageId: string, emoji: string, userReacted: boolean) => {
    onReaction(messageId, emoji, !userReacted);
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: any, message) => {
    const date = new Date(message.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(groupedMessages).map(([date, dayMessages]) => (
        <div key={date}>
          {/* Date Separator */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white text-sm text-gray-600">
                {formatDateSeparator(new Date(date).toISOString())}
              </span>
            </div>
          </div>

          {/* Messages for this day */}
          {(dayMessages as Message[]).map((message) => (
            <div
              key={message.id}
              className={`group relative px-5 py-1 hover:bg-gray-50 ${
                hoveredMessage === message.id ? 'bg-gray-50' : ''
              }`}
              onMouseEnter={() => setHoveredMessage(message.id)}
              onMouseLeave={() => setHoveredMessage(null)}
            >
              <div className="flex space-x-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-9 h-9 bg-gray-400 rounded flex items-center justify-center text-white font-semibold">
                    {message.display_name?.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-baseline space-x-2 mb-0.5">
                    <span className="font-bold text-slack-text">
                      {message.display_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(message.created_at)}
                    </span>
                    {message.is_edited && (
                      <span className="text-xs text-gray-500">(edited)</span>
                    )}
                  </div>

                  {/* Content */}
                  {editingMessage === message.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-slack-active"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={handleEditSave}
                          className="px-3 py-1 bg-slack-green text-white text-sm rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {message.is_deleted ? (
                        <p className="text-gray-500 italic">{message.content}</p>
                      ) : (
                        <div className="text-slack-text">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      )}

                      {/* Reactions */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {message.reactions.map((reaction) => {
                            const userReacted = reaction.users.includes(user?.id || '');
                            return (
                              <button
                                key={reaction.emoji}
                                onClick={() => handleReactionClick(message.id, reaction.emoji, userReacted)}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                                  userReacted
                                    ? 'bg-blue-100 border border-blue-300'
                                    : 'bg-gray-100 border border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <span>{reaction.emoji}</span>
                                <span className="ml-1">{reaction.count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Thread Indicator */}
                      {!isThread && message.reply_count && parseInt(message.reply_count) > 0 && (
                        <button
                          onClick={() => onThreadClick?.(message)}
                          className="flex items-center space-x-2 mt-1 text-slack-active hover:underline"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-sm">
                            {message.reply_count} {parseInt(message.reply_count) === 1 ? 'reply' : 'replies'}
                          </span>
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Actions */}
                {hoveredMessage === message.id && !editingMessage && !message.is_deleted && (
                  <div className="absolute right-5 top-0 -mt-2 bg-white border border-gray-200 rounded shadow-sm">
                    <div className="flex items-center">
                      <button
                        onClick={() => setShowEmojiPicker(message.id)}
                        className="p-1.5 hover:bg-gray-100 text-gray-600"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      {!isThread && (
                        <button
                          onClick={() => onThreadClick?.(message)}
                          className="p-1.5 hover:bg-gray-100 text-gray-600"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      )}
                      {message.user_id === user?.id && (
                        <>
                          <button
                            onClick={() => handleEditStart(message)}
                            className="p-1.5 hover:bg-gray-100 text-gray-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteMessage(message.id)}
                            className="p-1.5 hover:bg-gray-100 text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button className="p-1.5 hover:bg-gray-100 text-gray-600">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Emoji Picker */}
                    {showEmojiPicker === message.id && (
                      <div className="absolute top-8 right-0 z-50">
                        <div
                          className="fixed inset-0"
                          onClick={() => setShowEmojiPicker(null)}
                        />
                        <EmojiPicker
                          onEmojiClick={(emoji) => handleEmojiSelect(emoji, message.id)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default MessageList;
