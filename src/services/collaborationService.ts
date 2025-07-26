export interface CollaborationUser {
  id: string;
  username: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar?: string;
  color: string;
}

export interface CursorPosition {
  x: number;
  y: number;
  tableId?: string;
  columnId?: string;
}

export interface SchemaChange {
  type: 'table_created' | 'table_updated' | 'table_deleted' | 'relationship_added' | 'relationship_removed';
  data: any;
  userId: string;
  timestamp: Date;
}

import { simpleWebSocketService } from './simpleWebSocketService';

// WebSocket URL helper
const getWebSocketUrl = (schemaId: string) => {
  if (import.meta.env.DEV) {
    return `ws://localhost:5000/ws/collaboration/${schemaId}`;
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws/collaboration/${schemaId}`;
};

export default class CollaborationService {
  private connectionId: string | null = null;
  private currentUser: CollaborationUser | null = null;
  private schemaId: string | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();
  private isConnected = false;
  private isIntentionalDisconnect = false;

  constructor() {
    // Constructor boş
  }

  initialize(user: CollaborationUser, schemaId: string) {
    this.currentUser = user;
    this.schemaId = schemaId;
    console.log('🔧 CollaborationService initialized:', { user: user.username, schemaId });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.currentUser || !this.schemaId) {
        const error = new Error('Must initialize with user and schema ID before connecting');
        console.error('❌ Connection failed:', error.message);
        reject(error);
        return;
      }

      if (this.isConnected && this.connectionId) {
        console.log('✅ WebSocket already connected');
        resolve();
        return;
      }

      const url = getWebSocketUrl(this.schemaId);
      console.log('🔗 Connecting to WebSocket via SimpleWebSocketService:', url);
      
      try {
        this.connectionId = simpleWebSocketService.connect(url, {
          onOpen: () => {
            console.log('✅ Collaboration WebSocket connected successfully');
            this.isConnected = true;
            
            // Send user join message after a small delay to ensure connection is fully established
            setTimeout(() => {
              if (this.isConnected && this.connectionId) {
                this.sendMessage({
                  type: 'user_join',
                  userId: this.currentUser!.id,
                  username: this.currentUser!.username,
                  schemaId: this.schemaId!
                });
              }
            }, 200); // Increased delay to 200ms
            
            this.emit('connected');
            resolve();
          },
          onMessage: (message) => {
            this.handleMessage(message);
          },
          onClose: () => {
            console.log('❌ Collaboration WebSocket disconnected');
            this.isConnected = false;
            this.emit('disconnected');
          },
          onError: (error) => {
            console.error('❌ Collaboration WebSocket error:', error);
            this.emit('error', error);
            reject(error);
          },
          enableReconnect: !this.isIntentionalDisconnect
        });

      } catch (error) {
        console.error('❌ Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  private handleMessage(message: any) {
    console.log('📨 Received collaboration message:', message.type, message);
    
    switch (message.type) {
      case 'connection_established':
        console.log('🔗 Connection established with server, clientId:', message.clientId);
        // Store clientId for future reference if needed
        break;
        
      case 'user_joined':
        console.log('👋 User joined:', message.user?.username);
        this.emit('user_joined', message.user);
        break;
        
      case 'user_left':
        console.log('👋 User left:', message.userId);
        this.emit('user_left', message.userId);
        break;
        
      case 'cursor_update':
        // Server sends cursor data in 'data' field according to websocket-server.cjs
        const cursorData = message.data;
        
        // Validate cursor data structure
        if (cursorData && 
            typeof cursorData === 'object' && 
            cursorData.userId && 
            typeof cursorData.userId === 'string') {
          
          console.log('📍 Valid cursor update received:', cursorData);
          this.emit('cursor_update', cursorData);
        } else {
          console.warn('⚠️ Invalid cursor_update message structure:', {
            message,
            hasData: !!message.data,
            dataType: typeof message.data,
            dataUserId: message.data?.userId,
            userIdType: typeof message.data?.userId
          });
        }
        break;
        
      case 'schema_change':
        console.log('🔄 Schema changed:', message.changeType);
        this.emit('schema_change', message);
        break;
        
      case 'user_selection':
        this.emit('user_selection', message.data);
        break;
        
      case 'presence_update':
        this.emit('presence_update', message.data);
        break;
        
      case 'pong':
        // Heartbeat response
        console.log('💓 Heartbeat pong received');
        break;
        
      default:
        console.log('❓ Unknown message type:', message.type, message);
    }
  }

  sendCursorUpdate(position: CursorPosition) {
    if (!this.currentUser) {
      console.warn('⚠️ Cannot send cursor update: no current user');
      return;
    }

    const cursorMessage = {
      type: 'cursor_update',
      cursor: {
        userId: this.currentUser.id,
        username: this.currentUser.username,
        position,
        color: this.currentUser.color,
        lastSeen: new Date().toISOString()
      }
    };

    console.log('📍 Sending cursor update:', cursorMessage);
    this.sendMessage(cursorMessage);
  }

  sendSchemaChange(change: SchemaChange) {
    this.sendMessage({
      type: 'schema_change',
      changeType: change.type,
      data: change.data,
      userId: this.currentUser!.id,
      timestamp: new Date().toISOString()
    });
  }

  sendUserSelection(selection: { tableId?: string; columnId?: string }) {
    this.sendMessage({
      type: 'user_selection',
      data: {
        userId: this.currentUser!.id,
        selection,
        timestamp: new Date().toISOString()
      }
    });
  }

  updatePresence(status: 'online' | 'away' | 'busy', currentAction?: string) {
    this.sendMessage({
      type: 'presence_update',
      data: {
        userId: this.currentUser!.id,
        status,
        currentAction,
        timestamp: new Date().toISOString()
      }
    });
  }

  private sendMessage(message: any) {
    if (this.connectionId && this.isConnected && simpleWebSocketService.isConnected(this.connectionId)) {
      simpleWebSocketService.sendMessage(this.connectionId, message);
    } else {
      console.warn('⚠️ WebSocket not connected or ready, message not sent:', {
        messageType: message.type,
        connectionId: this.connectionId,
        isConnected: this.isConnected,
        serviceConnected: this.connectionId ? simpleWebSocketService.isConnected(this.connectionId) : false
      });
    }
  }

  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers && handlers.length > 0) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`❌ Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    
    if (this.connectionId && this.currentUser && this.isConnected) {
      // Send leave message only if we're actually connected
      this.sendMessage({
        type: 'user_leave',
        userId: this.currentUser.id,
        schemaId: this.schemaId
      });
      
      // Small delay to ensure the message is sent before disconnecting
      setTimeout(() => {
        if (this.connectionId) {
          simpleWebSocketService.disconnect(this.connectionId);
          this.connectionId = null;
        }
      }, 100);
    } else if (this.connectionId) {
      simpleWebSocketService.disconnect(this.connectionId);
      this.connectionId = null;
    }
    
    this.isConnected = false;
    console.log('🔌 Disconnected from Collaboration WebSocket');
  }

  // Utility methods
  isConnectedState(): boolean {
    return this.isConnected && 
           this.connectionId !== null && 
           simpleWebSocketService.isConnected(this.connectionId);
  }

  getConnectionState(): string {
    if (!this.connectionId) return 'CLOSED';
    return this.isConnectedState() ? 'OPEN' : 'CLOSED';
  }

  // Conflict resolution methods
  transformOperation(operation: any, otherOperation: any): any {
    if (operation.type === 'table_update' && otherOperation.type === 'table_update') {
      if (operation.tableId === otherOperation.tableId) {
        return this.mergeTableOperations(operation, otherOperation);
      }
    }
    return operation;
  }

  private mergeTableOperations(op1: any, op2: any): any {
    return {
      ...op1,
      data: {
        ...op1.data,
        ...op2.data,
        lastModified: Math.max(
          new Date(op1.timestamp).getTime(),
          new Date(op2.timestamp).getTime()
        )
      }
    };
  }

  resolveConflict(localChange: any, remoteChange: any): any {
    // Remote changes win (last-write-wins strategy)
    return remoteChange;
  }
}

export const collaborationService = new CollaborationService();