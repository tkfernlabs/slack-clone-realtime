-- Create workspace invites table
CREATE TABLE IF NOT EXISTS workspace_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    invite_code VARCHAR(50) UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    max_uses INTEGER,
    uses INTEGER DEFAULT 0,
    CONSTRAINT valid_max_uses CHECK (max_uses IS NULL OR max_uses > 0)
);

-- Create index for faster lookups
CREATE INDEX idx_workspace_invites_code ON workspace_invites(invite_code);
CREATE INDEX idx_workspace_invites_workspace ON workspace_invites(workspace_id);
