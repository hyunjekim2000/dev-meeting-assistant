/**
 * ETT Issue Tracker Service
 *
 * Handles integration with the ETT issue tracker API for creating
 * tickets from meeting summaries.
 *
 * - API URL is set via .env (NEXT_PUBLIC_ETT_API_URL)
 * - User authenticates at runtime when enabling ticket generation
 * - Token stored in localStorage
 */

const ETT_AUTH_KEY = 'ett_auth';

// Types matching ETT issue tracker schema
export interface ETTIssue {
  id?: number;
  board_id: number;
  title: string;
  description: string | null;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled' | 'blocker';
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  assignee_id?: number | null;
  reporter_id: number;
  due_date?: string | null;
  estimated_hours?: number | null;
  label_ids?: number[];
}

export interface ETTBoard {
  id: number;
  name: string;
  description: string | null;
  type: 'team' | 'personal';
}

export interface ETTTeamMember {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface ETTLabel {
  id: number;
  board_id: number;
  name: string;
  color: string;
}

export interface CreateIssueRequest {
  board_id: number;
  title: string;
  description?: string;
  status?: ETTIssue['status'];
  priority?: ETTIssue['priority'];
  assignee_id?: number;
  reporter_id: number;
  due_date?: string;
  estimated_hours?: number;
  label_ids?: number[];
}

export interface ETTAuthState {
  accessToken: string;
  refreshToken?: string;
  userId: number;
  userName: string;
  expiresAt?: number;
}

/**
 * ETT Issue Tracker Service
 *
 * API URL from env, auth at runtime via login.
 */
export class ETTService {
  private apiUrl: string;
  private auth: ETTAuthState | null = null;

  constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_ETT_API_URL || '';
    this.loadAuth();
  }

  /**
   * Load auth from localStorage
   */
  private loadAuth(): void {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(ETT_AUTH_KEY);
    if (stored) {
      try {
        this.auth = JSON.parse(stored);
      } catch {
        this.auth = null;
      }
    }
  }

  /**
   * Save auth to localStorage
   */
  private saveAuth(auth: ETTAuthState): void {
    this.auth = auth;
    if (typeof window !== 'undefined') {
      localStorage.setItem(ETT_AUTH_KEY, JSON.stringify(auth));
    }
  }

  /**
   * Check if API URL is configured
   */
  hasApiUrl(): boolean {
    return !!this.apiUrl;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.auth?.accessToken;
  }

  /**
   * Get current auth state (without exposing token)
   */
  getAuthState(): { isAuthenticated: boolean; userName?: string; userId?: number } {
    return {
      isAuthenticated: this.isAuthenticated(),
      userName: this.auth?.userName,
      userId: this.auth?.userId,
    };
  }

  /**
   * Get API URL
   */
  getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Login to ETT with username/password
   */
  async login(username: string, password: string): Promise<{ success: boolean; message: string }> {
    if (!this.apiUrl) {
      return { success: false, message: 'API URL not configured. Check .env file.' };
    }

    try {
      const response = await fetch(`${this.apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Login failed' }));
        return { success: false, message: error.message || 'Invalid credentials' };
      }

      const data = await response.json();

      // Store auth state
      this.saveAuth({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        userId: data.user_id || data.id,
        userName: data.username || data.name || username,
      });

      return { success: true, message: 'Logged in successfully' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Logout - clear stored auth
   */
  logout(): void {
    this.auth = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ETT_AUTH_KEY);
    }
  }

  private getHeaders(): HeadersInit {
    if (!this.auth?.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.auth.accessToken}`,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.apiUrl) {
      throw new Error('API URL not configured. Check .env file.');
    }
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated. Please login first.');
    }

    const url = `${this.apiUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Token expired - clear auth
      this.logout();
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `ETT API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Test connection to ETT API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getBoards();
      return { success: true, message: 'Connected successfully' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Get all boards accessible to the user
   */
  async getBoards(): Promise<ETTBoard[]> {
    const result = await this.request<{ success: boolean; data: ETTBoard[] }>(
      '/issue-tracker/boards'
    );
    return result.data;
  }

  /**
   * Get team members for assignment
   */
  async getTeamMembers(): Promise<ETTTeamMember[]> {
    const result = await this.request<{ success: boolean; data: ETTTeamMember[] }>(
      '/issue-tracker/team-members'
    );
    return result.data;
  }

  /**
   * Get labels for a board
   */
  async getLabels(boardId: number): Promise<ETTLabel[]> {
    const result = await this.request<{ success: boolean; data: ETTLabel[] }>(
      `/issue-tracker/boards/${boardId}/labels`
    );
    return result.data;
  }

  /**
   * Create a single issue
   */
  async createIssue(issue: CreateIssueRequest): Promise<ETTIssue> {
    const result = await this.request<{ success: boolean; data: ETTIssue }>(
      '/issue-tracker/issues',
      {
        method: 'POST',
        body: JSON.stringify(issue),
      }
    );
    return result.data;
  }

  /**
   * Create multiple issues in batch
   */
  async createIssues(issues: CreateIssueRequest[]): Promise<ETTIssue[]> {
    const results: ETTIssue[] = [];
    for (const issue of issues) {
      const created = await this.createIssue(issue);
      results.push(created);
    }
    return results;
  }

  /**
   * Parse tickets from meeting summary markdown
   * Extracts structured ticket data from the "Suggested Tickets" section
   */
  parseTicketsFromSummary(summaryMarkdown: string): Partial<CreateIssueRequest>[] {
    const tickets: Partial<CreateIssueRequest>[] = [];

    // Find the Suggested Tickets section
    const ticketSectionMatch = summaryMarkdown.match(
      /## Suggested Tickets\s*\n([\s\S]*?)(?=\n## |$)/i
    );

    if (!ticketSectionMatch) {
      return tickets;
    }

    const ticketSection = ticketSectionMatch[1];

    // Parse markdown table rows
    // Format: | **Title** | Description | Priority |
    const tableRowRegex = /\|\s*\*?\*?([^|*]+)\*?\*?\s*\|\s*([^|]+)\s*\|\s*(\w+)\s*\|/g;
    let match;

    while ((match = tableRowRegex.exec(ticketSection)) !== null) {
      const [, title, description, priority] = match;

      // Skip header row
      if (title.toLowerCase().includes('title') || title.includes('---')) {
        continue;
      }

      const normalizedPriority = priority.trim().toLowerCase() as ETTIssue['priority'];
      const validPriorities = ['urgent', 'high', 'medium', 'low', 'none'];

      tickets.push({
        title: title.trim(),
        description: description.trim(),
        priority: validPriorities.includes(normalizedPriority) ? normalizedPriority : 'medium',
        status: 'backlog',
      });
    }

    return tickets;
  }
}

// Export singleton instance
export const ettService = new ETTService();
