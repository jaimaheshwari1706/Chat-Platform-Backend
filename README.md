# Chat Platform Backend

Node.js backend for the Chat Platform application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## API Endpoints

- `POST /api/register` - Register new user
- `POST /api/login` - Login user
- `GET /api/messages` - Get recent messages (requires auth)

## WebSocket Events

- `message` - Send/receive chat messages

Server runs on port 8080 by default.