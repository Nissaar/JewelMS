import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PWAProvider } from './context/PWAContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UpdateBanner } from './components/UpdateBanner';
import { Layout } from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Stock from './pages/Stock';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import DiscountReport from './pages/DiscountReport';
import SalesHistory from './pages/SalesHistory';
import SoldItems from './pages/SoldItems';
import AuditLogs from './pages/AuditLogs';
import ODF from './pages/ODF';
import Orders from './pages/Orders';
import StockReports from './pages/StockReports';
import Customers from './pages/Customers';

/** Guarded page: `page` names its PAGE_ACCESS entry, `admin` requires the Admin role. */
const guard = (element: React.ReactNode, opts: { page?: string; admin?: boolean } = {}) => (
  <ProtectedRoute page={opts.page} requiredRole={opts.admin ? 'Admin' : undefined}>{element}</ProtectedRoute>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <PWAProvider>
        <UpdateBanner />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* One shell for every signed-in page, so it isn't rebuilt on navigation. */}
            <Route element={guard(<Layout />)}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/stock/sold" element={guard(<SoldItems />, { page: '/stock/sold' })} />
              <Route path="/stock/*" element={guard(<Stock />, { page: '/stock' })} />
              <Route path="/customers/*" element={guard(<Customers />, { page: '/customers' })} />
              <Route path="/sales/*" element={guard(<Sales />, { page: '/sales' })} />
              <Route path="/sales-history" element={guard(<SalesHistory />, { page: '/sales-history' })} />
              <Route path="/orders/*" element={guard(<Orders />, { page: '/orders' })} />
              <Route path="/odf/*" element={guard(<ODF />, { page: '/odf' })} />
              <Route path="/reports/discounts" element={guard(<DiscountReport />, { page: '/reports/discounts' })} />
              <Route path="/reports/*" element={guard(<Reports />, { page: '/reports' })} />
              <Route path="/stock-reports" element={guard(<StockReports />, { admin: true })} />
              <Route path="/settings" element={guard(<Settings />, { admin: true })} />
              <Route path="/audit-logs" element={guard(<AuditLogs />, { admin: true })} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </PWAProvider>
    </AuthProvider>
  );
};

export default App;
