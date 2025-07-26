// Simplified WebSocket Service to prevent connection spam
class SimpleWebSocketService {
  private static instance: SimpleWebSocketService;
  private connections: Map<string, WebSocket> = new Map();
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 2000; // 2 seconds

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
    const urlPath = url.split('/').slice(-2).join('/'); // Get last 2 parts for ID
    const connectionId = `${urlPath}_${Date.now()}`;
    
    // Close existing connections for this URL pattern to prevent duplicates
    const existingConnections = Array.from(this.connections.entries())
      .filter(([id, socket]) => {
        const idPath = id.split('_')[0];
        return idPath === urlPath;
      });
    
    existingConnections.forEach(([id, socket]) => {
      console.log(`🔌 Closing existing connection: ${id}`);
      socket.close(1000, 'Replacing with new connection');
      this.connections.delete(id);
      
      // Clear any reconnect timeout and attempts for the old connection
      const timeout = this.reconnectTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        this.reconnectTimeouts.delete(id);
      }
      this.reconnectAttempts.delete(id);
    });

    try {
      console.log(`🔗 Creating new WebSocket connection: ${url}`);
      const socket = new WebSocket(url);

      // Reset reconnect attempts for new connection
      this.reconnectAttempts.set(connectionId, 0);

      socket.onopen = () => {
        console.log(`✅ WebSocket connected: ${url}`);
        // Reset reconnect attempts on successful connection
        this.reconnectAttempts.set(connectionId, 0);
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

        // Only reconnect for unexpected closures and if reconnect is enabled
        // Improved logic to handle 1005 and other common disconnect codes
        const shouldReconnect = options.enableReconnect && 
                               event.code !== 1000 && // Normal closure
                               event.code !== 1001 && // Going away
                               event.code !== 1006 && // Abnormal closure (often network issues)
                               !event.wasClean;       // Not a clean disconnect
        
        if (shouldReconnect) {
          const attempts = this.reconnectAttempts.get(connectionId) || 0;
          
          if (attempts < this.maxReconnectAttempts) {
            // Enhanced exponential backoff with jitter and cap
            const baseDelay = this.baseReconnectDelay;
            const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempts), 30000); // Cap at 30 seconds
            const jitter = Math.random() * 2000; // Up to 2 seconds jitter
            const delay = exponentialDelay + jitter;
            
            console.log(`🔄 Scheduling reconnection attempt ${attempts + 1}/${this.maxReconnectAttempts} in ${Math.round(delay)}ms for close code: ${event.code}`);
            
            const timeout = setTimeout(() => {
              // Check if we still need to reconnect (user might have disconnected manually)
              if (this.reconnectAttempts.has(connectionId)) {
                this.reconnectAttempts.set(connectionId, attempts + 1);
                console.log(`🔄 Reconnecting to: ${url} (attempt ${attempts + 1})`);
                
                // Create new connection with same options
                try {
                  this.connect(url, options);
                } catch (reconnectError) {
                  console.error(`❌ Reconnection attempt ${attempts + 1} failed:`, reconnectError);
                }
              }
            }, delay);
            
            this.reconnectTimeouts.set(connectionId, timeout);
          } else {
            console.warn(`❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached for ${url}`);
            this.reconnectAttempts.delete(connectionId);
          }
        } else {
          console.log(`🔌 Not reconnecting - Code: ${event.code}, Clean: ${event.wasClean}, Enabled: ${options.enableReconnect}`);
          this.reconnectAttempts.delete(connectionId);
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

    // Clear reconnect data
    const timeout = this.reconnectTimeouts.get(connectionId);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(connectionId);
    }
    this.reconnectAttempts.delete(connectionId);
  }

  disconnectAll() {
    console.log('🔌 Disconnecting all WebSocket connections');
    this.connections.forEach((socket, id) => {
      socket.close(1000, 'Manual disconnect all');
    });
    this.connections.clear();

    // Clear all reconnect data
    this.reconnectTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.reconnectTimeouts.clear();
    this.reconnectAttempts.clear();
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
      const state = socket ? this.getReadyStateString(socket.readyState) : 'NOT_FOUND';
      console.warn(`WebSocket not ready for ${connectionId} (state: ${state}), message not sent:`, {
        messageType: message.type,
        socketExists: !!socket,
        readyState: state
      });
    }
  }

  isConnected(connectionId: string): boolean {
    const socket = this.connections.get(connectionId);
    return socket?.readyState === WebSocket.OPEN;
  }

  private getReadyStateString(state: number): string {
    switch (state) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  // Debug method to get connection info
  getConnectionInfo(): { [key: string]: any } {
    const info: { [key: string]: any } = {};
    this.connections.forEach((socket, id) => {
      info[id] = {
        readyState: this.getReadyStateString(socket.readyState),
        url: socket.url,
        hasReconnectTimeout: this.reconnectTimeouts.has(id),
        reconnectAttempts: this.reconnectAttempts.get(id) || 0
      };
    });
    return info;
  }
}

export const simpleWebSocketService = SimpleWebSocketService.getInstance();