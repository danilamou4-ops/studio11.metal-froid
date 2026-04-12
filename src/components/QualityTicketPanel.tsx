'use client';

// CONVENTION PROJET : icons over emojis — utiliser lucide-react systématiquement

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useQualityTickets } from '@/features/quality-tickets/useQualityTickets';
import type { TicketCreation, TicketStatus, TicketPriority } from '@/features/quality-tickets/types';
import { ViewState } from '@/components/ui/view-state';

interface QualityTicketButtonProps {
  playlistId: string;
  onSuccess?: () => void;
}

export function ReportQualityIssueButton({ playlistId, onSuccess }: QualityTicketButtonProps) {
  const { createTicket } = useQualityTickets();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState('incorrect_content');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('La description est requise');
      return;
    }

    setIsSubmitting(true);
    try {
      const ticket: TicketCreation = {
        playlist_id: playlistId,
        category,
        description,
      };

      const success = await createTicket(ticket);
      if (success) {
        setIsOpen(false);
        setDescription('');
        setCategory('incorrect_content');
        setError(null);
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
      >
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <span>Signaler un problème</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Signaler un problème de qualité</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Catégorie
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="incorrect_content">Contenu incorrect</option>
            <option value="spam">Spam</option>
            <option value="inappropriate">Contenu inapproprié</option>
            <option value="copyright">Violation de droits d&apos;auteur</option>
            <option value="other">Autre</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez le problème en détail..."
            className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={3}
          />
        </div>

        {error && (
          <ViewState
            variant="error"
            title="Signalement impossible"
            description={error}
          />
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex-1 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Envoi..." : "Soumettre le rapport"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface TicketListProps {
  playlistId?: string;
}

export function QualityTicketList({ playlistId }: TicketListProps) {
  const { tickets, loading, error } = useQualityTickets();

  // Filter by playlist if provided
  const displayTickets = playlistId ? tickets.filter((t) => t.playlist_id === playlistId) : tickets;

  if (loading) {
    return (
      <ViewState
        variant="loading"
        title="Chargement des signalements"
        description="Récupération des rapports qualité en cours..."
      />
    );
  }

  if (error) {
    return (
      <ViewState
        variant="error"
        title="Erreur de chargement"
        description={error}
      />
    );
  }

  if (displayTickets.length === 0) {
    return (
      <ViewState
        variant="empty"
        title="Aucun rapport qualité"
        description="Aucun signalement n'est disponible pour le moment."
      />
    );
  }

  const priorityColors: Record<TicketPriority, string> = {
    low: 'bg-blue-50 text-blue-700',
    normal: 'bg-gray-50 text-gray-700',
    high: 'bg-orange-50 text-orange-700',
    critical: 'bg-red-50 text-red-700',
  };

  const statusLabels: Record<TicketStatus, string> = {
    open: 'Ouvert',
    in_review: 'En examen',
    escalated: 'Escaladé',
    resolved: 'Résolu',
    closed: 'Fermé',
  };

  return (
    <div className="space-y-2">
      {displayTickets.map((ticket) => (
        <div key={ticket.id} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-foreground">{ticket.category}</h4>
              <p className="text-xs text-muted-foreground">{ticket.description}</p>
            </div>
            <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${priorityColors[ticket.priority]}`}>
              {ticket.priority}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{statusLabels[ticket.status]}</span>
            <span>{new Date(ticket.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
