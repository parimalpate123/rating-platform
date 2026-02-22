import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export function statusColor(status: string) {
  const map: Record<string, string> = {
    active: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
    draft: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30',
    inactive: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
    archived: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
    COMPLETED: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
    FAILED: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
    PROCESSING: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
    RECEIVED: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700',
    VALIDATING: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30',
  };
  return map[status] ?? 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
}
