import React, { useEffect, useState } from "react";
import {
  Cable,
  Pencil,
  KeyRound,
  PlusCircle,
  Router,
  Save,
  Server,
  Settings2,
  Shield,
  Terminal,
  X,
} from "lucide-react";
import AddDeviceModal from "../components/AddDeviceModal";
import { addNetworkDevice, fetchNetworkDevices } from "../services/networkService";
import PageHeader from "../components/PageHeader";
import DeviceCard, { normalizeDevice } from "../components/DeviceCard";
import TerminalDeviceModal from "../components/TerminalDeviceModal";
import EditDeviceModal from "../components/EditDeviceModal";
import UsageBar from "../components/UsageBar";
import Cursor from "../components/Cursor";
import ConfigSection from "../components/ConfigSection";
import ConfigField from "../components/ConfigField";

export default function NetworkDevices() {
  const [devices, setDevices] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [terminalDevice, setTerminalDevice] = useState(null);
  const [editDevice, setEditDevice] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchNetworkDevices()
      .then((items) => setDevices(items.map(normalizeDevice)))
      .catch((err) => setError(err.response?.data?.detail || "Unable to load network devices."));
  }, []);

  const addDevice = async (device) => {
    const created = await addNetworkDevice(device);
    setDevices((current) => [normalizeDevice(created), ...current]);
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-[#F8FAFC] to-[#D1D5DB] p-8 font-sans">
      <div className="mb-8 flex items-start justify-between">
        <PageHeader 
          title="Network Devices" 
          description="Monitor and manage all network devices" 
          isSmallSubtext={true}
        />

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
        >
          <PlusCircle size={18} />
          Add Device
        </button>
      </div>

      {error && <p className="mb-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-600">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
        {devices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            onConfigure={setTerminalDevice}
            onEdit={setEditDevice}
          />
        ))}
      </div>

      {showAddModal && (
        <AddDeviceModal
          onClose={() => setShowAddModal(false)}
          onSave={addDevice}
        />
      )}

      {terminalDevice && (
        <TerminalDeviceModal
          device={terminalDevice}
          onClose={() => setTerminalDevice(null)}
        />
      )}

      {editDevice && (
        <EditDeviceModal
          device={editDevice}
          onClose={() => setEditDevice(null)}
        />
      )}
    </div>
  );
}


