import { BrowserRouter, Routes, Route } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import ErrorBoundary from "./components/ErrorBoundary";

import HomePage from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AuditLogs from "./pages/AuditLogs";
import RBACUsers from "./pages/RBACUsers";
import SettingsPage from "./pages/Settings";
import TopologyMap from "./pages/TopologyMap";
import NetworkDevices from "./pages/NetworkDevices";
import AiChat from "./pages/AiChat";
import StagingGate from "./pages/StagingGate";
import Profile from "./pages/Profile";
import ProtectedRoute from "./routes/ProtectedRoute";
import PublicRoute from "./routes/PublicRoute";
import RoleProtectedRoute from "./routes/RoleProtectedRoute";
import PlaybookManagement from "./pages/PlaybookManagement";
import DriftReports from "./pages/DriftReports";
import DriftReportDetail from "./pages/DriftReportDetail";
import Console from "./pages/Console";
import SetupWizard from "./pages/SetupWizard";

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <SetupWizard />
              </ProtectedRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <RootLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/topology" element={<TopologyMap />} />
            <Route path="/ai-chat" element={<AiChat />} />
            <Route path="/staging" element={<StagingGate />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/drift-reports" element={<DriftReports />} />
            <Route path="/drift-reports/:hostname" element={<DriftReportDetail />} />

            <Route path="/console" element={
              <RoleProtectedRoute>
                <Console />
              </RoleProtectedRoute>
            } />
            <Route path="/network-devices" element={
              <RoleProtectedRoute>
                <NetworkDevices />
              </RoleProtectedRoute>
            } />

            <Route path="/audit-logs" element={
              <RoleProtectedRoute>
                <AuditLogs />
              </RoleProtectedRoute>
            } />

            <Route path="/users" element={
              <RoleProtectedRoute>
                <RBACUsers />
              </RoleProtectedRoute>
            } />

            <Route path="/playbooks" element={
              <RoleProtectedRoute>
                <PlaybookManagement />
              </RoleProtectedRoute>
            } />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;