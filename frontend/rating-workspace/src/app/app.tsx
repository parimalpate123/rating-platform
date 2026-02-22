import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { Dashboard } from '../pages/Dashboard';
import { Products } from '../pages/Products';
import { ProductDetail } from '../pages/ProductDetail';
import { Systems } from '../pages/Systems';
import { Transactions } from '../pages/Transactions';
import { Insights } from '../pages/Insights';
import { TestRating } from '../pages/TestRating';
import { LookupTables } from '../pages/LookupTables';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:code" element={<ProductDetail />} />
        <Route path="/products/:code/:tab" element={<ProductDetail />} />
        <Route path="/systems" element={<Systems />} />
        <Route path="/rules" element={<div className="p-6"><h1 className="text-xl font-semibold">Rules Engine</h1><p className="text-gray-500 mt-1">Select a product line from the sidebar to view its rules.</p></div>} />
        <Route path="/mappings" element={<div className="p-6"><h1 className="text-xl font-semibold">Mappings</h1><p className="text-gray-500 mt-1">Select a product line from the sidebar to view its mappings.</p></div>} />
        <Route path="/decision-tables" element={<LookupTables />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/test" element={<TestRating />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
