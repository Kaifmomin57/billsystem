import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CurrencyInr,
  Wallet,
  Clock,
  Receipt,
  Plus,
  CloudArrowUp,
  ArrowRight,
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
  Bank,
  QrCode,
  Money,
} from "@phosphor-icons/react";
import api from "../lib/api";
import { formatINR, formatDateIN } from "../lib/formatters";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { StatusBadge } from "../components/ui/StatusBadge";
import { CardSkeleton, TableSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import Pagination from "../components/Pagination";

const BILLS_PAGE_SIZE = 5;

function StatCard({ label, value, subtext, icon: Icon, badgeClasses }) {
  return (
    <div className="card p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-100 mt-1 tabular-nums">
            {value}
          </div>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${badgeClasses || "bg-zinc-800 text-zinc-300"}`}>
          <Icon size={24} weight="bold" />
        </div>
      </div>
      {subtext && (
        <p className="text-sm text-zinc-400 mt-3 pt-2.5 border-t border-zinc-800">
          {subtext}
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [billPage, setBillPage] = useState(1);

  const { data: stats, isLoading, refetch, isFetching } = useQuery({
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

  const now = new Date();
  const todayFormatted = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Financial Dashboard"
          purpose="See today's business health and track collections"
        />
        <CardSkeleton count={4} />
        <TableSkeleton rows={5} cols={6} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* PRD v2 Page Header */}
      <PageHeader
        title="Dashboard"
        purpose={`Business health for ${todayFormatted} • Auto-refreshes every 30s`}
        primaryAction={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => navigate("/bills?new=true")}
          >
            Create Bill
          </Button>
        }
        secondaryAction={
          <Button
            variant="secondary"
            icon={CloudArrowUp}
            onClick={() => navigate("/upload")}
          >
            Upload Ledger
          </Button>
        }
        moreActions={[
          {
            label: isFetching ? "Refreshing…" : "Refresh data",
            icon: ArrowsClockwise,
            onClick: () => refetch(),
          },
          {
            label: "View reports",
            icon: Receipt,
            onClick: () => navigate("/reports"),
          },
        ]}
      />

      {/* 4 Priority KPI Cards (PRD Section 12) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Sales"
          value={formatINR(totalSales)}
          subtext={`Today: ${formatINR(stats?.today_sales ?? 0)}`}
          icon={CurrencyInr}
          badgeClasses="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
        />
        <StatCard
          label="Payments Received"
          value={formatINR(receivedPayment)}
          subtext={`Today Inflow: ${formatINR(stats?.today_received ?? 0)}`}
          icon={Wallet}
          badgeClasses="bg-sky-500/10 text-sky-400 border border-sky-500/30"
        />
        <StatCard
          label="Outstanding Due"
          value={formatINR(balancePayment)}
          subtext={`${unpaidCount + partialCount} invoice(s) pending`}
          icon={Clock}
          badgeClasses="bg-amber-500/10 text-amber-300 border border-amber-500/30"
        />
        <StatCard
          label="Total Bills"
          value={totalBills}
          subtext={`${stats?.total_customers ?? 0} active customer(s)`}
          icon={Receipt}
          badgeClasses="bg-zinc-800 text-zinc-300 border border-zinc-700"
        />
      </div>

      {/* 2-Column Priority Work Area: Collection Progress & Highest-due Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Collection & Method Breakdown */}
        <div className="lg:col-span-5 card p-5 flex flex-col justify-between gap-5">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <CheckCircle size={20} weight="bold" className="text-emerald-400" />
                <span>Collection Progress</span>
              </h2>
              <span className="text-sm font-mono font-bold text-emerald-400">{paidPercentage}% Cleared</span>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-600 transition-all duration-300"
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

              <div className="grid grid-cols-3 gap-2 pt-1 text-sm">
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-emerald-400 font-semibold block">● Paid</span>
                  <span className="text-zinc-100 font-mono font-bold mt-1 block">{paidCount} bills</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-amber-300 font-semibold block">● Partial</span>
                  <span className="text-zinc-100 font-mono font-bold mt-1 block">{partialCount} bills</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                  <span className="text-rose-400 font-semibold block">● Due</span>
                  <span className="text-zinc-100 font-mono font-bold mt-1 block">{unpaidCount} bills</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800 grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-400 text-sm">
                <Money size={18} weight="bold" className="text-emerald-400" />
                <span>Cash Receipts</span>
              </div>
              <span className="text-zinc-100 font-mono font-bold text-base mt-1.5 block tabular-nums">
                {formatINR(cashTotal)}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-400 text-sm">
                <QrCode size={18} weight="bold" className="text-sky-400" />
                <span>UPI Collections</span>
              </div>
              <span className="text-zinc-100 font-mono font-bold text-base mt-1.5 block tabular-nums">
                {formatINR(upiTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Top Outstanding Customers (Highest-due with Collect payment action) */}
        <div className="lg:col-span-7 card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <WarningCircle size={20} weight="bold" className="text-amber-400" />
                <span>Highest-Due Customers</span>
              </h2>
              <Link
                to="/bills?status=due"
                className="text-sm text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
              >
                <span>View all dues</span>
                <ArrowRight size={16} weight="bold" />
              </Link>
            </div>

            <div className="mt-3">
              {topDebtors.length > 0 ? (
                <>
                  {/* Desktop Table (52px row height) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th className="text-center">Pending Bills</th>
                          <th className="text-right">Balance Due</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topDebtors.slice(0, 5).map((d) => (
                          <tr key={d.customer_id} className="min-h-[52px]">
                            <td className="font-semibold text-zinc-100 text-base">{d.customer_name}</td>
                            <td className="text-center font-mono text-zinc-300 text-base">{d.unpaid_bills}</td>
                            <td className="text-right cell-money text-amber-300 font-bold text-base">
                              {formatINR(d.total_due)}
                            </td>
                            <td className="text-right">
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={ArrowRight}
                                iconPosition="right"
                                onClick={() => navigate(`/bills?customer_id=${d.customer_id}`)}
                              >
                                Collect
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Compact Cards (44px min targets) */}
                  <div className="block md:hidden divide-y divide-zinc-800">
                    {topDebtors.slice(0, 5).map((d) => (
                      <div key={d.customer_id} className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-zinc-100 text-base">{d.customer_name}</div>
                          <div className="text-xs text-zinc-400 font-mono mt-0.5">
                            {d.unpaid_bills} pending {d.unpaid_bills === 1 ? "bill" : "bills"}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-amber-300 text-base tabular-nums">
                            {formatINR(d.total_due)}
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/bills?customer_id=${d.customer_id}`)}
                          >
                            Collect
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-zinc-400 text-base">
                  No outstanding balances. All customer payments are up to date!
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
            <h2 className="text-lg font-bold text-zinc-100">Recent Bills</h2>
            <p className="text-sm text-zinc-400 mt-0.5">Latest billing transactions recorded</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate("/bills")}
          >
            View All Bills
          </Button>
        </div>

        {recentBills.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No bills recorded yet"
            description="Create your first bill or upload a handwritten ledger photo to get started."
            actionLabel="Create First Bill"
            onAction={() => navigate("/bills?new=true")}
          />
        ) : (
          <>
            {/* Desktop Table (52px row height, 16px text) */}
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
                    <th className="text-right">Balance Due</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBills.map((bill) => {
                    return (
                      <tr key={bill.id} className="min-h-[52px]">
                        <td className="font-mono font-bold text-zinc-300 text-base">#{bill.bill_no}</td>
                        <td className="font-semibold text-zinc-100 text-base">{bill.customer_name}</td>
                        <td className="cell-secondary">{formatDateIN(bill.bill_date)}</td>
                        <td>
                          <span className="badge-neutral text-xs">
                            {bill.payment_method || "Cash"}
                          </span>
                        </td>
                        <td className="cell-money text-zinc-100 text-base">{formatINR(bill.total_amount)}</td>
                        <td className="cell-money text-emerald-400 text-base">{formatINR(bill.amount_paid)}</td>
                        <td className="cell-money text-base">
                          {bill.balance_due > 0 ? (
                            <span className="text-amber-300 font-bold">{formatINR(bill.balance_due)}</span>
                          ) : (
                            <span className="text-zinc-500">₹0.00</span>
                          )}
                        </td>
                        <td className="text-center">
                          <StatusBadge status={bill.payment_status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="block md:hidden divide-y divide-zinc-800">
              {paginatedBills.map((bill) => (
                <div key={bill.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-zinc-100 text-base">#{bill.bill_no}</span>
                      <span className="text-xs text-zinc-400">{formatDateIN(bill.bill_date)}</span>
                    </div>
                    <StatusBadge status={bill.payment_status} />
                  </div>

                  <div className="flex items-center justify-between text-base">
                    <span className="font-semibold text-zinc-100">{bill.customer_name}</span>
                    <span className="badge-neutral text-xs">{bill.payment_method || "Cash"}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm">
                    <div>
                      <span className="text-xs text-zinc-400 block">Total</span>
                      <span className="font-mono font-bold text-zinc-100 mt-0.5 block tabular-nums">
                        {formatINR(bill.total_amount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400 block">Paid</span>
                      <span className="font-mono font-semibold text-emerald-400 mt-0.5 block tabular-nums">
                        {formatINR(bill.amount_paid)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400 block">Balance</span>
                      <span
                        className={`font-mono font-bold mt-0.5 block tabular-nums ${
                          bill.balance_due > 0 ? "text-amber-300" : "text-zinc-500"
                        }`}
                      >
                        {bill.balance_due > 0 ? formatINR(bill.balance_due) : "₹0.00"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
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
