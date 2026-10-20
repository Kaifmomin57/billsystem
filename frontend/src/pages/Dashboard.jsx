import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee, Upload,
  Wallet, Clock, CheckCircle2, AlertCircle,
  QrCode, Banknote, ArrowRight, Receipt, Plus
} from "lucide-react";
import api from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";
import Pagination from "../components/Pagination";

const BILLS_PAGE_SIZE = 5;

function StatCard({ label, value, subtext, icon: Icon, badgeColor }) {
  return (
    <div className="card p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-100 mt-1">
            {value}
          </div>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${badgeColor || "bg-zinc-800 text-zinc-400"}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {subtext && <p className="text-xs text-zinc-500 mt-3 pt-2 border-t border-zinc-800/60">{subtext}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [billPage, setBillPage] = useState(1);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.get("/stats/dashboard").then((r) => r.data),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

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

  const totalBillPages = Math.ceil(recentBills.length / BILLS_PAGE_SIZE) || 1;
  const paginatedBills = useMemo(() => {
    const s = (billPage - 1) * BILLS_PAGE_SIZE;
    return recentBills.slice(s, s + BILLS_PAGE_SIZE);
  }, [recentBills, billPage]);

  const paidPercentage = totalBills > 0 ? Math.round((paidCount / totalBills) * 100) : 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card p-5 h-28 bg-zinc-900/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
            Financial Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Overview of total sales, customer collections, and outstanding dues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/upload" className="btn-secondary text-xs sm:text-sm flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Upload Ledger</span>
          </Link>
          <Link to="/bills" className="btn-primary text-xs sm:text-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>New Bill</span>
          </Link>
        </div>
      </div>

      {/* 4 Core Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Total Sales"
          value={formatCurrency(totalSales)}
          subtext={`Today: ${formatCurrency(stats?.today_sales ?? 0)}`}
          icon={IndianRupee}
          badgeColor="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        />
        <StatCard
          label="Received Payments"
          value={formatCurrency(receivedPayment)}
          subtext={`Today Inflow: ${formatCurrency(stats?.today_received ?? 0)}`}
          icon={Wallet}
          badgeColor="bg-sky-500/10 text-sky-400 border border-sky-500/20"
        />
        <StatCard
          label="Outstanding Due"
          value={formatCurrency(balancePayment)}
          subtext={`${unpaidCount + partialCount} pending invoice(s)`}
          icon={Clock}
          badgeColor="bg-amber-500/10 text-amber-400 border border-amber-500/20"
        />
        <StatCard
          label="Total Invoices"
          value={totalBills}
          subtext={`${stats?.total_customers ?? 0} registered customers`}
          icon={Receipt}
          badgeColor="bg-zinc-800 text-zinc-300 border border-zinc-700"
        />
      </div>

      {/* 2-Column Focus Grid: Collection Health & Top Pending Debts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Collection & Method Breakdown */}
        <div className="lg:col-span-5 card p-5 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Collection Progress
              </h2>
              <span className="text-xs font-mono font-medium text-emerald-400">{paidPercentage}% Completed</span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 transition-all duration-300"
                  style={{ width: `${totalBills > 0 ? (paidCount / totalBills) * 100 : 0}%` }}
                  title={`Paid: ${paidCount}`}
                />
                <div
                  className="bg-amber-500 transition-all duration-300"
                  style={{ width: `${totalBills > 0 ? (partialCount / totalBills) * 100 : 0}%` }}
                  title={`Partial: ${partialCount}`}
                />
                <div
                  className="bg-rose-500 transition-all duration-300"
                  style={{ width: `${totalBills > 0 ? (unpaidCount / totalBills) * 100 : 0}%` }}
                  title={`Unpaid: ${unpaidCount}`}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80">
                  <span className="text-emerald-400 font-medium block">● Paid</span>
                  <span className="text-zinc-200 font-mono font-semibold mt-0.5 block">{paidCount} bills</span>
                </div>
                <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80">
                  <span className="text-amber-400 font-medium block">● Partial</span>
                  <span className="text-zinc-200 font-mono font-semibold mt-0.5 block">{partialCount} bills</span>
                </div>
                <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80">
                  <span className="text-rose-400 font-medium block">● Unpaid</span>
                  <span className="text-zinc-200 font-mono font-semibold mt-0.5 block">{unpaidCount} bills</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cash Receipts</span>
              </div>
              <span className="text-zinc-100 font-mono font-semibold text-sm mt-1 block">
                {formatCurrency(cashTotal)}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <QrCode className="w-3.5 h-3.5 text-sky-400" />
                <span>UPI Collections</span>
              </div>
              <span className="text-zinc-100 font-mono font-semibold text-sm mt-1 block">
                {formatCurrency(upiTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Top Pending Customers */}
        <div className="lg:col-span-7 card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Outstanding Customer Balances
              </h2>
              <Link to="/bills?status=due" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                View all dues →
              </Link>
            </div>

            <div className="mt-2">
              {topDebtors.length > 0 ? (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="data-table text-xs">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th className="text-center">Unpaid Bills</th>
                          <th className="text-right">Balance Due</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topDebtors.slice(0, 5).map((d) => (
                          <tr key={d.customer_id}>
                            <td className="font-medium text-zinc-200">{d.customer_name}</td>
                            <td className="text-center font-mono text-zinc-400">{d.unpaid_bills}</td>
                            <td className="text-right font-mono font-bold text-amber-400">
                              {formatCurrency(d.total_due)}
                            </td>
                            <td className="text-right">
                              <Link
                                to={`/bills?customer_id=${d.customer_id}`}
                                className="btn-ghost btn-sm text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                              >
                                <span>Collect</span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Compact Cards */}
                  <div className="block md:hidden divide-y divide-zinc-800/80">
                    {topDebtors.slice(0, 5).map((d) => (
                      <div key={d.customer_id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-zinc-200 text-xs">{d.customer_name}</div>
                          <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                            {d.unpaid_bills} unpaid {d.unpaid_bills === 1 ? "bill" : "bills"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-amber-400 text-xs">
                            {formatCurrency(d.total_due)}
                          </span>
                          <Link
                            to={`/bills?customer_id=${d.customer_id}`}
                            className="btn-secondary btn-sm !py-1 !px-2 text-xs text-emerald-400 inline-flex items-center gap-1"
                          >
                            <span>Collect</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  No outstanding customer balances. All payments collected!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bills Activity Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Recent Invoices</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Latest billing activity recorded in the system</p>
          </div>
          <Link to="/bills" className="btn-secondary btn-sm text-xs">
            View All Invoices
          </Link>
        </div>

        {recentBills.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-sm">
            No bills recorded yet.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Balance</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBills.map((bill) => {
                    const isPaid = bill.payment_status === "paid";
                    const isPartial = bill.payment_status === "partial";
                    return (
                      <tr key={bill.id}>
                        <td className="font-mono text-xs font-semibold text-zinc-300">#{bill.bill_no}</td>
                        <td className="font-medium text-zinc-100">{bill.customer_name}</td>
                        <td className="text-xs text-zinc-400">{formatDate(bill.bill_date)}</td>
                        <td>
                          <span className="badge-zinc text-[10px]">
                            {bill.payment_method || "Cash"}
                          </span>
                        </td>
                        <td className="text-right font-mono text-zinc-200">{formatCurrency(bill.total_amount)}</td>
                        <td className="text-right font-mono text-emerald-400">{formatCurrency(bill.amount_paid)}</td>
                        <td className="text-right font-mono">
                          {bill.balance_due > 0 ? (
                            <span className="text-amber-400 font-semibold">{formatCurrency(bill.balance_due)}</span>
                          ) : (
                            <span className="text-zinc-500">₹0</span>
                          )}
                        </td>
                        <td className="text-center">
                          <span
                            className={
                              isPaid
                                ? "badge-green"
                                : isPartial
                                ? "badge-yellow"
                                : "badge-red"
                            }
                          >
                            {isPaid ? "Paid" : isPartial ? "Partial" : "Unpaid"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (< md) */}
            <div className="block md:hidden divide-y divide-zinc-800/80">
              {paginatedBills.map((bill) => {
                const isPaid = bill.payment_status === "paid";
                const isPartial = bill.payment_status === "partial";

                return (
                  <div key={bill.id} className="p-4 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-200">#{bill.bill_no}</span>
                        <span className="text-[11px] text-zinc-500">{formatDate(bill.bill_date)}</span>
                      </div>
                      <span
                        className={
                          isPaid
                            ? "badge-green text-[10px]"
                            : isPartial
                            ? "badge-yellow text-[10px]"
                            : "badge-red text-[10px]"
                        }
                      >
                        {isPaid ? "Paid" : isPartial ? "Partial" : "Unpaid"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-100">{bill.customer_name}</span>
                      <span className="badge-zinc text-[10px]">{bill.payment_method || "Cash"}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2 rounded bg-zinc-950/70 border border-zinc-800/70 text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Total</span>
                        <span className="font-mono font-medium text-zinc-200 mt-0.5 block">
                          {formatCurrency(bill.total_amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Paid</span>
                        <span className="font-mono text-zinc-400 mt-0.5 block">
                          {formatCurrency(bill.amount_paid)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Balance</span>
                        <span
                          className={`font-mono font-bold mt-0.5 block ${
                            bill.balance_due > 0 ? "text-amber-400" : "text-zinc-500"
                          }`}
                        >
                          {bill.balance_due > 0 ? formatCurrency(bill.balance_due) : "₹0"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              page={billPage}
              totalPages={totalBillPages}
              totalItems={recentBills.length}
              pageSize={BILLS_PAGE_SIZE}
              onPageChange={setBillPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
