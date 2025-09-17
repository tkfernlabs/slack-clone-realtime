import React, { useState } from 'react';
import { X, Hash, Lock } from 'lucide-react';
import { channelApi } from '../../services/api';
import { Channel } from '../../types';
import toast from 'react-hot-toast';

interface CreateChannelModalProps {
  workspaceId: string;
  onClose: () => void;
  onChannelCreated: (channel: Channel) => void;
}

const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  workspaceId,
  onClose,
  onChannelCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Channel name is required');
      return;
    }

    setLoading(true);
    try {
      const response = await channelApi.createChannel({
        workspace_id: workspaceId,
        name: name.toLowerCase().replace(/\s+/g, '-'),
        description,
        is_private: isPrivate,
      });
      
      onChannelCreated(response.data);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-slack-text">Create a channel</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Hash className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. marketing"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                maxLength={80}
                autoFocus
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Names must be lowercase, without spaces or periods, and can't be longer than 80 characters.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this channel about?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slack-purple focus:border-transparent"
              rows={3}
            />
          </div>

          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 text-slack-purple border-gray-300 rounded focus:ring-slack-purple"
              />
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-gray-500" />
                <div>
                  <span className="text-sm font-medium text-gray-700">Make private</span>
                  <p className="text-xs text-gray-500">
                    When a channel is set to private, it can only be viewed or joined by invitation.
                  </p>
                </div>
              </div>
            </label>
          </div>
        </form>

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
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="px-4 py-2 bg-slack-green text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateChannelModal;
