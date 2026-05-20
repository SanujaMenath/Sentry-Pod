import { BrowserRouter, Routes, Route } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";

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
import { Network } from "lucide-react";
import ProtectedRoute from "./routes/ProtectedRoute";
import PublicRoute from "./routes/PublicRoute";


function App() {
  return (
    <BrowserRouter>
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
          <Route path="/network-devices" element={<NetworkDevices />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/users" element={<RBACUsers />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<SettingsPage />} />
          
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
