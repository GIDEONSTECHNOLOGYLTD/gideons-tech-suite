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
      ip: req.socket.remoteAddress || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      authenticated: false,
      lastActivity: new Date(),
      userId: null,
      user: null,
      heartbeatAlive: true
    };
    
    // Add client to the clients map
    clients.set(connectionId, clientInfo);
    
    console.log(`New WebSocket connection [${connectionId}] from ${clientInfo.ip}`, {
      url: req.url,
      headers: req.headers
    });
    stats.totalConnections++;
    stats.activeConnections = clients.size;

    // Set up connection timeout (increased to 30 seconds)
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
    }, 30000); // 30 second timeout for authentication

    // Extract token from URL query parameters or headers
    let token = null;
    try {
      // Try to get token from URL first (for testing)
      if (req.url && req.url.includes('token=')) {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        token = url.searchParams.get('token');
      }
      
      // Check Authorization header (standard for WebSocket with JWT)
      if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        } else {
          token = authHeader; // Allow raw token for backward compatibility
        }
      }
      
      // Fall back to WebSocket protocol header (for some WebSocket clients)
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
      
      console.log(`Connection [${connectionId}] token extracted:`, token ? 'Token exists' : 'No token found');
    } catch (error) {
      console.error(`Error extracting token for connection [${connectionId}]:`, error);
    }
    
    if (!token) {
      console.warn(`Connection [${connectionId}]: No token provided`);
      safeSend(ws, {
        type: 'error',
        code: 'NO_TOKEN',
        message: 'No authentication token provided',
        timestamp: Date.now()
      });
      // Don't close immediately, wait for the client to send a token in a message
      // This allows for delayed authentication
      clientInfo.authenticate = (authToken) => {
        verifyToken(authToken);
      };
      return;
    }
    
    // If we have a token, verify it immediately
    verifyToken(token);
    
    function verifyToken(authToken) {
      clearTimeout(connectionTimeout);
      
      if (!authToken) {
        console.warn(`Connection [${connectionId}]: Empty token provided`);
        safeSend(ws, {
          type: 'error',
          code: 'INVALID_TOKEN',
          message: 'Authentication token is required',
          timestamp: Date.now()
        });
        ws.close(4003, 'Authentication required');
        return;
      }

      // Verify JWT token
      jwt.verify(authToken, process.env.JWT_SECRET, (err, decoded) => {
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
        clientInfo.authenticate = null; // Remove the authenticate method
        
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
    }
    
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
        
        // Handle authentication message
        if (data.type === 'authenticate' && !clientInfo.authenticated) {
          if (clientInfo.authenticate && typeof clientInfo.authenticate === 'function') {
            clientInfo.authenticate(data.token);
          } else {
            safeSend(ws, {
              type: 'error',
              code: 'AUTH_ERROR',
              message: 'Authentication already attempted',
              timestamp: Date.now(),
              messageId: data.messageId
            });
          }
          return;
        }
        
        // If not authenticated, only allow authentication messages
        if (!clientInfo.authenticated) {
          safeSend(ws, {
            type: 'error',
            code: 'UNAUTHENTICATED',
            message: 'Please authenticate first',
            timestamp: Date.now(),
            messageId: data.messageId
          });
          return;
        }
        
        // Handle different message types for authenticated users
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
            
          case 'get_user_info':
            if (clientInfo.user) {
              safeSend(ws, {
                type: 'user_info',
                user: {
                  id: clientInfo.userId,
                  email: clientInfo.user.email,
                  name: clientInfo.user.name,
                  roles: clientInfo.user.roles || []
                },
                timestamp: Date.now(),
                messageId: data.messageId
              });
            } else {
              safeSend(ws, {
                type: 'error',
                code: 'USER_INFO_UNAVAILABLE',
                message: 'User information not available',
                timestamp: Date.now(),
                messageId: data.messageId
              });
            }
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
    const handleError = (error) => {
      if (clientInfo.errorHandled) return;
      clientInfo.errorHandled = true;
      
      console.error(`WebSocket error on connection [${connectionId}]:`, error);
      stats.errors++;
      
      // Try to notify the client about the error if possible
      if (ws.readyState === WebSocket.OPEN) {
        try {
          safeSend(ws, {
            type: 'error',
            code: 'WEBSOCKET_ERROR',
            message: 'A WebSocket error occurred',
            timestamp: Date.now()
          });
        } catch (sendError) {
          console.error('Error sending error message to client:', sendError);
        }
      }
      
      // Clean up resources
      cleanupConnection();
      
      // Try to close the connection gracefully
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1011, 'Internal server error');
        } else if (ws.readyState === WebSocket.CONNECTING) {
          // If still connecting, terminate the connection
          ws.terminate();
        }
      } catch (closeError) {
        console.error('Error closing WebSocket after error:', closeError);
      }
    };
    
    ws.on('error', handleError);
    
    // Set up heartbeat/ping-pong
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // Only send ping if the last one was acknowledged
          if (!clientInfo.heartbeatAlive) {
            console.warn(`Connection [${connectionId}] missed heartbeat, terminating`);
            ws.terminate();
            return;
          }
          
          clientInfo.heartbeatAlive = false;
          ws.ping();
        } catch (pingError) {
          console.error('Error in heartbeat:', pingError);
        }
      }
    }, 30000); // Send ping every 30 seconds
    
    // Handle pong responses
    ws.on('pong', () => {
      clientInfo.heartbeatAlive = true;
      clientInfo.lastActivity = new Date();
    });
    
    // Clean up interval on close
    const cleanupConnection = () => {
      if (clientInfo.cleanedUp) return;
      clientInfo.cleanedUp = true;
      
      clearInterval(heartbeatInterval);
      clearTimeout(connectionTimeout);
      
      // Only remove from clients if not already removed
      if (clients.has(connectionId)) {
        clients.delete(connectionId);
        stats.activeConnections = clients.size;
        console.log(`Connection [${connectionId}] cleaned up. Active connections: ${clients.size}`);
      }
      
      // Remove all listeners to prevent memory leaks
      ws.removeAllListeners('message');
      ws.removeAllListeners('close');
      ws.removeAllListeners('error');
      ws.removeAllListeners('pong');
    };
    
    // Set up connection cleanup on close and error
    ws.on('close', (code, reason) => {
      const reasonStr = reason || 'No reason provided';
      console.log(`Connection [${connectionId}] closed. Code: ${code}, Reason: ${reasonStr}`);
      cleanupConnection();
    });
    
    ws.on('error', (error) => {
      console.error(`Connection [${connectionId}] error:`, error);
      handleError(error);
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
