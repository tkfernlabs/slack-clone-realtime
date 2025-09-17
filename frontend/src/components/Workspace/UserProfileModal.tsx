import React, { useState } from 'react';
import { X, Circle, Camera } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { userApi } from '../../services/api';
import toast from 'react-hot-toast';

interface UserProfileModalProps {
  onClose: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [statusMessage, setStatusMessage] = useState(user?.status_message || '');
  const [status, setStatus] = useState(user?.status || 'online');
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      await userApi.updateProfile({ display_name: displayName });
      toast.success('Profile updated');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    setLoading(true);
    try {
      await userApi.updateStatus({ status, status_message: statusMessage });
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { value: 'online', label: 'Active', color: 'text-slack-presence' },
    { value: 'away', label: 'Away', color: 'text-yellow-500' },
    { value: 'dnd', label: 'Do not disturb', color: 'text-red-500' },
    { value: 'offline', label: 'Offline', color: 'text-gray-500' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-slack-text">Profile</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 bg-gray-400 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {user?.display_name?.charAt(0).toUpperCase()}
              </div>
              <button className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 shadow-lg border border-gray-200 hover:bg-gray-50">
                <Camera className="w-4 h-4 text-gray-600" />
              </button>
              <Circle 
                className={`absolute bottom-1 left-1 w-5 h-5 ${
                  user?.is_online ? 'text-slack-presence' : 'text-gray-500'
                } fill-current`}
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slack-purple focus:border-transparent"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={user?.username || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'online' | 'away' | 'dnd' | 'offline')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slack-purple focus:border-transparent"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status message
            </label>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="What's your status?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slack-purple focus:border-transparent"
              maxLength={100}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              handleUpdateProfile();
              handleUpdateStatus();
              onClose();
            }}
            disabled={loading}
            className="px-4 py-2 bg-slack-green text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
