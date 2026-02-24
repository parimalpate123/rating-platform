import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Moon, Sun, Zap, X, LayoutDashboard, Package, Server, GitBranch, Map, BarChart3, Activity, HelpCircle, Layers } from 'lucide-react';
import type { ProductLine } from '../../api/products';

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

function AboutDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero header */}
        <div className="relative bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 px-8 pt-10 pb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 ring-4 ring-white/10">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">InsurRateX</h2>
          <p className="text-purple-100 text-sm mt-1.5 font-medium leading-snug">
            The Rating Domain Interoperability Layer —<br />One Bridge for Every Rating Engine
          </p>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-5">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            InsurRateX enables seamless integration between policy administration systems and rating engines across the insurance ecosystem. By abstracting rating logic into a unified domain layer, it eliminates point-to-point integrations and accelerates product deployment. Connect once, integrate everywhere, and scale without friction.
          </p>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg py-3 px-2">
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">10+</p>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-0.5">Services</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg py-3 px-2">
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">Multi</p>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-0.5">Engines</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg py-3 px-2">
              <p className="text-lg font-bold text-purple-600 dark:text-purple-400">Any</p>
              <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-0.5">Format</p>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex items-center justify-between">
            <div className="text-xs text-gray-400 dark:text-gray-500">
              <p>v1.0.0</p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const GLOBAL_NAV: { label: string; path: string; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Products', path: '/products', icon: Package },
  { label: 'Systems', path: '/systems', icon: Server },
  { label: 'Rules', path: '/rules', icon: GitBranch },
  { label: 'Mappings', path: '/mappings', icon: Map },
  { label: 'Insights', path: '/insights', icon: BarChart3 },
  { label: 'Transactions', path: '/transactions', icon: Activity },
  { label: 'Test Rating', path: '/test', icon: Zap },
  { label: 'Getting Started', path: '/guide', icon: HelpCircle },
];

interface TopBarProps {
  products?: ProductLine[];
}

export function TopBar({ products = [] }: TopBarProps) {
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [q, setQ] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) {
      return [
        ...GLOBAL_NAV,
        ...products.map((p) => ({ label: `${p.name} (${p.code})`, path: `/products/${p.code}`, icon: Layers as typeof LayoutDashboard })),
      ];
    }
    const navMatches = GLOBAL_NAV.filter((n) => n.label.toLowerCase().includes(term));
    const productMatches = products.filter(
      (p) => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term),
    );
    return [
      ...navMatches,
      ...productMatches.map((p) => ({ label: `${p.name} (${p.code})`, path: `/products/${p.code}`, icon: Layers as typeof LayoutDashboard })),
    ];
  }, [q, products]);

  const showDropdown = searchOpen && searchResults.length > 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, [q]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!showDropdown) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % searchResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = searchResults[selectedIndex];
        if (item) {
          navigate(item.path);
          setQ('');
          setSearchOpen(false);
          inputRef.current?.blur();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showDropdown, searchResults, selectedIndex, navigate]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current?.contains(e.target as Node) || inputRef.current?.contains(e.target as Node)) return;
      setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const goTo = (path: string) => {
    navigate(path);
    setQ('');
    setSearchOpen(false);
    inputRef.current?.blur();
  };

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
    <div className="h-12 flex items-center justify-between px-4 border-b border-purple-100 bg-purple-50/60 dark:border-gray-700 dark:bg-gray-900">
      {/* Logo */}
      <button
        onClick={() => setShowAbout(true)}
        className="flex items-center gap-2 min-w-[200px] hover:opacity-80 transition-opacity"
        title="About InsurRateX"
      >
        <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">InsurRateX</span>
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md mx-4 relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search products, rules, mappings..."
            className="w-full pl-8 pr-12 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:bg-gray-800"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 bg-gray-100 border border-gray-200 rounded px-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-500">⌘K</kbd>
        </div>
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
            {searchResults.map((item, i) => (
              <button
                key={`${item.path}-${i}-${item.label}`}
                type="button"
                onClick={() => goTo(item.path)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                  i === selectedIndex
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        )}
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
        <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-semibold">
          P
        </div>
      </div>

      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </div>
  );
}
