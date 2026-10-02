import { useQuery } from "@tanstack/react-query";
import {
  Users, Package, Receipt, IndianRupee,
  ArrowUp, ArrowDown, Upload, BarChart3,
  Wallet, Clock, CheckCircle2, AlertCircle,
  QrCode, Banknote, ArrowRight, ShieldAlert, Sparkles
} from "lucide-react";
import api from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";

function StatCard({ label, value, subtext, icon: Icon, colorClass, borderClass }) {
  return (
    <div className={`card p-5 border ${borderClass || "border-zinc-800"} bg-zinc-900/80 hover:border-zinc-700 transition-all`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-bold mt-1 tracking-tight ${colorClass || "text-zinc-100"}`}>
            {value}
          </p>
          {subtext && <p className="text-[11px] text-zinc-500 mt-1">{subtext}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${borderClass || "bg-zinc-800 text-zinc-300"}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/stats/dashboard").then((r) => r.data),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-6 h-28 bg-zinc-900 border-zinc-800" />
        ))}
      </div>
    );
  }

  const totalSales = stats?.total_sales ?? 0;
  const receivedPayment = stats?.received_payment ?? 0;
  const balancePayment = stats?.balance_payment ?? 0;
  const totalBills = stats?.total_bills ?? 0;

  const paidCount = stats?.status_breakdown?.paid ?? 0;
  const partialCount = stats?.status_breakdown?.partial ?? 0;
  const unpaidCount = stats?.status_breakdown?.unpaid ?? 0;

  const cashTotal = stats?.method_breakdown?.cash ?? 0;
  const upiTotal = stats?.method_breakdown?.upi ?? 0;

  const topDebtors = stats?.top_debtors || [];
  const recentBills = stats?.recent_bills || [];

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" /> Business Financial Dashboard
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time sales revenue, received cash inflow, pending balances & payment analytics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/upload" className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3">
            <Upload className="w-4 h-4 text-emerald-400" /> Upload Ledger
          </a>
          <a href="/bills" className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3">
            <Receipt className="w-4 h-4" /> Bills Workspace
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sales"
          value={formatCurrency(totalSales)}
          subtext={`Today: ${formatCurrency(stats?.today_sales ?? 0)}`}
          icon={IndianRupee}
          colorClass="text-zinc-100"
          borderClass="bg-blue-500/10 text-blue-400 border-blue-500/20"
        />
        <StatCard
          label="Received Payment"
          value={formatCurrency(receivedPayment)}
          subtext={`Today Inflow: ${formatCurrency(stats?.today_received ?? 0)}`}
          icon={Wallet}
          colorClass="text-emerald-400"
          borderClass="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        />
        <StatCard
          label="Balance Payment (Due)"
          value={formatCurrency(balancePayment)}
          subtext={`${unpaidCount + partialCount} pending bill(s)`}
          icon={Clock}
          colorClass="text-amber-400"
          borderClass="bg-amber-500/10 text-amber-400 border-amber-500/20"
        />
        <StatCard
          label="Total Customer Bills"
          value={totalBills}
          subtext={`${stats?.total_customers ?? 0} active customers`}
          icon={Receipt}
          colorClass="text-purple-400"
          borderClass="bg-purple-500/10 text-purple-400 border-purple-500/20"
        />
      </div>

      {/* Financial Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Payment Collection Breakdown */}
        <div className="lg:col-span-4 card p-5 flex flex-col gap-4">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Bill Payment Status
          </h3>

          <div className="flex flex-col gap-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  ● Payment Complete
                </span>
                <span className="text-zinc-300 font-mono">{paidCount} bills</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${totalBills > 0 ? (paidCount / totalBills) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  ● Partial Paid
                </span>
                <span className="text-zinc-300 font-mono">{partialCount} bills</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${totalBills > 0 ? (partialCount / totalBills) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  ● Unpaid
                </span>
                <span className="text-zinc-300 font-mono">{unpaidCount} bills</span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${totalBills > 0 ? (unpaidCount / totalBills) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-2 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 block text-[10px] uppercase">Cash Collections</span>
              <span className="text-emerald-400 font-mono font-bold mt-0.5 block">{formatCurrency(cashTotal)}</span>
            </div>
            <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 block text-[10px] uppercase">UPI Payments</span>
              <span className="text-purple-400 font-mono font-bold mt-0.5 block">{formatCurrency(upiTotal)}</span>
            </div>
          </div>
        </div>

        {/* Top Pending Customer Balances (Debtors) */}
        <div className="lg:col-span-8 card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" /> Pending Customer Balances (Top Dues)
            </h3>
            <a href="/bills" className="text-xs text-emerald-400 hover:underline">
              Manage Dues →
            </a>
          </div>

          <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-semibold">
                  <th className="py-2 px-3">Customer Name</th>
                  <th className="py-2 px-3 text-center">Unpaid Bills</th>
                  <th className="py-2 px-3 text-right">Outstanding Balance</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {topDebtors.length > 0 ? (
                  topDebtors.map((d) => (
                    <tr key={d.customer_id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-zinc-200">{d.customer_name}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-zinc-400">{d.unpaid_bills} bill(s)</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                        {formatCurrency(d.total_due)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <a
                          href={`/bills?customer_id=${d.customer_id}`}
                          className="btn-secondary text-[10px] py-1 px-2 inline-flex items-center gap-1"
                        >
                          Collect Payment <ArrowRight className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-500">
                      No pending customer balances. All payments are complete! 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Bills Activity */}
      <div className="card">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Recent Invoices & Bills</h2>
          <a href="/bills" className="text-xs text-emerald-400 hover:underline">
            View All Bills →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase text-[10px]">
                <th className="py-3 px-4">Bill No</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-center">Payment Method</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {recentBills.length > 0 ? (
                recentBills.map((bill) => {
                  const isPaid = bill.payment_status === "paid";
                  const isPartial = bill.payment_status === "partial";
                  return (
                    <tr key={bill.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-zinc-400">#{bill.bill_no}</td>
                      <td className="py-3 px-4 font-semibold text-zinc-200">{bill.customer_name}</td>
                      <td className="py-3 px-4 text-zinc-400 font-mono">{formatDate(bill.bill_date)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {bill.payment_method || "Cash"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-200">{formatCurrency(bill.total_amount)}</td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">{formatCurrency(bill.amount_paid)}</td>
                      <td className="py-3 px-4 text-right font-mono text-amber-400">{formatCurrency(bill.balance_due)}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isPaid
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : isPartial
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {isPaid ? "Paid" : isPartial ? "Partial" : "Unpaid"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-zinc-600">
                    No active bills recorded yet. Create a bill from the Bills page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
