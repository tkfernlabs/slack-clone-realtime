# Slack Clone - Real-time Messaging Application

A full-featured Slack clone with real-time messaging, channels, direct messages, and more.

## Features

- **Real-time Messaging**: Instant message delivery using Socket.IO
- **Workspaces**: Create and manage multiple workspaces
- **Channels**: Public and private channels for team communication
- **Direct Messages**: Private conversations between users
- **Thread Replies**: Organized discussions within messages
- **Reactions**: Express yourself with emoji reactions
- **User Presence**: See who's online in real-time
- **Typing Indicators**: Know when someone is typing
- **Message Editing & Deletion**: Edit or delete your messages
- **User Status**: Set your status and status message
- **Mentions**: @ mention users to get their attention
- **File Sharing**: Upload and share files (coming soon)
- **Search**: Search messages and users
- **Authentication**: Secure JWT-based authentication

## Tech Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** (Neon) for database
- **Socket.IO** for real-time communication
- **JWT** for authentication
- **bcrypt** for password hashing

### Frontend
- **React** with TypeScript
- **Socket.IO Client** for real-time updates
- **Tailwind CSS** for styling
- **React Router** for navigation

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Workspaces
- `GET /api/workspaces/my-workspaces` - Get user's workspaces
- `POST /api/workspaces` - Create new workspace
- `GET /api/workspaces/:id` - Get workspace details
- `GET /api/workspaces/:id/members` - Get workspace members
- `POST /api/workspaces/:id/join` - Join workspace

### Channels
- `GET /api/channels/workspace/:workspaceId` - Get workspace channels
- `POST /api/channels` - Create new channel
- `GET /api/channels/:id` - Get channel details
- `GET /api/channels/:id/members` - Get channel members
- `POST /api/channels/:id/join` - Join channel
- `POST /api/channels/:id/leave` - Leave channel
- `PUT /api/channels/:id` - Update channel

### Messages
- `GET /api/messages/channel/:channelId` - Get channel messages
- `POST /api/messages` - Send message
- `GET /api/messages/:messageId/thread` - Get thread messages
- `PUT /api/messages/:id` - Edit message
- `DELETE /api/messages/:id` - Delete message
- `POST /api/messages/:id/reactions` - Add reaction
- `DELETE /api/messages/:id/reactions/:emoji` - Remove reaction

### Users
- `GET /api/users/me` - Get current user
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/me` - Update profile
- `PUT /api/users/me/status` - Update status
- `GET /api/users/search/:workspaceId` - Search users
- `POST /api/users/direct-message` - Create/get DM channel
- `GET /api/users/direct-messages/:workspaceId` - Get user's DMs

## WebSocket Events

### Client to Server
- `join_workspace` - Join a workspace room
- `join_channel` - Join a channel room
- `leave_channel` - Leave a channel room
- `send_message` - Send a message
- `edit_message` - Edit a message
- `delete_message` - Delete a message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `add_reaction` - Add reaction to message
- `remove_reaction` - Remove reaction
- `update_status` - Update user status
- `mark_read` - Mark channel as read

### Server to Client
- `new_message` - New message received
- `message_edited` - Message was edited
- `message_deleted` - Message was deleted
- `user_typing` - User is typing
- `user_stopped_typing` - User stopped typing
- `reaction_added` - Reaction added
- `reaction_removed` - Reaction removed
- `user_online` - User came online
- `user_offline` - User went offline
- `user_status_changed` - User status changed
- `thread_updated` - Thread has new reply
- `mentioned` - You were mentioned

## Environment Variables

### Backend
```
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_jwt_secret
PORT=5000
NODE_ENV=production
```

### Frontend
```
REACT_APP_API_URL=your_backend_url
REACT_APP_WS_URL=your_websocket_url
```

## Deployment

### Backend
The backend is deployed at: https://slack-backend-morphvm-4yh44846.http.cloud.morph.so

### Frontend
The frontend will be deployed at: [Coming soon]

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL (or Neon account)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/tkfernlabs/slack-clone-realtime.git
cd slack-clone-realtime
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run the backend
```bash
npm start
```

5. Install frontend dependencies
```bash
cd ../frontend
npm install
```

6. Run the frontend
```bash
npm start
```

## License

MIT
