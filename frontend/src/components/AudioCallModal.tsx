import React, { useEffect, useRef, useState } from 'react';
import { X, Phone, PhoneOff, Mic, MicOff, User } from 'lucide-react';
import webrtcService, { CallState } from '../services/webrtc';

interface AudioCallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioCallModal: React.FC<AudioCallModalProps> = ({ isOpen, onClose }) => {
  const [callState, setCallState] = useState<CallState>(webrtcService.getCallState());
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Set up WebRTC state listener
    webrtcService.setOnStateChange(setCallState);

    return () => {
      webrtcService.setOnStateChange(null);
    };
  }, []);

  useEffect(() => {
    // Play remote audio stream
    if (remoteAudioRef.current && callState.remoteStream) {
      remoteAudioRef.current.srcObject = callState.remoteStream;
      remoteAudioRef.current.play().catch(console.error);
    }
  }, [callState.remoteStream]);

  const handleAcceptCall = async () => {
    try {
      await webrtcService.acceptCall();
    } catch (error) {
      console.error('Error accepting call:', error);
    }
  };

  const handleRejectCall = () => {
    webrtcService.rejectCall();
  };

  const handleEndCall = () => {
    webrtcService.endCall();
    onClose();
  };

  const handleToggleMute = () => {
    webrtcService.toggleMute();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen || callState.status === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">
              {callState.status === 'ringing' && 'Incoming Call'}
              {callState.status === 'calling' && 'Calling...'}
              {callState.status === 'connected' && 'In Call'}
              {callState.status === 'ended' && 'Call Ended'}
            </h2>
            <button
              onClick={handleEndCall}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Call Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
              {callState.caller?.avatar_url ? (
                <img
                  src={callState.caller.avatar_url}
                  alt={callState.caller.display_name}
                  className="w-24 h-24 rounded-full"
                />
              ) : (
                <User className="h-12 w-12 text-gray-500" />
              )}
            </div>

            {/* Caller Info */}
            <h3 className="text-xl font-semibold text-gray-900 mb-1">
              {callState.status === 'ringing' && callState.caller?.display_name}
              {callState.status === 'calling' && callState.recipient?.display_name}
              {callState.status === 'connected' && (callState.caller?.display_name || callState.recipient?.display_name)}
            </h3>

            {/* Call Status */}
            <p className="text-sm text-gray-500">
              {callState.status === 'ringing' && 'is calling you...'}
              {callState.status === 'calling' && 'Waiting for response...'}
              {callState.status === 'connected' && formatDuration(callState.callDuration)}
            </p>

            {/* Remote Mute Indicator */}
            {callState.status === 'connected' && callState.isRemoteMuted && (
              <p className="text-sm text-orange-500 mt-2 flex items-center justify-center">
                <MicOff className="h-4 w-4 mr-1" />
                Remote user is muted
              </p>
            )}
          </div>

          {/* Call Controls */}
          <div className="flex justify-center space-x-4">
            {/* Accept/Reject for incoming calls */}
            {callState.status === 'ringing' && (
              <>
                <button
                  onClick={handleRejectCall}
                  className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  title="Reject call"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
                <button
                  onClick={handleAcceptCall}
                  className="p-4 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors animate-pulse"
                  title="Accept call"
                >
                  <Phone className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Controls during call */}
            {(callState.status === 'connected' || callState.status === 'calling') && (
              <>
                <button
                  onClick={handleToggleMute}
                  className={`p-4 rounded-full transition-colors ${
                    callState.isMuted 
                      ? 'bg-red-500 text-white hover:bg-red-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title={callState.isMuted ? 'Unmute' : 'Mute'}
                >
                  {callState.isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                <button
                  onClick={handleEndCall}
                  className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  title="End call"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Hidden audio element for remote stream */}
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
};
