'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ettService, CreateIssueRequest, ETTBoard } from '@/services/ettService';

interface ParsedTicket {
  id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  selected: boolean;
}

interface TicketReviewProps {
  summaryMarkdown: string;
  onTicketsCreated?: (count: number) => void;
  onClose?: () => void;
}

export function TicketReview({ summaryMarkdown, onTicketsCreated, onClose }: TicketReviewProps) {
  const [tickets, setTickets] = React.useState<ParsedTicket[]>([]);
  const [boards, setBoards] = React.useState<ETTBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isPushing, setIsPushing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const hasApiUrl = ettService.hasApiUrl();
  const authState = ettService.getAuthState();
  const isReady = hasApiUrl && authState.isAuthenticated;

  React.useEffect(() => {
    // Parse tickets from summary
    const parsed = ettService.parseTicketsFromSummary(summaryMarkdown);
    setTickets(
      parsed.map((t, i) => ({
        id: `ticket-${i}`,
        title: t.title || '',
        description: t.description || '',
        priority: t.priority || 'medium',
        selected: true,
      }))
    );

    // Load boards if authenticated
    if (isReady) {
      loadBoards();
    }
  }, [summaryMarkdown, isReady]);

  const loadBoards = async () => {
    setIsLoading(true);
    try {
      const boardList = await ettService.getBoards();
      setBoards(boardList);

      // Select first board by default
      if (boardList.length > 0) {
        setSelectedBoardId(boardList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load boards');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTicket = (id: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const toggleAll = () => {
    const allSelected = tickets.every((t) => t.selected);
    setTickets((prev) => prev.map((t) => ({ ...t, selected: !allSelected })));
  };

  const handlePush = async () => {
    if (!selectedBoardId) {
      setError('Please select a board');
      return;
    }

    const selectedTickets = tickets.filter((t) => t.selected);
    if (selectedTickets.length === 0) {
      setError('Please select at least one ticket');
      return;
    }

    const currentAuth = ettService.getAuthState();
    if (!currentAuth.userId) {
      setError('Please log in to create tickets');
      return;
    }

    setIsPushing(true);
    setError(null);
    setSuccess(null);

    try {
      const issues: CreateIssueRequest[] = selectedTickets.map((t) => ({
        board_id: selectedBoardId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: 'backlog',
        reporter_id: currentAuth.userId!,
      }));

      await ettService.createIssues(issues);
      setSuccess(`Successfully created ${issues.length} ticket(s)`);
      onTicketsCreated?.(issues.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tickets');
    } finally {
      setIsPushing(false);
    }
  };

  const selectedCount = tickets.filter((t) => t.selected).length;

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
    none: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  if (!hasApiUrl) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
        <p className="text-yellow-800">
          Issue tracker API not configured. Set <code>NEXT_PUBLIC_ETT_API_URL</code> in .env file.
        </p>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
        <p className="text-yellow-800">
          Please log in to the issue tracker in Settings to push tickets.
        </p>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-muted">
        <p className="text-muted-foreground">
          No tickets found in the summary. Make sure the summary includes a "Suggested Tickets" section.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Review Tickets ({tickets.length})</h3>
        <Button variant="ghost" size="sm" onClick={toggleAll}>
          {tickets.every((t) => t.selected) ? 'Deselect All' : 'Select All'}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tickets.map((ticket) => (
              <label
                key={ticket.id}
                className={`flex items-start gap-3 p-3 border rounded cursor-pointer transition-colors ${
                  ticket.selected ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={ticket.selected}
                  onChange={() => toggleTicket(ticket.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{ticket.title}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${priorityColors[ticket.priority]}`}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {ticket.description}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm">
              Board:
              <select
                value={selectedBoardId || ''}
                onChange={(e) => setSelectedBoardId(Number(e.target.value))}
                className="ml-2 border rounded px-2 py-1 text-sm"
              >
                <option value="">Select a board</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded bg-green-50 text-green-700 border border-green-200 text-sm">
              {success}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handlePush}
              disabled={isPushing || selectedCount === 0 || !selectedBoardId}
            >
              {isPushing
                ? 'Creating...'
                : `Push ${selectedCount} Ticket${selectedCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
