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
import { Network } from "lucide-react";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />

        <Route element={<RootLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ai-chat" element={<AiChat />} />
          <Route path="/topology" element={<TopologyMap />} />
          <Route path="/network-devices" element={<NetworkDevices />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/users" element={<RBACUsers />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;