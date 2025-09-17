import React, { useState, useEffect } from 'react';
import { 
  Hash, ChevronDown, Plus, Search, Circle, 
  Home, MessageSquare, Bell, Bookmark, Users, 
  MoreVertical, PenSquare, LogOut, UserPlus
} from 'lucide-react';
import { Workspace, Channel, DirectMessage } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { userApi } from '../../services/api';
import socketService from '../../services/socket';
import CreateChannelModal from './CreateChannelModal';
import UserProfileModal from './UserProfileModal';
import InviteModal from './InviteModal';
import DirectMessageModal from './DirectMessageModal';

interface SidebarProps {
  workspace: Workspace | null;
  channels: Channel[];
  selectedChannel: Channel | null;
  selectedDirectMessage?: DirectMessage | null;
  onChannelSelect: (channel: Channel) => void;
  onDirectMessageSelect?: (dm: DirectMessage) => void;
  onChannelCreated: (channel: Channel) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  workspace,
  channels,
  selectedChannel,
  selectedDirectMessage,
  onChannelSelect,
  onDirectMessageSelect,
  onChannelCreated,
}) => {
  const { user, logout } = useAuth();
  const [showChannels, setShowChannels] = useState(true);
  const [showDirectMessages, setShowDirectMessages] = useState(true);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDirectMessageModal, setShowDirectMessageModal] = useState(false);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);

  useEffect(() => {
    const loadDMs = async () => {
      if (!workspace) return;
      
      try {
        console.log('[useEffect] Loading DMs for workspace:', workspace.id);
        const response = await userApi.getDirectMessages(workspace.id);
        console.log('[useEffect] DM response:', response.data);
        setDirectMessages(response.data || []);
      } catch (error) {
        console.error('[useEffect] Error loading DMs:', error);
      }
    };
    
    if (workspace) {
      console.log('[useEffect] Workspace available, loading DMs');
      loadDMs();
      // Reload DMs every 30 seconds to keep them fresh
      const interval = setInterval(loadDMs, 30000);
      
      // Listen for new messages to update DM list
      const handleNewMessage = (message: any) => {
        // Reload DMs when a new message arrives in a DM channel
        if (message.channel_id) {
          loadDMs();
        }
      };
      
      // Subscribe to socket events
      socketService.on('new_message', handleNewMessage);
      socketService.on('dm_created', loadDMs);
      
      return () => {
        clearInterval(interval);
        socketService.off('new_message', handleNewMessage);
        socketService.off('dm_created', loadDMs);
      };
    }
  }, [workspace]);

  const loadDirectMessages = async () => {
    if (!workspace) return;
    
    try {
      console.log('Loading DMs for workspace:', workspace.id);
      const response = await userApi.getDirectMessages(workspace.id);
      console.log('DM API response:', response);
      console.log('DMs data:', response.data);
      
      // Ensure we have an array
      const dms = Array.isArray(response.data) ? response.data : [];
      setDirectMessages(dms);
      console.log('Set DMs in state:', dms);
    } catch (error: any) {
      console.error('Error loading DMs:', error);
      console.error('Error response:', error.response?.data);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const publicChannels = channels.filter(c => !c.is_private && !c.is_direct);
  const privateChannels = channels.filter(c => c.is_private && !c.is_direct);

  return (
    <>
      <div className="w-64 bg-slack-sidebar text-gray-300 flex flex-col h-full">
        {/* Workspace Header */}
        <div className="px-4 py-3 border-b border-slate-700/50">
          <button className="w-full flex items-center justify-between hover:bg-slate-700/30 rounded px-2 py-1 transition-colors">
            <div className="flex items-center">
              <span className="text-white font-bold text-lg">{workspace?.name || 'Workspace'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <PenSquare className="w-4 h-4 hover:text-white" />
              <ChevronDown className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* User Section */}
        <div className="px-2 py-2 border-b border-slate-700/50">
          <button 
            onClick={() => setShowUserProfile(true)}
            className="w-full flex items-center space-x-2 px-2 py-1 hover:bg-slate-700/30 rounded transition-colors"
          >
            <div className="relative">
              <div className="w-8 h-8 bg-gray-500 rounded flex items-center justify-center text-white text-sm font-semibold">
                {user?.display_name?.charAt(0).toUpperCase()}
              </div>
              <Circle 
                className={`absolute bottom-0 right-0 w-3 h-3 ${
                  user?.is_online ? 'text-slack-presence' : 'text-gray-500'
                } fill-current`}
              />
            </div>
            <div className="flex-1 text-left">
              <div className="text-white text-sm font-medium">{user?.display_name}</div>
              <div className="text-xs text-gray-400">{user?.status_message || 'Active'}</div>
            </div>
          </button>
        </div>

        {/* Quick Actions */}
        <div className="px-2 py-2 space-y-1 border-b border-slate-700/50">
          <button className="w-full flex items-center space-x-3 px-2 py-1 hover:bg-slate-700/30 rounded text-left">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm">Threads</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-2 py-1 hover:bg-slate-700/30 rounded text-left">
            <Bell className="w-4 h-4" />
            <span className="text-sm">Mentions & reactions</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-2 py-1 hover:bg-slate-700/30 rounded text-left">
            <Bookmark className="w-4 h-4" />
            <span className="text-sm">Saved items</span>
          </button>
          <button className="w-full flex items-center space-x-3 px-2 py-1 hover:bg-slate-700/30 rounded text-left">
            <Users className="w-4 h-4" />
            <span className="text-sm">People & user groups</span>
          </button>
          <button 
            onClick={() => setShowInviteModal(true)}
            className="w-full flex items-center space-x-3 px-2 py-1 hover:bg-slate-700/30 rounded text-left text-slack-presence"
          >
            <UserPlus className="w-4 h-4" />
            <span className="text-sm font-medium">Invite people</span>
          </button>
        </div>

        {/* Channels Section */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {/* Channels Header */}
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <button 
              onClick={() => setShowChannels(!showChannels)}
              className="flex items-center space-x-1 hover:text-white text-sm"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${!showChannels ? '-rotate-90' : ''}`} />
              <span>Channels</span>
            </button>
            <button
              onClick={() => setShowCreateChannel(true)}
              className="hover:bg-slate-700/30 rounded p-1"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Channel List */}
          {showChannels && (
            <div className="space-y-0.5">
              {publicChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel)}
                  className={`w-full flex items-center space-x-2 px-2 py-1 rounded text-left transition-colors ${
                    selectedChannel?.id === channel.id
                      ? 'bg-slack-active text-white'
                      : 'hover:bg-slate-700/30'
                  }`}
                >
                  <Hash className="w-4 h-4 opacity-60" />
                  <span className="text-sm">{channel.name}</span>
                  {channel.unread_count && parseInt(channel.unread_count) > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">
                      {channel.unread_count}
                    </span>
                  )}
                </button>
              ))}
              {publicChannels.length === 0 && (
                <div className="px-2 py-1 text-xs text-gray-500">No channels yet</div>
              )}
            </div>
          )}

          {/* Direct Messages Header */}
          <div className="flex items-center justify-between px-2 py-1 mt-4 mb-1">
            <button 
              onClick={() => setShowDirectMessages(!showDirectMessages)}
              className="flex items-center space-x-1 hover:text-white text-sm"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${!showDirectMessages ? '-rotate-90' : ''}`} />
              <span>Direct messages</span>
            </button>
            <button 
              onClick={() => setShowDirectMessageModal(true)}
              className="hover:bg-slate-700/30 rounded p-1"
              title="Start a new direct message"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Direct Messages List */}
          {showDirectMessages && (
            <div className="space-y-0.5">
              {directMessages.map((dm) => (
                <button
                  key={dm.channel_id}
                  onClick={() => onDirectMessageSelect?.(dm)}
                  className={`w-full flex items-center space-x-2 px-2 py-1 rounded text-left hover:bg-slate-700/30 ${
                    selectedDirectMessage?.channel_id === dm.channel_id ? 'bg-slack-active text-white' : ''
                  }`}
                >
                  <div className="relative">
                    <div className="w-5 h-5 bg-gray-600 rounded flex items-center justify-center text-white text-xs">
                      {dm.other_display_name.charAt(0).toUpperCase()}
                    </div>
                    <Circle 
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${
                        dm.other_is_online ? 'text-slack-presence' : 'text-gray-500'
                      } fill-current`}
                    />
                  </div>
                  <span className="text-sm flex-1">{dm.other_display_name}</span>
                  {dm.unread_count && parseInt(dm.unread_count) > 0 && (
                    <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">
                      {dm.unread_count}
                    </span>
                  )}
                </button>
              ))}
              {directMessages.length === 0 && (
                <div className="px-2 py-1 text-xs text-gray-500">No direct messages</div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="px-2 py-2 border-t border-slate-700/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-2 py-1 hover:bg-slate-700/30 rounded text-left text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      {showCreateChannel && (
        <CreateChannelModal
          workspaceId={workspace?.id || ''}
          onClose={() => setShowCreateChannel(false)}
          onChannelCreated={onChannelCreated}
        />
      )}

      {showUserProfile && (
        <UserProfileModal
          onClose={() => setShowUserProfile(false)}
        />
      )}

      {showInviteModal && workspace && (
        <InviteModal
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {showDirectMessageModal && workspace && (
        <DirectMessageModal
          workspaceId={workspace.id}
          onClose={() => setShowDirectMessageModal(false)}
          onDirectMessageCreated={(dm) => {
            // Reload the full DM list to ensure it's properly sorted
            loadDirectMessages();
            // Then select the new DM
            setTimeout(() => {
              onDirectMessageSelect?.(dm);
            }, 100);
          }}
        />
      )}
    </>
  );
};

export default Sidebar;
