import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, Plus, Building2 } from 'lucide-react';
import { Workspace } from '../../types';
import { workspaceApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const WorkspaceList: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', url_slug: '' });
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const response = await workspaceApi.getMyWorkspaces();
      setWorkspaces(response.data);
    } catch (error) {
      console.error('Error loading workspaces:', error);
      toast.error('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newWorkspace.name.trim() || !newWorkspace.url_slug.trim()) {
      toast.error('All fields are required');
      return;
    }

    setCreating(true);
    try {
      const response = await workspaceApi.createWorkspace({
        name: newWorkspace.name,
        url_slug: newWorkspace.url_slug.toLowerCase().replace(/\s+/g, '-'),
      });
      
      toast.success('Workspace created successfully');
      navigate(`/workspace/${response.data.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slack-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slack-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workspaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slack-bg">
      <div className="max-w-4xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-slack-purple rounded-2xl flex items-center justify-center">
              <Hash className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slack-text mb-2">
            Welcome back, {user?.display_name}!
          </h1>
          <p className="text-gray-600">Choose a workspace to continue</p>
        </div>

        {/* Workspaces Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => navigate(`/workspace/${workspace.id}`)}
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-slack-purple rounded-lg flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slack-text">{workspace.name}</h3>
                  <p className="text-sm text-gray-500">/{workspace.url_slug}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {workspace.role === 'owner' ? 'Owner' : workspace.role}
                  </p>
                </div>
              </div>
            </button>
          ))}

          {/* Create New Workspace */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border-2 border-dashed border-gray-300 hover:border-slack-purple group"
          >
            <div className="flex items-center justify-center space-x-3 text-gray-500 group-hover:text-slack-purple">
              <Plus className="w-8 h-8" />
              <span className="font-semibold">Create Workspace</span>
            </div>
          </button>
        </div>
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-slack-text">Create a workspace</h2>
            </div>

            <form onSubmit={handleCreateWorkspace} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workspace name
                </label>
                <input
                  type="text"
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                  placeholder="Acme Inc"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workspace URL
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-500">
                    slack.com/
                  </span>
                  <input
                    type="text"
                    value={newWorkspace.url_slug}
                    onChange={(e) => setNewWorkspace({ ...newWorkspace, url_slug: e.target.value })}
                    placeholder="acme-inc"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-slack-purple focus:border-transparent"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Choose a URL for your workspace. Use lowercase letters, numbers, and hyphens.
                </p>
              </div>
            </form>

            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkspace}
                disabled={creating}
                className="px-4 py-2 bg-slack-purple text-white rounded hover:bg-slack-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceList;
