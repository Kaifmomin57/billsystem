import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Plus, Search, Calendar, Trash2, Eye,
  X, Wallet, CheckCircle2, Clock, AlertCircle, QrCode, Banknote,
  FileDown, Send, Pencil, PenSquare, SlidersHorizontal, ChevronDown, ChevronUp, Printer
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatCurrency, formatDate } from "../lib/utils";
import { printerService } from "../printer/printerService";

export default function BillsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isThermalPrinting, setIsThermalPrinting] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(""); // "" | "due" | "paid" | "partial" | "unpaid"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
    staleTime: 5 * 60_000,  // customers rarely change — 5min cache
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => (await api.get("/products?is_active=true")).data,
    staleTime: 5 * 60_000,  // products rarely change — 5min cache
  });

  // Fetch Bills with filters (cached for 60s)
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
    staleTime: 60_000,
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Bill deleted successfully");
    },
  });

  // Create Bill Mutation
  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/bills", payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Bill created! Printing receipt...");
      setIsManualModalOpen(false);
      // Auto-print thermal receipt after bill creation
      if (res?.data) {
        handleThermalPrint(res.data);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to create bill");
    },
  });

  // Update Bill Mutation
  const updateBillMutation = useMutation({
    mutationFn: ({ billId, payload }) => api.put(`/bills/${billId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Payment recorded successfully!");
      setPaymentBill(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to record payment");
    },
  });

  const downloadBillPdf = async (bill) => {
    let url = null;
    try {
      toast.loading(`Generating PDF for #${bill.bill_no}...`, { id: `pdf-toast-${bill.id}` });
      const res = await api.get(`/bills/${bill.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Invoice_${bill.bill_no || bill.id}_Rs${Math.round(bill.total_amount || 0)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Invoice #${bill.bill_no} downloaded!`, { id: `pdf-toast-${bill.id}` });
    } catch {
      toast.error("Failed to download PDF invoice", { id: `pdf-toast-${bill.id}` });
    } finally {
      if (url) {
        window.URL.revokeObjectURL(url);
      }
    }
  };

  const sendInvoiceWhatsApp = async (bill) => {
    setSendingBillId(bill.id);
    try {
      toast.loading(`Sending Bill #${bill.bill_no} via WhatsApp...`, { id: `wa-toast-${bill.id}` });
      const res = await api.post(`/bills/${bill.id}/send-whatsapp`);
      if (res.data?.success && res.data?.provider === "openwa") {
        toast.success(`Invoice #${bill.bill_no} sent to ${bill.customer_name}!`, { id: `wa-toast-${bill.id}` });
        return;
      }
      if (res.data?.whatsapp_url) {
        window.open(res.data.whatsapp_url, "_blank");
        toast.success(`WhatsApp opened for #${bill.bill_no}!`, { id: `wa-toast-${bill.id}` });
        return;
      }
      toast.success(`Invoice #${bill.bill_no} dispatched!`, { id: `wa-toast-${bill.id}` });
    } catch {
      const msg = `🧾 *INVOICE: #${bill.bill_no}*\n👤 *Customer:* ${bill.customer_name}\n📅 *Date:* ${bill.bill_date}\n💰 *Total:* ₹${bill.total_amount}\n✅ *Paid:* ₹${bill.amount_paid}\n⏳ *Balance:* ₹${bill.balance_due}`;
      const cleanPhone = (bill.customer_phone || "").replace(/[^0-9]/g, "");
      const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, "_blank");
      toast.dismiss(`wa-toast-${bill.id}`);
    } finally {
      setSendingBillId(null);
    }
  };

  const handleThermalPrint = async (bill) => {
    setIsThermalPrinting(true);
    try {
      toast.loading(`Printing #${bill.bill_no} on VYPRTP3001...`, { id: `thermal-toast-${bill.id}` });
      const billData = {
        printer: "VYPRTP3001",
        paperWidth: 80,
        bill: {
          shopName: "KADRI FISH CENTER",
          invoiceNumber: bill.bill_no || `INV-${bill.id}`,
          date: bill.bill_date,
          customer: {
            name: bill.customer_name || "Customer",
            phone: bill.customer_phone || "",
            address: bill.customer_address || "",
          },
          items: (bill.items || []).map((it) => ({
            name: it.product_name || "Item",
            quantity: Number(it.quantity || 1),
            rate: Number(it.rate || 0),
            amount: Number(it.amount || (Number(it.quantity || 1) * Number(it.rate || 0))),
          })),
          subtotal: Number(bill.total_amount || 0),
          discount: 0,
          gst: 0,
          total: Number(bill.total_amount || 0),
          previousBalance: Number(bill.previous_balance || 0),
          totalDueWithCarryForward: Number(bill.total_due_with_carry_forward || (Number(bill.balance_due || 0) + Number(bill.previous_balance || 0))),
          amountPaid: Number(bill.amount_paid || 0),
          balanceDue: Number(bill.balance_due || 0),
          paymentStatus: bill.payment_status || "unpaid",
          paymentMethod: bill.payment_method || "Cash",
          previous_bills: bill.previous_bills || [],
          payment_history: bill.payment_history || [],
          footerMessage: "Thank You!\nVisit Again :)",
        },
      };

      await printerService.printBill(billData, 48);
      toast.success(`Receipt for #${bill.bill_no} printed successfully!`, { id: `thermal-toast-${bill.id}` });
    } catch (err) {
      console.error("Thermal print failed:", err);
      toast.error(err.message || "Failed to print to VYPRTP3001", { id: `thermal-toast-${bill.id}`, duration: 5000 });
    } finally {
      setIsThermalPrinting(false);
    }
  };

  const buildEmptyRows = (productList) =>
    productList.map((p) => ({ product_id: p.id, name: p.name, unit: p.unit, rate: 0, rate_type: "none", quantity: "" }));

  const fetchAllRates = async (productList, customerId) => {
    setRatesLoading(true);
    try {
      const custParam = customerId ? `?customer_id=${customerId}` : "";
      const res = await api.get(`/rates/effective-batch${custParam}`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn("Batch rates fetch error, falling back to empty rows:", err);
    } finally {
      setRatesLoading(false);
    }
    return buildEmptyRows(productList);
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

  const billTotal = useMemo(
    () => productRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0), 0),
    [productRows]
  );
  const billBalance = useMemo(
    () => Math.max(0, billTotal - (parseFloat(billMeta.amount_paid) || 0)),
    [billTotal, billMeta.amount_paid]
  );
  const editBillTotal = useMemo(
    () => editProductRows.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0), 0),
    [editProductRows]
  );

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

  // Status counts for pills (memoized)
  const paidCount = useMemo(() => bills.filter((b) => b.payment_status === "paid").length, [bills]);
  const dueCount = useMemo(
    () => bills.filter((b) => b.payment_status === "unpaid" || b.payment_status === "partial").length,
    [bills]
  );

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (selectedStatus === "paid" && b.payment_status !== "paid") return false;
      if (selectedStatus === "due" && b.payment_status === "paid") return false;
      if (selectedStatus === "partial" && b.payment_status !== "partial") return false;
      if (selectedStatus === "unpaid" && b.payment_status !== "unpaid") return false;

      const q = search.toLowerCase();
      return (
        !q ||
        b.customer_name?.toLowerCase().includes(q) ||
        b.bill_no?.toLowerCase().includes(q)
      );
    });
  }, [bills, selectedStatus, search]);

  // Client-side pagination (drastically improves initial rendering speed)
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, selectedStatus, selectedCustomerId, selectedSource, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / PAGE_SIZE));
  const paginatedBills = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredBills.slice(start, start + PAGE_SIZE);
  }, [filteredBills, page]);

  const openPaymentModal = (bill) => {
    setPaymentBill(bill);
    setPaymentForm({
      installment_amount: "",
      payment_method: bill.payment_method || "Cash",
      note: "",
    });
  };

  const hasAdvancedFilters = selectedCustomerId || selectedSource || startDate || endDate;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
            Bills & Invoices
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            {bills.length} total bills · {dueCount} pending balance payment
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="btn-secondary text-xs sm:text-sm flex items-center gap-1.5"
          >
            <Send className="w-4 h-4 text-emerald-400" />
            <span>WhatsApp Dispatch</span>
          </button>
          <button
            onClick={openManualModal}
            className="btn-primary text-xs sm:text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Bill</span>
          </button>
        </div>
      </div>

      {/* Simplified, High-Clarity Filter Bar */}
      <div className="card p-3 sm:p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented Quick Status Switcher */}
          <div className="segmented-nav">
            <button
              onClick={() => setSelectedStatus("")}
              className={`segmented-item ${selectedStatus === "" ? "active" : ""}`}
            >
              All Bills ({bills.length})
            </button>
            <button
              onClick={() => setSelectedStatus("due")}
              className={`segmented-item ${selectedStatus === "due" ? "active" : ""}`}
            >
              Pending Due ({dueCount})
            </button>
            <button
              onClick={() => setSelectedStatus("paid")}
              className={`segmented-item ${selectedStatus === "paid" ? "active" : ""}`}
            >
              Paid in Full ({paidCount})
            </button>
          </div>

          {/* Search & More Filters Toggle */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search customer or bill #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9 text-xs sm:text-sm"
              />
            </div>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`btn-secondary text-xs sm:text-sm px-3 flex items-center gap-1.5 ${hasAdvancedFilters ? "border-emerald-500/40 text-emerald-400" : ""
                }`}
              title="More filter options"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {hasAdvancedFilters && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs animate-slide-in">
            <div>
              <label className="label">Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="input-field text-xs"
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Creation Source</label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="input-field text-xs"
              >
                <option value="">All Sources</option>
                <option value="ledger_ai">Ledger AI</option>
                <option value="manual">Manual Entry</option>
                <option value="bill_ai">Single Bill AI</option>
              </select>
            </div>
            <div>
              <label className="label">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field text-xs"
              />
            </div>
            <div>
              <label className="label">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field text-xs"
              />
            </div>
            {hasAdvancedFilters && (
              <div className="sm:col-span-4 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedCustomerId("");
                    setSelectedSource("");
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bills Content */}
      {isLoading ? (
        <div className="card p-16 flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="card p-16 text-center text-zinc-500 text-sm">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30 text-zinc-600" />
          No customer bills found matching your filter criteria.
        </div>
      ) : (
        <>
          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bill # & Date</th>
                    <th>Customer</th>
                    <th>Payment Mode</th>
                    <th className="text-right">Total Amount</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Balance Due</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBills.map((b) => {
                    const isPaid = b.payment_status === "paid";
                    const isPartial = b.payment_status === "partial";

                    return (
                      <tr key={b.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-zinc-200">{b.bill_no}</span>
                            {b.source === "ledger_ai" && (
                              <span className="badge-green text-[10px]">AI</span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {formatDate(b.bill_date)}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium text-zinc-100">{b.customer_name}</div>
                          {b.customer_phone && (
                            <div className="text-xs text-zinc-500 font-mono">{b.customer_phone}</div>
                          )}
                        </td>
                        <td>
                          <span className="badge-zinc">
                            {b.payment_method === "UPI" ? <QrCode className="w-3 h-3 text-purple-400" /> : <Banknote className="w-3 h-3 text-emerald-400" />}
                            {b.payment_method || "Cash"}
                          </span>
                        </td>
                        <td className="text-right font-mono font-medium text-zinc-200">
                          {formatCurrency(b.total_amount)}
                        </td>
                        <td className="text-right font-mono text-zinc-400">
                          {formatCurrency(b.amount_paid)}
                        </td>
                        <td className="text-right font-mono font-bold">
                          {b.balance_due > 0 ? (
                            <span className="text-amber-400">{formatCurrency(b.balance_due)}</span>
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
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isPaid && (
                              <button
                                onClick={() => openPaymentModal(b)}
                                className="btn-primary btn-sm !py-1 !px-2.5 text-xs mr-1"
                                title="Record payment"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                <span>Pay</span>
                              </button>
                            )}
                            <button
                              onClick={() => sendInvoiceWhatsApp(b)}
                              className="btn-ghost btn-sm !px-1.5 text-emerald-400 hover:text-emerald-300"
                              title="Send WhatsApp"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => downloadBillPdf(b)}
                              className="btn-ghost btn-sm !px-1.5"
                              title="Download PDF"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleThermalPrint(b)}
                              disabled={isThermalPrinting}
                              className="btn-ghost btn-sm !px-1.5 text-zinc-300 hover:text-emerald-400"
                              title="Print to VYPRTP3001 (Thermal 80mm)"
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-400" />
                            </button>
                            <button
                              onClick={() => setViewingBill(b)}
                              className="btn-ghost btn-sm !px-1.5"
                              title="View Items"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditBillModal(b)}
                              className="btn-ghost btn-sm !px-1.5 hover:text-amber-400"
                              title="Edit Bill"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete bill ${b.bill_no}?`)) {
                                  deleteMutation.mutate(b.id);
                                }
                              }}
                              className="btn-ghost btn-sm !px-1.5 hover:text-rose-400 hover:bg-rose-500/10"
                              title="Delete Bill"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< md) - Spacious, Distinct Cards with generous gaps */}
          <div className="block md:hidden flex flex-col gap-4">
            {paginatedBills.map((b) => {
              const isPaid = b.payment_status === "paid";
              const isPartial = b.payment_status === "partial";

              return (
                <div
                  key={b.id}
                  className="card p-4 sm:p-5 flex flex-col gap-3.5 border border-zinc-800/90 bg-zinc-900/90 shadow-sm hover:border-zinc-700/80 transition-all rounded-xl"
                >
                  {/* Top Header: Bill #, AI indicator, Date, Status */}
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800/70">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-zinc-100 tracking-tight">#{b.bill_no}</span>
                      {b.source === "ledger_ai" && (
                        <span className="badge-green text-[10px] px-1.5 py-0.5 font-semibold">AI</span>
                      )}
                      <span className="text-xs text-zinc-400">· {formatDate(b.bill_date)}</span>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${isPaid
                          ? "badge-green"
                          : isPartial
                            ? "badge-yellow"
                            : "badge-red"
                        }`}
                    >
                      {isPaid ? "Paid" : isPartial ? "Partial" : "Unpaid"}
                    </span>
                  </div>

                  {/* Customer Information & Payment Mode */}
                  <div className="flex items-start justify-between gap-3 pt-0.5">
                    <div className="space-y-1">
                      <div className="font-semibold text-zinc-100 text-base leading-snug">{b.customer_name}</div>
                      {b.customer_phone ? (
                        <a
                          href={`tel:${b.customer_phone}`}
                          className="text-xs text-emerald-400/90 hover:text-emerald-300 font-mono inline-block hover:underline"
                        >
                          {b.customer_phone}
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-500 italic block">No phone number</span>
                      )}
                    </div>
                    <span className="badge-zinc text-xs px-2.5 py-1 shrink-0 flex items-center gap-1.5">
                      {b.payment_method === "UPI" ? (
                        <QrCode className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{b.payment_method || "Cash"}</span>
                    </span>
                  </div>

                  {/* Financial Metrics Strip */}
                  <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs">
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block">
                        Total
                      </span>
                      <span className="font-mono text-sm font-bold text-zinc-100 block">
                        {formatCurrency(b.total_amount)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block">
                        Paid
                      </span>
                      <span className="font-mono text-sm font-semibold text-zinc-300 block">
                        {formatCurrency(b.amount_paid)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider block">
                        Balance
                      </span>
                      <span
                        className={`font-mono text-sm font-bold block ${b.balance_due > 0 ? "text-amber-400" : "text-zinc-500"
                          }`}
                      >
                        {b.balance_due > 0 ? formatCurrency(b.balance_due) : "₹0"}
                      </span>
                    </div>
                  </div>

                  {/* Touch Action Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/70 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isPaid && (
                        <button
                          onClick={() => openPaymentModal(b)}
                          className="btn-primary btn-sm !py-2 !px-3.5 text-xs flex items-center gap-1.5 font-semibold shadow-sm"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>Pay</span>
                        </button>
                      )}
                      <button
                        onClick={() => sendInvoiceWhatsApp(b)}
                        className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 active:scale-95 transition-all"
                        title="Send WhatsApp"
                        aria-label="Send WhatsApp"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => downloadBillPdf(b)}
                        className="p-2.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 active:scale-95 transition-all"
                        title="Download PDF"
                        aria-label="Download PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleThermalPrint(b)}
                        disabled={isThermalPrinting}
                        className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 active:scale-95 transition-all"
                        title="Thermal Print 80mm"
                        aria-label="Thermal Print 80mm"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewingBill(b)}
                        className="p-2.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 active:scale-95 transition-all"
                        title="View Items"
                        aria-label="View Items"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditBillModal(b)}
                        className="p-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-amber-400 hover:bg-zinc-700 active:scale-95 transition-all"
                        title="Edit Bill"
                        aria-label="Edit Bill"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete bill ${b.bill_no}?`)) {
                            deleteMutation.mutate(b.id);
                          }
                        }}
                        className="p-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/15 active:scale-95 transition-all"
                        title="Delete Bill"
                        aria-label="Delete Bill"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {filteredBills.length > PAGE_SIZE && (
            <div className="card p-3 sm:p-4 flex items-center justify-between text-xs text-zinc-400">
              <div>
                Showing <span className="font-semibold text-zinc-200">{(page - 1) * PAGE_SIZE + 1}</span> to{" "}
                <span className="font-semibold text-zinc-200">{Math.min(page * PAGE_SIZE, filteredBills.length)}</span> of{" "}
                <span className="font-semibold text-zinc-200">{filteredBills.length}</span> bills
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary btn-sm px-3 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="font-mono text-zinc-300 px-2 font-medium">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary btn-sm px-3 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── WHATSAPP SEND MODAL ─────────────────────────────────────── */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="card w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">WhatsApp Invoices</h3>
                  <p className="text-xs text-zinc-400">Dispatch itemized invoices directly to customer WhatsApp</p>
                </div>
              </div>
              <button
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
              <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/60 divide-y divide-zinc-800/50">
                {filteredBills.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 text-xs">No bills in current selection.</div>
                ) : (
                  filteredBills.map((b) => (
                    <div key={b.id} className="p-3 flex items-center justify-between gap-3 hover:bg-zinc-800/40">
                      <div>
                        <div className="font-medium text-zinc-200 text-sm">{b.customer_name}</div>
                        <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                          <span>#{b.bill_no}</span>
                          <span>·</span>
                          <span className="font-mono text-zinc-300">{formatCurrency(b.total_amount)}</span>
                          <span>·</span>
                          {b.customer_phone ? (
                            <span className="text-emerald-400 font-mono">{b.customer_phone}</span>
                          ) : (
                            <span className="text-rose-400 italic">No phone saved</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={sendingBillId === b.id}
                        onClick={() => sendInvoiceWhatsApp(b)}
                        className="btn-primary btn-sm"
                      >
                        {sendingBillId === b.id ? "Sending..." : "Send WhatsApp"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RECORD PAYMENT MODAL ────────────────────────────────────── */}
      {paymentBill && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <Wallet className="w-5 h-5" />
                <h3 className="text-sm font-bold text-zinc-100">Record Bill Payment</h3>
              </div>
              <button
                onClick={() => setPaymentBill(null)}
                className="text-zinc-400 hover:text-zinc-100 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-5 flex flex-col gap-4">
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 flex flex-col gap-1.5 text-xs">
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
                <label className="label">
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
                    className="input-field text-sm font-mono font-bold text-emerald-400 pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, installment_amount: paymentBill.balance_due.toString() })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded hover:bg-emerald-500/25"
                  >
                    Pay Full
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Cash", "UPI"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentForm({ ...paymentForm, payment_method: m })}
                      className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${paymentForm.payment_method === m
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        }`}
                    >
                      {m === "Cash" ? <Banknote className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Note / Reference (Optional)</label>
                <input
                  type="text"
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  placeholder="e.g. GPay ref, shop cash counter"
                  className="input-field text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setPaymentBill(null)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentMutation.isPending}
                  className="btn-primary btn-sm flex items-center gap-1.5"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>{paymentMutation.isPending ? "Recording..." : "Save Payment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── VIEW BILL MODAL ─────────────────────────────────────────── */}
      {viewingBill && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="card w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-zinc-100">Bill Details #{viewingBill.bill_no}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{viewingBill.customer_name} · {formatDate(viewingBill.bill_date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleThermalPrint(viewingBill)}
                  disabled={isThermalPrinting}
                  className="btn-primary btn-sm text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                  title="Print to VYPRTP3001 (80mm Thermal Receipt)"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isThermalPrinting ? "Printing..." : "Thermal Print"}</span>
                </button>
                <button
                  onClick={() => downloadBillPdf(viewingBill)}
                  className="btn-secondary btn-sm text-xs flex items-center gap-1"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF</span>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400 block">Total</span>
                  <span className="text-sm font-bold font-mono text-zinc-100 mt-1 block">{formatCurrency(viewingBill.total_amount)}</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400 block">Paid</span>
                  <span className="text-sm font-bold font-mono text-emerald-400 mt-1 block">{formatCurrency(viewingBill.amount_paid)}</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400 block">Balance Due</span>
                  <span className="text-sm font-bold font-mono text-amber-400 mt-1 block">{formatCurrency(viewingBill.balance_due)}</span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400 block">Method</span>
                  <span className="text-sm font-bold text-zinc-200 mt-1 block">{viewingBill.payment_method || "Cash"}</span>
                </div>
              </div>

              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="text-right">Quantity</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingBill.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="font-medium text-zinc-200">
                          {item.product_name || "Custom Item"}
                          {(item.is_live || item.circled_value) && (
                            <span className="badge-green text-[10px] ml-2">⊚ Live</span>
                          )}
                        </td>
                        <td className="text-right font-mono">{item.quantity} {item.unit || "kg"}</td>
                        <td className="text-right font-mono">₹{item.rate}</td>
                        <td className="text-right font-mono font-semibold text-zinc-100">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {viewingBill.payment_history?.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase">Payment Collection History</h4>
                  <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800/60 text-xs">
                    {viewingBill.payment_history.map((inst) => (
                      <div key={inst.id} className="p-2.5 flex items-center justify-between bg-zinc-950">
                        <div>
                          <span className="font-semibold text-zinc-200 font-mono">₹{inst.amount.toFixed(2)}</span>
                          <span className="text-zinc-400 ml-2">via {inst.payment_method}</span>
                          {inst.note && <span className="text-zinc-400 italic ml-2">({inst.note})</span>}
                        </div>
                        <span className="text-zinc-400">{inst.paid_at ? formatDate(inst.paid_at) : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-zinc-800 text-right">
              <button
                onClick={() => setViewingBill(null)}
                className="btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MANUAL BILL CREATION MODAL ──────────────────────────────── */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="card w-full max-w-3xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
              <h3 className="text-sm font-bold text-zinc-100">Create New Bill</h3>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-5 flex-1 overflow-y-auto flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Customer *</label>
                    <select
                      required
                      value={billMeta.customer_id}
                      onChange={(e) => handleCustomerChange(e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="">Select Customer...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Bill Date *</label>
                    <input
                      type="date"
                      required
                      value={billMeta.bill_date}
                      onChange={(e) => setBillMeta({ ...billMeta, bill_date: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label mb-0">Products & Quantities</label>
                    {ratesLoading && <span className="text-xs text-zinc-500">Updating rates...</span>}
                  </div>

                  <div className="border border-zinc-800 rounded-lg overflow-x-auto">
                    <table className="data-table text-xs min-w-[480px]">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th className="text-right w-24">Rate (₹)</th>
                          <th className="text-right w-28">Quantity</th>
                          <th className="text-right w-24">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productRows.map((row, idx) => {
                          const amt = (parseFloat(row.quantity) || 0) * (parseFloat(row.rate) || 0);
                          return (
                            <tr key={row.product_id}>
                              <td className="font-medium text-zinc-200">
                                {row.name}
                                <span className="text-zinc-500 ml-1">({row.unit || "kg"})</span>
                              </td>
                              <td className="text-right">
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
                              <td className="text-right">
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
                              <td className="text-right font-mono font-semibold text-zinc-100">
                                {amt > 0 ? formatCurrency(amt) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-zinc-300">Total Amount:</span>
                    <span className="font-mono text-emerald-400 text-base">{formatCurrency(billTotal)}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800 text-xs">
                    <div>
                      <label className="label">Amount Paid Now</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max={billTotal}
                        value={billMeta.amount_paid}
                        onChange={(e) => setBillMeta({ ...billMeta, amount_paid: e.target.value })}
                        placeholder="₹0.00"
                        className="input-field font-mono text-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="label">Payment Method</label>
                      <select
                        value={billMeta.payment_method}
                        onChange={(e) => setBillMeta({ ...billMeta, payment_method: e.target.value })}
                        className="input-field"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-semibold pt-1 border-t border-zinc-800">
                    <span className="text-zinc-400">Remaining Balance:</span>
                    <span className="font-mono text-amber-400">{formatCurrency(billBalance)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || billTotal === 0}
                  className="btn-primary btn-sm"
                >
                  {createMutation.isPending ? "Saving..." : "Save Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT BILL MODAL ─────────────────────────────────────────── */}
      {isEditBillModalOpen && editingBill && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="card w-full max-w-3xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <PenSquare className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-zinc-100">Edit Bill #{editingBill.bill_no}</h3>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Customer *</label>
                    <select
                      required
                      value={editBillMeta.customer_id}
                      onChange={(e) => setEditBillMeta({ ...editBillMeta, customer_id: e.target.value })}
                      className="input-field text-sm"
                    >
                      <option value="">Select Customer...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Bill Date *</label>
                    <input
                      type="date"
                      required
                      value={editBillMeta.bill_date}
                      onChange={(e) => setEditBillMeta({ ...editBillMeta, bill_date: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label mb-0">Edit Line Items</label>
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
                      className="btn-secondary btn-sm !py-1 !px-2 text-xs"
                    >
                      + Add Item
                    </button>
                  </div>

                  <div className="border border-zinc-800 rounded-lg overflow-x-auto">
                    <table className="data-table text-xs min-w-[480px]">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th className="text-right w-24">Rate (₹)</th>
                          <th className="text-right w-28">Quantity</th>
                          <th className="text-right w-24">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editProductRows.map((row, idx) => {
                          const amt = (parseFloat(row.quantity) || 0) * (parseFloat(row.rate) || 0);
                          return (
                            <tr key={`${row.product_id || "custom"}-${idx}`}>
                              <td>
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
                                  className="input-field text-xs py-1"
                                >
                                  <option value="">Custom Item</option>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="text-right">
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
                              <td className="text-right">
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
                              <td className="text-right font-mono font-semibold text-zinc-100">
                                {amt > 0 ? formatCurrency(amt) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span className="text-zinc-300">Total Amount:</span>
                    <span className="font-mono text-amber-400 text-base">{formatCurrency(editBillTotal)}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800 text-xs">
                    <div>
                      <label className="label">Payment Method</label>
                      <select
                        value={editBillMeta.payment_method}
                        onChange={(e) => setEditBillMeta({ ...editBillMeta, payment_method: e.target.value })}
                        className="input-field"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditBillModalOpen(false)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateBillMutation.isPending || editBillTotal === 0}
                  className="btn-primary btn-sm bg-amber-600 hover:bg-amber-500"
                >
                  {updateBillMutation.isPending ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
