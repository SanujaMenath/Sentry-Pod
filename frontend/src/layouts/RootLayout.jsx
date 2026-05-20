import { Outlet } from "react-router-dom";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

const RootLayout = () => {
  const [search, setSearch] = useState("");

  return (
    <div className="flex h-screen bg-[#0d1117] font-sans overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar search={search} setSearch={setSearch} />

        <main className="flex-1 overflow-auto">
          <Outlet context={{ search }} />
        </main>
      </div>
    </div>
  );
};

export default RootLayout;
