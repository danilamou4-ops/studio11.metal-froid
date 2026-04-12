'use client';

import { useState, useCallback } from 'react';
import type { QualityTicket, TicketCreation, TicketUpdate } from './types';

interface UseQualityTicketsReturn {
  loading: boolean;
  error: string | null;
  tickets: QualityTicket[];
  fetchTickets: (playlistId?: string) => Promise<void>;
  createTicket: (ticket: TicketCreation) => Promise<boolean>;
  updateTicket: (ticketId: string, update: TicketUpdate) => Promise<boolean>;
  getTicketsByStatus: (status: string) => QualityTicket[];
}

export function useQualityTickets(): UseQualityTicketsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<QualityTicket[]>([]);

  const fetchTickets = useCallback(async (playlistId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (playlistId) params.append('playlistId', playlistId);

      const response = await fetch(`/api/quality-tickets?${params}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }

      const data = await response.json();
      if (data.tickets) {
        setTickets(data.tickets);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const createTicket = useCallback(
    async (ticket: TicketCreation) => {
      try {
        setError(null);
        const response = await fetch('/api/quality-tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ticket),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create ticket');
        }

        // Refetch tickets
        await fetchTickets(ticket.playlist_id);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return false;
      }
    },
    [fetchTickets]
  );

  const updateTicket = useCallback(
    async (ticketId: string, update: TicketUpdate) => {
      try {
        setError(null);
        const response = await fetch(`/api/quality-tickets/${ticketId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update ticket');
        }

        // Refetch tickets
        await fetchTickets();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return false;
      }
    },
    [fetchTickets]
  );

  const getTicketsByStatus = useCallback((status: string) => {
    return tickets.filter((t) => t.status === status);
  }, [tickets]);

  return {
    loading,
    error,
    tickets,
    fetchTickets,
    createTicket,
    updateTicket,
    getTicketsByStatus,
  };
}
