import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Users, AlertCircle, CheckCircle } from 'lucide-react';

const InviteAccept: React.FC = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteCode) {
      setError('Invalid invite link');
      return;
    }

    // If not authenticated, redirect to login with invite code
    if (!isAuthenticated) {
      // Store invite code in localStorage to use after login
      localStorage.setItem('pendingInvite', inviteCode);
      navigate(`/login?invite=${inviteCode}`);
      return;
    }

    // If authenticated, try to join the workspace
    handleJoinWorkspace();
  }, [inviteCode, isAuthenticated]);

  const handleJoinWorkspace = async () => {
    if (!inviteCode) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/workspaces/join/${inviteCode}`);
      
      toast.success('Successfully joined workspace!');
      
      // Clear any pending invite from localStorage
      localStorage.removeItem('pendingInvite');
      
      // Navigate to the workspace
      setTimeout(() => {
        navigate(`/workspace/${response.data.workspace_id}`);
      }, 1000);
    } catch (err: any) {
      console.error('Error joining workspace:', err);
      const errorMessage = err.response?.data?.error || 'Failed to join workspace';
      setError(errorMessage);
      
      // If invite is invalid or expired
      if (err.response?.status === 400) {
        toast.error(errorMessage);
      } else if (err.response?.status === 409) {
        // Already a member
        toast('You are already a member of this workspace', {
          icon: '✅',
        });
        navigate('/workspace');
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // If not authenticated, this component won't show (will redirect to login)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          {loading ? (
            <>
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Joining Workspace
              </h2>
              <p className="text-gray-600">
                Please wait while we add you to the workspace...
              </p>
            </>
          ) : error ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Unable to Join
              </h2>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => navigate('/workspace')}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Go to Workspaces
              </button>
            </>
          ) : inviteDetails ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Successfully Joined!
              </h2>
              <p className="text-gray-600">
                Redirecting to workspace...
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default InviteAccept;
