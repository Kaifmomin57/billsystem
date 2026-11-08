import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  Receipt,
  CheckCircle,
  WarningCircle,
  Coins,
  CreditCard,
  Money,
  ArrowsLeftRight,
} from "@phosphor-icons/react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatINR } from "../lib/formatters";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";

const PAYMENT_METHODS = [
  { id: "Cash", label: "Cash", icon: Money },
  { id: "UPI", label: "UPI", icon: CreditCard },
  { id: "Bank Transfer", label: "Bank Transfer", icon: ArrowsLeftRight },
  { id: "Cheque", label: "Cheque", icon: Coins },
];

export function CustomerPaymentModal({ isOpen, onClose, initialCustomer }) {
  const qc = useQueryClient();

  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialCustomer && typeof initialCustomer === "object" ? initialCustomer.id : ""
  );
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [note, setNote] = useState("");

  // Fetch all customers for the dropdown if needed
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers?limit=500").then((r) => r.data),
    staleTime: 30_000,
    enabled: isOpen,
  });

  const customers = useMemo(() => {
    if (!customersData) return [];
    return Array.isArray(customersData) ? customersData : customersData.items || [];
  }, [customersData]);

  // Sync selected customer when modal opens or initialCustomer changes
  useEffect(() => {
    if (initialCustomer && typeof initialCustomer === "object") {
      setSelectedCustomerId(initialCustomer.id);
    } else if (!selectedCustomerId && customers.length > 0) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [initialCustomer, customers]);

  // Reset form when modal closes/opens
  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setNote("");
      setPaymentMethod("Cash");
    }
  }, [isOpen]);

  // Find active customer object
  const activeCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    const found = customers.find((c) => String(c.id) === String(selectedCustomerId));
    if (found) return found;
    if (initialCustomer && typeof initialCustomer === "object" && String(initialCustomer.id) === String(selectedCustomerId)) {
      return initialCustomer;
    }
    return null;
  }, [selectedCustomerId, customers, initialCustomer]);

  // Extract financial balances
  const openBal = parseFloat(activeCustomer?.opening_balance || 0);
  const billsBal = parseFloat(activeCustomer?.bills_balance || 0);
  const totalBal = parseFloat(activeCustomer?.total_balance ?? round(openBal + billsBal, 2));

  const hasPositiveDues = totalBal > 0.001;
  const isAllCleared = Math.abs(totalBal) <= 0.001;
  const hasExistingAdvance = totalBal < -0.001;
  const advanceAmount = hasExistingAdvance ? Math.abs(totalBal) : 0;

  // Real-time settlement breakdown
  const enteredAmount = parseFloat(amount || 0);

  const breakdown = useMemo(() => {
    if (enteredAmount <= 0) return null;

    let rem = enteredAmount;

    // 1. Applied to bills
    const toBills = Math.min(rem, Math.max(0, billsBal));
    rem = Math.max(0, rem - toBills);

    // 2. Applied to opening balance
    const toOpening = Math.min(rem, Math.max(0, openBal));
    rem = Math.max(0, rem - toOpening);

    // 3. Excess to advance
    const toAdvance = rem;

    // Resulting balance
    const resultingBalance = totalBal - enteredAmount;

    return {
      toBills,
      toOpening,
      toAdvance,
      resultingBalance,
    };
  }, [enteredAmount, billsBal, openBal, totalBal]);

  const paymentMutation = useMutation({
    mutationFn: (payload) => api.post(`/customers/${selectedCustomerId}/payment`, payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers-chunked"] });
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });

      const adv = res.data?.settlement?.advance_credited || 0;
      if (adv > 0) {
        toast.success(`Payment of ₹${enteredAmount.toFixed(2)} recorded! (₹${adv.toFixed(2)} added as Advance)`);
      } else {
        toast.success(`Payment of ₹${enteredAmount.toFixed(2)} recorded successfully!`);
      }
      onClose();
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to record payment");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error("Please select a customer");
      return;
    }
    if (enteredAmount <= 0) {
      toast.error("Please enter a valid amount greater than ₹0");
      return;
    }

    paymentMutation.mutate({
      amount: enteredAmount,
      payment_method: paymentMethod,
      note: note.trim() || null,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receive Customer Payment / Advance"
      subtitle={activeCustomer ? `Customer: ${activeCustomer.name}` : "Record payment or advance credit"}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Customer Selection (if not pre-selected or if user wants to change) */}
        {(!initialCustomer || initialCustomer === "select") && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-300">Select Customer</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-zinc-100 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              required
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => {
                const bal = parseFloat(c.total_balance || 0);
                const tag = bal < -0.01 ? `(Advance: ₹${Math.abs(bal).toFixed(2)})` : bal > 0.01 ? `(Due: ₹${bal.toFixed(2)})` : "(Cleared)";
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} {tag}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Current Account Balances Card */}
        {activeCustomer && (
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
              <div>
                <span className="font-semibold text-zinc-100 text-base">{activeCustomer.name}</span>
                <span className="text-xs text-zinc-400 font-mono block mt-0.5">
                  {activeCustomer.phone ? `Ph: ${activeCustomer.phone}` : "No phone saved"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium block">
                  {hasExistingAdvance ? "Advance Credit" : "Total Outstanding"}
                </span>
                <span
                  className={`font-mono font-bold text-xl tabular-nums block ${
                    hasExistingAdvance
                      ? "text-emerald-400"
                      : hasPositiveDues
                      ? "text-amber-300"
                      : "text-zinc-400"
                  }`}
                >
                  {hasExistingAdvance ? formatINR(advanceAmount) : formatINR(Math.max(0, totalBal))}
                </span>
              </div>
            </div>

            {/* Dues breakdown grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/70">
                <span className="text-zinc-400 block mb-1">Previous Balance (Unbilled)</span>
                <span className={`font-mono font-bold text-sm tabular-nums ${openBal > 0 ? "text-amber-300" : "text-zinc-400"}`}>
                  {formatINR(openBal)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800/70">
                <span className="text-zinc-400 block mb-1">Unpaid Invoices Due</span>
                <span className={`font-mono font-bold text-sm tabular-nums ${billsBal > 0 ? "text-amber-300" : "text-zinc-400"}`}>
                  {formatINR(billsBal)}
                </span>
              </div>
            </div>

            {/* Status explanation notice */}
            {isAllCleared && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                <CheckCircle size={16} weight="fill" className="text-emerald-400 shrink-0" />
                <span>All bills and previous dues are completely cleared! Any payment entered will be saved as <strong>Customer Advance (जमा राशि)</strong>.</span>
              </div>
            )}

            {hasExistingAdvance && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                <Coins size={16} weight="fill" className="text-emerald-400 shrink-0" />
                <span>Customer already has <strong>{formatINR(advanceAmount)} Advance Credit</strong>. Any new payment will add to this advance balance.</span>
              </div>
            )}
          </div>
        )}

        {/* Amount Input */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-200 flex items-center gap-1.5">
              <span>Payment Amount</span>
              <span className="text-rose-400">*</span>
            </label>
            {enteredAmount > 0 && (
              <button
                type="button"
                onClick={() => setAmount("")}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Clear amount
              </button>
            )}
          </div>

          <div className="relative flex items-center">
            <div className="absolute left-3.5 flex items-center pointer-events-none text-zinc-400 font-mono font-semibold text-lg">
              ₹
            </div>
            <input
              type="number"
              step="any"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount to receive"
              className="w-full min-h-[50px] bg-zinc-950 border border-zinc-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl pl-9 pr-4 py-2 text-xl font-mono font-bold text-emerald-400 placeholder:text-zinc-600 tabular-nums transition-all outline-none"
              required
              autoFocus
            />
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {hasPositiveDues && (
              <button
                type="button"
                onClick={() => setAmount(totalBal.toString())}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-zinc-900 border-zinc-800 text-purple-300 hover:border-purple-600 hover:text-white transition-all cursor-pointer flex items-center gap-1"
              >
                <Receipt size={13} />
                <span>Pay Full Due ({formatINR(totalBal)})</span>
              </button>
            )}
            {openBal > 0 && (
              <button
                type="button"
                onClick={() => setAmount(openBal.toString())}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-zinc-900 border-zinc-800 text-amber-300 hover:border-amber-600 hover:text-white transition-all cursor-pointer"
              >
                <span>Previous Due Only ({formatINR(openBal)})</span>
              </button>
            )}
            {billsBal > 0 && (
              <button
                type="button"
                onClick={() => setAmount(billsBal.toString())}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white transition-all cursor-pointer"
              >
                <span>Bills Due Only ({formatINR(billsBal)})</span>
              </button>
            )}
            {[500, 1000, 2000, 5000].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(val.toString())}
                className="px-2.5 py-1 rounded-lg text-xs font-mono bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer"
              >
                +₹{val}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Settlement Breakdown Preview */}
        {breakdown && (
          <div className="p-3.5 rounded-xl border transition-all text-xs flex flex-col gap-2.5 bg-zinc-950/80 border-zinc-800">
            <span className="font-semibold text-zinc-300 text-[11px] uppercase tracking-wider">
              Settlement Allocation Breakdown:
            </span>

            {breakdown.toBills > 0 && (
              <div className="flex items-center justify-between text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Receipt size={14} className="text-emerald-400" />
                  <span>Clears unpaid invoices:</span>
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatINR(breakdown.toBills)}
                </span>
              </div>
            )}

            {breakdown.toOpening > 0 && (
              <div className="flex items-center justify-between text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Coins size={14} className="text-amber-400" />
                  <span>Clears previous unbilled balance:</span>
                </span>
                <span className="font-mono font-bold text-amber-400">
                  {formatINR(breakdown.toOpening)}
                </span>
              </div>
            )}

            {breakdown.toAdvance > 0 && (
              <div className="flex items-center gap-2 text-emerald-300 bg-emerald-950/40 border border-emerald-500/40 p-2.5 rounded-lg font-medium">
                <CheckCircle size={16} weight="fill" className="text-emerald-400 shrink-0" />
                <span>
                  <strong>{formatINR(breakdown.toAdvance)}</strong> will be credited to Customer's <strong>Advance Balance (जमा राशि)</strong> for future bills!
                </span>
              </div>
            )}

            <div className="border-t border-zinc-800/80 pt-2 flex items-center justify-between text-zinc-400 font-mono">
              <span>Customer total balance after payment:</span>
              <span
                className={`font-bold text-sm tabular-nums ${
                  breakdown.resultingBalance < -0.01
                    ? "text-emerald-400"
                    : breakdown.resultingBalance > 0.01
                    ? "text-amber-300"
                    : "text-zinc-200"
                }`}
              >
                {breakdown.resultingBalance < -0.01
                  ? `${formatINR(Math.abs(breakdown.resultingBalance))} (Advance)`
                  : formatINR(Math.max(0, breakdown.resultingBalance))}
              </span>
            </div>
          </div>
        )}

        {/* Payment Method Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-200">Payment Mode</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PAYMENT_METHODS.map((pm) => {
              const Icon = pm.icon;
              const isSelected = paymentMethod === pm.id;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`min-h-[42px] px-2.5 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-200 shadow-sm"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  <Icon size={14} className={isSelected ? "text-emerald-400" : "text-zinc-500"} />
                  <span>{pm.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-300">
            Note / Reference <span className="text-xs text-zinc-500 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Previous balance settlement, Advance for upcoming orders, UPI Ref"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-zinc-100 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-zinc-600"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800 mt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={paymentMutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={Wallet}
            isLoading={paymentMutation.isPending}
            loadingText="Recording payment…"
            disabled={!selectedCustomerId || enteredAmount <= 0}
          >
            {breakdown && breakdown.toAdvance > 0 && breakdown.toBills === 0 && breakdown.toOpening === 0
              ? "Record Advance Payment"
              : "Record Payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

