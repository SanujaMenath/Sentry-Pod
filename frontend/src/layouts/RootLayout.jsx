import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

const RootLayout = () => {
  
  return (
    <div className="flex h-screen bg-[#0d1117] font-sans overflow-hidden">
      <Sidebar /> 
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-auto">

          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default RootLayout;