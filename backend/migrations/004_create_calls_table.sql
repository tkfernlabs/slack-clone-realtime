-- Create calls table for tracking audio/video calls
CREATE TABLE IF NOT EXISTS calls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    caller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    call_type VARCHAR(20) DEFAULT 'audio' CHECK (call_type IN ('audio', 'video')),
    status VARCHAR(20) DEFAULT 'ringing' CHECK (status IN ('ringing', 'connected', 'ended', 'rejected', 'missed', 'failed')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    connected_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration INTEGER, -- Duration in seconds
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_calls_caller_id ON calls(caller_id);
CREATE INDEX idx_calls_recipient_id ON calls(recipient_id);
CREATE INDEX idx_calls_workspace_id ON calls(workspace_id);
CREATE INDEX idx_calls_channel_id ON calls(channel_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_started_at ON calls(started_at DESC);

-- Create call participants table for group calls (future enhancement)
CREATE TABLE IF NOT EXISTS call_participants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    is_muted BOOLEAN DEFAULT FALSE,
    is_video_enabled BOOLEAN DEFAULT FALSE,
    connection_quality VARCHAR(20) DEFAULT 'good' CHECK (connection_quality IN ('excellent', 'good', 'fair', 'poor')),
    UNIQUE(call_id, user_id)
);

CREATE INDEX idx_call_participants_call_id ON call_participants(call_id);
CREATE INDEX idx_call_participants_user_id ON call_participants(user_id);
