import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, GitBranch, Map, BookOpen,
  Database, Server, Activity, ChevronRight, ChevronDown,
  Plus, Layers, Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ProductLine } from '../../api/products';

interface SidebarProps {
  products: ProductLine[];
  onNewProduct: () => void;
}

const iconNav = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: Server, label: 'Systems', path: '/systems' },
  { icon: GitBranch, label: 'Rules', path: '/rules' },
  { icon: Map, label: 'Mappings', path: '/mappings' },
  { icon: Activity, label: 'Transactions', path: '/transactions' },
  { icon: Zap, label: 'Test Rating', path: '/test' },
];

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{title}</p>
      {children}
    </div>
  );
}

function NavItem({ label, path, icon: Icon, indent = false }: { label: string; path: string; icon?: any; indent?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === path;

  return (
    <button
      onClick={() => navigate(path)}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors text-left',
        indent && 'pl-6',
        active
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
  );
}

function ProductNavItem({ product }: { product: ProductLine }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(location.pathname.startsWith(`/products/${product.code}`));
  const active = location.pathname.startsWith(`/products/${product.code}`);

  return (
    <div>
      <button
        onClick={() => { setOpen(!open); navigate(`/products/${product.code}`); }}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
          active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{product.name}</span>
        </div>
        {open ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
      </button>
      {open && (
        <div className="ml-2 border-l border-gray-200 pl-2 mt-0.5 space-y-0.5">
          <NavItem label="Orchestrator" path={`/products/${product.code}/orchestrator`} indent />
          <NavItem label="Mappings" path={`/products/${product.code}/mappings`} indent />
          <NavItem label="Rules" path={`/products/${product.code}/rules`} indent />
          <NavItem label="Scopes" path={`/products/${product.code}/scopes`} indent />
        </div>
      )}
    </div>
  );
}

export function Sidebar({ products, onNewProduct }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex h-full">
      {/* Icon strip */}
      <div className="w-12 flex flex-col items-center py-3 gap-1 border-r border-gray-200 bg-gray-50">
        {iconNav.map(({ icon: Icon, label, path }) => {
          const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
          return (
            <button
              key={path}
              title={label}
              onClick={() => navigate(path)}
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
                active ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-200 hover:text-gray-700',
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Text panel */}
      <div className="w-52 flex flex-col h-full overflow-hidden border-r border-gray-200 bg-white">
        {/* Header */}
        <div className="px-3 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Navigator</span>
            <button
              onClick={() => navigate('/')}
              className="text-[10px] text-blue-600 hover:underline"
            >
              Home
            </button>
          </div>
        </div>

        {/* Nav content */}
        <div className="flex-1 overflow-y-auto py-3 px-1 space-y-1">
          <NavItem label="Dashboard" path="/" icon={LayoutDashboard} />

          <div className="pt-2">
            <NavSection title="Product Lines">
              {products.map((p) => (
                <ProductNavItem key={p.code} product={p} />
              ))}
              <button
                onClick={onNewProduct}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Product</span>
              </button>
            </NavSection>

            <NavSection title="Configuration">
              <NavItem label="Systems" path="/systems" icon={Server} />
              <NavItem label="Mappings" path="/mappings" icon={Map} />
              <NavItem label="Rules" path="/rules" icon={BookOpen} />
              <NavItem label="Decision Tables" path="/decision-tables" icon={Database} />
            </NavSection>

            <NavSection title="Monitoring">
              <NavItem label="Transactions" path="/transactions" icon={Activity} />
              <NavItem label="Test Rating" path="/test" icon={Zap} />
            </NavSection>
          </div>
        </div>
      </div>
    </div>
  );
}
