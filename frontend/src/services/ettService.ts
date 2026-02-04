/**
 * ETT Issue Tracker Service
 *
 * Handles integration with the ETT issue tracker API for creating
 * tickets from meeting summaries.
 *
 * CONFIG IS STORED LOCALLY - users must configure their own credentials
 * via the settings UI. No credentials are baked into the source code.
 */

const ETT_CONFIG_KEY = 'ett_config';

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

export interface ETTConfig {
  apiUrl: string;
  accessToken: string;
  defaultBoardId?: number;
  defaultReporterId?: number;
}

/**
 * ETT Issue Tracker Service
 * Manages communication with ETT-main-service API
 *
 * Config is stored in localStorage - each user must configure their own
 * ETT instance URL and credentials via the settings UI.
 */
export class ETTService {
  private config: ETTConfig | null = null;

  constructor() {
    // Load config from localStorage on init
    this.loadConfig();
  }

  /**
   * Load config from localStorage
   */
  private loadConfig(): void {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(ETT_CONFIG_KEY);
    if (stored) {
      try {
        this.config = JSON.parse(stored);
      } catch {
        this.config = null;
      }
    }
  }

  /**
   * Configure the ETT service with API credentials
   * Saves to localStorage for persistence
   */
  configure(config: ETTConfig): void {
    this.config = config;
    if (typeof window !== 'undefined') {
      localStorage.setItem(ETT_CONFIG_KEY, JSON.stringify(config));
    }
  }

  /**
   * Clear stored configuration
   */
  clearConfig(): void {
    this.config = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ETT_CONFIG_KEY);
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.config !== null && !!this.config.apiUrl && !!this.config.accessToken;
  }

  /**
   * Get current configuration (without exposing access token)
   */
  getConfig(): Omit<ETTConfig, 'accessToken'> & { hasToken: boolean } | null {
    if (!this.config) return null;
    return {
      apiUrl: this.config.apiUrl,
      defaultBoardId: this.config.defaultBoardId,
      defaultReporterId: this.config.defaultReporterId,
      hasToken: !!this.config.accessToken,
    };
  }

  private getHeaders(): HeadersInit {
    if (!this.config) {
      throw new Error('ETT Service not configured. Call configure() first.');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.accessToken}`,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.config) {
      throw new Error('ETT Service not configured. Call configure() first.');
    }

    const url = `${this.config.apiUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

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
