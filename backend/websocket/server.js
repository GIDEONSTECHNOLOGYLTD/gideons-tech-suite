const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Set up WebSocket server
const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ 
    server, 
    path: '/ws',
    clientTracking: true,
    maxPayload: 10 * 1024 * 1024, // 10MB max message size
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3,
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      serverMaxWindowBits: 10,
      concurrencyLimit: 10,
      threshold: 1024,
    }
  });

  // Store connected clients with metadata
  const clients = new Map();
  
  // Track connection statistics
  const stats = {
    totalConnections: 0,
    activeConnections: 0,
    messagesReceived: 0,
    messagesSent: 0,
    errors: 0,
  };
  
  // Helper function to safely send messages
  const safeSend = (ws, data) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        ws.send(message);
        stats.messagesSent++;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error sending message:', error);
      stats.errors++;
      return false;
    }
  };

  // Handle new connections
  wss.on('connection', (ws, req) => {
    const connectionId = Date.now();
    const clientInfo = {
      id: connectionId,
      ws,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      authenticated: false,
      lastActivity: new Date(),
      userId: null,
      user: null
    };
    
    // Add client to the clients map
    clients.set(connectionId, clientInfo);
    
    console.log(`New WebSocket connection [${connectionId}] from ${clientInfo.ip}`);
    stats.totalConnections++;
    stats.activeConnections++;

    // Set up connection timeout
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.warn(`Connection [${connectionId}] timed out during authentication`);
        safeSend(ws, {
          type: 'error',
          code: 'AUTH_TIMEOUT',
          message: 'Authentication timeout',
          timestamp: Date.now()
        });
        ws.close(4008, 'Authentication timeout');
      }
    }, 10000); // 10 second timeout for authentication

    // Extract token from URL query parameters or headers
    let token = null;
    try {
      // Try to get token from URL first
      if (req.url) {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        token = url.searchParams.get('token');
      }
      
      // Fall back to WebSocket protocol header
      if (!token && req.headers['sec-websocket-protocol']) {
        const protocols = req.headers['sec-websocket-protocol'].split(',').map(p => p.trim());
        const bearerToken = protocols.find(p => p.startsWith('Bearer '));
        if (bearerToken) {
          token = bearerToken.substring(7);
        } else if (protocols.length > 0) {
          // If no Bearer prefix but we have a token, use the first one
          token = protocols[0];
        }
      }
    } catch (error) {
      console.error(`Error parsing URL for connection [${connectionId}]:`, error);
    }
    
    if (!token) {
      console.warn(`Connection [${connectionId}]: No token provided`);
      safeSend(ws, {
        type: 'error',
        code: 'NO_TOKEN',
        message: 'No authentication token provided',
        timestamp: Date.now()
      });
      ws.close(4001, 'No token provided');
      clearTimeout(connectionTimeout);
      return;
    }

    // Verify JWT token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      clearTimeout(connectionTimeout);
      
      if (err) {
        const errorMsg = `Connection [${connectionId}]: Invalid token - ${err.message}`;
        console.warn(errorMsg);
        safeSend(ws, {
          type: 'error',
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
          timestamp: Date.now()
        });
        ws.close(4003, 'Invalid token');
        return;
      }
      
      // Token is valid, mark client as authenticated
      clientInfo.authenticated = true;
      clientInfo.userId = decoded.userId;
      clientInfo.user = decoded;
      
      console.log(`Connection [${connectionId}] authenticated as user ${decoded.userId}`);
      
      // Send welcome message
      safeSend(ws, {
        type: 'welcome',
        message: 'Successfully connected to WebSocket server',
        timestamp: Date.now(),
        userId: decoded.userId,
        connectionId
      });
    });
    
    // Handle incoming messages
    const messageHandler = (message) => {
      let data;
      try {
        stats.messagesReceived++;
        clientInfo.lastActivity = new Date();
        
        // Parse the incoming message
        try {
          data = typeof message === 'string' ? JSON.parse(message) : message;
        } catch (parseError) {
          throw new Error(`Invalid JSON: ${parseError.message}`);
        }
        
        // Validate message format
        if (!data || typeof data !== 'object') {
          throw new Error('Message must be a JSON object');
        }
        
        if (!data.type) {
          throw new Error('Message must have a type');
        }
        
        // Handle different message types
        switch (data.type) {
          case 'ping':
            safeSend(ws, {
              type: 'pong',
              timestamp: Date.now(),
              originalTimestamp: data.timestamp || null,
              messageId: data.messageId
            });
            break;
            
          case 'echo':
            safeSend(ws, {
              type: 'echo_response',
              timestamp: Date.now(),
              originalMessage: data.payload,
              messageId: data.messageId
            });
            break;
            
          default:
            console.warn(`Unknown message type from connection [${connectionId}]:`, data.type);
            safeSend(ws, {
              type: 'error',
              code: 'UNKNOWN_MESSAGE_TYPE',
              message: `Unknown message type: ${data.type}`,
              timestamp: Date.now(),
              messageId: data.messageId
            });
        }
      } catch (error) {
        console.error(`Error processing message from connection [${connectionId}]:`, error);
        stats.errors++;
        
        safeSend(ws, {
          type: 'error',
          code: 'PROCESSING_ERROR',
          message: error.message || 'Failed to process message',
          timestamp: Date.now(),
          messageId: data?.messageId
        });
      }
    };
    
    // Register the message handler
    ws.on('message', messageHandler);
    
    // Handle client disconnection
    ws.on('close', (code, reason) => {
      const closeReason = reason || 'No reason provided';
      console.log(`Connection [${connectionId}] closed. Code: ${code}, Reason: ${closeReason}`);
      
      // Clean up resources
      if (clientInfo.userId) {
        console.log(`User ${clientInfo.userId} disconnected [${connectionId}]`);
      }
      
      clients.delete(connectionId);
      stats.activeConnections--;
      clearInterval(heartbeatInterval);
      
      // Log the disconnection
      console.log(`Active connections: ${clients.size}`);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error on connection [${connectionId}]:`, error);
      stats.errors++;
      
      // Try to notify the client about the error if possible
      if (ws.readyState === WebSocket.OPEN) {
        safeSend(ws, {
          type: 'error',
          code: 'WEBSOCKET_ERROR',
          message: 'A WebSocket error occurred',
          timestamp: Date.now()
        });
      }
      
      // Clean up
      clients.delete(connectionId);
      stats.activeConnections--;
      
      // Try to close the connection gracefully
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1011, 'Internal server error');
        }
      } catch (closeError) {
        console.error('Error closing WebSocket after error:', closeError);
      }
    });
    
    // Set up heartbeat/ping-pong
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping();
        } catch (pingError) {
          console.error('Error sending ping:', pingError);
        }
      }
    }, 30000); // Send ping every 30 seconds
    
    // Clean up interval on close
    ws.on('close', () => {
      clearInterval(heartbeatInterval);
    });
  });

  // Send to specific user by user ID
  const sendToUser = (userId, data) => {
    let sent = false;
    clients.forEach((client, id) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        if (safeSend(client.ws, data)) {
          sent = true;
        }
      }
    });
    return sent;
  };
  
  // Send to specific connection by connection ID
  const sendToConnection = (connectionId, data) => {
    const client = clients.get(connectionId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      return safeSend(client.ws, data);
    }
    return false;
  };
  
  // Broadcast to all connected clients
  const broadcast = (data, options = {}) => {
    if (!data || typeof data !== 'object') {
      console.error('Invalid message format for broadcast');
      return 0;
    }
    
    let count = 0;
    const { excludeUserId, excludeConnectionId } = options;
    
    clients.forEach((client, id) => {
      // Skip if client is not authenticated or connection is not open
      if (!client.authenticated || client.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      
      // Skip excluded users/connections
      if (excludeUserId && client.userId === excludeUserId) {
        return;
      }
      
      if (excludeConnectionId && client.id === excludeConnectionId) {
        return;
      }
      
      // Send the message
      if (safeSend(client.ws, data)) {
        count++;
      }
    });
    
    return count;
  };
  
  // Get server statistics
  const getStats = () => ({
    ...stats,
    activeConnections: clients.size,
    timestamp: new Date().toISOString()
  });
  
  // Clean up function for graceful shutdown
  const cleanup = () => {
    console.log('Cleaning up WebSocket connections...');
    // Close all connections with a status code indicating server shutdown
    clients.forEach((client, connectionId) => {
      try {
        if (client.ws && client.ws.readyState === WebSocket.OPEN) {
          safeSend(client.ws, {
            type: 'server_shutdown',
            message: 'Server is shutting down',
            timestamp: Date.now()
          });
          client.ws.close(1012, 'Server is shutting down');
        }
      } catch (error) {
        console.error(`Error cleaning up connection [${connectionId}]:`, error);
      }
    });
    
    // Clear the clients map
    clients.clear();
  };
  
  // Log statistics periodically (every 5 minutes)
  const statsInterval = setInterval(() => {
    console.log('WebSocket Server Stats:', JSON.stringify(getStats(), null, 2));
  }, 5 * 60 * 1000);
  
  // Set up ping interval for all connections
  const pingInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.ping();
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      }
    });
  }, 30000);
  
  // Handle process termination
  const shutdown = () => {
    console.log('Shutting down WebSocket server...');
    cleanup();
    clearInterval(pingInterval);
    clearInterval(statsInterval);
    process.exit(0);
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { 
    wss, 
    broadcast, 
    sendToUser, 
    sendToConnection,
    getStats,
    cleanup,
    getClientCount: () => clients.size
  };
};

module.exports = setupWebSocket;
