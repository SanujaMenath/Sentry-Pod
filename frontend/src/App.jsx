import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/Home"; 
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard"; 

import AuditLogs from "./pages/AuditLogs";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />  
        <Route path="/login" element={<Login />} />
        
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/audit-logs" element={<AuditLogs />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;