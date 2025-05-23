const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Store active connections
const clients = new Map();

const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');

    // Handle authentication
    const token = req.headers['sec-websocket-protocol'] || '';
    let userId = null;

    try {
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
        clients.set(userId, ws);
        console.log(`User ${userId} connected`);
      }
    } catch (err) {
      console.error('WebSocket auth error:', err.message);
      ws.close(1008, 'Unauthorized');
      return;
    }

    // Handle messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        // Handle different message types
        switch (data.type) {
          case 'AUTH':
            try {
              const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
              userId = decoded.id;
              clients.set(userId, ws);
              console.log(`User ${userId} authenticated`);
              ws.send(JSON.stringify({ 
                type: 'AUTH_SUCCESS',
                userId,
                timestamp: new Date().toISOString()
              }));
            } catch (err) {
              console.error('WebSocket auth error:', err.message);
              ws.send(JSON.stringify({
                type: 'AUTH_ERROR',
                message: 'Authentication failed',
                error: err.message
              }));
              ws.close(1008, 'Invalid token');
            }
            break;

          case 'PING':
            // Respond to ping with pong
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'PONG',
                timestamp: new Date().toISOString()
              }));
            }
            break;
          
          // Add more message handlers here as needed
          
          default:
            console.log('Unknown message type:', data.type);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Unknown message type',
                receivedType: data.type
              }));
            }
        }
      } catch (err) {
        console.error('Error processing message:', err);
      }
    });

    // Handle client disconnection
    ws.on('close', (code, reason) => {
      console.log(`Client disconnected: ${userId || 'unauthorized'}, code: ${code}, reason: ${reason}`);
      if (userId) {
        clients.delete(userId);
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error for user', userId || 'unknown', ':', error.message);
      console.error(error.stack);
      if (userId) {
        clients.delete(userId);
      }
      
      // Try to send error to client if possible
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'WebSocket error occurred',
            error: error.message
          }));
        }
      } catch (sendError) {
        console.error('Failed to send error to client:', sendError);
      }
    });
  });

  // Broadcast to all connected clients
  const broadcast = (data, excludeUserId = null) => {
    const message = JSON.stringify(data);
    for (const [userId, client] of clients.entries()) {
      if (client.readyState === WebSocket.OPEN && userId !== excludeUserId) {
        client.send(message);
      }
    }
  };

  // Send to specific user
  const sendToUser = (userId, data) => {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
      return true;
    }
    return false;
  };

  return { wss, broadcast, sendToUser };
};

module.exports = setupWebSocket;
