import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import OrdersList from './pages/orders/OrdersList';
import CatalogList from './pages/catalog/CatalogList';
import InventoryList from './pages/inventory/InventoryList';
import ProductionList from './pages/production/ProductionList';
import TechCardsList from './pages/production/TechCardsList';
import RecipeEditor from './pages/production/RecipeEditor';
import ProductionCalculator from './pages/production/ProductionCalculator';
import { ContractorsList } from './pages/crm/ContractorsList';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import SettingsPage from './pages/settings/SettingsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<InventoryList />} />
              <Route path="/orders" element={<OrdersList />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/catalog" element={<CatalogList />} />
              <Route path="/inventory" element={<InventoryList />} />
              <Route path="/production" element={<ProductionList />} />
              <Route path="/calculator" element={<ProductionCalculator />} />
              <Route path="/production/recipes" element={<TechCardsList />} />
              <Route path="/production/recipes/new" element={<RecipeEditor />} />
              <Route path="/production/recipes/:id" element={<RecipeEditor />} />
              <Route path="/contractors" element={<ContractorsList />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
