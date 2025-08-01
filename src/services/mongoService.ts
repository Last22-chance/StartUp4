// MongoDB service for user validation and team collaboration
import { WorkspaceInvitation, WorkspaceMember } from '../context/DatabaseContext';

class MongoService {
  private baseUrl = (import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:5000') + '/api';

  constructor() {
    if (import.meta.env.DEV) {
      console.log('🔧 MongoDB Service Configuration:');
      console.log(`📡 API Base URL: ${this.baseUrl}`);
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async validateUsername(username: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/users/validate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ username })
      });
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/';
          return false;
        }
        console.error(`Username validation failed: HTTP ${response.status}: ${response.statusText}`);
        return false;
      }
      const data = await response.json();
      return Boolean(data.exists);
    } catch (error) {
      console.error('Error validating username:', error);
      return false;
    }
  }

  async saveInvitation(invitation: WorkspaceInvitation): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/invitations`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          ...invitation,
          createdAt: invitation.createdAt.toISOString(),
          expiresAt: invitation.expiresAt.toISOString(),
        })
      });
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/';
          return false;
        }
        const errorData = await response.json().catch(() => ({}));
        console.error(`Failed to save invitation: ${response.status}`, errorData);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error saving invitation:', error);
      return false;
    }
  }

  async updateInvitationStatus(invitationId: string, status: 'accepted' | 'expired'): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/invitations/${invitationId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Failed to update invitation status: ${response.status}`, errorData);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error updating invitation status:', error);
      return false;
    }
  }

  async getWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    try {
      const response = await fetch(`${this.baseUrl}/invitations?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        console.error(`Failed to fetch invitations: ${response.status}`);
        return [];
      }
      const data = await response.json();
      return data.map((inv: any) => ({
        ...inv,
        createdAt: new Date(inv.createdAt),
        expiresAt: new Date(inv.expiresAt),
      }));
    } catch (error) {
      console.error('Error fetching workspace invitations:', error);
      return [];
    }
  }

  async saveWorkspaceMember(member: WorkspaceMember, workspaceId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/members`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          ...member,
          workspaceId,
          joinedAt: member.joinedAt.toISOString(),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Failed to save workspace member: ${response.status}`, errorData);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error saving workspace member:', error);
      return false;
    }
  }

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    try {
      const response = await fetch(`${this.baseUrl}/members?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        console.error(`Failed to fetch workspace members: ${response.status}`);
        return [];
      }
      const data = await response.json();
      return data.map((member: any) => ({
        ...member,
        joinedAt: new Date(member.joinedAt),
      }));
    } catch (error) {
      console.error('Error fetching workspace members:', error);
      return [];
    }
  }

  async updateWorkspace(workspaceId: string, data: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/workspaces/${encodeURIComponent(workspaceId)}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          ...data,
          updatedAt: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`Failed to update workspace: ${response.status}`, errorData);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error updating workspace:', error);
      return false;
    }
  }

  async getUserWorkspaces(username: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/workspaces?username=${encodeURIComponent(username)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        console.error(`Failed to fetch user workspaces: ${response.status}`);
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching user workspaces:', error);
      return [];
    }
  }

  async validateJoinCode(joinCode: string): Promise<{ valid: boolean; invitation?: WorkspaceInvitation; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/invitations/validate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ joinCode: joinCode.toUpperCase() }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { valid: false, error: errorData.message || 'Invalid or expired join code' };
      }
      const data = await response.json();
      if (data.invitation) {
        data.invitation.createdAt = new Date(data.invitation.createdAt);
        data.invitation.expiresAt = new Date(data.invitation.expiresAt);
      }
      return { valid: data.valid, invitation: data.invitation, error: data.error };
    } catch (error) {
      console.error('Error validating join code:', error);
      return { valid: false, error: 'Network error. Please check your connection and try again.' };
    }
  }

  async broadcastSchemaChange(schemaId: string, changeType: string, data: any): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/collaboration/broadcast`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          schemaId,
          changeType,
          data,
          timestamp: new Date().toISOString(),
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('Error broadcasting schema change:', error);
      return false;
    }
  }

  async getRealtimeUpdates(schemaId: string, since?: Date): Promise<any[]> {
    try {
      const params = new URLSearchParams({ schemaId });
      if (since) params.append('since', since.toISOString());
      const response = await fetch(`${this.baseUrl}/collaboration/updates?${params}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        console.error(`Failed to fetch realtime updates: ${response.status}`);
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching realtime updates:', error);
      return [];
    }
  }
}

export const mongoService = new MongoService();
