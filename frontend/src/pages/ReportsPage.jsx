import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download, Calendar, Users, Package,
  FileSpreadsheet, Search, CheckCircle2, Clock,
  AlertCircle, ArrowUpRight, Percent, RefreshCw
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatCurrency, downloadBlob } from "../lib/utils";

export default function ReportsPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo]     = useState(todayStr);
  const [activeTab, setActiveTab] = useState("customers"); // "customers" | "products"
  const [searchTerm, setSearchTerm] = useState("");
  const [downloading, setDownloading] = useState(null);

  // Quick preset filter buttons
  const applyPreset = (preset) => {
    const today = new Date();
    if (preset === "today") {
      const s = today.toISOString().slice(0, 10);
      setDateFrom(s);
      setDateTo(s);
    } else if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const s = y.toISOString().slice(0, 10);
      setDateFrom(s);
      setDateTo(s);
    } else if (preset === "7days") {
      const past = new Date(today);
      past.setDate(past.getDate() - 6);
      setDateFrom(past.toISOString().slice(0, 10));
      setDateTo(today.toISOString().slice(0, 10));
    } else if (preset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(firstDay.toISOString().slice(0, 10));
      setDateTo(today.toISOString().slice(0, 10));
    }
  };

  // Fetch summary report data for current date range
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ["reports-summary", dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get("/reports/summary", {
        params: { date_from: dateFrom, date_to: dateTo },
      });
      return res.data;
    },
  });

  const totals = reportData?.totals || {
    total_sales: 0,
    total_received: 0,
    total_pending: 0,
    collection_rate: 0,
    total_bills: 0,
    total_customers: 0,
  };

  const customers = reportData?.customers || [];
  const products = reportData?.products || [];

  const filteredCustomers = customers.filter((c) =>
    (c.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || "").includes(searchTerm)
  );

  const filteredProducts = products.filter((p) =>
    (p.product_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadReport = async (type) => {
    setDownloading(type);
    try {
      toast.loading(`Generating ${type === "by-customer" ? "Customer" : "Product"} Excel report...`, { id: "report-toast" });
      const res = await api.get(`/reports/daily/${type}`, {
        params: { date_from: dateFrom, date_to: dateTo },
        responseType: "blob",
      });
      const label = dateFrom === dateTo ? dateFrom : `${dateFrom}_to_${dateTo}`;
      const filename = `daily_${type}_${label}.xlsx`;
      downloadBlob(res.data, filename);
      toast.success(`${filename} downloaded!`, { id: "report-toast" });
    } catch {
      toast.error("Failed to generate Excel report", { id: "report-toast" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2.5">
              <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
              Daily Financial Reports
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Audit
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Exact breakdown of Total Sales, Received Amount, and Pending Balances by customer and product
          </p>
        </div>

        {/* Excel Export Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => downloadReport("by-customer")}
            disabled={!!downloading}
            className="btn-primary text-xs flex items-center gap-2 py-2 px-3.5 shadow-lg shadow-emerald-950/40"
          >
            {downloading === "by-customer" ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download Customer Report (.xlsx)
          </button>

          <button
            onClick={() => downloadReport("by-product")}
            disabled={!!downloading}
            className="btn-secondary text-xs flex items-center gap-2 py-2 px-3.5"
          >
            {downloading === "by-product" ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4 text-emerald-400" />
            )}
            Download Product Report (.xlsx)
          </button>
        </div>
      </div>

      {/* Date Filter Bar & Quick Presets */}
      <div className="card p-4 sm:p-5 bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 border-zinc-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            Period:
          </span>
          <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
            <span className="text-xs text-zinc-500">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-xs text-emerald-400 font-semibold focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
            <span className="text-xs text-zinc-500">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-xs text-emerald-400 font-semibold focus:outline-none"
            />
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => applyPreset("today")}
            className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyPreset("yesterday")}
            className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300"
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => applyPreset("7days")}
            className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300"
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => applyPreset("month")}
            className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards: Total Sale, Received, Pending, Collection Rate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="card p-4 sm:p-5 border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 via-zinc-900 to-zinc-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Total Sales
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2 tracking-tight">
            {formatCurrency(totals.total_sales)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            {totals.total_bills} bills across {totals.total_customers} customers
          </p>
        </div>

        {/* Received */}
        <div className="card p-4 sm:p-5 border-blue-500/20 bg-gradient-to-br from-blue-950/20 via-zinc-900 to-zinc-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Received Amount
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-400 mt-2 tracking-tight">
            {formatCurrency(totals.total_received)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            Actual collection deposited
          </p>
        </div>

        {/* Pending */}
        <div className="card p-4 sm:p-5 border-rose-500/20 bg-gradient-to-br from-rose-950/20 via-zinc-900 to-zinc-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Pending Balance
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-2 tracking-tight">
            {formatCurrency(totals.total_pending)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            Outstanding balance to recover
          </p>
        </div>

        {/* Collection % */}
        <div className="card p-4 sm:p-5 border-purple-500/20 bg-gradient-to-br from-purple-950/20 via-zinc-900 to-zinc-950">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Collection Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-purple-400 mt-2 tracking-tight">
            {totals.collection_rate}%
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            Received ÷ Total Sales
          </p>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="card p-5 bg-zinc-900/90 border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("customers")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === "customers"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-zinc-800/80 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Users className="w-4 h-4" />
              Customer Breakdown ({customers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === "products"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-zinc-800/80 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Package className="w-4 h-4" />
              Product Breakdown ({products.length})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab === "customers" ? "customer or phone" : "product"}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
            />
          </div>
        </div>

        {/* Tab 1: Customer Table */}
        {activeTab === "customers" && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3 text-center">Bills</th>
                  <th className="py-2.5 px-3 text-right">Total Sale (₹)</th>
                  <th className="py-2.5 px-3 text-right">Received (₹)</th>
                  <th className="py-2.5 px-3 text-right">Pending (₹)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-500">
                      No customer bills found for this period.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((c, i) => (
                    <tr key={c.customer_id || i} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-center text-zinc-500 font-mono">{i + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-zinc-200">{c.customer_name}</td>
                      <td className="py-2.5 px-3 text-zinc-400 font-mono">{c.phone || "—"}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-zinc-300">{c.bills_count}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(c.total_sale)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-400">
                        {formatCurrency(c.amount_paid)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">
                        {formatCurrency(c.balance_due)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            c.payment_status === "paid"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : c.payment_status === "partial"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {c.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredCustomers.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-zinc-700 bg-zinc-950 font-bold text-zinc-100">
                    <td colSpan={4} className="py-3 px-3 text-right uppercase tracking-wider text-xs">
                      Grand Total:
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400 text-sm">
                      {formatCurrency(totals.total_sales)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-blue-400 text-sm">
                      {formatCurrency(totals.total_received)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-400 text-sm">
                      {formatCurrency(totals.total_pending)}
                    </td>
                    <td className="py-3 px-3 text-center text-xs text-purple-400 font-mono">
                      {totals.collection_rate}% Recv
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Tab 2: Product Table */}
        {activeTab === "products" && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3 text-center">Unit</th>
                  <th className="py-2.5 px-3 text-right">Quantity Sold</th>
                  <th className="py-2.5 px-3 text-right">Avg Rate (₹)</th>
                  <th className="py-2.5 px-3 text-right">Total Sale (₹)</th>
                  <th className="py-2.5 px-3 text-right">Received (₹)</th>
                  <th className="py-2.5 px-3 text-right">Pending (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-500">
                      No products sold in this period.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p, i) => (
                    <tr key={p.product_id || i} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-center text-zinc-500 font-mono">{i + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-zinc-200">{p.product_name}</td>
                      <td className="py-2.5 px-3 text-center text-zinc-400 font-mono">{p.unit}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-200">
                        {p.total_qty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                        ₹{p.avg_rate?.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(p.total_sale)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-400">
                        {formatCurrency(p.amount_paid)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">
                        {formatCurrency(p.balance_due)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredProducts.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-zinc-700 bg-zinc-950 font-bold text-zinc-100">
                    <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider text-xs">
                      Grand Total:
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400 text-sm">
                      {formatCurrency(totals.total_sales)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-blue-400 text-sm">
                      {formatCurrency(totals.total_received)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-rose-400 text-sm">
                      {formatCurrency(totals.total_pending)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
