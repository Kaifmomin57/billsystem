import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Plus, Search, Calendar, Trash2, Eye,
  X, Wallet, CheckCircle2, Clock, AlertCircle, QrCode, Banknote,
  FileDown, Send, Pencil, PenSquare
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";

export default function BillsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isEditBillModalOpen, setIsEditBillModalOpen] = useState(false);
  const [viewingBill, setViewingBill] = useState(null);
  const [sendingBillId, setSendingBillId] = useState(null);
  const [editingBill, setEditingBill] = useState(null);

  // Payment Modal state
  const [paymentBill, setPaymentBill] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    installment_amount: "",
    payment_method: "Cash",
    note: ""
  });

  // Manual Bill Form
  const [productRows, setProductRows] = useState([]);
  const [billMeta, setBillMeta] = useState({
    customer_id: "",
    bill_date: new Date().toISOString().split("T")[0],
    amount_paid: "",
    payment_method: "Cash",
  });

  // Edit Bill Form
  const [editProductRows, setEditProductRows] = useState([]);
  const [editBillMeta, setEditBillMeta] = useState({
    customer_id: "",
    bill_date: new Date().toISOString().split("T")[0],
    payment_method: "Cash",
  });
  const [ratesLoading, setRatesLoading] = useState(false);

  // Fetch Customers & Products
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get("/customers")).data,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => (await api.get("/products?is_active=true")).data,
  });

  // Fetch Bills with filters
  const { data: bills = [], isLoading } = useQuery({
    queryKey: ["bills", selectedCustomerId, selectedSource, startDate, endDate],
    queryFn: async () => {
      let url = "/bills?";
      if (selectedCustomerId) url += `customer_id=${selectedCustomerId}&`;
      if (selectedSource) url += `source=${selectedSource}&`;
      if (startDate) url += `start_date=${startDate}&`;
      if (endDate) url += `end_date=${endDate}&`;
      return (await api.get(url)).data;
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["bills"]);
      queryClient.invalidateQueries(["dashboard-stats"]);
      toast.success("Bill deleted successfully");
    },
  });

  // Create Bill Mutation
  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/bills", payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["bills"]);
      queryClient.invalidateQueries(["dashboard-stats"]);
      toast.success("Bill created successfully!");
      setIsManualModalOpen(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to create bill");
    },
  });

  // Update Bill Mutation
  const updateBillMutation = useMutation({
    mutationFn: ({ billId, payload }) => api.put(`/bills/${billId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["bills"]);
      queryClient.invalidateQueries(["dashboard-stats"]);
      toast.success("Bill updated successfully!");
      setIsEditBillModalOpen(false);
      setEditingBill(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to update bill");
    },
  });

  // Payment Record Mutation
  const paymentMutation = useMutation({
    mutationFn: ({ billId, payload }) => api.put(`/bills/${billId}/payment`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["bills"]);
      queryClient.invalidateQueries(["dashboard-stats"]);
      toast.success("Payment recorded successfully!");
      setPaymentBill(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to record payment");
    },
  });

  const downloadBillPdf = async (bill) => {
    try {
      toast.loading(`Generating PDF for #${bill.bill_no}...`, { id: `pdf-toast-${bill.id}` });
      const res = await api.get(`/bills/${bill.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Invoice_${bill.bill_no || bill.id}_Rs${Math.round(bill.total_amount || 0)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Invoice #${bill.bill_no} downloaded!`, { id: `pdf-toast-${bill.id}` });
    } catch (e) {
      toast.error("Failed to download PDF invoice", { id: `pdf-toast-${bill.id}` });
    }
  };

  const sendInvoiceWhatsApp = async (bill) => {
    setSendingBillId(bill.id);
    try {
      toast.loading(`Sending Bill #${bill.bill_no} via WhatsApp...`, { id: `wa-toast-${bill.id}` });
      const res = await api.post(`/bills/${bill.id}/send-whatsapp`);
      if (res.data?.success && res.data?.provider === "openwa") {
        toast.success(`Invoice #${bill.bill_no} sent to ${bill.customer_name} via OpenWA! 🚀`, { id: `wa-toast-${bill.id}` });
        return;
      }
      if (res.data?.whatsapp_url) {
        window.open(res.data.whatsapp_url, "_blank");
        toast.success(`WhatsApp opened for #${bill.bill_no}!`, { id: `wa-toast-${bill.id}` });
        return;
      }
      toast.success(`Invoice #${bill.bill_no} dispatched!`, { id: `wa-toast-${bill.id}` });
    } catch (e) {
      const msg = `🧾 *INVOICE: #${bill.bill_no}*\n👤 *Customer:* ${bill.customer_name}\n📅 *Date:* ${bill.bill_date}\n💰 *Total:* ₹${bill.total_amount}\n✅ *Paid:* ₹${bill.amount_paid}\n⏳ *Balance:* ₹${bill.balance_due}`;
      const cleanPhone = (bill.customer_phone || "").replace(/[^0-9]/g, "");
      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, "_blank");
      toast.dismiss(`wa-toast-${bill.id}`);
    } finally {
      setSendingBillId(null);
    }
  };

  const buildEmptyRows = (productList) =>
    productList.map((p) => ({ product_id: p.id, name: p.name, unit: p.unit, rate: 0, rate_type: "none", quantity: "" }));

  const fetchAllRates = async (productList, customerId) => {
    setRatesLoading(true);
    const rows = await Promise.all(
      productList.map(async (p) => {
        try {
          const custParam = customerId ? `&customer_id=${customerId}` : "";
          const res = await api.get(`/rates/effective?product_id=${p.id}${custParam}`);
          return { product_id: p.id, name: p.name, unit: p.unit, rate: res.data.rate ?? 0, rate_type: res.data.rate_type ?? "none", quantity: "" };
        } catch {
          return { product_id: p.id, name: p.name, unit: p.unit, rate: 0, rate_type: "none", quantity: "" };
        }
      })
    );
    setRatesLoading(false);
    return rows;
  };

  const openManualModal = async () => {
    const rows = buildEmptyRows(products);
    setProductRows(rows);
    setBillMeta({ customer_id: "", bill_date: new Date().toISOString().split("T")[0], amount_paid: "", payment_method: "Cash" });
    setIsManualModalOpen(true);
  };

  const openEditBillModal = (bill) => {
    setEditingBill(bill);
    setEditBillMeta({
      customer_id: String(bill.customer_id ?? ""),
      bill_date: bill.bill_date || new Date().toISOString().split("T")[0],
      payment_method: bill.payment_method || "Cash",
    });
    setEditProductRows(
      (bill.items || []).map((item) => ({
        product_id: item.product_id ?? "",
        name: item.product_name || "Custom Item",
        unit: item.unit || "kg",
        rate: String(item.rate ?? 0),
        quantity: String(item.quantity ?? 0),
        tag: item.tag || null,
        circled_value: item.circled_value || null,
        confidence: item.confidence ?? 1,
        raw_text: item.raw_text || null,
      }))
    );
    setIsEditBillModalOpen(true);
  };

  const handleCustomerChange = async (newCustomerId) => {
    setBillMeta((m) => ({ ...m, customer_id: newCustomerId }));
    if (!newCustomerId || products.length === 0) return;
    const rows = await fetchAllRates(products, newCustomerId);
    setProductRows((prev) => rows.map((r, i) => ({ ...r, quantity: prev[i]?.quantity ?? "" })));
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!billMeta.customer_id) { toast.error("Please select a customer"); return; }
    const validItems = productRows.filter((r) => parseFloat(r.quantity) > 0);
    if (validItems.length === 0) { toast.error("Enter quantity for at least one product"); return; }
    createMutation.mutate({
      customer_id: parseInt(billMeta.customer_id),
      bill_date: billMeta.bill_date,
      amount_paid: parseFloat(billMeta.amount_paid || 0),
      payment_method: billMeta.payment_method || "Cash",
      items: validItems.map((r) => ({
        product_id: r.product_id,
        quantity: parseFloat(r.quantity),
        rate: parseFloat(r.rate || 0),
        amount: parseFloat(r.quantity) * parseFloat(r.rate || 0),
      })),
      source: "manual",
    });
  };

  const handleEditBillSubmit = (e) => {
    e.preventDefault();
    if (!editingBill) return;
    if (!editBillMeta.customer_id) { toast.error("Please select a customer"); return; }
    const validItems = editProductRows.filter((row) => parseFloat(row.quantity) > 0);
    if (validItems.length === 0) { toast.error("Enter quantity for at least one product"); return; }

    updateBillMutation.mutate({
      billId: editingBill.id,
      payload: {
        customer_id: parseInt(editBillMeta.customer_id),
        bill_date: editBillMeta.bill_date,
        payment_method: editBillMeta.payment_method || "Cash",
        items: validItems.map((row) => ({
          product_id: row.product_id ? Number(row.product_id) : null,
          quantity: parseFloat(row.quantity),
          rate: parseFloat(row.rate || 0),
          amount: parseFloat(row.quantity) * parseFloat(row.rate || 0),
          tag: row.tag || null,
          circled_value: row.circled_value || null,
          confidence: row.confidence ?? 1.0,
          raw_text: row.raw_text || null,
        })),
      },
    });
  };

  const billTotal = productRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0), 0);
  const billBalance = Math.max(0, billTotal - (parseFloat(billMeta.amount_paid) || 0));
  const editBillTotal = editProductRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0), 0);

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    if (!paymentBill) return;
    const amt = parseFloat(paymentForm.installment_amount || 0);
    const remaining = paymentBill.balance_due;
    if (amt <= 0) {
      toast.error("Please enter an amount greater than zero");
      return;
    }
    if (amt > remaining + 0.001) {
      toast.error(`Cannot pay ₹${amt.toFixed(2)} — remaining balance is only ₹${remaining.toFixed(2)}`);
      return;
    }
    paymentMutation.mutate({
      billId: paymentBill.id,
      payload: {
        installment_amount: amt,
        payment_method: paymentForm.payment_method,
        note: paymentForm.note || null,
      },
    });
  };

  const filteredBills = bills.filter((b) => {
    if (selectedStatus && b.payment_status !== selectedStatus) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      b.customer_name?.toLowerCase().includes(q) ||
      b.bill_no?.toLowerCase().includes(q)
    );
  });

  const openPaymentModal = (bill) => {
    setPaymentBill(bill);
    setPaymentForm({
      installment_amount: "",
      payment_method: bill.payment_method || "Cash",
      note: "",
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-emerald-400" />
            Bills & Payment Manager
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage customer bills, track payments (Full / Partial / Pending), & record Cash / UPI collections
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="btn-secondary inline-flex items-center justify-center gap-2 text-emerald-400 border-emerald-500/30 hover:bg-emerald-950/40 shadow-md"
            title="Send WhatsApp Invoices to customers"
          >
            <Send className="w-4 h-4" />
            WhatsApp Send
          </button>
          <button
            onClick={openManualModal}
            className="btn-primary inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            Create Bill Manually
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-3.5 sm:p-4 flex flex-wrap items-center gap-2.5 sm:gap-3">
        <div className="relative flex-1 min-w-[180px] w-full sm:w-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search customer or bill no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-xs w-full"
          />
        </div>

        <select
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
          className="input-field text-xs w-full sm:w-auto sm:min-w-[150px]"
        >
          <option value="">All Customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="input-field text-xs w-full sm:w-auto sm:min-w-[140px]"
        >
          <option value="">All Payment Status</option>
          <option value="paid">🟢 Complete Paid</option>
          <option value="partial">🟡 Partial Paid</option>
          <option value="unpaid">🔴 Unpaid</option>
        </select>

        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          className="input-field text-xs w-full sm:w-auto sm:min-w-[130px]"
        >
          <option value="">All Sources</option>
          <option value="bill_ai">Single Bill AI</option>
          <option value="manual">Manual Entry</option>
        </select>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input-field text-xs flex-1 sm:w-auto"
            placeholder="From"
          />
          <span className="text-zinc-600 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-field text-xs flex-1 sm:w-auto"
            placeholder="To"
          />
        </div>

        {(selectedCustomerId || selectedStatus || selectedSource || startDate || endDate || search) && (
          <button
            onClick={() => {
              setSelectedCustomerId("");
              setSelectedStatus("");
              setSelectedSource("");
              setStartDate("");
              setEndDate("");
              setSearch("");
            }}
            className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 w-full sm:w-auto text-center"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Bills Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="p-16 text-center text-zinc-500 text-sm">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-40 text-zinc-600" />
            No customer bills found matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[720px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 font-semibold uppercase">
                  <th className="py-3 px-3">Bill No / Date</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3 text-center">Payment Method</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 px-3 text-right">Paid Amount</th>
                  <th className="py-3 px-3 text-right">Balance Due</th>
                  <th className="py-3 px-3 text-center">Payment Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {filteredBills.map((b) => {
                  const isPaid = b.payment_status === "paid";
                  const isPartial = b.payment_status === "partial";

                  return (
                    <tr key={b.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-mono text-xs font-semibold text-zinc-200">{b.bill_no}</div>
                        <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(b.bill_date)}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-zinc-100">{b.customer_name}</div>
                        {b.customer_phone && (
                          <div className="text-[11px] text-zinc-500 font-mono">{b.customer_phone}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {b.payment_method === "UPI" ? <QrCode className="w-3 h-3 text-purple-400" /> : <Banknote className="w-3 h-3 text-emerald-400" />}
                          {b.payment_method || "Cash"}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-zinc-200">
                        {formatCurrency(b.total_amount)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-emerald-400">
                        {formatCurrency(b.amount_paid)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-amber-400">
                        {formatCurrency(b.balance_due)}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            isPaid
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : isPartial
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {isPaid ? <CheckCircle2 className="w-3 h-3" /> : isPartial ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {isPaid ? "Paid" : isPartial ? `Partial` : "Unpaid"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid && (
                            <button
                              onClick={() => openPaymentModal(b)}
                              className="btn-secondary text-xs py-1 px-2 flex items-center gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-950/30"
                              title="Record payment received"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => openEditBillModal(b)}
                            className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Edit Bill"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadBillPdf(b)}
                            className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Download PDF Invoice"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setViewingBill(b)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                            title="View Items"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete bill ${b.bill_no}?`)) {
                                deleteMutation.mutate(b.id);
                              }
                            }}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete Bill"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WhatsApp Send Modal */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">WhatsApp Invoice Sender</h3>
                  <p className="text-xs text-zinc-400">Send itemized PDF invoice directly to customer's WhatsApp</p>
                </div>
              </div>
              <button
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/60">
                <div className="px-3.5 py-2.5 bg-zinc-900/60 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400 font-semibold uppercase">
                  <span>Customer & Bill</span>
                  <span>WhatsApp Action</span>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/40 text-xs">
                  {filteredBills.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">No bills found in current filter.</div>
                  ) : (
                    filteredBills.map((b) => (
                      <div key={b.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-800/20">
                        <div>
                          <div className="font-semibold text-zinc-200 text-sm">{b.customer_name}</div>
                          <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                            <span>#{b.bill_no}</span>
                            <span>·</span>
                            <span className="font-mono text-zinc-400">{formatCurrency(b.total_amount)}</span>
                            <span>·</span>
                            {b.customer_phone ? (
                              <span className="text-emerald-400 font-mono font-medium">{b.customer_phone}</span>
                            ) : (
                              <span className="text-rose-400 italic">No phone saved</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <button
                            type="button"
                            disabled={sendingBillId === b.id}
                            onClick={() => sendInvoiceWhatsApp(b)}
                            className="btn-primary text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5 shadow-md shadow-emerald-950/40 disabled:opacity-50"
                          >
                            {sendingBillId === b.id ? (
                              <>
                                <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                Send WhatsApp
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-zinc-800 shrink-0 bg-zinc-900/90 flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                Sends complete itemized bill and generated PDF invoice to customer
              </span>
              <button
                type="button"
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="btn-secondary text-xs sm:text-sm px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentBill && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <Wallet className="w-5 h-5" />
                <h3 className="text-lg font-bold text-zinc-100">Record Bill Payment</h3>
              </div>
              <button
                onClick={() => setPaymentBill(null)}
                className="text-zinc-400 hover:text-zinc-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Customer:</span>
                  <span className="font-semibold text-zinc-200">{paymentBill.customer_name}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Bill No:</span>
                  <span className="font-mono text-zinc-200">{paymentBill.bill_no}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Total Amount:</span>
                  <span className="font-mono text-zinc-200">{formatCurrency(paymentBill.total_amount)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Already Paid:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{formatCurrency(paymentBill.amount_paid)}</span>
                </div>
                <div className="border-t border-zinc-800 pt-1.5 flex justify-between font-bold text-sm">
                  <span className="text-amber-400">Remaining Balance:</span>
                  <span className="font-mono text-amber-400">{formatCurrency(paymentBill.balance_due)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1.5">
                  Payment Amount (₹) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    min="1"
                    max={paymentBill.balance_due}
                    value={paymentForm.installment_amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, installment_amount: e.target.value })}
                    placeholder={`Max ₹${paymentBill.balance_due.toFixed(2)}`}
                    className="input-field w-full text-base font-mono font-bold text-emerald-400 pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, installment_amount: paymentBill.balance_due.toString() })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded hover:bg-emerald-900"
                  >
                    Pay Full
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Cash", "UPI"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentForm({ ...paymentForm, payment_method: m })}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        paymentForm.payment_method === m
                          ? "bg-emerald-950/60 border-emerald-500 text-emerald-400"
                          : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {m === "Cash" ? <Banknote className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1.5">
                  Note / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  placeholder="e.g. GPay ref #1234, cash received by shop"
                  className="input-field text-xs w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setPaymentBill(null)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentMutation.isLoading}
                  className="btn-primary text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5"
                >
                  <Wallet className="w-4 h-4" />
                  {paymentMutation.isLoading ? "Recording..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Bill Modal */}
      {viewingBill && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Bill Details #{viewingBill.bill_no}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Customer: {viewingBill.customer_name} · Date: {formatDate(viewingBill.bill_date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadBillPdf(viewingBill)}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-950/30"
                  title="Download PDF Invoice"
                >
                  <FileDown className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={() => setViewingBill(null)}
                  className="text-zinc-400 hover:text-zinc-100 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500 block">Total Amount</span>
                  <span className="text-base font-bold font-mono text-zinc-100 mt-1 block">{formatCurrency(viewingBill.total_amount)}</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500 block">Amount Paid</span>
                  <span className="text-base font-bold font-mono text-emerald-400 mt-1 block">{formatCurrency(viewingBill.amount_paid)}</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500 block">Balance Due</span>
                  <span className="text-base font-bold font-mono text-amber-400 mt-1 block">{formatCurrency(viewingBill.balance_due)}</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <span className="text-zinc-500 block">Payment Method</span>
                  <span className="text-base font-bold text-zinc-200 mt-1 block">{viewingBill.payment_method || "Cash"}</span>
                </div>
              </div>

              <div className="border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800 uppercase">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Quantity</th>
                      <th className="p-3 text-right">Rate</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {viewingBill.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-800/20">
                        <td className="p-3 font-medium text-zinc-200">{item.product_name || "Custom Item"}</td>
                        <td className="p-3 text-right font-mono">{item.quantity} {item.unit || "kg"}</td>
                        <td className="p-3 text-right font-mono">₹{item.rate}</td>
                        <td className="p-3 text-right font-mono font-semibold text-zinc-100">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {viewingBill.payment_history?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase">Payment Collection History</h4>
                  <div className="border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800/60 text-xs">
                    {viewingBill.payment_history.map((inst) => (
                      <div key={inst.id} className="p-3 flex items-center justify-between bg-zinc-950/40">
                        <div>
                          <span className="font-semibold text-zinc-200 font-mono">₹{inst.amount.toFixed(2)}</span>
                          <span className="text-zinc-500 ml-2">via {inst.payment_method}</span>
                          {inst.note && <span className="text-zinc-400 italic ml-2">({inst.note})</span>}
                        </div>
                        <span className="text-zinc-500">{inst.paid_at ? formatDate(inst.paid_at) : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 text-right">
              <button
                onClick={() => setViewingBill(null)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Bill Creation Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[96vh] sm:max-h-[90vh]">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-zinc-100">Create Bill Manually</h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 flex-1 overflow-y-auto flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                      Customer *
                    </label>
                    <select
                      required
                      value={billMeta.customer_id}
                      onChange={(e) => handleCustomerChange(e.target.value)}
                      className="input-field text-xs sm:text-sm w-full"
                    >
                      <option value="">Select Customer...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                      Bill Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={billMeta.bill_date}
                      onChange={(e) => setBillMeta({ ...billMeta, bill_date: e.target.value })}
                      className="input-field text-xs sm:text-sm w-full"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase">
                      Enter Quantities & Rates
                    </label>
                    {ratesLoading && <span className="text-xs text-zinc-500">Loading rates...</span>}
                  </div>

                  <div className="border border-zinc-800 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[500px]">
                      <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800">
                        <tr>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5 text-right w-24">Rate (₹)</th>
                          <th className="p-2.5 text-right w-28">Quantity</th>
                          <th className="p-2.5 text-right w-24">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {productRows.map((row, idx) => {
                          const amt = (parseFloat(row.quantity) || 0) * (parseFloat(row.rate) || 0);
                          return (
                            <tr key={row.product_id} className="hover:bg-zinc-800/20">
                              <td className="p-2.5 font-medium text-zinc-200">
                                {row.name}
                                <span className="text-zinc-500 ml-1">({row.unit || "kg"})</span>
                              </td>
                              <td className="p-2.5 text-right">
                                <input
                                  type="number"
                                  step="any"
                                  value={row.rate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setProductRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, rate: val } : r))
                                    );
                                  }}
                                  className="input-field text-xs text-right py-1 px-2 w-20"
                                />
                              </td>
                              <td className="p-2.5 text-right">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder="0"
                                  value={row.quantity}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setProductRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r))
                                    );
                                  }}
                                  className="input-field text-xs text-right py-1 px-2 w-20 font-bold"
                                />
                              </td>
                              <td className="p-2.5 text-right font-mono font-semibold text-zinc-100">
                                {amt > 0 ? formatCurrency(amt) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-zinc-300">Total Amount:</span>
                    <span className="font-mono text-emerald-400 text-base">{formatCurrency(billTotal)}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800 text-xs">
                    <div>
                      <label className="block font-semibold text-zinc-400 uppercase mb-1">
                        Amount Paid Now
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={billTotal}
                        value={billMeta.amount_paid}
                        onChange={(e) => setBillMeta({ ...billMeta, amount_paid: e.target.value })}
                        placeholder="₹0.00"
                        className="input-field text-xs w-full font-mono text-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-zinc-400 uppercase mb-1">
                        Payment Method
                      </label>
                      <select
                        value={billMeta.payment_method}
                        onChange={(e) => setBillMeta({ ...billMeta, payment_method: e.target.value })}
                        className="input-field text-xs w-full"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-semibold pt-1 border-t border-zinc-800/60">
                    <span className="text-zinc-400">Remaining Balance:</span>
                    <span className="font-mono text-amber-400">{formatCurrency(billBalance)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="btn-secondary text-xs sm:text-sm px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isLoading || billTotal === 0}
                  className="btn-primary text-xs sm:text-sm px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
                >
                  {createMutation.isLoading ? "Saving..." : "Save Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bill Modal */}
      {isEditBillModalOpen && editingBill && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[96vh] sm:max-h-[90vh]">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <PenSquare className="w-5 h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-zinc-100">Edit Bill #{editingBill.bill_no}</h3>
              </div>
              <button
                onClick={() => setIsEditBillModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditBillSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 flex-1 overflow-y-auto flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                      Customer *
                    </label>
                    <select
                      required
                      value={editBillMeta.customer_id}
                      onChange={(e) => setEditBillMeta({ ...editBillMeta, customer_id: e.target.value })}
                      className="input-field text-xs sm:text-sm w-full"
                    >
                      <option value="">Select Customer...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                      Bill Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={editBillMeta.bill_date}
                      onChange={(e) => setEditBillMeta({ ...editBillMeta, bill_date: e.target.value })}
                      className="input-field text-xs sm:text-sm w-full"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase">
                      Edit Items
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const fallbackProduct = products[0];
                        setEditProductRows((prev) => [
                          ...prev,
                          {
                            product_id: fallbackProduct?.id ?? "",
                            name: fallbackProduct?.name || "Custom Item",
                            unit: fallbackProduct?.unit || "kg",
                            rate: String(fallbackProduct?.rate ?? 0),
                            quantity: "0",
                            tag: null,
                            circled_value: null,
                            confidence: 1,
                            raw_text: null,
                          },
                        ]);
                      }}
                      className="btn-secondary text-[11px] px-2 py-1 text-amber-400 border-amber-500/30 hover:bg-amber-950/30"
                    >
                      + Add Item
                    </button>
                  </div>

                  <div className="border border-zinc-800 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[500px]">
                      <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800">
                        <tr>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5 text-right w-24">Rate (₹)</th>
                          <th className="p-2.5 text-right w-28">Quantity</th>
                          <th className="p-2.5 text-right w-24">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {editProductRows.map((row, idx) => {
                          const amt = (parseFloat(row.quantity) || 0) * (parseFloat(row.rate) || 0);
                          return (
                            <tr key={`${row.product_id || "custom"}-${idx}`} className="hover:bg-zinc-800/20">
                              <td className="p-2.5 font-medium text-zinc-200">
                                <select
                                  value={row.product_id}
                                  onChange={(e) => {
                                    const selected = products.find((p) => String(p.id) === e.target.value);
                                    setEditProductRows((prev) => prev.map((item, i) =>
                                      i === idx
                                        ? {
                                            ...item,
                                            product_id: selected ? selected.id : "",
                                            name: selected ? selected.name : item.name,
                                            unit: selected ? selected.unit : item.unit,
                                            rate: String(item.rate || 0),
                                          }
                                        : item
                                    ));
                                  }}
                                  className="input-field text-xs w-full"
                                >
                                  <option value="">Custom Item</option>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2.5 text-right">
                                <input
                                  type="number"
                                  step="any"
                                  value={row.rate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditProductRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, rate: val } : r))
                                    );
                                  }}
                                  className="input-field text-xs text-right py-1 px-2 w-20"
                                />
                              </td>
                              <td className="p-2.5 text-right">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  placeholder="0"
                                  value={row.quantity}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditProductRows((prev) =>
                                      prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r))
                                    );
                                  }}
                                  className="input-field text-xs text-right py-1 px-2 w-20 font-bold"
                                />
                              </td>
                              <td className="p-2.5 text-right font-mono font-semibold text-zinc-100">
                                {amt > 0 ? formatCurrency(amt) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-zinc-300">Total Amount:</span>
                    <span className="font-mono text-amber-400 text-base">{formatCurrency(editBillTotal)}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800 text-xs">
                    <div>
                      <label className="block font-semibold text-zinc-400 uppercase mb-1">
                        Payment Method
                      </label>
                      <select
                        value={editBillMeta.payment_method}
                        onChange={(e) => setEditBillMeta({ ...editBillMeta, payment_method: e.target.value })}
                        className="input-field text-xs w-full"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditBillModalOpen(false)}
                  className="btn-secondary text-xs sm:text-sm px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateBillMutation.isLoading || editBillTotal === 0}
                  className="btn-primary text-xs sm:text-sm px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40"
                >
                  {updateBillMutation.isLoading ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
