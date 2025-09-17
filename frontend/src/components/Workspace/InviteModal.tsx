import React, { useState, useEffect } from 'react';
import { X, Copy, Trash2, Users, Link, Calendar, Hash } from 'lucide-react';
import { workspaceApi } from '../../services/api';
import toast from 'react-hot-toast';

interface InviteModalProps {
  workspaceId: string;
  workspaceName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface Invite {
  id: string;
  invite_code: string;
  invite_url: string;
  created_by_username: string;
  created_by_name: string;
  created_at: string;
  expires_at: string;
  max_uses: number | null;
  uses: number;
}

const InviteModal: React.FC<InviteModalProps> = ({
  workspaceId,
  workspaceName,
  isOpen,
  onClose,
}) => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [maxUses, setMaxUses] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadInvites();
    }
  }, [isOpen, workspaceId]);

  const loadInvites = async () => {
    setLoading(true);
    try {
      const response = await workspaceApi.getInvites(workspaceId);
      setInvites(response.data);
    } catch (error) {
      console.error('Error loading invites:', error);
      toast.error('Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const response = await workspaceApi.createInvite(workspaceId, {
        expires_in_days: expiresInDays,
        max_uses: maxUses,
      });
      
      setInvites([response.data, ...invites]);
      toast.success('Invite link created');
      
      // Copy to clipboard automatically
      await navigator.clipboard.writeText(response.data.invite_url);
      toast.success('Invite link copied to clipboard!');
    } catch (error) {
      console.error('Error creating invite:', error);
      toast.error('Failed to create invite');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyLink = async (inviteUrl: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Invite link copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast.error('Failed to copy link');
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!window.confirm('Are you sure you want to delete this invite?')) return;

    try {
      await workspaceApi.deleteInvite(workspaceId, inviteId);
      setInvites(invites.filter(inv => inv.id !== inviteId));
      toast.success('Invite deleted');
    } catch (error) {
      console.error('Error deleting invite:', error);
      toast.error('Failed to delete invite');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-slack-purple" />
            <h2 className="text-xl font-bold text-gray-900">
              Invite people to {workspaceName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Create Invite Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Create New Invite Link
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Expires after
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slack-purple"
                >
                  <option value={1}>1 day</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={0}>Never</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Max uses (optional)
                </label>
                <input
                  type="number"
                  value={maxUses || ''}
                  onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Unlimited"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slack-purple"
                />
              </div>
            </div>
            
            <button
              onClick={handleCreateInvite}
              disabled={creatingInvite}
              className="w-full bg-slack-purple text-white py-2 px-4 rounded-md hover:bg-purple-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {creatingInvite ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Link className="w-4 h-4" />
                  <span>Generate Invite Link</span>
                </>
              )}
            </button>
          </div>

          {/* Existing Invites */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Active Invite Links
            </h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slack-purple mx-auto"></div>
              </div>
            ) : invites.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>No active invites</p>
                <p className="text-sm mt-1">Create an invite link to start inviting people</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono text-gray-700">
                            {invite.invite_code}
                          </code>
                          <button
                            onClick={() => handleCopyLink(invite.invite_url)}
                            className="text-slack-purple hover:text-purple-900 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center space-x-4">
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>
                                Expires: {invite.expires_at ? new Date(invite.expires_at).toLocaleDateString() : 'Never'}
                              </span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Hash className="w-3 h-3" />
                              <span>
                                Uses: {invite.uses} / {invite.max_uses || '∞'}
                              </span>
                            </span>
                          </div>
                          <div>
                            Created by {invite.created_by_name || invite.created_by_username} • 
                            {' '}{new Date(invite.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteInvite(invite.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors ml-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;
