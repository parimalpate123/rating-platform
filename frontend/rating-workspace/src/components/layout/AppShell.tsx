import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { productsApi, type ProductLine } from '../../api/products';
import { NewProductModal } from '../NewProductModal';

export function AppShell() {
  const [products, setProducts] = useState<ProductLine[]>([]);
  const [showNewProduct, setShowNewProduct] = useState(false);

  const loadProducts = async () => {
    try {
      const data = await productsApi.list();
      setProducts(data);
    } catch {
      // services may not be running — show empty state
    }
  };

  useEffect(() => { loadProducts(); }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <TopBar products={products} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar products={products} onNewProduct={() => setShowNewProduct(true)} />
        <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
          <Outlet context={{ products, reloadProducts: loadProducts, onNewProduct: () => setShowNewProduct(true) }} />
        </main>
      </div>
      {showNewProduct && (
        <NewProductModal
          onClose={() => setShowNewProduct(false)}
          onCreated={() => { loadProducts(); setShowNewProduct(false); }}
        />
      )}
    </div>
  );
}
