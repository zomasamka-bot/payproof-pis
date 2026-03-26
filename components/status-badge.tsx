import { cn } from '@/lib/utils';
import type { TransactionRecord } from '@/lib/transaction-storage';

const statusConfig: Record<
  TransactionRecord['status'],
  { label: string; className: string; dot: string }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
    dot: 'bg-yellow-500',
  },
  completed: {
    label: 'Completed',
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  verified: {
    label: 'Verified',
    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
    dot: 'bg-green-500',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    dot: 'bg-red-500',
  },
};

interface StatusBadgeProps {
  status: TransactionRecord['status'];
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}
