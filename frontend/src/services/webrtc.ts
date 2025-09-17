import { Socket } from 'socket.io-client';

export interface CallConfig {
  iceServers: RTCIceServer[];
}

export interface CallState {
  callId: string;
  status: 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isRemoteMuted: boolean;
  callDuration: number;
  caller?: any;
  recipient?: any;
}

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private socket: Socket | null = null;
  private callState: CallState = {
    callId: '',
    status: 'idle',
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isRemoteMuted: false,
    callDuration: 0
  };
  private callTimer: NodeJS.Timer | null = null;
  private onStateChangeCallback: ((state: CallState) => void) | null = null;

  private config: CallConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ]
  };

  constructor() {
    this.handleIceCandidate = this.handleIceCandidate.bind(this);
    this.handleRemoteStream = this.handleRemoteStream.bind(this);
    this.handleConnectionStateChange = this.handleConnectionStateChange.bind(this);
  }

  setSocket(socket: Socket) {
    this.socket = socket;
    this.setupSocketHandlers();
  }

  setOnStateChange(callback: ((state: CallState) => void) | null) {
    this.onStateChangeCallback = callback;
  }

  private updateState(updates: Partial<CallState>) {
    this.callState = { ...this.callState, ...updates };
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.callState);
    }
  }

  private setupSocketHandlers() {
    if (!this.socket) return;

    // Incoming call
    this.socket.on('call:incoming', async (data: any) => {
      console.log('Incoming call:', data);
      this.updateState({
        callId: data.callId,
        status: 'ringing',
        caller: data.caller
      });
    });

    // Call initiated response
    this.socket.on('call:initiated', async (data: any) => {
      console.log('Call initiated response:', data);
      // Store recipient info if available
      if (data.recipientId) {
        this.updateState({ recipient: { id: data.recipientId } });
      }
    });
    
    // Call accepted by recipient
    this.socket.on('call:accepted', async (data: any) => {
      console.log('Call accepted:', data);
      // Store the accepting user ID for WebRTC signaling
      if (data.acceptedBy) {
        this.updateState({ recipient: { id: data.acceptedBy } });
      }
      await this.createOffer();
    });

    // Call rejected
    this.socket.on('call:rejected', (data: any) => {
      console.log('Call rejected:', data);
      this.endCall();
    });

    // Call ended
    this.socket.on('call:ended', (data: any) => {
      console.log('Call ended by other party:', data);
      this.endCall();
    });

    // Recipient unavailable
    this.socket.on('call:recipient_unavailable', (data: any) => {
      console.log('Recipient unavailable:', data);
      this.endCall();
    });

    // WebRTC signaling
    this.socket.on('webrtc:offer', async (data: any) => {
      console.log('Received offer:', data);
      await this.handleOffer(data.offer, data.fromUserId);
    });

    this.socket.on('webrtc:answer', async (data: any) => {
      console.log('Received answer:', data);
      await this.handleAnswer(data.answer);
    });

    this.socket.on('webrtc:ice-candidate', async (data: any) => {
      console.log('Received ICE candidate:', data);
      await this.handleNewIceCandidate(data.candidate);
    });

    // Remote user muted/unmuted
    this.socket.on('call:user-muted', (data: any) => {
      this.updateState({ isRemoteMuted: data.isMuted });
    });
  }

  async initiateCall(targetUserId: string, channelId?: string, workspaceId?: string): Promise<void> {
    try {
      console.log('Initiating call to user:', targetUserId);
      
      // Get local audio stream
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Store the recipient ID for later use
      this.updateState({
        status: 'calling',
        localStream: this.localStream,
        recipient: { id: targetUserId }
      });

      // Setup peer connection
      await this.setupPeerConnection();

      // Add local stream tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Send call initiation
      this.socket?.emit('call:initiate', {
        targetUserId,
        channelId,
        workspaceId,
        callType: 'audio'
      });
      
      console.log('Call initiation sent');

    } catch (error) {
      console.error('Error initiating call:', error);
      this.endCall();
      throw error;
    }
  }

  async acceptCall(): Promise<void> {
    try {
      console.log('Accepting call:', this.callState.callId);
      
      // Get local audio stream
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.updateState({
        status: 'connecting',
        localStream: this.localStream
      });

      // Setup peer connection
      await this.setupPeerConnection();

      // Add local stream tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Send accept signal
      this.socket?.emit('call:accept', { callId: this.callState.callId });
      
      console.log('Call accept sent');

      // Don't start timer here, wait for connection

    } catch (error) {
      console.error('Error accepting call:', error);
      this.endCall();
      throw error;
    }
  }

  rejectCall(reason: string = 'rejected'): void {
    this.socket?.emit('call:reject', {
      callId: this.callState.callId,
      reason
    });
    this.endCall();
  }

  endCall(): void {
    // Send end call signal if connected
    if (this.callState.status === 'connected' && this.callState.callId) {
      this.socket?.emit('call:end', { callId: this.callState.callId });
    }

    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop call timer
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }

    // Reset state
    this.updateState({
      callId: '',
      status: 'idle',
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isRemoteMuted: false,
      callDuration: 0,
      caller: undefined,
      recipient: undefined
    });
  }

  toggleMute(): void {
    if (!this.localStream) return;

    const audioTracks = this.localStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !track.enabled;
    });

    const isMuted = !audioTracks[0]?.enabled;
    this.updateState({ isMuted });

    // Notify other party
    this.socket?.emit('call:toggle-mute', {
      callId: this.callState.callId,
      isMuted
    });
  }

  private async setupPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection(this.config);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = this.handleIceCandidate;

    // Handle remote stream
    this.peerConnection.ontrack = this.handleRemoteStream;

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = this.handleConnectionStateChange;
  }

  private handleIceCandidate(event: RTCPeerConnectionIceEvent): void {
    if (event.candidate && this.socket) {
      // Determine target user ID based on call state
      const targetUserId = this.callState.caller?.id || this.callState.recipient?.id;
      
      if (targetUserId) {
        console.log('Sending ICE candidate to:', targetUserId);
        this.socket.emit('webrtc:ice-candidate', {
          targetUserId,
          candidate: event.candidate,
          callId: this.callState.callId
        });
      } else {
        console.warn('No target user ID available for ICE candidate');
      }
    }
  }

  private handleRemoteStream(event: RTCTrackEvent): void {
    console.log('Remote stream received:', event.streams);
    const [remoteStream] = event.streams;
    this.remoteStream = remoteStream;
    this.updateState({ remoteStream });
  }

  private handleConnectionStateChange(): void {
    if (!this.peerConnection) return;

    console.log('Connection state:', this.peerConnection.connectionState);

    switch (this.peerConnection.connectionState) {
      case 'connected':
        this.updateState({ status: 'connected' });
        this.startCallTimer();
        break;
      case 'failed':
      case 'closed':
      case 'disconnected':
        this.endCall();
        break;
    }
  }

  private async createOffer(): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // Determine target user ID
      const targetUserId = this.callState.recipient?.id;
      
      if (targetUserId && this.socket) {
        this.socket.emit('webrtc:offer', {
          targetUserId,
          offer,
          callId: this.callState.callId
        });
      }
    } catch (error) {
      console.error('Error creating offer:', error);
      this.endCall();
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit, fromUserId: string): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      if (this.socket) {
        this.socket.emit('webrtc:answer', {
          targetUserId: fromUserId,
          answer,
          callId: this.callState.callId
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
      this.endCall();
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
      this.endCall();
    }
  }

  private async handleNewIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  private startCallTimer(): void {
    if (this.callTimer) return;

    this.callTimer = setInterval(() => {
      this.updateState({ callDuration: this.callState.callDuration + 1 });
    }, 1000);
  }

  getCallState(): CallState {
    return this.callState;
  }
}

export default new WebRTCService();
