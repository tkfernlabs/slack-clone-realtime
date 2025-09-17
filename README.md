# Slack Clone - Real-time Messaging Application

A full-featured Slack clone with real-time messaging, workspaces, channels, and team collaboration features.

## 🚀 Live Demo

- **Frontend**: https://slack-frontend-morphvm-4yh44846.http.cloud.morph.so
- **Backend API**: https://slack-backend-morphvm-4yh44846.http.cloud.morph.so
- **GitHub Repository**: https://github.com/tkfernlabs/slack-clone-realtime

## ✨ Features

### Core Functionality
- **Real-time Messaging**: Instant message delivery using Socket.IO WebSockets
- **Workspace Management**: Create and manage multiple workspaces
- **Channel System**: Public and private channels for organized communication
- **Direct Messaging**: One-on-one private conversations
- **User Authentication**: Secure JWT-based authentication system
- **Invite System**: Generate shareable invite links with custom expiry and usage limits

### Messaging Features
- **Instant Updates**: Messages appear immediately without page refresh
- **Rich Text Formatting**: Support for bold, italic, code blocks, and lists
- **Emoji Support**: Full emoji picker and reactions
- **Message Threading**: Reply to messages in threads
- **Message Editing/Deletion**: Edit or delete your messages
- **Typing Indicators**: See when others are typing

### User Features
- **User Profiles**: Customizable display names and avatars
- **Online Presence**: See who's online in real-time
- **Status Updates**: Set your availability status
- **@Mentions**: Tag users in messages
- **Search**: Search through messages and channels

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS v3** for styling
- **Socket.IO Client** for real-time features
- **React Router v6** for navigation
- **Axios** for API calls
- **React Hot Toast** for notifications
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **PostgreSQL** (Neon) for database
- **Socket.IO** for WebSockets
- **JWT** for authentication
- **bcrypt** for password hashing

## 📖 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database (we use Neon)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tkfernlabs/slack-clone-realtime.git
   cd slack-clone-realtime
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   
   # Create .env file with:
   # DATABASE_URL=your_postgres_connection_string
   # JWT_SECRET=your_jwt_secret
   # PORT=5000
   # NODE_ENV=production
   # FRONTEND_URL=https://your-frontend-url.com
   
   npm start
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   
   # Create .env file with:
   # REACT_APP_API_URL=https://your-backend-url.com
   # REACT_APP_WS_URL=wss://your-backend-url.com
   
   npm run build
   npm run start
   ```

## 💡 Usage Guide

### Creating a Workspace
1. Register/Login to the application
2. Click "Create Workspace"
3. Enter workspace name and details
4. Your workspace is ready!

### Inviting Team Members
1. Click **"Invite people"** in the sidebar (purple button)
2. Choose invite settings:
   - **Expiry**: 1, 7, 14, 30 days, or never
   - **Max uses**: Set a limit or leave unlimited
3. Click **"Generate Invite Link"**
4. Copy and share the link with team members
5. New users can join by:
   - Clicking the invite link
   - Registering/logging in
   - Automatically joining your workspace

### Sending Messages
1. Select a channel from the sidebar
2. Type your message in the input field
3. Press Enter to send
4. Messages appear instantly for all channel members
5. Use the formatting toolbar for rich text
6. Add emojis with the emoji picker

### Real-time Features
- **Instant Messaging**: No refresh needed
- **Live Typing Indicators**: See who's typing
- **Presence Updates**: Online/offline status
- **Real-time Reactions**: Instant emoji reactions

## 🔧 Recent Updates & Fixes

### Latest Improvements (Sept 2025)
1. **Fixed Invite Link Generation**
   - Invite links now use production URL instead of localhost
   - Added FRONTEND_URL environment variable configuration
   
2. **Implemented Real-time Messaging**
   - Messages appear instantly without page refresh
   - WebSocket connections properly established
   
3. **Enhanced Invite System**
   - Complete invite acceptance flow
   - Handles authentication redirects
   - Graceful handling of existing members

4. **Auto-generation of Workspace URLs**
   - Automatically creates unique URL slugs
   - Prevents conflicts with existing workspaces

## 🏗️ Project Structure

```
slack-clone/
├── backend/
│   ├── server.js           # Express server & Socket.IO
│   ├── routes/             # API endpoints
│   │   ├── auth.js         # Authentication routes
│   │   ├── workspaces.js   # Workspace & invite management
│   │   ├── channels.js     # Channel operations
│   │   ├── messages.js     # Message handling
│   │   └── users.js        # User management
│   ├── middleware/         # Auth & error handling
│   ├── db.js              # Database connection
│   └── migrations/        # Database schemas
│
└── frontend/
    ├── src/
    │   ├── components/    # React components
    │   │   ├── Auth/     # Login, Register, InviteAccept
    │   │   └── Workspace/ # Main app components
    │   ├── services/     # API & WebSocket services
    │   ├── contexts/     # React contexts
    │   └── types/        # TypeScript definitions
    └── public/           # Static assets
```

## 📝 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Workspace Endpoints
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces` - List user's workspaces
- `POST /api/workspaces/:id/invite` - Generate invite link
- `POST /api/workspaces/join/:inviteCode` - Join via invite

### Channel Endpoints
- `POST /api/channels` - Create channel
- `GET /api/channels/:workspaceId` - List channels
- `POST /api/channels/:id/join` - Join channel

### Message Endpoints
- `POST /api/messages` - Send message
- `GET /api/messages/:channelId` - Get channel messages
- `PUT /api/messages/:id` - Edit message
- `DELETE /api/messages/:id` - Delete message

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Inspired by Slack's excellent UX/UI
- Built with modern web technologies
- Deployed on Morph's cloud infrastructure
- Database powered by Neon PostgreSQL

## 📧 Support

For issues or questions, please open an issue on GitHub or contact the development team.

---

**Live Application**: Visit https://slack-frontend-morphvm-4yh44846.http.cloud.morph.so to try it out!
