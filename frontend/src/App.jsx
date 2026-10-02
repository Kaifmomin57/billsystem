import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages — lazy-loaded for code splitting
import { lazy, Suspense } from "react";
const LoginPage     = lazy(() => import("./pages/LoginPage"));
const Dashboard     = lazy(() => import("./pages/Dashboard"));
const CustomersPage = lazy(() => import("./pages/CustomersPage"));
const ProductsPage  = lazy(() => import("./pages/ProductsPage"));
const RatesPage     = lazy(() => import("./pages/RatesPage"));
const BillsPage     = lazy(() => import("./pages/BillsPage"));
const UploadPage    = lazy(() => import("./pages/UploadPage"));
const ReportsPage   = lazy(() => import("./pages/ReportsPage"));
const SettingsPage  = lazy(() => import("./pages/SettingsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="products"  element={<ProductsPage />} />
                <Route path="rates"     element={<RatesPage />} />
                <Route path="bills"     element={<BillsPage />} />
                <Route path="upload"    element={<UploadPage />} />
                <Route path="reports"   element={<ReportsPage />} />
                <Route path="settings"  element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#27272a",
            color: "#f4f4f5",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            fontSize: "13px",
          },
          success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
          error:   { iconTheme: { primary: "#f43f5e", secondary: "#fff" } },
        }}
      />
    </QueryClientProvider>
  );
}
