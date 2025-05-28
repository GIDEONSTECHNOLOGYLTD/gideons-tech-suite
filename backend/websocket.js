const WebSocket = require('ws');

// Initialize WebSocket server
const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws'
  });

  console.log('WebSocket server initialized');

  wss.on('connection', (ws, req) => {
    console.log(`WebSocket client connected from ${req.socket.remoteAddress}`);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to Gideon\'s Tech Suite WebSocket Server',
      timestamp: new Date().toISOString()
    }));

    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log('Received message:', data);
        
        // Handle different message types
        switch (data.type) {
          case 'ping':
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString()
            }));
            break;
            
          case 'subscribe':
            // Handle subscription to specific channels/topics
            console.log(`Client subscribed to: ${data.channel}`);
            ws.subscriptions = ws.subscriptions || [];
            ws.subscriptions.push(data.channel);
            ws.send(JSON.stringify({
              type: 'subscribed',
              channel: data.channel,
              timestamp: new Date().toISOString()
            }));
            break;
            
          default:
            // Broadcast to all clients
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'broadcast',
                  data: data,
                  timestamp: new Date().toISOString()
                }));
              }
            });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: new Date().toISOString()
        }));
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Broadcast to all clients or specific channels
  const broadcast = (data, channel = null) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // If channel is specified, only send to clients subscribed to that channel
        if (channel && (!client.subscriptions || !client.subscriptions.includes(channel))) {
          return;
        }
        
        client.send(JSON.stringify({
          ...data,
          timestamp: new Date().toISOString()
        }));
      }
    });
  };

  // Return methods for external use
  return {
    broadcast,
    getConnections: () => wss.clients.size
  };
};

module.exports = setupWebSocket;
