import { BrowserRouter, Routes, Route } from "react-router-dom";
import SentryPodLanding from "./components/SentryPodLanding";
import Login from "./pages/Login";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SentryPodLanding />} />
        <Route path="/login" element={<Login />} />
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;