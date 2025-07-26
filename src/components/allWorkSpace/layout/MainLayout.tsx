// src/components/allWorkSpace/layout/MainLayout.tsx
import React, { useState, useEffect } from 'react';
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from './Header';
import WorkspacePanel from '../panels/WorkspacePanel';
import PortfolioPanel from '../panels/PortfolioPanel';
import ToolsPanel from '../panels/ToolsPanel';
import CollaborativeCursors, { CursorData } from '../workspace/CollaborativeCursors';
import { useDatabase } from '../../../context/DatabaseContext';
import { collaborationService, CollaborationUser } from '../../../services/collaborationService';

const MainLayout: React.FC = () => {
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [collaborativeCursors, setCollaborativeCursors] = useState<CursorData[]>([]);
  const [isCollaborationConnected, setIsCollaborationConnected] = useState(false);

  const { currentSchema, syncWorkspaceWithMongoDB } = useDatabase();

  useEffect(() => {
    // Initialize collaboration service for real-time collaboration
    const initializeCollaboration = async () => {
      if (!currentSchema?.id) return;

      try {
        // Create a demo user for collaboration
        const demoUser: CollaborationUser = {
          id: `user_${Date.now()}`,
          username: `user_${Math.random().toString(36).substr(2, 8)}`,
          role: 'editor',
          color: `hsl(${Math.random() * 360}, 70%, 50%)`
        };

        // Initialize and connect collaboration service
        collaborationService.initialize(demoUser, currentSchema.id);

        // Set up event handlers
        const handleConnected = () => {
          console.log('✅ Collaboration connected');
          setIsCollaborationConnected(true);
        };

        const handleDisconnected = () => {
          console.log('❌ Collaboration disconnected');
          setIsCollaborationConnected(false);
        };

        const handleCursorUpdate = (cursor: any) => {
          console.log('📍 Cursor update received:', cursor);
          if (cursor && cursor.userId) {
            setCollaborativeCursors(prev => {
              const filtered = prev.filter(c => c.userId !== cursor.userId);
              return [...filtered, {
                userId: cursor.userId,
                username: cursor.username || 'Unknown',
                position: cursor.position || { x: 0, y: 0 },
                color: cursor.color || '#3B82F6',
                lastSeen: cursor.lastSeen || new Date().toISOString()
              }];
            });
          }
        };

        const handleUserJoined = (user: CollaborationUser) => {
          console.log('👋 User joined:', user?.username);
        };

        const handleUserLeft = (userId: string) => {
          console.log('👋 User left:', userId);
          setCollaborativeCursors(prev => prev.filter(c => c.userId !== userId));
        };

        const handleError = (error: any) => {
          console.error('❌ Collaboration error:', error);
          setIsCollaborationConnected(false);
        };

        // Register event handlers
        collaborationService.on('connected', handleConnected);
        collaborationService.on('disconnected', handleDisconnected);
        collaborationService.on('cursor_update', handleCursorUpdate);
        collaborationService.on('user_joined', handleUserJoined);
        collaborationService.on('user_left', handleUserLeft);
        collaborationService.on('error', handleError);

        // Connect to collaboration service
        await collaborationService.connect();

        // Cleanup function
        return () => {
          collaborationService.off('connected', handleConnected);
          collaborationService.off('disconnected', handleDisconnected);
          collaborationService.off('cursor_update', handleCursorUpdate);
          collaborationService.off('user_joined', handleUserJoined);
          collaborationService.off('user_left', handleUserLeft);
          collaborationService.off('error', handleError);
          collaborationService.disconnect();
        };

      } catch (error) {
        console.error('Failed to initialize collaboration:', error);
        setIsCollaborationConnected(false);
      }
    };

    // Add delay to prevent connection spam
    const timeoutId = setTimeout(initializeCollaboration, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentSchema?.id]);

  // Panel toggles
  const toggleLeftPanel = () => setLeftPanelOpen(p => !p);
  const toggleRightPanel = () => setRightPanelOpen(p => !p);
  const toggleLeftCollapse = () => setLeftPanelCollapsed(p => !p);
  const toggleRightCollapse = () => setRightPanelCollapsed(p => !p);

  // Cursor move broadcast
  const handleCursorMove = (pos: { x: number; y: number; tableId?: string; columnId?: string }) => {
    if (isCollaborationConnected && collaborationService.isConnectedState()) {
      collaborationService.sendCursorUpdate(pos);
    }
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200 relative">
      <Header />
      
      {/* Collaboration Status Indicator */}
      {import.meta.env.DEV && (
        <div className="fixed top-20 right-4 z-50">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isCollaborationConnected 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
          }`}>
            {isCollaborationConnected ? '🟢 Collaboration Active' : '🟡 Collaboration Offline'}
          </div>
        </div>
      )}
      
      {/* Collaborative Cursors Overlay */}
      <CollaborativeCursors 
        cursors={collaborativeCursors}
        onCursorMove={handleCursorMove}
      />
      
      <div className="flex-1 flex relative">
        {/* Mobile Menu Buttons */}
        <div className="lg:hidden absolute top-4 left-4 z-50">
          <button
            onClick={toggleLeftPanel}
            className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200 hover:scale-105"
            aria-label={leftPanelOpen ? "Close tools panel" : "Open tools panel"}
          >
            {leftPanelOpen ? (
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>

        <div className="lg:hidden absolute top-4 right-4 z-50">
          <button
            onClick={toggleRightPanel}
            className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-200 hover:scale-105"
            aria-label={rightPanelOpen ? "Close portfolio panel" : "Open portfolio panel"}
          >
            {rightPanelOpen ? (
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>

        {/* Left Panel - Advanced Tools */}
        <div className={`
          fixed inset-y-0 left-0 z-40 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-300 ease-in-out shadow-xl
          lg:relative lg:translate-x-0 lg:shadow-none
          ${leftPanelOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${leftPanelCollapsed ? 'lg:w-12' : 'w-80 lg:w-1/5 lg:min-w-80'}
        `}>
          {/* Collapse Toggle Button */}
          <div className="hidden lg:block absolute top-4 -right-3 z-50">
            <button
              onClick={toggleLeftCollapse}
              className="w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200"
              aria-label={leftPanelCollapsed ? "Expand tools panel" : "Collapse tools panel"}
            >
              {leftPanelCollapsed ? (
                <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
          
          <div className="lg:hidden absolute top-4 right-4">
            <button
              onClick={() => setLeftPanelOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
              aria-label="Close tools panel"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          
          {/* Tools Panel Content */}
          <ToolsPanel collapsed={leftPanelCollapsed} />
        </div>

        {/* Center Panel - Workspace */}
        <div className="flex-1 lg:w-3/5">
          <WorkspacePanel />
        </div>

        {/* Right Panel - Portfolio & Chat */}
        <div className={`
          fixed inset-y-0 right-0 z-40 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 transform transition-all duration-300 ease-in-out shadow-xl
          lg:relative lg:translate-x-0 lg:shadow-none
          ${rightPanelOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          ${rightPanelCollapsed ? 'lg:w-12' : 'w-80 lg:w-1/5 lg:min-w-80'}
        `}>
          {/* Collapse Toggle Button */}
          <div className="hidden lg:block absolute top-4 -left-3 z-50">
            <button
              onClick={toggleRightCollapse}
              className="w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200"
              aria-label={rightPanelCollapsed ? "Expand portfolio panel" : "Collapse portfolio panel"}
            >
              {rightPanelCollapsed ? (
                <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
          
          <div className="lg:hidden absolute top-4 left-4">
            <button
              onClick={() => setRightPanelOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
              aria-label="Close portfolio panel"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <PortfolioPanel collapsed={rightPanelCollapsed} />
        </div>

        {/* Mobile Overlays */}
        {(leftPanelOpen || rightPanelOpen) && (
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30 backdrop-blur-sm"
            onClick={() => {
              setLeftPanelOpen(false);
              setRightPanelOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default MainLayout;