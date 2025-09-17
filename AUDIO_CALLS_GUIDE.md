# Audio Call Feature Guide

## Overview
The Slack clone now includes real-time audio calling capabilities powered by WebRTC technology. Users can make peer-to-peer audio calls directly within the application.

## Features

### ✅ Implemented
- **1-on-1 Audio Calls**: Make direct audio calls to other users
- **Call Controls**: 
  - Accept/Reject incoming calls
  - Mute/Unmute microphone during calls
  - End call at any time
- **Call Status Indicators**:
  - Ringing state for incoming/outgoing calls
  - Connected state with call duration timer
  - User online/offline status
- **WebRTC Integration**:
  - Peer-to-peer connection for low latency
  - ICE candidate exchange for NAT traversal
  - STUN servers for connection establishment

### 🚧 Coming Soon
- **Group Calls**: Audio calls with multiple participants in channels
- **Video Calls**: Face-to-face video communication
- **Screen Sharing**: Share your screen during calls
- **Call Recording**: Record important conversations
- **Call History**: View past calls and durations

## How to Use

### Making a Call
1. **From Direct Messages**:
   - Open a direct message conversation with a user
   - Click the phone icon (📞) in the header
   - Wait for the other user to accept

2. **Receiving a Call**:
   - An incoming call modal will appear automatically
   - You'll see the caller's name and avatar
   - Click the green phone button to accept
   - Click the red phone button to reject

### During a Call
- **Mute/Unmute**: Click the microphone button to toggle mute
- **End Call**: Click the red phone button to end the call
- **Call Duration**: View the ongoing call duration in real-time
- **Remote Mute Indicator**: See when the other party is muted

## Technical Architecture

### Backend Components
- **Socket.IO Signaling**: WebRTC offer/answer exchange
- **Call Management**: Database tracking of call states
- **User Presence**: Real-time online/offline status

### Frontend Components
- **WebRTC Service**: Manages peer connections and media streams
- **Audio Call Modal**: UI for call controls and status
- **Direct Message View**: Integrated call buttons

### Database Schema
```sql
-- Calls table stores call history
calls (
  id: UUID
  caller_id: UUID (references users)
  recipient_id: UUID (references users)
  channel_id: UUID (optional, for channel calls)
  workspace_id: UUID
  call_type: 'audio' | 'video'
  status: 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed'
  started_at: TIMESTAMP
  connected_at: TIMESTAMP
  ended_at: TIMESTAMP
  duration: INTEGER (seconds)
)
```

## Browser Requirements
- **Microphone Permission**: Required for audio calls
- **WebRTC Support**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Secure Context**: HTTPS required for getUserMedia API

## Troubleshooting

### Common Issues

1. **"Failed to start audio call"**
   - Check microphone permissions in browser settings
   - Ensure microphone is not being used by another application
   - Try refreshing the page

2. **"Recipient unavailable"**
   - The other user is offline
   - Wait for them to come online

3. **No audio during call**
   - Check if you're muted (microphone icon)
   - Check system audio settings
   - Verify microphone is working in other applications

4. **Call quality issues**
   - Check internet connection stability
   - Close bandwidth-intensive applications
   - Try moving closer to WiFi router

## Security Considerations
- Calls are peer-to-peer (not routed through server)
- Signaling data is authenticated via JWT tokens
- WebRTC encrypts media streams by default (SRTP)
- No call recording without explicit consent

## API Endpoints

### WebSocket Events

**Outgoing Events**:
- `call:initiate` - Start a new call
- `call:accept` - Accept incoming call
- `call:reject` - Reject incoming call
- `call:end` - End ongoing call
- `call:toggle-mute` - Toggle mute state
- `webrtc:offer` - Send WebRTC offer
- `webrtc:answer` - Send WebRTC answer
- `webrtc:ice-candidate` - Send ICE candidate

**Incoming Events**:
- `call:incoming` - Receive incoming call notification
- `call:accepted` - Call accepted by recipient
- `call:rejected` - Call rejected by recipient
- `call:ended` - Call ended by other party
- `call:recipient_unavailable` - Recipient is offline
- `call:user-muted` - Other party toggled mute
- `webrtc:offer` - Receive WebRTC offer
- `webrtc:answer` - Receive WebRTC answer
- `webrtc:ice-candidate` - Receive ICE candidate

## Future Enhancements

### Phase 2: Video Calls
- Add camera support
- Picture-in-picture mode
- Virtual backgrounds
- Video quality adaptation

### Phase 3: Group Calls
- Multi-party WebRTC mesh/SFU
- Speaker detection
- Participant management
- Push-to-talk mode

### Phase 4: Advanced Features
- Call transfers
- Call waiting/hold
- Voicemail
- Call analytics
- Integration with calendar

## Contributing
To contribute to the audio call feature:
1. Test the feature thoroughly
2. Report bugs with browser console logs
3. Suggest improvements via GitHub issues
4. Submit pull requests for enhancements

## License
This audio call feature is part of the Slack Clone project and follows the same license terms.
