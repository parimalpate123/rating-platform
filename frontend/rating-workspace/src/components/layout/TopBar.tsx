import { useState, useEffect } from 'react';
import { Search, Moon, Sun, Zap } from 'lucide-react';

const THEME_KEY = 'rating-workspace-theme';

function getStoredTheme(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'dark';
  } catch {
    return false;
  }
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {}
}

interface TopBarProps {
  onSearch?: (q: string) => void;
}

export function TopBar({ onSearch }: TopBarProps) {
  const [dark, setDark] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    const stored = getStoredTheme();
    setDark(stored);
    applyTheme(stored);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next);
  };

  return (
    <div className="h-12 flex items-center justify-between px-4 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* Logo */}
      <div className="flex items-center gap-2 min-w-[200px]">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">InsurRateX</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); onSearch?.(e.target.value); }}
            placeholder="Search products, rules, mappings..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:bg-gray-800"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-gray-100 border border-gray-200 rounded px-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-500">⌘K</kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 min-w-[200px] justify-end">
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
          Development
        </span>
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
          P
        </div>
      </div>
    </div>
  );
}
