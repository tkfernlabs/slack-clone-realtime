export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  status_message?: string;
  is_online: boolean;
  last_seen?: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  url_slug: string;
  icon_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  role?: string;
  joined_at?: string;
}

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  is_private: boolean;
  is_direct: boolean;
  topic?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: string;
  unread_count?: string;
  user_joined_at?: string;
  last_read_at?: string;
  notification_preference?: string;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  message_type: string;
  parent_message_id?: string;
  is_edited: boolean;
  edited_at?: string;
  is_deleted: boolean;
  deleted_at?: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  status?: string;
  is_online?: boolean;
  reaction_count?: string;
  reply_count?: string;
  reactions?: Reaction[];
}

export interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface DirectMessage {
  channel_id: string;
  other_user_id: string;
  other_username: string;
  other_display_name: string;
  other_avatar_url?: string;
  other_status: string;
  other_status_message?: string;
  other_is_online: boolean;
  last_message?: string;
  unread_count: string;
  last_read_at?: string;
  updated_at?: string;
}

export interface Thread {
  parent: Message;
  replies: Message[];
}

export interface WorkspaceMember extends User {
  role: 'owner' | 'admin' | 'member' | 'guest';
  joined_at: string;
}
