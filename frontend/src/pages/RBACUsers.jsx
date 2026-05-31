import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { UserPlus, Shield, Loader2 } from "lucide-react";
import AddUserModal from "../components/AddUserModal";
import { fetchSystemUsers, modifyUserRole } from "../services/adminService";
import { getUserProfile } from "../services/profileService";
import PageHeader from "../components/PageHeader";

const staticRoleMetadata = [
  { name: "Super Admin", desc: "Full system access", color: "text-purple-400" },
  {
    name: "Network Admin",
    desc: "Manage devices and configurations",
    color: "text-blue-400",
  },
  {
    name: "Security Admin",
    desc: "Manage security policies",
    color: "text-teal-400",
  },
  { name: "Auditor", desc: "View logs and reports", color: "text-yellow-400" },
  { name: "Read Only", desc: "View-only access", color: "text-gray-400" },
  {
    name: "pending",
    desc: "Awaiting Administrator Activation",
    color: "text-rose-400",
  },
];

const roleColors = {
  "Super Admin": "bg-purple-900/60 text-purple-300 border border-purple-700",
  "Network Admin": "bg-blue-900/60 text-blue-300 border border-blue-700",
  "Security Admin": "bg-teal-900/60 text-teal-300 border border-teal-700",
  "Read Only": "bg-gray-800/60 text-gray-300 border border-gray-600",
  Auditor: "bg-yellow-900/60 text-yellow-300 border border-yellow-700",
  pending: "bg-rose-900/60 text-rose-300 border border-rose-700",
};

const calculateInitials = (fullName) => {
  if (!fullName) return "U";
  return fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
};

const getAvatarColorClass = (name) => {
  const charCode = name ? name.charCodeAt(0) : 65;
  const choices = [
    "bg-blue-600",
    "bg-emerald-600",
    "bg-purple-600",
    "bg-pink-600",
    "bg-indigo-600",
  ];
  return choices[charCode % choices.length];
};

export default function RBACUsers() {
  const [showAddUser, setShowAddUser] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [systemAlert, setSystemAlert] = useState(null);
  const { search } = useOutletContext();

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setIsLoading(true);

        const [profile, users] = await Promise.all([
          getUserProfile(),
          fetchSystemUsers(),
        ]);

        setCurrentUserRole(profile.role);
        setUsersList(users);
      } catch (err) {
        setSystemAlert({ type: "error", text: err });
      } finally {
        setIsLoading(false);
      }
    };

    initializeDashboard();
  }, []);

  const handleRoleChange = async (userId, targetRole) => {
    try {
      setSystemAlert(null);
      await modifyUserRole(userId, targetRole);

      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: targetRole } : u)),
      );
      setSystemAlert({
        type: "success",
        text: "User privilege configuration updated successfully.",
      });
    } catch (err) {
      setSystemAlert({ type: "error", text: err });
    }
  };

  const isAuthorizedToEdit = currentUserRole === "Super Admin";

  const activeRolesMetric = staticRoleMetadata.map((roleItem) => ({
    ...roleItem,
    count: usersList.filter((u) => u.role === roleItem.name).length,
  }));

  if (isLoading) {
    return (
      <div className="flex-1 min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }
  const filteredUsers = usersList.filter((user) => {
    const query = search.toLowerCase();

    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
    );
  });

  const styles = {
    main: {
      background: 'linear-gradient(135deg, #F8FAFC 0%, #D1D5DB 100%)',
      backgroundAttachment: 'fixed',
      fontFamily: '"Inter", sans-serif',
      minHeight: '100%',
    },
    card: { backgroundColor: '#1D293DED', fontFamily: '"Inter", sans-serif' },
    headline: { color: '#0F172A', fontSize: '30px', fontWeight: '800', fontFamily: '"Inter", sans-serif', letterSpacing: '-0.025em' },
    subtext: { color: '#475569', fontSize: '16px', fontWeight: '500', fontFamily: '"Inter", sans-serif' }
  };

  return (
    <div className="flex-1 min-h-screen bg-[#f0f2f5] p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <PageHeader 
            title="User Management" 
            description="Manage users and role-based access control (RBAC)" 
            isSmallSubtext={true}
          />
        </div>

      {/* Operation Alert Feeds */}
      {systemAlert && (
        <div
          className={`mb-4 p-4 text-sm rounded-xl border max-w-7xl ${
            systemAlert.type === "error"
              ? "bg-red-500/10 border-red-500/30 text-red-600"
              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
          }`}
        >
          {systemAlert.text}
        </div>
      )}

      {/* Dynamic Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {activeRolesMetric.map((role) => (
          <div
            key={role.name}
            className="bg-[#1D293DED] border border-slate-700/30 rounded-2xl p-5 relative shadow-[0_5px_15px_rgba(0,0,0,0.6)]"
          >
            <div className="absolute top-3 right-3">
              <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold">
                {role.count}
              </span>
            </div>
            <Shield size={18} className={`${role.color} mb-3`} />
            <p className="text-white font-semibold text-sm mb-1">{role.name}</p>
            <p className="text-gray-400 text-xs leading-relaxed">{role.desc}</p>
          </div>
        ))}
      </div>

      {/* Users Table Grid */}
      <div className="bg-[#1D293DED] border border-slate-700/30 rounded-3xl overflow-hidden shadow-[0_5px_15px_rgba(0,0,0,0.6)]">
        <div className="p-6 border-b border-slate-800/50">
          <h2 className="text-sm font-semibold text-white">
            All Active System Registries
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800/50">
              {[
                "User",
                "Email",
                "Access Group Privileges",
                "Status",
                "Last Login",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs text-gray-400 font-medium tracking-wider uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr
                key={user.id}
                className="border-b border-[#1e2530] hover:bg-[#1e2530]/50 transition-colors"
              >
                {/* User Info Column */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full ${getAvatarColorClass(user.full_name)} flex items-center justify-center text-xs font-bold text-white`}
                    >
                      {calculateInitials(user.full_name)}
                    </div>
                    <span className="text-white text-sm font-medium">
                      {user.full_name || user.username}
                    </span>
                  </div>
                </td>

                {/* Email Column */}
                <td className="px-5 py-3.5 text-gray-400 text-sm">
                  {user.email}
                </td>

                {/* Role Column */}
                <td className="px-5 py-3.5">
                  {isAuthorizedToEdit ? (
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(user.id, e.target.value)
                      }
                      className={`px-2 py-1 rounded-md text-xs font-medium bg-slate-900 text-slate-200 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500`}
                    >
                      {staticRoleMetadata.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-medium ${roleColors[user.role] || "bg-slate-800 text-slate-300"}`}
                    >
                      {user.role}
                    </span>
                  )}
                </td>

                {/* Status Column */}
                <td className="px-5 py-3.5">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                      user.role !== "pending"
                        ? "bg-green-900/50 text-green-400 border-green-700"
                        : "bg-amber-900/50 text-amber-400 border-amber-700"
                    }`}
                  >
                    {user.role === "pending" ? "Pending Approval" : "Active"}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-400 text-xs font-mono">
                  {user.last_login
                    ? `Last login: ${new Date(user.last_login).toLocaleDateString()}`
                    : "Never logged in"}
                </td>

                {/* Actions Placeholder Column */}
                <td className="px-5 py-3.5 text-slate-400 text-xs font-mono">
                  {isAuthorizedToEdit ? "Granted" : "Restricted"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      </div>
      {showAddUser && <AddUserModal onClose={() => setShowAddUser(false)} />}
    </div>
  );
}
