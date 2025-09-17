import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import ChannelView from './ChannelView';
import DirectMessageView from './DirectMessageView';
import ThreadView from './ThreadView';
import { Workspace as WorkspaceType, Channel, Message, DirectMessage } from '../../types';
import { workspaceApi, channelApi } from '../../services/api';
import socketService from '../../services/socket';
import toast from 'react-hot-toast';

const Workspace: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [workspace, setWorkspace] = useState<WorkspaceType | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedDirectMessage, setSelectedDirectMessage] = useState<DirectMessage | null>(null);
  const [selectedThread, setSelectedThread] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspaceId) {
      loadWorkspace();
      loadChannels();
      socketService.joinWorkspace(workspaceId);
    }

    return () => {
      // Cleanup
    };
  }, [workspaceId]);

  const loadWorkspace = async () => {
    if (!workspaceId) return;
    
    try {
      const response = await workspaceApi.getWorkspace(workspaceId);
      setWorkspace(response.data);
    } catch (error) {
      console.error('Error loading workspace:', error);
      toast.error('Failed to load workspace');
    }
  };

  const loadChannels = async () => {
    if (!workspaceId) return;
    
    try {
      const response = await channelApi.getWorkspaceChannels(workspaceId);
      setChannels(response.data);
      
      // Select first channel if none selected
      if (response.data.length > 0 && !selectedChannel) {
        setSelectedChannel(response.data[0]);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
      toast.error('Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    setSelectedDirectMessage(null);
    setSelectedThread(null);
  };

  const handleDirectMessageSelect = (dm: DirectMessage) => {
    setSelectedDirectMessage(dm);
    setSelectedChannel(null);
    setSelectedThread(null);
  };

  const handleThreadSelect = (message: Message) => {
    setSelectedThread(message);
  };

  const handleCloseThread = () => {
    setSelectedThread(null);
  };

  const handleChannelCreated = (channel: Channel) => {
    setChannels([...channels, channel]);
    toast.success(`Channel #${channel.name} created`);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slack-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-white">
      {/* Sidebar */}
      <Sidebar
        workspace={workspace}
        channels={channels}
        selectedChannel={selectedChannel}
        selectedDirectMessage={selectedDirectMessage}
        onChannelSelect={handleChannelSelect}
        onDirectMessageSelect={handleDirectMessageSelect}
        onChannelCreated={handleChannelCreated}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Channel/DM View */}
        <div className={`flex-1 ${selectedThread ? 'border-r border-gray-300' : ''}`}>
          {selectedChannel ? (
            <ChannelView
              channel={selectedChannel}
              onThreadSelect={handleThreadSelect}
            />
          ) : selectedDirectMessage ? (
            <DirectMessageView
              directMessage={selectedDirectMessage}
              workspaceId={workspaceId || ''}
              onThreadSelect={handleThreadSelect}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Select a channel or direct message to start messaging
            </div>
          )}
        </div>

        {/* Thread View */}
        {selectedThread && (
          <div className="w-96 xl:w-[480px]">
            <ThreadView
              parentMessage={selectedThread}
              onClose={handleCloseThread}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Workspace;
