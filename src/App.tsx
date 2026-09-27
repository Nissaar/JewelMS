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

// Placeholders for other pages

const App: React.FC = () => {
  return (
    <AuthProvider>
      <PWAProvider>
        <UpdateBanner />
        <Router>
          <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/stock/*" element={
            <ProtectedRoute page="/stock">
              <Layout>
                <Stock />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/customers/*" element={
            <ProtectedRoute page="/customers">
              <Layout>
                <Customers />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/sales/*" element={
            <ProtectedRoute page="/sales">
              <Layout>
                <Sales />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/sales-history" element={
            <ProtectedRoute page="/sales-history">
              <Layout>
                <SalesHistory />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/stock/sold" element={
            <ProtectedRoute page="/stock/sold">
              <Layout>
                <SoldItems />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/orders/*" element={
            <ProtectedRoute page="/orders">
              <Layout>
                <Orders />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/odf/*" element={
            <ProtectedRoute page="/odf">
              <Layout>
                <ODF />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/reports/*" element={
            <ProtectedRoute page="/reports">
              <Layout>
                <Reports />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/reports/discounts" element={
            <ProtectedRoute page="/reports/discounts">
              <Layout>
                <DiscountReport />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/stock-reports" element={
            <ProtectedRoute requiredRole="Admin">
              <Layout>
                <StockReports />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute requiredRole="Admin">
              <Layout>
                <Settings />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/audit-logs" element={
            <ProtectedRoute requiredRole="Admin">
              <Layout>
                <AuditLogs />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      </PWAProvider>
    </AuthProvider>
  );
};

export default App;
