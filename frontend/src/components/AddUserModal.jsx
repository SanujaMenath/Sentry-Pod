import { useState } from "react";
import { X, User, Mail, Lock, Shield, Loader2 } from "lucide-react";
import { createUser } from "../services/userService";

export default function AddUserModal({ onClose, onUserAdded }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    username: "",
    password: "",
    role: "",
  });

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validate = () => {
    const newErrors = {};

    if (!form.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!form.email.includes("@")) newErrors.email = "Invalid email";
    if (!form.username.trim()) newErrors.username = "Username required";
    if (form.password.length < 8)
      newErrors.password = "Min 8 characters required";
    if (!form.role) newErrors.role = "Select a role";

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setApiError("");

    try {
      await createUser({
        full_name: form.fullName,
        email: form.email,
        username: form.username,
        password: form.password,
        role: form.role,
      });

      onUserAdded?.();
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.detail?.[0]?.msg ||
        "Failed to create user";
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "w-full bg-[#0d1117] border border-[#1e2530] rounded-lg pl-9 pr-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 m-auto bg-[#161b22] border border-[#1e2530] rounded-2xl w-[420px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1e2530]">
          <h2 className="text-white font-semibold text-base">
            Add New User
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Full Name */}
          <div>
            <label className="text-xs text-gray-400">Full Name</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                className={inputClass}
                placeholder="John Doe"
              />
            </div>
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="text-xs text-gray-400">Email</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                className={inputClass}
                placeholder="john@sentrypod.io"
              />
            </div>
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Username */}
          <div>
            <label className="text-xs text-gray-400">Username</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                className={inputClass}
                placeholder="jdoe"
              />
            </div>
            {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="text-xs text-gray-400">Password</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="text-xs text-gray-400">Role</label>
            <div className="relative mt-1">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">Select role</option>
                <option>Super Admin</option>
                <option>Network Admin</option>
                <option>Security Admin</option>
                <option>Auditor</option>
                <option>Read Only</option>
              </select>
            </div>
            {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
          </div>

          {/* API Error */}
          {apiError && (
            <div className="text-red-500 text-xs bg-red-500/10 p-2 rounded">
              {apiError}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 bg-[#0d1117] border border-[#1e2530] text-gray-400 rounded-lg"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              Save User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}