import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import OrdersList from './pages/orders/OrdersList';
import CatalogList from './pages/catalog/CatalogList';
import InventoryList from './pages/inventory/InventoryList';
import ProductionList from './pages/production/ProductionList';
import ProductionPlanning from './pages/production/ProductionPlanning';
import TechCardsList from './pages/production/TechCardsList';
import RecipeEditor from './pages/production/RecipeEditor';
import ProductionCalculator from './pages/production/ProductionCalculator';
import LogisticsCalendar from './pages/logistics/LogisticsCalendar';
import { ContractorsList } from './pages/crm/ContractorsList';
import ContractorsPage from './pages/contractors/ContractorsPage';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import UsersPage from './pages/users/UsersPage';
import SettingsPage from './pages/settings/SettingsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

function App() {
  return (
    <LanguageProvider>
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
              <Route path="/production/planning" element={<ProductionPlanning />} />
              <Route path="/logistics" element={<LogisticsCalendar />} />
              <Route path="/calculator" element={<ProductionCalculator />} />
              <Route path="/production/recipes" element={<TechCardsList />} />
              <Route path="/production/recipes/new" element={<RecipeEditor />} />
              <Route path="/production/recipes/:id" element={<RecipeEditor />} />
              <Route path="/crm/contractors" element={<ContractorsList />} />
              <Route path="/contractors" element={<ContractorsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
