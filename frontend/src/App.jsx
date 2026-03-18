import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/Home"; 
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard"; 


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 3. Use the renamed component name here */}
        <Route path="/" element={<HomePage />} />
        
        <Route path="/login" element={<Login />} />
        
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;