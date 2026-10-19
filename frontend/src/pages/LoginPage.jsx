import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Receipt, Eye, EyeSlash } from "@phosphor-icons/react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { authStorage } from "../lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append("username", data.username);
      form.append("password", data.password);
      const res = await api.post("/auth/login", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      authStorage.setToken(res.data.access_token);
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md animate-slide-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mb-5 shadow-glow">
            <Receipt size={27} weight="bold" className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Welcome back</h1>
          <p className="text-base text-zinc-400 mt-2">Sign in to manage your billing with confidence.</p>
        </div>

        {/* Form */}
        <div className="card p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="input-group">
              <label className="label">Username</label>
              <input
                className={`input ${errors.username ? "border-rose-500 focus:ring-rose-500" : ""}`}
                placeholder="admin"
                {...register("username", { required: "Username is required" })}
              />
              {errors.username && (
                <p className="text-xs text-rose-400 mt-1">{errors.username.message}</p>
              )}
            </div>

            <div className="input-group">
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  className={`input pr-10 ${errors.password ? "border-rose-500 focus:ring-rose-500" : ""}`}
                  placeholder="••••••••"
                  {...register("password", { required: "Password is required" })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-10 min-w-10 text-zinc-400 hover:text-zinc-200 transition-colors rounded-lg"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-rose-400 mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-md btn-primary w-full mt-1"
            >
              {loading ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : null}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-500 mt-5">
          Secure billing management for your business
        </p>
      </div>
    </div>
  );
}
