import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DownloadSimple,
  CalendarBlank,
  Users,
  Package,
  MagnifyingGlass,
  CheckCircle,
  WarningCircle,
  ArrowUpRight,
  Percent,
  ArrowsClockwise,
  TrendUp,
  TrendDown,
  ChartBar,
  CurrencyInr,
  Wallet,
} from "@phosphor-icons/react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatINR, formatDateIN } from "../lib/formatters";
import { downloadBlob } from "../lib/utils";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { FormField } from "../components/ui/FormField";
import { EmptyState } from "../components/ui/EmptyState";
import { CardSkeleton, TableSkeleton } from "../components/ui/Skeleton";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 10;

function StatCard({ label, value, subtext, icon: Icon, badgeClasses }) {
  return (
    <div className="card p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${badgeClasses}`}>
          <Icon size={20} weight="bold" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-100 tabular-nums">
          {value}
        </div>
        {subtext && <p className="text-sm text-zinc-400 mt-1">{subtext}</p>}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [activeTab, setActiveTab] = useState("customers"); // "customers" | "products"
  const [searchTerm, setSearchTerm] = useState("");
  const [custPage, setCustPage] = useState(1);
  const [prodPage, setProdPage] = useState(1);
  const [downloading, setDownloading] = useState(null);

  // PRD v2 Date Presets: Today, This Week, This Month, Custom
  const applyPreset = (preset) => {
    const today = new Date();
    if (preset === "today") {
      const s = today.toISOString().slice(0, 10);
      setDateFrom(s);
      setDateTo(s);
    } else if (preset === "week") {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      setDateFrom(startOfWeek.toISOString().slice(0, 10));
      setDateTo(today.toISOString().slice(0, 10));
    } else if (preset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(firstDay.toISOString().slice(0, 10));
      setDateTo(today.toISOString().slice(0, 10));
    }
  };

  const dateLabel = () => {
    if (dateFrom === dateTo) return formatDateIN(dateFrom);
    return `${formatDateIN(dateFrom)} – ${formatDateIN(dateTo)}`;
  };

  // Fetch report summary
  const { data: reportData, isLoading, refetch, isFetching } = useQuery({
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

  const filteredCustomers = useMemo(() =>
    customers.filter(
      (c) =>
        (c.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone || "").includes(searchTerm)
    ),
    [customers, searchTerm]
  );

  const filteredProducts = useMemo(() =>
    products.filter((p) =>
      (p.product_name || "").toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [products, searchTerm]
  );

  const totalCustPages = Math.ceil(filteredCustomers.length / PAGE_SIZE) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (custPage - 1) * PAGE_SIZE;
    return filteredCustomers.slice(start, start + PAGE_SIZE);
  }, [filteredCustomers, custPage]);

  const totalProdPages = Math.ceil(filteredProducts.length / PAGE_SIZE) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (prodPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, prodPage]);

  const totalPL = useMemo(() =>
    products.reduce(
      (sum, p) => (p.profit_loss !== null && p.profit_loss !== undefined ? sum + p.profit_loss : sum),
      0
    ),
    [products]
  );

  const hasPL = useMemo(() =>
    products.some((p) => p.profit_loss !== null && p.profit_loss !== undefined),
    [products]
  );

  const downloadReport = async (type) => {
    setDownloading(type);
    try {
      toast.loading(`Generating ${type === "by-customer" ? "Customer" : "Product"} Excel report…`, {
        id: "report-toast",
      });
      const res = await api.get(`/reports/daily/${type}`, {
        params: { date_from: dateFrom, date_to: dateTo },
        responseType: "blob",
      });
      const label = dateFrom === dateTo ? dateFrom : `${dateFrom}_to_${dateTo}`;
      const filename = `report_${type}_${label}.xlsx`;
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
      {/* PRD v2 Page Header */}
      <PageHeader
        title="Reports"
        purpose="Understand financial performance across customers, products, and date ranges"
        primaryAction={
          <Button
            variant="primary"
            icon={DownloadSimple}
            isLoading={downloading === "by-customer"}
            loadingText="Preparing…"
            onClick={() => downloadReport("by-customer")}
            disabled={Boolean(downloading)}
          >
            Customer Report
          </Button>
        }
        secondaryAction={
          <Button
            variant="secondary"
            icon={DownloadSimple}
            isLoading={downloading === "by-product"}
            loadingText="Preparing…"
            onClick={() => downloadReport("by-product")}
            disabled={Boolean(downloading)}
          >
            Product Report
          </Button>
        }
        moreActions={[
          {
            label: isFetching ? "Refreshing…" : "Refresh report",
            icon: ArrowsClockwise,
            onClick: () => refetch(),
          },
        ]}
      />

      {/* Date Filter Bar with PRD v2 Presets */}
      <div className="card p-4 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-sm text-zinc-400 font-medium shrink-0">
              <CalendarBlank size={18} weight="bold" className="text-emerald-400" />
              <span>Date Range:</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 w-full sm:w-auto min-w-0">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input min-h-[44px] text-sm sm:text-base py-1.5 px-2 sm:px-3 w-full min-w-0 font-mono"
              />
              <span className="text-zinc-500 text-sm text-center">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input min-h-[44px] text-sm sm:text-base py-1.5 px-2 sm:px-3 w-full min-w-0 font-mono"
              />
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="grid grid-cols-3 sm:flex segmented-nav w-full sm:w-auto">
            <button
              type="button"
              onClick={() => applyPreset("today")}
              className={`segmented-item text-center ${dateFrom === dateTo && dateFrom === new Date().toISOString().slice(0, 10) ? "active" : ""}`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyPreset("week")}
              className="segmented-item text-center"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => applyPreset("month")}
              className="segmented-item text-center"
            >
              This Month
            </button>
          </div>
        </div>
      </div>

      {/* 5 KPI Summary Cards (PRD v2 Section 12: Sales, Collected, Outstanding, Net P&L, Bills) */}
      {isLoading ? (
        <CardSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="Total Sales"
            value={formatINR(totals.total_sales)}
            subtext={`${totals.total_bills} bill(s)`}
            icon={CurrencyInr}
            badgeClasses="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
          />
          <StatCard
            label="Collected"
            value={formatINR(totals.total_received)}
            subtext="Cash & UPI received"
            icon={Wallet}
            badgeClasses="bg-sky-500/10 text-sky-400 border border-sky-500/30"
          />
          <StatCard
            label="Outstanding"
            value={formatINR(totals.total_pending)}
            subtext="Balance due from customers"
            icon={WarningCircle}
            badgeClasses="bg-amber-500/10 text-amber-300 border border-amber-500/30"
          />
          <StatCard
            label="Recovery Rate"
            value={`${totals.collection_rate}%`}
            subtext="Collected ÷ Total Sales"
            icon={Percent}
            badgeClasses="bg-zinc-800 text-zinc-300 border border-zinc-700"
          />
          <div className="card p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                Net Profit / Loss
              </span>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  !hasPL
                    ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    : totalPL >= 0
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}
              >
                {!hasPL ? (
                  <ChartBar size={20} weight="bold" />
                ) : totalPL >= 0 ? (
                  <TrendUp size={20} weight="bold" />
                ) : (
                  <TrendDown size={20} weight="bold" />
                )}
              </div>
            </div>
            <div className="mt-3">
              <div
                className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums ${
                  !hasPL ? "text-zinc-500" : totalPL >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {hasPL
                  ? `${totalPL >= 0 ? "+" : ""}${formatINR(totalPL)}`
                  : "—"}
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                {hasPL ? "Revenue minus purchase cost" : "Add purchase prices to track"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs + Detail Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="segmented-nav">
            <button
              type="button"
              onClick={() => setActiveTab("customers")}
              className={`segmented-item ${activeTab === "customers" ? "active" : ""}`}
            >
              <Users size={16} weight="bold" />
              <span>By Customer ({customers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`segmented-item ${activeTab === "products" ? "active" : ""}`}
            >
              <Package size={16} weight="bold" />
              <span>By Product ({products.length})</span>
            </button>
          </div>

          <div className="w-full sm:w-72">
            <Input
              placeholder={`Search ${activeTab === "customers" ? "customer or phone" : "product name"}…`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCustPage(1);
                setProdPage(1);
              }}
              leftIcon={MagnifyingGlass}
            />
          </div>
        </div>

        {/* Customer Report Tab */}
        {activeTab === "customers" && (
          <div>
            {isLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : filteredCustomers.length === 0 ? (
              <EmptyState
                icon={Users}
                title={`No customer data for ${dateLabel()}`}
                description={
                  searchTerm
                    ? `No customer matched "${searchTerm}" in this date range.`
                    : `No bills were recorded for the selected period: ${dateLabel()}.`
                }
              />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th className="text-right">Total Sales</th>
                        <th className="text-right">Collected</th>
                        <th className="text-right">Balance Due</th>
                        <th className="text-right">Profit / Loss</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCustomers.map((c) => {
                        const pl = c.profit_loss;
                        const hasCustomerPL = pl !== null && pl !== undefined;
                        const isProfitable = hasCustomerPL && pl >= 0;
                        return (
                          <tr key={c.customer_id} className="min-h-[52px]">
                            <td>
                              <span className="font-semibold text-zinc-100 text-base">
                                {c.customer_name}
                              </span>
                              {c.phone && (
                                <div className="cell-secondary font-mono">{c.phone}</div>
                              )}
                            </td>
                            <td className="cell-money text-base text-zinc-100">
                              {formatINR(c.total_sales)}
                            </td>
                            <td className="cell-money text-base text-emerald-400">
                              {formatINR(c.total_received)}
                            </td>
                            <td className="cell-money text-base">
                              {c.total_pending > 0 ? (
                                <span className="text-amber-300 font-bold">
                                  {formatINR(c.total_pending)}
                                </span>
                              ) : (
                                <span className="text-zinc-500">₹0.00</span>
                              )}
                            </td>
                            <td className="cell-money text-base">
                              {hasCustomerPL ? (
                                <span
                                  className={`font-bold ${isProfitable ? "text-emerald-400" : "text-rose-400"}`}
                                >
                                  {isProfitable ? "+" : ""}
                                  {formatINR(pl)}
                                </span>
                              ) : (
                                <span className="text-zinc-500">—</span>
                              )}
                            </td>
                            <td className="text-center">
                              {c.total_pending > 0 ? (
                                <span className="badge-warning">
                                  <WarningCircle size={14} weight="bold" />
                                  Due
                                </span>
                              ) : (
                                <span className="badge-success">
                                  <CheckCircle size={14} weight="bold" />
                                  Settled
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile customer cards */}
                <div className="block md:hidden divide-y divide-zinc-800">
                  {paginatedCustomers.map((c) => {
                    const pl = c.profit_loss;
                    const hasCustomerPL = pl !== null && pl !== undefined;
                    const isProfitable = hasCustomerPL && pl >= 0;
                    return (
                      <div key={c.customer_id} className="p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-zinc-100 text-base">
                              {c.customer_name}
                            </h3>
                            {c.phone && (
                              <p className="text-xs text-zinc-400 font-mono">{c.phone}</p>
                            )}
                          </div>
                          {c.total_pending > 0 ? (
                            <span className="badge-warning text-xs">
                              <WarningCircle size={12} weight="bold" />
                              Due
                            </span>
                          ) : (
                            <span className="badge-success text-xs">
                              <CheckCircle size={12} weight="bold" />
                              Settled
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm">
                          <div>
                            <span className="text-xs text-zinc-400 block">Sales</span>
                            <span className="font-mono font-bold text-zinc-100 mt-0.5 block tabular-nums">
                              {formatINR(c.total_sales)}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400 block">Collected</span>
                            <span className="font-mono font-bold text-emerald-400 mt-0.5 block tabular-nums">
                              {formatINR(c.total_received)}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400 block">Balance Due</span>
                            <span
                              className={`font-mono font-bold mt-0.5 block tabular-nums ${
                                c.total_pending > 0 ? "text-amber-300" : "text-zinc-500"
                              }`}
                            >
                              {formatINR(c.total_pending)}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400 block">Profit / Loss</span>
                            <span
                              className={`font-mono font-bold mt-0.5 block tabular-nums ${
                                !hasCustomerPL
                                  ? "text-zinc-500"
                                  : isProfitable
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {hasCustomerPL ? (isProfitable ? "+" : "") + formatINR(pl) : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Pagination
                  page={custPage}
                  totalPages={totalCustPages}
                  totalItems={filteredCustomers.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setCustPage}
                />
              </>
            )}
          </div>
        )}

        {/* Product Report Tab */}
        {activeTab === "products" && (
          <div>
            {isLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                icon={Package}
                title={`No product data for ${dateLabel()}`}
                description={
                  searchTerm
                    ? `No product matched "${searchTerm}" in this date range.`
                    : `No products were sold in the selected period: ${dateLabel()}.`
                }
              />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-right">Total Quantity</th>
                        <th className="text-right">Total Sales</th>
                        <th className="text-right">Purchase Price</th>
                        <th className="text-right">Profit / Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts.map((p) => {
                        const pl = p.profit_loss;
                        const hasProdPL = pl !== null && pl !== undefined;
                        const isProfitable = hasProdPL && pl >= 0;
                        return (
                          <tr key={p.product_id || p.product_name} className="min-h-[52px]">
                            <td className="font-semibold text-zinc-100 text-base">
                              {p.product_name}
                            </td>
                            <td className="cell-money text-base text-zinc-300">
                              <span className="font-mono">{p.total_quantity}</span>
                              <span className="text-zinc-400 ml-1 text-sm">{p.unit || "kg"}</span>
                            </td>
                            <td className="cell-money text-base text-zinc-100">
                              {formatINR(p.total_sales)}
                            </td>
                            <td className="cell-money text-base">
                              {p.purchase_price !== null && p.purchase_price !== undefined ? (
                                <span className="text-rose-300">{formatINR(p.purchase_price)}</span>
                              ) : (
                                <span className="text-zinc-500">Not set</span>
                              )}
                            </td>
                            <td className="cell-money text-base">
                              {hasProdPL ? (
                                <span
                                  className={`font-bold ${isProfitable ? "text-emerald-400" : "text-rose-400"}`}
                                >
                                  {isProfitable ? "+" : ""}
                                  {formatINR(pl)}
                                </span>
                              ) : (
                                <span className="text-zinc-500">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile product cards */}
                <div className="block md:hidden divide-y divide-zinc-800">
                  {paginatedProducts.map((p) => {
                    const pl = p.profit_loss;
                    const hasProdPL = pl !== null && pl !== undefined;
                    const isProfitable = hasProdPL && pl >= 0;
                    return (
                      <div key={p.product_id || p.product_name} className="p-4 flex flex-col gap-3">
                        <h3 className="font-semibold text-zinc-100 text-base">{p.product_name}</h3>

                        <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm">
                          <div>
                            <span className="text-xs text-zinc-400 block">Total Sold</span>
                            <span className="font-mono font-bold text-zinc-100 mt-0.5 block tabular-nums">
                              {p.total_quantity} {p.unit || "kg"}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400 block">Revenue</span>
                            <span className="font-mono font-bold text-zinc-100 mt-0.5 block tabular-nums">
                              {formatINR(p.total_sales)}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400 block">Purchase Cost</span>
                            <span className="font-mono font-bold text-rose-300 mt-0.5 block tabular-nums">
                              {p.purchase_price !== null && p.purchase_price !== undefined
                                ? formatINR(p.purchase_price)
                                : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-zinc-400 block">Profit / Loss</span>
                            <span
                              className={`font-mono font-bold mt-0.5 block tabular-nums ${
                                !hasProdPL
                                  ? "text-zinc-500"
                                  : isProfitable
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {hasProdPL ? (isProfitable ? "+" : "") + formatINR(pl) : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Pagination
                  page={prodPage}
                  totalPages={totalProdPages}
                  totalItems={filteredProducts.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setProdPage}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
