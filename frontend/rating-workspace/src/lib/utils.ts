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
    active: 'text-green-600 bg-green-50',
    draft: 'text-yellow-600 bg-yellow-50',
    inactive: 'text-gray-500 bg-gray-100',
    archived: 'text-red-500 bg-red-50',
    COMPLETED: 'text-green-600 bg-green-50',
    FAILED: 'text-red-600 bg-red-50',
    PROCESSING: 'text-blue-600 bg-blue-50',
    RECEIVED: 'text-gray-600 bg-gray-100',
    VALIDATING: 'text-yellow-600 bg-yellow-50',
  };
  return map[status] ?? 'text-gray-600 bg-gray-100';
}
