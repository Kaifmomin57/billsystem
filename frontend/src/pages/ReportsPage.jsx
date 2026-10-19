import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download, Calendar, Users, Package,
  FileSpreadsheet, Search, CheckCircle2,
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
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
            Financial Reports
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Daily product totals, customer sales breakdown, and Excel exports
          </p>
        </div>

        {/* Excel Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadReport("by-customer")}
            disabled={!!downloading}
            className="btn-primary text-xs sm:text-sm flex items-center gap-1.5"
          >
            {downloading === "by-customer" ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Customer Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => downloadReport("by-product")}
            disabled={!!downloading}
            className="btn-secondary text-xs sm:text-sm flex items-center gap-1.5"
          >
            {downloading === "by-product" ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4 text-emerald-400" />
            )}
            <span>Product Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Date Filter & Preset Chips */}
      <div className="card p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium mr-1">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>Date Range:</span>
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input-field text-xs py-1.5 px-2.5 w-auto"
          />
          <span className="text-zinc-600 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input-field text-xs py-1.5 px-2.5 w-auto"
          />
        </div>

        {/* Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => applyPreset("today")}
            className="btn-secondary btn-sm !py-1 text-xs"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => applyPreset("yesterday")}
            className="btn-secondary btn-sm !py-1 text-xs"
          >
            Yesterday
          </button>
          <button
            type="button"
            onClick={() => applyPreset("7days")}
            className="btn-secondary btn-sm !py-1 text-xs"
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => applyPreset("month")}
            className="btn-secondary btn-sm !py-1 text-xs"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-ghost btn-sm !p-1.5 text-zinc-400 hover:text-zinc-200"
            title="Refresh Report Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Sales</span>
            <div className="w-7 h-7 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100 mt-2">
            {formatCurrency(totals.total_sales)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {totals.total_bills} bills · {totals.total_customers} customers
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Collected</span>
            <div className="w-7 h-7 rounded bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {formatCurrency(totals.total_received)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Total cash & UPI in-hand
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Pending Due</span>
            <div className="w-7 h-7 rounded bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {formatCurrency(totals.total_pending)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Outstanding balance due
          </div>
        </div>

        <div className="card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Recovery Rate</span>
            <div className="w-7 h-7 rounded bg-zinc-800 text-zinc-300 flex items-center justify-center">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100 mt-2">
            {totals.collection_rate}%
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Collected / Total Sales
          </div>
        </div>
      </div>

      {/* Tabs & Data Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="segmented-nav">
            <button
              type="button"
              onClick={() => setActiveTab("customers")}
              className={`segmented-item flex items-center gap-1.5 ${activeTab === "customers" ? "active" : ""}`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>By Customer ({customers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`segmented-item flex items-center gap-1.5 ${activeTab === "products" ? "active" : ""}`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>By Product ({products.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab === "customers" ? "customer or phone" : "product"}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9 text-xs"
            />
          </div>
        </div>

        {/* Tab 1: Customer Table */}
        {activeTab === "customers" && (
          <div>
            {filteredCustomers.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-sm">
                No customer bills found for this date period.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th className="w-10 text-center">#</th>
                        <th>Customer Name</th>
                        <th>Phone</th>
                        <th className="text-center">Bills</th>
                        <th className="text-right">Total Sale</th>
                        <th className="text-right">Received</th>
                        <th className="text-right">Pending</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map((c, i) => (
                        <tr key={c.customer_id || i}>
                          <td className="text-center text-zinc-500 font-mono">{i + 1}</td>
                          <td className="font-semibold text-zinc-200">{c.customer_name}</td>
                          <td className="text-zinc-400 font-mono">{c.phone || "—"}</td>
                          <td className="text-center font-mono text-zinc-300">{c.bills_count}</td>
                          <td className="text-right font-mono font-medium text-zinc-200">
                            {formatCurrency(c.total_sale)}
                          </td>
                          <td className="text-right font-mono text-emerald-400">
                            {formatCurrency(c.amount_paid)}
                          </td>
                          <td className="text-right font-mono font-semibold">
                            {c.balance_due > 0 ? (
                              <span className="text-amber-400">{formatCurrency(c.balance_due)}</span>
                            ) : (
                              <span className="text-zinc-500">₹0</span>
                            )}
                          </td>
                          <td className="text-center">
                            <span
                              className={
                                c.payment_status === "paid"
                                ? "badge-green"
                                : c.payment_status === "partial"
                                ? "badge-yellow"
                                : "badge-red"
                              }
                            >
                              {c.payment_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-zinc-700 bg-zinc-950 font-bold text-zinc-200">
                        <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                          Grand Total:
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                          {formatCurrency(totals.total_sales)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-100 text-sm">
                          {formatCurrency(totals.total_received)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-400 text-sm">
                          {formatCurrency(totals.total_pending)}
                        </td>
                        <td className="py-3 px-4 text-center text-xs text-zinc-400 font-mono">
                          {totals.collection_rate}% Recv
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile Cards List (< md) */}
                <div className="block md:hidden divide-y divide-zinc-800/80">
                  {filteredCustomers.map((c, i) => (
                    <div key={c.customer_id || i} className="p-4 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-zinc-500">#{i + 1}</span>
                          <span className="font-semibold text-zinc-100 text-sm">{c.customer_name}</span>
                        </div>
                        <span
                          className={
                            c.payment_status === "paid"
                              ? "badge-green text-[10px]"
                              : c.payment_status === "partial"
                              ? "badge-yellow text-[10px]"
                              : "badge-red text-[10px]"
                          }
                        >
                          {c.payment_status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>{c.phone || "No phone"}</span>
                        <span>{c.bills_count} bills</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2 rounded bg-zinc-950/70 border border-zinc-800/70 text-xs">
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Total Sale</span>
                          <span className="font-mono font-medium text-zinc-200 mt-0.5 block">
                            {formatCurrency(c.total_sale)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Received</span>
                          <span className="font-mono text-zinc-400 mt-0.5 block">
                            {formatCurrency(c.amount_paid)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Pending</span>
                          <span
                            className={`font-mono font-bold mt-0.5 block ${
                              c.balance_due > 0 ? "text-amber-400" : "text-zinc-500"
                            }`}
                          >
                            {c.balance_due > 0 ? formatCurrency(c.balance_due) : "₹0"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Product Table */}
        {activeTab === "products" && (
          <div>
            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-sm">
                No products sold in this date period.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th className="w-10 text-center">#</th>
                        <th>Product Name</th>
                        <th className="text-center">Unit</th>
                        <th className="text-right">Quantity Sold</th>
                        <th className="text-right">Avg Rate (₹)</th>
                        <th className="text-right">Total Sale</th>
                        <th className="text-right">Received</th>
                        <th className="text-right">Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((p, i) => (
                        <tr key={p.product_id || i}>
                          <td className="text-center text-zinc-500 font-mono">{i + 1}</td>
                          <td className="font-semibold text-zinc-200">{p.product_name}</td>
                          <td className="text-center text-zinc-400 font-mono">{p.unit}</td>
                          <td className="text-right font-mono text-zinc-200">{p.total_qty}</td>
                          <td className="text-right font-mono text-zinc-400">₹{p.avg_rate?.toFixed(2)}</td>
                          <td className="text-right font-mono font-medium text-zinc-200">
                            {formatCurrency(p.total_sale)}
                          </td>
                          <td className="text-right font-mono text-emerald-400">
                            {formatCurrency(p.amount_paid)}
                          </td>
                          <td className="text-right font-mono font-semibold">
                            {p.balance_due > 0 ? (
                              <span className="text-amber-400">{formatCurrency(p.balance_due)}</span>
                            ) : (
                              <span className="text-zinc-500">₹0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-zinc-700 bg-zinc-950 font-bold text-zinc-200">
                        <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider text-xs">
                          Grand Total:
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                          {formatCurrency(totals.total_sales)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-100 text-sm">
                          {formatCurrency(totals.total_received)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-400 text-sm">
                          {formatCurrency(totals.total_pending)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile Cards List (< md) */}
                <div className="block md:hidden divide-y divide-zinc-800/80">
                  {filteredProducts.map((p, i) => (
                    <div key={p.product_id || i} className="p-4 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-zinc-500">#{i + 1}</span>
                          <span className="font-semibold text-zinc-100 text-sm">{p.product_name}</span>
                        </div>
                        <span className="badge-zinc text-[10px] font-mono">{p.unit}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Quantity: <strong className="text-zinc-200 font-mono">{p.total_qty} {p.unit}</strong></span>
                        <span>Avg Rate: <strong className="text-zinc-200 font-mono">₹{p.avg_rate?.toFixed(2)}</strong></span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2 rounded bg-zinc-950/70 border border-zinc-800/70 text-xs">
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Total Sale</span>
                          <span className="font-mono font-medium text-zinc-200 mt-0.5 block">
                            {formatCurrency(p.total_sale)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Received</span>
                          <span className="font-mono text-zinc-400 mt-0.5 block">
                            {formatCurrency(p.amount_paid)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 block">Pending</span>
                          <span
                            className={`font-mono font-bold mt-0.5 block ${
                              p.balance_due > 0 ? "text-amber-400" : "text-zinc-500"
                            }`}
                          >
                            {p.balance_due > 0 ? formatCurrency(p.balance_due) : "₹0"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
