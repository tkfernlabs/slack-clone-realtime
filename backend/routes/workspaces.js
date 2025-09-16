const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Create workspace
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, url_slug, icon_url } = req.body;
    const userId = req.userId;

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

module.exports = router;
