import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Smile, Paperclip, AtSign, Bold, Italic, 
  Code, Link2, List, ListOrdered, Quote
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import socketService from '../../services/socket';

interface MessageInputProps {
  channelName?: string;
  placeholder?: string;
  onSendMessage: (content: string) => void;
  channelId?: string;
  isThread?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  channelName,
  placeholder,
  onSendMessage,
  channelId,
  isThread = false,
}) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      stopTyping();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = () => {
    if (!isTyping && channelId && !isThread) {
      setIsTyping(true);
      socketService.startTyping(channelId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const stopTyping = () => {
    if (isTyping && channelId && !isThread) {
      setIsTyping(false);
      socketService.stopTyping(channelId);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setMessage(prev => prev + emoji.emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const insertFormatting = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    
    const newText = 
      message.substring(0, start) + 
      before + 
      (selectedText || 'text') + 
      after + 
      message.substring(end);
    
    setMessage(newText);
    
    // Set cursor position
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + before.length, end + before.length);
      } else {
        textarea.setSelectionRange(start + before.length, start + before.length + 4);
      }
    }, 0);
  };

  return (
    <div className="px-5 pb-6">
      <div className="relative border border-gray-300 rounded-lg focus-within:border-gray-400 bg-white">
        {/* Formatting Toolbar */}
        <div className="flex items-center px-3 py-1 border-b border-gray-200">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => insertFormatting('**', '**')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('_', '_')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('`', '`')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Code"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('[', '](url)')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Link"
            >
              <Link2 className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button
              type="button"
              onClick={() => insertFormatting('- ')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Bulleted List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('1. ')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('> ')}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Quote"
            >
              <Quote className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Input */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || `Message ${channelName ? '#' + channelName : ''}`}
            className="w-full px-3 py-2 resize-none focus:outline-none min-h-[44px] max-h-[200px]"
            rows={1}
          />

          {/* Action Buttons */}
          <div className="absolute bottom-2 right-2 flex items-center space-x-2">
            <button
              type="button"
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Attach files"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Mention someone"
            >
              <AtSign className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!message.trim()}
              className={`p-1.5 rounded ${
                message.trim()
                  ? 'bg-slack-green hover:bg-green-700 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-12 right-2 z-50">
            <div
              className="fixed inset-0"
              onClick={() => setShowEmojiPicker(false)}
            />
            <EmojiPicker onEmojiClick={handleEmojiSelect} />
          </div>
        )}
      </div>

      {/* Hint Text */}
      <div className="mt-1 text-xs text-gray-500">
        <strong>Shift + Enter</strong> to add a new line
      </div>
    </div>
  );
};

export default MessageInput;
