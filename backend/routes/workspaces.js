const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Create workspace
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, icon_url } = req.body;
    let { url_slug } = req.body;
    const userId = req.userId;

    // Generate url_slug from name if not provided
    if (!url_slug) {
      url_slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);
      
      // Add random suffix to ensure uniqueness
      url_slug = `${url_slug}-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Check if url_slug is unique
    const existing = await db.query(
      'SELECT * FROM workspaces WHERE url_slug = $1',
      [url_slug]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'URL slug already exists' });
    }

    // Create workspace
    const workspace = await db.query(
      `INSERT INTO workspaces (name, url_slug, icon_url, created_by) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [name, url_slug, icon_url, userId]
    );

    // Add creator as owner
    await db.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) 
       VALUES ($1, $2, 'owner')`,
      [workspace.rows[0].id, userId]
    );

    // Create default general channel
    await db.query(
      `INSERT INTO channels (workspace_id, name, description, is_private, created_by) 
       VALUES ($1, 'general', 'General discussion', false, $2)`,
      [workspace.rows[0].id, userId]
    );

    res.status(201).json(workspace.rows[0]);
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's workspaces
router.get('/my-workspaces', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const workspaces = await db.query(
      `SELECT w.*, wm.role, wm.joined_at 
       FROM workspaces w 
       JOIN workspace_members wm ON w.id = wm.workspace_id 
       WHERE wm.user_id = $1 
       ORDER BY wm.joined_at DESC`,
      [userId]
    );

    res.json(workspaces.rows);
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workspace by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if user is member
    const membership = await db.query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const workspace = await db.query(
      'SELECT * FROM workspaces WHERE id = $1',
      [id]
    );

    if (workspace.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json(workspace.rows[0]);
  } catch (error) {
    console.error('Get workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workspace members
router.get('/:id/members', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if user is member
    const membership = await db.query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const members = await db.query(
      `SELECT u.id, u.username, u.email, u.display_name, u.avatar_url, 
              u.status, u.status_message, u.is_online, u.last_seen,
              wm.role, wm.joined_at 
       FROM users u 
       JOIN workspace_members wm ON u.id = wm.user_id 
       WHERE wm.workspace_id = $1 
       ORDER BY wm.joined_at ASC`,
      [id]
    );

    res.json(members.rows);
  } catch (error) {
    console.error('Get workspace members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join workspace
router.post('/:id/join', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Check if already member
    const existing = await db.query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already a member' });
    }

    // Add as member
    const member = await db.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) 
       VALUES ($1, $2, 'member') 
       RETURNING *`,
      [id, userId]
    );

    res.status(201).json(member.rows[0]);
  } catch (error) {
    console.error('Join workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate invite link
router.post('/:workspaceId/invite', authMiddleware, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { expires_in_days = 7, max_uses = null } = req.body;
    const userId = req.userId;

    // Check if user is admin/owner
    const membership = await db.query(
      `SELECT * FROM workspace_members 
       WHERE workspace_id = $1 AND user_id = $2 
       AND (role = 'owner' OR role = 'admin')`,
      [workspaceId, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to create invites' });
    }

    // Generate unique invite code
    const inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Handle expiration - if 0, set to null (never expires)
    let expiresAt = null;
    if (expires_in_days && expires_in_days > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }

    // Create invite
    const invite = await db.query(
      `INSERT INTO workspace_invites 
       (workspace_id, invite_code, created_by, expires_at, max_uses) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [workspaceId, inviteCode, userId, expiresAt, max_uses]
    );

    res.json({
      ...invite.rows[0],
      invite_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${inviteCode}`
    });
  } catch (error) {
    console.error('Generate invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workspace invites
router.get('/:workspaceId/invites', authMiddleware, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.userId;

    // Check if user is admin/owner
    const membership = await db.query(
      `SELECT * FROM workspace_members 
       WHERE workspace_id = $1 AND user_id = $2 
       AND (role = 'owner' OR role = 'admin')`,
      [workspaceId, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to view invites' });
    }

    // Get active invites
    const invites = await db.query(
      `SELECT wi.*, u.username as created_by_username, u.display_name as created_by_name
       FROM workspace_invites wi
       JOIN users u ON wi.created_by = u.id
       WHERE wi.workspace_id = $1 
       AND (wi.expires_at > NOW() OR wi.expires_at IS NULL)
       AND (wi.max_uses IS NULL OR wi.uses < wi.max_uses)
       ORDER BY wi.created_at DESC`,
      [workspaceId]
    );

    res.json(invites.rows.map(invite => ({
      ...invite,
      invite_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${invite.invite_code}`
    })));
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join workspace via invite
router.post('/join/:inviteCode', authMiddleware, async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.userId;

    // Get invite
    const invite = await db.query(
      `SELECT * FROM workspace_invites 
       WHERE invite_code = $1 
       AND (expires_at > NOW() OR expires_at IS NULL)
       AND (max_uses IS NULL OR uses < max_uses)`,
      [inviteCode]
    );

    if (invite.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invite code' });
    }

    const workspaceId = invite.rows[0].workspace_id;

    // Check if already a member
    const existingMembership = await db.query(
      'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    if (existingMembership.rows.length > 0) {
      return res.status(400).json({ error: 'Already a member of this workspace' });
    }

    // Add user to workspace
    await db.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) 
       VALUES ($1, $2, 'member')`,
      [workspaceId, userId]
    );

    // Increment invite uses
    await db.query(
      'UPDATE workspace_invites SET uses = uses + 1 WHERE id = $1',
      [invite.rows[0].id]
    );

    // Get workspace details
    const workspace = await db.query(
      'SELECT * FROM workspaces WHERE id = $1',
      [workspaceId]
    );

    res.json({
      message: 'Successfully joined workspace',
      workspace: workspace.rows[0]
    });
  } catch (error) {
    console.error('Join workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete invite
router.delete('/:workspaceId/invites/:inviteId', authMiddleware, async (req, res) => {
  try {
    const { workspaceId, inviteId } = req.params;
    const userId = req.userId;

    // Check if user is admin/owner
    const membership = await db.query(
      `SELECT * FROM workspace_members 
       WHERE workspace_id = $1 AND user_id = $2 
       AND (role = 'owner' OR role = 'admin')`,
      [workspaceId, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to delete invites' });
    }

    await db.query(
      'DELETE FROM workspace_invites WHERE id = $1 AND workspace_id = $2',
      [inviteId, workspaceId]
    );

    res.json({ message: 'Invite deleted successfully' });
  } catch (error) {
    console.error('Delete invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
