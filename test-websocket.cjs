// Simple WebSocket test to verify connection stability
const WebSocket = require('ws');

const testConnection = () => {
  console.log('🧪 Starting WebSocket connection test...');
  
  const ws = new WebSocket('ws://localhost:5000/ws/collaboration/test-schema');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected successfully');
    
    // Send user join message
    ws.send(JSON.stringify({
      type: 'user_join',
      userId: 'test-user-1',
      username: 'TestUser1',
      schemaId: 'test-schema'
    }));
    
    // Send cursor update message
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'cursor_update',
        cursor: {
          userId: 'test-user-1',
          username: 'TestUser1',
          position: { x: 100, y: 200 },
          color: '#FF5733',
          lastSeen: new Date().toISOString()
        }
      }));
    }, 1000);
    
    // Send ping after 5 seconds
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'ping' }));
    }, 5000);
    
    // Close connection after 10 seconds
    setTimeout(() => {
      console.log('🔌 Closing connection...');
      ws.close(1000, 'Test completed');
    }, 10000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📨 Received:', message.type, message);
    } catch (error) {
      console.error('❌ Failed to parse message:', error);
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`❌ Connection closed: ${code} - ${reason}`);
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
};

// Run test
testConnection();