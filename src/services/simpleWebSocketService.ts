// Simplified WebSocket Service to prevent connection spam
class SimpleWebSocketService {
  private static instance: SimpleWebSocketService;
  private connections: Map<string, WebSocket> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  static getInstance(): SimpleWebSocketService {
    if (!SimpleWebSocketService.instance) {
      SimpleWebSocketService.instance = new SimpleWebSocketService();
    }
    return SimpleWebSocketService.instance;
  }

  connect(url: string, options: {
    onOpen?: () => void;
    onMessage?: (data: any) => void;
    onClose?: () => void;
    onError?: (error: any) => void;
    enableReconnect?: boolean;
  } = {}): string {
    const connectionId = `${url}_${Date.now()}`;
    
    // Close existing connections for this URL to prevent duplicates
    const existingConnections = Array.from(this.connections.entries())
      .filter(([id, socket]) => id.includes(url.split('/').pop() || ''));
    
    existingConnections.forEach(([id, socket]) => {
      console.log(`🔌 Closing existing connection: ${id}`);
      socket.close(1000, 'Replacing with new connection');
      this.connections.delete(id);
      
      // Clear any reconnect timeout for the old connection
      const timeout = this.reconnectTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        this.reconnectTimeouts.delete(id);
      }
    });

    try {
      console.log(`🔗 Creating new WebSocket connection: ${url}`);
      const socket = new WebSocket(url);

      socket.onopen = () => {
        console.log(`✅ WebSocket connected: ${url}`);
        options.onOpen?.();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`📨 WebSocket message received:`, data.type, data);
          options.onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error, event.data);
        }
      };

      socket.onclose = (event) => {
        console.log(`❌ WebSocket closed: ${url} - Code: ${event.code}, Reason: ${event.reason || 'Unknown'}`);
        this.connections.delete(connectionId);
        
        // Clear any existing reconnect timeout
        const existingTimeout = this.reconnectTimeouts.get(connectionId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          this.reconnectTimeouts.delete(connectionId);
        }
        
        options.onClose?.();

        // Only reconnect for unexpected closures (not manual disconnects)
        if (options.enableReconnect && event.code !== 1000 && event.code !== 1001) {
          // Exponential backoff for reconnection
          const timeout = setTimeout(() => {
            console.log(`🔄 Reconnecting to: ${url} (previous code: ${event.code})`);
            this.connect(url, options);
          }, 3000); // Reduced from 5s to 3s
          this.reconnectTimeouts.set(connectionId, timeout);
        }
      };

      socket.onerror = (error) => {
        console.error(`❌ WebSocket error for ${url}:`, error);
        options.onError?.(error);
      };

      this.connections.set(connectionId, socket);
      return connectionId;

    } catch (error) {
      console.error(`Failed to create WebSocket connection to ${url}:`, error);
      throw error;
    }
  }

  disconnect(connectionId: string) {
    const socket = this.connections.get(connectionId);
    if (socket) {
      console.log(`🔌 Disconnecting WebSocket: ${connectionId}`);
      socket.close(1000, 'Manual disconnect');
      this.connections.delete(connectionId);
    }

    const timeout = this.reconnectTimeouts.get(connectionId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(connectionId);
    }
  }

  disconnectAll() {
    console.log('🔌 Disconnecting all WebSocket connections');
    this.connections.forEach((socket, id) => {
      socket.close(1000, 'Manual disconnect all');
    });
    this.connections.clear();

    this.reconnectTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.reconnectTimeouts.clear();
  }

  sendMessage(connectionId: string, message: any) {
    const socket = this.connections.get(connectionId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to ${connectionId}:`, error);
      }
    } else {
      console.warn(`WebSocket not connected for ${connectionId}, message not sent:`, message);
    }
  }

  isConnected(connectionId: string): boolean {
    const socket = this.connections.get(connectionId);
    return socket?.readyState === WebSocket.OPEN;
  }
}

export const simpleWebSocketService = SimpleWebSocketService.getInstance();