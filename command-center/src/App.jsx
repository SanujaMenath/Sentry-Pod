import { BrowserRouter, Routes, Route } from "react-router-dom";
import SentryPodLanding from "./components/SentryPodLanding";
import Login from "./pages/Login";
import AuditLogs from "./pages/AuditLogs";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SentryPodLanding />} />
        <Route path="/login" element={<Login />} />
        <Route path="/audit-logs" element={<AuditLogs />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;