// src/components/portfolio/PortfolioManager.tsx
import React, { useState, useEffect } from 'react';
import { ArrowRight, Folder, Calendar, Eye, Trash2, Plus, Code, Upload, FileText, X } from 'lucide-react';
import { useDatabase } from '../../../context/DatabaseContext';
import { usePortfolio, Portfolio } from '../../../context/PortfolioContext';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { mongoService } from '../../../services/mongoService';
import { SQLParser } from '../../../utils/sqlParser';

const PortfolioManager: React.FC = () => {
  const {
    currentSchema,
    createNewSchema,
    saveSchema,
    //generateSQL,
    importSchema,
  } = useDatabase();

  const {
    portfolios,
    loadPortfolios,
    savePortfolio,
    deletePortfolio,
  } = usePortfolio();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState('');
  const [sharedSchemas, setSharedSchemas] = useState<Portfolio[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSQL, setImportSQL] = useState('');
  const [importError, setImportError] = useState('');
  
  // Real-time portfolio updates via WebSocket
  const wsUrl = import.meta.env.DEV 
    ? 'ws://localhost:8080/portfolio-updates'
    : `wss://${window.location.host}/ws/portfolio-updates`;
    
  const { isConnected, sendMessage } = useWebSocket({
    url: wsUrl,
    onMessage: (message) => {
      handlePortfolioUpdate(message);
    },
    autoConnect: true
  });
  
  const handlePortfolioUpdate = (message: any) => {
    switch (message.type) {
      case 'schema_shared':
        // Add shared schema to portfolio list
        if (message.data.schema && message.data.targetUsers?.includes('current_user')) {
          setSharedSchemas(prev => [...prev, message.data.schema]);
        }
        break;
      case 'schema_access_revoked':
        // Remove schema from portfolio list
        if (message.data.schemaId && message.data.revokedUsers?.includes('current_user')) {
          setSharedSchemas(prev => prev.filter(schema => schema._id !== message.data.schemaId));
          // Also reload portfolios to ensure consistency
          loadPortfolios();
        }
        break;
      case 'schema_updated':
        // Update existing schema in portfolio
        if (message.data.schema) {
          setSharedSchemas(prev => prev.map(schema => 
            schema._id === message.data.schema._id ? message.data.schema : schema
          ));
        }
        break;
    }
  };

  useEffect(() => {
    loadPortfolios();
    loadSharedSchemas();
  }, [loadPortfolios]);
  
  const loadSharedSchemas = async () => {
    try {
      // Load schemas shared with current user
      const shared = await mongoService.getUserWorkspaces('current_user');
      setSharedSchemas(shared);
    } catch (error) {
      console.error('Failed to load shared schemas:', error);
    }
  };

  const handleCreateSchema = () => {
    if (!newSchemaName.trim()) return;
    createNewSchema(newSchemaName.trim());
    setNewSchemaName('');
    setShowCreateModal(false);
  };

  const handleImportSQL = () => {
    if (!importSQL.trim()) {
      setImportError('Please enter SQL code to import');
      
      return;
    }

    try {
      // Validate SQL first
      const validation = SQLParser.validateSQL(importSQL);
      if (!validation.isValid) {
        setImportError(`SQL validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      // Parse SQL statements to create schema
      const statements = importSQL.split(';').filter(s => s.trim());
      const newSchema = {
        id: crypto.randomUUID(),
        name: newSchemaName || 'Imported Schema',
        tables: [] as any[],
        relationships: [],
        indexes: [],
        constraints: [],
        users: [],
        permissions: [],
        savedQueries: [],
        members: [{
          id: crypto.randomUUID(),
          username: 'current_user',
          role: 'owner' as const,
          joinedAt: new Date()
        }],
        invitations: [],
        isShared: false,
        ownerId: 'current_user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Parse CREATE TABLE statements
      statements.forEach(statement => {
        try {
          const parsed = SQLParser.parseStatement(statement.trim());
          if (parsed.type === 'CREATE_TABLE' && parsed.tableName && parsed.columns) {
            const table = {
              id: crypto.randomUUID(),
              name: parsed.tableName,
              columns: parsed.columns.map(col => ({
                id: crypto.randomUUID(),
                name: col.name,
                type: col.type,
                nullable: col.nullable,
                isPrimaryKey: col.primaryKey,
                isForeignKey: !!col.references,
                referencedTable: col.references?.table,
                referencedColumn: col.references?.column,
                isUnique: col.unique,
                defaultValue: col.defaultValue
              })),
              position: { 
                x: Math.random() * 400 + 100, 
                y: Math.random() * 300 + 100 
              },
              rowCount: 0,
              data: []
            };
            newSchema.tables.push(table);
          }
        } catch (error) {
          console.warn('Failed to parse statement:', statement, error);
        }
      });

      // Import the schema
      importSchema(newSchema);
      
      // Close modal and reset
      setShowImportModal(false);
      setImportSQL('');
      setImportError('');
      setNewSchemaName('');
      
    } catch (error) {
      setImportError('Failed to parse SQL. Please check your syntax.');
    }
  };

  const handleSaveCurrentSchema = async () => {
    saveSchema();
    const payload = JSON.stringify(currentSchema);
    try {
      await savePortfolio(currentSchema.name, payload);
      await loadPortfolios();
      
      // Broadcast schema save to collaborators if shared
      if (currentSchema.isShared && isConnected) {
        sendMessage({
          type: 'schema_updated',
          data: { 
            schema: { 
              _id: currentSchema.id, 
              name: currentSchema.name, 
              scripts: payload 
            } 
          },
          userId: 'current_user',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Portfolio saxlama xətası:', err);
    }
  };

  const confirmAndDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this database?')) return;
    try {
      await deletePortfolio(id);
      await loadPortfolios();
    } catch (err) {
      console.error('Portfolio silmə xətası:', err);
    }
  };

  const handleLoadPortfolio = (p: Portfolio) => {
    try {
      const schemaObj = JSON.parse(p.scripts);
      importSchema(schemaObj);
    } catch (error) {
      console.error('Could not parse portfolio scripts:', error);
    }
  };
  
  // Combine personal and shared portfolios
  const allPortfolios = [...portfolios, ...sharedSchemas];

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Schema Portfolio
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
            >
              <Upload className="w-4 h-4" /> Import SQL
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
        </div>
        {/* Current Schema Info */}
        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sky-800 dark:text-sky-200">
              Current Schema
            </h4>
            <button
              onClick={handleSaveCurrentSchema}
              className="text-sm bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded"
            >
              Save
            </button>
          </div>
          <p className="font-medium text-sky-700 dark:text-sky-300">
            {currentSchema.name}
          </p>
          <div className="flex items-center gap-4 mt-2 text-sm text-sky-600 dark:text-sky-400">
            <span>{currentSchema.tables.length} tables</span>
            <span>{currentSchema.relationships.length} relationships</span>
          </div>
        </div>
      </div>

      {/* Portfolio Button */}
      <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg mb-6">
        <ArrowRight className="w-4 h-4" /> Go to Portfolio
      </button>

      {/* Portfolios List */}
      <div className="flex-1 overflow-y-auto">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
          All Schemas ({allPortfolios.length})
        </h4>

        {allPortfolios.length === 0 ? (
          <div className="text-center py-8">
            <Folder className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              No saved schemas yet
            </p>
            <p className="text-sm text-gray-400">
              Create and save your first schema to see it here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {allPortfolios.map((p) => {
              // parse tables/relationships counts if JSON
              let tblCount = null;
              let relCount = null;
              let isShared = sharedSchemas.some(shared => shared._id === p._id);
              try {
                const s = JSON.parse(p.scripts);
                tblCount = s.tables.length;
                relCount = s.relationships.length;
              } catch {}
              return (
                <div
                  key={p._id}
                  className={`bg-white dark:bg-gray-800 border rounded-lg p-4 hover:shadow-md transition-shadow duration-200 ${
                    isShared 
                      ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium text-gray-900 dark:text-white truncate">
                        {p.name}
                      </h5>
                      {isShared && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                          Shared
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleLoadPortfolio(p)}
                        className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                        title="Load schema"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!isShared && (
                        <button
                          onClick={() => confirmAndDelete(p._id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          title="Delete schema"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                    <span>{tblCount !== null ? tblCount : '-'} tables</span>
                    <span>{relCount !== null ? relCount : '-'} relationships</span>
                    {isShared && <span>• Collaborative</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    <span>Created {new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Schema Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Schema
            </h3>
            <input
              type="text"
              value={newSchemaName}
              onChange={(e) => setNewSchemaName(e.target.value)}
              placeholder="Enter schema name"
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && handleCreateSchema()}
              className="w-full px-3 py-2 border rounded-lg mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewSchemaName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSchema}
                disabled={!newSchemaName.trim()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded disabled:bg-gray-400"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import SQL Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <Code className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Import SQL Schema
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportSQL('');
                  setImportError('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Schema Name (optional)
                </label>
                <input
                  type="text"
                  value={newSchemaName}
                  onChange={(e) => setNewSchemaName(e.target.value)}
                  placeholder="Enter schema name or leave blank for 'Imported Schema'"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  SQL Code
                </label>
                <textarea
                  value={importSQL}
                  onChange={(e) => setImportSQL(e.target.value)}
                  placeholder="Paste your SQL CREATE TABLE statements here..."
                  className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Supports CREATE TABLE statements with columns, primary keys, and foreign keys
                </p>
              </div>

              {importError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span className="text-red-800 dark:text-red-200 text-sm font-medium">Import Error</span>
                  </div>
                  <p className="text-red-700 dark:text-red-300 text-sm mt-1">{importError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportSQL('');
                  setImportError('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleImportSQL}
                disabled={!importSQL.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg"
              >
                Import Schema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioManager;