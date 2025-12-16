const express = require('express');
const http = require('http');
const sockjs = require('sockjs');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// SockJS setup
const sockjsServer = sockjs.createServer({ sockjs_url: 'http://cdn.jsdelivr.net/sockjs/1.0.1/sockjs.min.js' });
const connections = new Map(); // Changed to Map to store user info
const typingUsers = new Set();
const onlineUsers = new Set();

require('dotenv').config();

const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow all file types for now
    cb(null, true);
  }
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// In-memory storage (replace with database in production)
const users = [];
const messages = [];
const messageReactions = new Map(); // messageId -> reactions

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = { id: Date.now(), username, password: hashedPassword };
  users.push(user);

  const token = jwt.sign({ id: user.id, username }, JWT_SECRET);
  res.json({ token, user: { id: user.id, username } });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username }, JWT_SECRET);
  res.json({ token, user: { id: user.id, username } });
});

app.get('/api/messages', authenticateToken, (req, res) => {
  const messagesWithReactions = messages.slice(-50).map(msg => ({
    ...msg,
    reactions: messageReactions.get(msg.id) || []
  }));
  res.json(messagesWithReactions);
});

// File upload endpoint
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ 
    fileUrl,
    fileName: req.file.originalname,
    fileSize: req.file.size
  });
});

// Get online users
app.get('/api/online-users', authenticateToken, (req, res) => {
  res.json({ users: Array.from(onlineUsers) });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connections: connections.size,
    onlineUsers: onlineUsers.size,
    totalMessages: messages.length
  });
});

// Broadcast to all connections
function broadcast(destination, data) {
  const stompMessage = `MESSAGE\ndestination:${destination}\n\n${JSON.stringify(data)}\0`;
  console.log(`Broadcasting to ${connections.size} connections:`, data);
  console.log('STOMP message:', stompMessage);
  
  let sentCount = 0;
  connections.forEach((userInfo, connection) => {
    console.log('Connection state:', connection.readyState, 'User:', userInfo.username);
    if (connection.readyState === 1) {
      try {
        connection.write(stompMessage);
        sentCount++;
        console.log('Message sent to connection:', userInfo.username || 'anonymous');
      } catch (error) {
        console.error('Error broadcasting to connection:', error);
      }
    }
  });
  console.log(`Successfully sent to ${sentCount} connections`);
}

// Parse STOMP frame
function parseStompFrame(data) {
  const lines = data.split('\n');
  const command = lines[0];
  const headers = {};
  let bodyStart = -1;
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '') {
      bodyStart = i + 1;
      break;
    }
    const colonIndex = lines[i].indexOf(':');
    if (colonIndex > 0) {
      const key = lines[i].substring(0, colonIndex);
      const value = lines[i].substring(colonIndex + 1);
      headers[key] = value;
    }
  }
  
  const body = bodyStart >= 0 ? lines.slice(bodyStart).join('\n').replace(/\0$/, '') : '';
  console.log('Parsed frame - Command:', command, 'Headers:', headers, 'Body:', body);
  return { command, headers, body };
}

// WebSocket handling
sockjsServer.on('connection', (conn) => {
  console.log('User connected:', conn.id);
  connections.set(conn, { id: conn.id, username: null });

  conn.on('data', (data) => {
    try {
      console.log('Raw data received:', data.toString());
      const frame = parseStompFrame(data.toString());
      console.log('Parsed frame:', frame);
      const userInfo = connections.get(conn);
      
      if (frame.command === 'CONNECT') {
        conn.write('CONNECTED\nversion:1.2\n\n\0');
        console.log('CONNECT response sent');
        return;
      }
      
      if (frame.command === 'SEND') {
        const destination = frame.headers.destination;
        console.log('SEND to destination:', destination);
        
        if (destination === '/app/chat') {
          const messageData = JSON.parse(frame.body);
          console.log('Received message data:', messageData);
          
          const message = {
            id: Date.now().toString(),
            sender: messageData.sender,
            content: messageData.content,
            timestamp: new Date(),
            type: messageData.type || 'text',
            fileName: messageData.fileName,
            fileSize: messageData.fileSize,
            fileUrl: messageData.fileUrl
          };
          
          messages.push(message);
          console.log('Message saved:', message);
          console.log('Total messages:', messages.length);
          
          // Update user info
          if (userInfo && !userInfo.username) {
            userInfo.username = messageData.sender;
            onlineUsers.add(messageData.sender);
            console.log('User added to online:', messageData.sender);
            broadcast('/topic/online', { users: Array.from(onlineUsers) });
          }
          
          console.log('Broadcasting message to', connections.size, 'connections');
          broadcast('/topic/messages', message);
        }
        
        else if (destination === '/app/typing/start') {
          const typingData = JSON.parse(frame.body);
          typingUsers.add(typingData.username);
          broadcast('/topic/typing', { users: Array.from(typingUsers) });
        }
        
        else if (destination === '/app/typing/stop') {
          const typingData = JSON.parse(frame.body);
          typingUsers.delete(typingData.username);
          broadcast('/topic/typing', { users: Array.from(typingUsers) });
        }
        
        else if (destination === '/app/reaction') {
          const reactionData = JSON.parse(frame.body);
          const { messageId, emoji, username } = reactionData;
          
          if (!messageReactions.has(messageId)) {
            messageReactions.set(messageId, []);
          }
          
          const reactions = messageReactions.get(messageId);
          let existingReaction = reactions.find(r => r.emoji === emoji);
          
          if (existingReaction) {
            if (existingReaction.users.includes(username)) {
              // Remove reaction
              existingReaction.users = existingReaction.users.filter(u => u !== username);
              existingReaction.count = existingReaction.users.length;
              
              if (existingReaction.count === 0) {
                messageReactions.set(messageId, reactions.filter(r => r.emoji !== emoji));
              }
            } else {
              // Add reaction
              existingReaction.users.push(username);
              existingReaction.count = existingReaction.users.length;
            }
          } else {
            // New reaction
            reactions.push({
              emoji,
              count: 1,
              users: [username]
            });
          }
          
          broadcast('/topic/reactions', {
            messageId,
            emoji,
            count: existingReaction ? existingReaction.count : 1,
            users: existingReaction ? existingReaction.users : [username]
          });
        }
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });

  conn.on('close', () => {
    console.log('User disconnected:', conn.id);
    const userInfo = connections.get(conn);
    
    if (userInfo && userInfo.username) {
      onlineUsers.delete(userInfo.username);
      typingUsers.delete(userInfo.username);
      
      broadcast('/topic/online', { users: Array.from(onlineUsers) });
      broadcast('/topic/typing', { users: Array.from(typingUsers) });
    }
    
    connections.delete(conn);
  });
});

sockjsServer.installHandlers(server, { prefix: '/ws' });

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`File uploads will be stored in: ${uploadsDir}`);
});