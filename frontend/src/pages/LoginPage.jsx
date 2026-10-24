import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Storefront, Eye, EyeSlash, WarningCircle } from "@phosphor-icons/react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { authStorage } from "../lib/auth";
import { Button } from "../components/ui/Button";

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    setFormError("");
    try {
      const form = new FormData();
      form.append("username", data.username.trim());
      form.append("password", data.password);
      const res = await api.post("/auth/login", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      authStorage.setToken(res.data.access_token);
      toast.success("Signed in successfully");
      navigate("/");
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid username or password. Please try again.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#047857] flex items-center justify-center mb-4 shadow-lg shadow-emerald-950/50">
            <Storefront size={32} weight="bold" className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Sign in to BillTrack</h1>
          <p className="text-base text-zinc-300 mt-1">Dependable billing and ledger management</p>
        </div>

        {/* Card */}
        <div className="card p-6 sm:p-8 bg-zinc-900 border border-zinc-700">
          {formError && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3"
            >
              <WarningCircle size={20} weight="bold" className="shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Sign in failed</p>
                <p className="mt-0.5">{formError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
            <div>
              <label htmlFor="login-username" className="block text-sm font-semibold text-zinc-200 mb-2">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                className={`w-full min-h-[48px] bg-zinc-900 border rounded-lg px-4 py-2.5 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-300 focus-visible:outline-2 focus-visible:outline-[#6EE7B7] focus-visible:outline-offset-2 transition-colors ${
                  errors.username ? "border-rose-500" : "border-[#71717A]"
                }`}
                placeholder="Enter your username"
                {...register("username", { required: "Please enter your username" })}
              />
              {errors.username && (
                <p className="text-sm text-rose-400 mt-1.5 flex items-center gap-1.5 font-medium">
                  <WarningCircle size={16} weight="bold" />
                  <span>{errors.username.message}</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-semibold text-zinc-200 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  className={`w-full min-h-[48px] bg-zinc-900 border rounded-lg pl-4 pr-12 py-2.5 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-300 focus-visible:outline-2 focus-visible:outline-[#6EE7B7] focus-visible:outline-offset-2 transition-colors ${
                    errors.password ? "border-rose-500" : "border-[#71717A]"
                  }`}
                  placeholder="Enter your password"
                  {...register("password", { required: "Please enter your password" })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white rounded-lg transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-[#6EE7B7]"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  title={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeSlash size={20} weight="bold" /> : <Eye size={20} weight="bold" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-rose-400 mt-1.5 flex items-center gap-1.5 font-medium">
                  <WarningCircle size={16} weight="bold" />
                  <span>{errors.password.message}</span>
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="submit"
              variant="primary"
              isLoading={loading}
              loadingText="Signing in…"
              className="w-full mt-2"
            >
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-400 mt-6">
          Paste supported • Secure session authentication
        </p>
      </div>
    </div>
  );
}
