'use client';

import { useState } from 'react';
import type { ContributionStatus } from '@/features/contribution-workflow/types';

interface StatusBadgeProps {
  status: ContributionStatus;
  size?: 'sm' | 'md' | 'lg';
}

const statusColors: Record<ContributionStatus, { bg: string; text: string; pill: string }> = {
  draft: { bg: 'bg-secondary/80', text: 'text-foreground', pill: 'border-border' },
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', pill: 'border-emerald-500/30' },
  rejected: { bg: 'bg-destructive/10', text: 'text-destructive', pill: 'border-destructive/30' },
  archived: { bg: 'bg-muted/80', text: 'text-muted-foreground', pill: 'border-border' },
};

const statusLabels: Record<ContributionStatus, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  rejected: 'Rejeté',
  archived: 'Archivé',
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const colors = statusColors[status];
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border ${colors.pill} ${colors.bg} ${colors.text} font-medium ${sizeClasses[size]}`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${colors.text} mr-2`} />
      {statusLabels[status]}
    </span>
  );
}

interface StatusTransitionProps {
  currentStatus: ContributionStatus;
  onTransition: (newStatus: ContributionStatus) => Promise<void>;
  disabled?: boolean;
  isAdmin: boolean;
}

export function StatusTransition({ currentStatus, onTransition, disabled = false, isAdmin }: StatusTransitionProps) {
  const [isLoading, setIsLoading] = useState(false);

  const getAvailableTransitions = (status: ContributionStatus): ContributionStatus[] => {
    const transitions: Record<ContributionStatus, ContributionStatus[]> = {
      draft: isAdmin ? ['active', 'rejected'] : [],
      active: isAdmin ? ['archived', 'rejected'] : [],
      rejected: isAdmin ? ['draft', 'archived'] : [],
      archived: isAdmin ? ['active'] : [],
    };
    return transitions[status] || [];
  };

  const availableTransitions = getAvailableTransitions(currentStatus);

  if (!isAdmin || availableTransitions.length === 0) {
    return null;
  }

  const handleTransition = async (newStatus: ContributionStatus) => {
    setIsLoading(true);
    try {
      await onTransition(newStatus);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {availableTransitions.map((status) => (
        <button
          key={status}
          onClick={() => handleTransition(status)}
          disabled={isLoading || disabled}
          className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '...' : `Marquer comme ${statusLabels[status].toLowerCase()}`}
        </button>
      ))}
    </div>
  );
}
