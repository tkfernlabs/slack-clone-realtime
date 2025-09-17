import React, { useState, useEffect } from 'react';
import { X, Search, MessageCircle, Circle } from 'lucide-react';
import { userApi } from '../../services/api';
import { User, DirectMessage } from '../../types';
import socketService from '../../services/socket';
import toast from 'react-hot-toast';

interface DirectMessageModalProps {
  workspaceId: string;
  onClose: () => void;
  onDirectMessageCreated: (dm: DirectMessage) => void;
}

const DirectMessageModal: React.FC<DirectMessageModalProps> = ({
  workspaceId,
  onClose,
  onDirectMessageCreated
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchQuery]);

  const searchUsers = async () => {
    setLoading(true);
    try {
      const response = await userApi.searchUsers(workspaceId, searchQuery);
      setUsers(response.data);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDirectMessage = async (targetUser: User) => {
    setCreating(true);
    try {
      const response = await userApi.createDirectMessage(workspaceId, targetUser.id);
      
      // Create a DirectMessage object from the response
      const dm: DirectMessage = {
        channel_id: response.data.channel_id,
        other_user_id: response.data.other_user_id,
        other_username: response.data.other_user.username,
        other_display_name: response.data.other_user.display_name,
        other_avatar_url: response.data.other_user.avatar_url,
        other_status: response.data.other_user.status,
        other_status_message: response.data.other_user.status_message,
        other_is_online: response.data.other_user.is_online,
        last_message: '',
        unread_count: '0',
        last_read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      toast.success(`Direct message with ${targetUser.display_name} created`);
      
      // Emit an event to notify other components
      if (socketService.getSocket()) {
        socketService.getSocket()?.emit('dm_created', { dm });
      }
      
      onDirectMessageCreated(dm);
      onClose();
    } catch (error) {
      console.error('Error creating direct message:', error);
      toast.error('Failed to create direct message');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Start a Direct Message
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a user..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slack-purple"
              autoFocus
            />
          </div>

          {/* Search Results */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple mx-auto"></div>
              </div>
            ) : searchQuery.length < 2 ? (
              <p className="text-gray-500 text-center py-4">
                Type at least 2 characters to search
              </p>
            ) : users.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No users found
              </p>
            ) : (
              <div className="space-y-1">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleCreateDirectMessage(user)}
                    disabled={creating}
                    className="w-full flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <div className="relative">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.display_name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {user.display_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <Circle
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
                          user.is_online ? 'text-green-500' : 'text-gray-400'
                        } fill-current`}
                      />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900">
                        {user.display_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        @{user.username}
                      </div>
                    </div>
                    <MessageCircle className="w-5 h-5 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
          <p className="text-sm text-gray-600">
            Select a user to start a direct message conversation
          </p>
        </div>
      </div>
    </div>
  );
};

export default DirectMessageModal;
