import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import SentryPodLanding from "./components/SentryPodLanding";
import Login from "./pages/Login";
import AuditLogs from "./pages/AuditLogs";
import RBACUsers from "./pages/RBACUsers";
import SettingsPage from "./pages/Settings";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

function Layout({ children }) {
  const [activePage, setActivePage] = useState('audit');
  return (
    <div className="flex h-screen bg-[#0d1117] font-sans overflow-hidden">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SentryPodLanding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/audit-logs" element={<Layout><AuditLogs /></Layout>} />
        <Route path="/users" element={<Layout><RBACUsers /></Layout>} />
        <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
