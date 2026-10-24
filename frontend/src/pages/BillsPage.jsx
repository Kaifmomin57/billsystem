import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Receipt,
  Plus,
  MagnifyingGlass,
  CalendarBlank,
  Trash,
  Eye,
  X,
  Wallet,
  CheckCircle,
  Clock,
  WarningCircle,
  QrCode,
  Money,
  FilePdf,
  PaperPlaneTilt,
  PencilSimple,
  SlidersHorizontal,
  Printer,
  ArrowsClockwise,
  ArrowRight,
  User,
  WhatsappLogo,
} from "@phosphor-icons/react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatINR, formatDateIN } from "../lib/formatters";
import { printerService } from "../printer/printerService";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Input";
import { FormField } from "../components/ui/FormField";
import { StatusBadge } from "../components/ui/StatusBadge";
import { MoreActions } from "../components/ui/MoreActions";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { TableSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 20;

export default function BillsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedCustomerId, setSelectedCustomerId] = useState(searchParams.get("customer_id") || "");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get("status") || ""); // "" | "due" | "paid" | "partial"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Thermal printing status
  const [isThermalPrinting, setIsThermalPrinting] = useState(false);

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(searchParams.get("new") === "true");
  const [isEditBillModalOpen, setIsEditBillModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [selectedBulkBillIds, setSelectedBulkBillIds] = useState([]);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [viewingBill, setViewingBill] = useState(null);
  const [paymentBill, setPaymentBill] = useState(null);
  const [billToDelete, setBillToDelete] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [sendingBillId, setSendingBillId] = useState(null);

  // Payment Form state
  const [paymentForm, setPaymentForm] = useState({
    installment_amount: "",
    payment_method: "Cash",
    note: "",
  });

  // Manual Bill Form state
  const [productRows, setProductRows] = useState([]);
  const [billMeta, setBillMeta] = useState({
    customer_id: searchParams.get("customer_id") || "",
    bill_date: new Date().toISOString().split("T")[0],
    amount_paid: "",
    payment_method: "Cash",
  });

  // Edit Bill Form state
  const [editProductRows, setEditProductRows] = useState([]);
  const [editBillMeta, setEditBillMeta] = useState({
    customer_id: "",
    bill_date: new Date().toISOString().split("T")[0],
    amount_paid: "",
    payment_method: "Cash",
  });
  const [ratesLoading, setRatesLoading] = useState(false);

  // Fetch Customers, Products & Base Rates
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get("/customers")).data,
    staleTime: 5 * 60_000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", "active"],
    queryFn: async () => (await api.get("/products?is_active=true")).data,
    staleTime: 5 * 60_000,
  });

  const { data: baseRates = [] } = useQuery({
    queryKey: ["rates", "products"],
    queryFn: async () => (await api.get("/rates/products")).data,
    staleTime: 60_000,
  });

  const baseRateMap = useMemo(() => {
    const map = {};
    for (const br of baseRates) {
      map[br.product_id] = {
        rate: br.rate,
        live_rate: br.live_rate !== null && br.live_rate !== undefined ? br.live_rate : br.rate,
      };
    }
    return map;
  }, [baseRates]);

  // Fetch Bills with Server Pagination & Filtering
  const { data: billsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      "bills",
      page,
      selectedCustomerId,
      selectedSource,
      selectedStatus,
      startDate,
      endDate,
      search,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", page);
      params.append("page_size", PAGE_SIZE);
      if (selectedCustomerId) params.append("customer_id", selectedCustomerId);
      if (selectedSource) params.append("source", selectedSource);
      if (selectedStatus) params.append("status", selectedStatus);
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (search) params.append("search", search);
      return (await api.get(`/bills?${params.toString()}`)).data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const paginatedBills = billsData?.items || (Array.isArray(billsData) ? billsData : []);
  const totalBills = billsData?.total ?? paginatedBills.length;
  const totalPages = billsData?.total_pages ?? Math.max(1, Math.ceil(totalBills / PAGE_SIZE));
  const paidCount = billsData?.paid_count ?? 0;
  const dueCount = billsData?.due_count ?? 0;
  const partialCount = billsData?.partial_count ?? 0;

  // Initialize product rows on modal open or when products/baseRates load
  useEffect(() => {
    if (products.length > 0 && (productRows.length === 0 || productRows.length !== products.length)) {
      setProductRows(
        products.map((p) => {
          const bInfo = baseRateMap[p.id];
          const rate = bInfo?.rate ?? 0;
          const live_rate = bInfo?.live_rate ?? rate ?? "";
          return {
            product_id: p.id,
            name: p.name,
            unit: p.unit || "kg",
            rate,
            quantity: "",
            live_rate,
            live_quantity: "",
          };
        })
      );
    }
  }, [products, baseRateMap, productRows.length]);

  // Handle thermal printing helper
  const handleThermalPrint = async (bill) => {
    try {
      setIsThermalPrinting(true);
      toast.loading(`Printing receipt #${bill.bill_no}...`, { id: `thermal-${bill.id}` });
      await printerService.printBill(bill);
      toast.success(`Receipt printed for #${bill.bill_no}`, { id: `thermal-${bill.id}` });
    } catch (err) {
      toast.error(`Printer error: ${err.message || "Failed to print"}`, { id: `thermal-${bill.id}` });
    } finally {
      setIsThermalPrinting(false);
    }
  };

  // PDF Download helper
  const downloadBillPdf = async (bill) => {
    let url = null;
    try {
      toast.loading(`Generating PDF for #${bill.bill_no}...`, { id: `pdf-toast-${bill.id}` });
      const res = await api.get(`/bills/${bill.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Invoice_${bill.bill_no || bill.id}_Rs${Math.round(bill.total_amount || 0)}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`Invoice #${bill.bill_no} downloaded!`, { id: `pdf-toast-${bill.id}` });
    } catch {
      toast.error("Failed to download PDF invoice", { id: `pdf-toast-${bill.id}` });
    } finally {
      if (url) window.URL.revokeObjectURL(url);
    }
  };

  // WhatsApp Dispatch
  const sendInvoiceWhatsApp = async (bill) => {
    try {
      setSendingBillId(bill.id);
      toast.loading(`Sending invoice #${bill.bill_no} via WhatsApp...`, { id: `wa-${bill.id}` });
      const res = await api.post(`/bills/${bill.id}/whatsapp`);
      if (res.data?.whatsapp_url) {
        window.open(res.data.whatsapp_url, "_blank");
        toast.success(`WhatsApp opened for #${bill.bill_no}`, { id: `wa-${bill.id}` });
      } else {
        toast.success(`Invoice sent to customer WhatsApp!`, { id: `wa-${bill.id}` });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not dispatch WhatsApp message", {
        id: `wa-${bill.id}`,
      });
    } finally {
      setSendingBillId(null);
    }
  };

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/bills/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Bill deleted successfully");
      setBillToDelete(null);
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to delete bill"),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => api.post("/bills", payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Bill created successfully!");
      setIsManualModalOpen(false);
      if (res?.data) {
        handleThermalPrint(res.data);
      }
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to create bill"),
  });

  const updateBillMutation = useMutation({
    mutationFn: ({ billId, payload }) => api.put(`/bills/${billId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Bill updated successfully!");
      setIsEditBillModalOpen(false);
      setEditingBill(null);
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to update bill"),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ billId, payload }) => api.put(`/bills/${billId}/payment`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Payment recorded successfully!");
      setPaymentBill(null);
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to record payment"),
  });

  // Customer change in manual bill
  const handleCustomerChange = async (customerId) => {
    setBillMeta((prev) => ({ ...prev, customer_id: customerId }));
    if (!customerId) {
      // Revert to standard product rates
      setProductRows((prev) =>
        prev.map((row) => {
          const bInfo = baseRateMap[row.product_id];
          const rate = bInfo?.rate ?? 0;
          const live_rate = bInfo?.live_rate ?? rate ?? "";
          return {
            ...row,
            rate,
            live_rate,
          };
        })
      );
      return;
    }

    try {
      setRatesLoading(true);
      // Query customer-specific rates (endpoint returns List[CustomerRateOut])
      const res = await api.get(`/rates/customers?customer_id=${customerId}`);
      const custRateList = Array.isArray(res.data)
        ? res.data
        : res.data?.rates
        ? Object.entries(res.data.rates).map(([pid, r]) => ({
            product_id: Number(pid),
            ...r,
          }))
        : [];

      const custRateMap = {};
      for (const cr of custRateList) {
        custRateMap[cr.product_id] = cr;
      }

      setProductRows((prev) =>
        prev.map((row) => {
          const cInfo = custRateMap[row.product_id];
          const bInfo = baseRateMap[row.product_id];

          // Priority: Customer-specific rate -> Base standard rate -> existing row rate
          const newRate =
            cInfo?.rate !== undefined && cInfo?.rate !== null
              ? cInfo.rate
              : bInfo?.rate !== undefined && bInfo?.rate !== null
              ? bInfo.rate
              : row.rate ?? 0;

          const newLiveRate =
            cInfo?.live_rate !== undefined && cInfo?.live_rate !== null
              ? cInfo.live_rate
              : bInfo?.live_rate !== undefined && bInfo?.live_rate !== null
              ? bInfo.live_rate
              : bInfo?.rate !== undefined
              ? bInfo.rate
              : row.live_rate ?? newRate;

          return {
            ...row,
            rate: newRate,
            live_rate: newLiveRate,
          };
        })
      );
    } catch (err) {
      console.error("Failed to fetch customer rates:", err);
    } finally {
      setRatesLoading(false);
    }
  };

  // Pull customer rates when opening modal with a preselected customer
  useEffect(() => {
    if (isManualModalOpen && billMeta.customer_id && products.length > 0) {
      handleCustomerChange(billMeta.customer_id);
    }
  }, [isManualModalOpen]);

  // Manual Bill Submit
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!billMeta.customer_id) {
      toast.error("Please select a customer");
      return;
    }

    const itemsToSave = [];
    for (const r of productRows) {
      const normalQ = parseFloat(r.quantity || 0);
      const normalR = parseFloat(r.rate || 0);
      if (normalQ > 0) {
        itemsToSave.push({
          product_id: r.product_id,
          quantity: normalQ,
          rate: normalR,
          amount: parseFloat((normalQ * normalR).toFixed(2)),
          is_live: false,
          circled_value: null,
        });
      }

      const liveQ = parseFloat(r.live_quantity || 0);
      const liveR = parseFloat(r.live_rate || r.rate || 0);
      if (liveQ > 0) {
        itemsToSave.push({
          product_id: r.product_id,
          quantity: liveQ,
          rate: liveR,
          amount: parseFloat((liveQ * liveR).toFixed(2)),
          is_live: true,
          circled_value: String(liveR),
        });
      }
    }

    if (itemsToSave.length === 0) {
      toast.error("Enter quantity (Normal or Live) for at least one product");
      return;
    }

    createMutation.mutate({
      customer_id: parseInt(billMeta.customer_id),
      bill_date: billMeta.bill_date,
      amount_paid: parseFloat(billMeta.amount_paid || 0),
      payment_method: billMeta.payment_method || "Cash",
      items: itemsToSave,
      source: "manual",
    });
  };

  // Calculation totals
  const billTotal = useMemo(
    () =>
      productRows.reduce((s, r) => {
        const normalAmt = (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0);
        const liveRate = parseFloat(r.live_rate) || parseFloat(r.rate) || 0;
        const liveAmt = (parseFloat(r.live_quantity) || 0) * liveRate;
        return s + normalAmt + liveAmt;
      }, 0),
    [productRows]
  );

  const billBalance = useMemo(
    () => Math.max(0, billTotal - (parseFloat(billMeta.amount_paid) || 0)),
    [billTotal, billMeta.amount_paid]
  );

  // Edit Bill Handlers & Calculations
  const handleOpenEditBill = async (bill) => {
    let billData = bill;
    if (!bill.items || bill.items.length === 0) {
      try {
        const res = await api.get(`/bills/${bill.id}`);
        if (res.data) billData = res.data;
      } catch (e) {
        console.error("Failed to fetch bill details:", e);
      }
    }
    setEditingBill(billData);
    setEditBillMeta({
      customer_id: billData.customer_id ? String(billData.customer_id) : "",
      bill_date: billData.bill_date || new Date().toISOString().split("T")[0],
      amount_paid:
        billData.amount_paid !== undefined && billData.amount_paid !== null
          ? String(billData.amount_paid)
          : "0",
      payment_method: billData.payment_method || "Cash",
    });

    const billItems = billData.items || [];
    const usedProductIds = new Set();

    const rows = products.map((p) => {
      usedProductIds.add(p.id);
      const bInfo = baseRateMap[p.id];
      const defaultRate = bInfo?.rate ?? 0;
      const defaultLiveRate = bInfo?.live_rate ?? defaultRate ?? "";

      const normalItems = billItems.filter(
        (it) => it.product_id === p.id && !it.is_live && !it.circled_value
      );
      const liveItems = billItems.filter(
        (it) => it.product_id === p.id && (Boolean(it.is_live) || Boolean(it.circled_value))
      );

      const normalQty =
        normalItems.length > 0
          ? normalItems.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0), 0)
          : "";
      const normalRate = normalItems.length > 0 ? normalItems[0].rate : defaultRate;

      const liveQty =
        liveItems.length > 0
          ? liveItems.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0), 0)
          : "";
      const liveRate = liveItems.length > 0 ? liveItems[0].rate : defaultLiveRate;

      return {
        product_id: p.id,
        name: p.name,
        unit: p.unit || "kg",
        rate: normalRate,
        quantity: normalQty,
        live_rate: liveRate,
        live_quantity: liveQty,
      };
    });

    // Also include any items in bill whose product_id is not in active catalogue
    billItems.forEach((it) => {
      if (it.product_id && !usedProductIds.has(it.product_id)) {
        usedProductIds.add(it.product_id);
        const isLive = Boolean(it.is_live || it.circled_value);
        rows.push({
          product_id: it.product_id,
          name: it.product_name || `Product #${it.product_id}`,
          unit: it.unit || "kg",
          rate: isLive ? 0 : it.rate,
          quantity: isLive ? "" : it.quantity,
          live_rate: isLive ? it.rate : "",
          live_quantity: isLive ? it.quantity : "",
        });
      }
    });

    setEditProductRows(rows);
    setIsEditBillModalOpen(true);
  };

  const handleEditCustomerChange = (customerId) => {
    setEditBillMeta((prev) => ({ ...prev, customer_id: customerId }));
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editingBill) return;
    if (!editBillMeta.customer_id) {
      toast.error("Please select a customer");
      return;
    }

    const itemsToSave = [];
    for (const r of editProductRows) {
      const normalQ = parseFloat(r.quantity || 0);
      const normalR = parseFloat(r.rate || 0);
      if (normalQ > 0) {
        itemsToSave.push({
          product_id: r.product_id,
          quantity: normalQ,
          rate: normalR,
          amount: parseFloat((normalQ * normalR).toFixed(2)),
          is_live: false,
          circled_value: null,
        });
      }

      const liveQ = parseFloat(r.live_quantity || 0);
      const liveR = parseFloat(r.live_rate || r.rate || 0);
      if (liveQ > 0) {
        itemsToSave.push({
          product_id: r.product_id,
          quantity: liveQ,
          rate: liveR,
          amount: parseFloat((liveQ * liveR).toFixed(2)),
          is_live: true,
          circled_value: String(liveR),
        });
      }
    }

    if (itemsToSave.length === 0) {
      toast.error("Enter quantity (Normal or Live) for at least one product");
      return;
    }

    updateBillMutation.mutate({
      billId: editingBill.id,
      payload: {
        customer_id: parseInt(editBillMeta.customer_id),
        bill_date: editBillMeta.bill_date,
        amount_paid: parseFloat(editBillMeta.amount_paid || 0),
        payment_method: editBillMeta.payment_method || "Cash",
        items: itemsToSave,
      },
    });
  };

  const editBillTotal = useMemo(
    () =>
      editProductRows.reduce((s, r) => {
        const normalAmt = (parseFloat(r.quantity) || 0) * (parseFloat(r.rate) || 0);
        const liveRate = parseFloat(r.live_rate) || parseFloat(r.rate) || 0;
        const liveAmt = (parseFloat(r.live_quantity) || 0) * liveRate;
        return s + normalAmt + liveAmt;
      }, 0),
    [editProductRows]
  );

  const editBillBalance = useMemo(
    () => Math.max(0, editBillTotal - (parseFloat(editBillMeta.amount_paid) || 0)),
    [editBillTotal, editBillMeta.amount_paid]
  );

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    if (!paymentBill) return;
    const amt = parseFloat(paymentForm.installment_amount || 0);
    if (amt <= 0) {
      toast.error("Please enter a valid amount greater than zero");
      return;
    }
    paymentMutation.mutate({
      billId: paymentBill.id,
      payload: {
        installment_amount: amt,
        payment_method: paymentForm.payment_method || "Cash",
        note: paymentForm.note || null,
      },
    });
  };

  const hasAdvancedFilters = selectedCustomerId || selectedSource || startDate || endDate;

  return (
    <div className="flex flex-col gap-6">
      {/* PRD v2 Page Header */}
      <PageHeader
        title="Bills & Invoices"
        purpose="Create, send, and collect customer bills with itemized accounting"
        primaryAction={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setIsManualModalOpen(true)}
          >
            Create Bill
          </Button>
        }
        moreActions={[
          {
            label: isFetching ? "Refreshing…" : "Refresh bills",
            icon: ArrowsClockwise,
            onClick: () => refetch(),
          },
          {
            label: "Send WhatsApp batch",
            icon: PaperPlaneTilt,
            onClick: () => setIsWhatsAppModalOpen(true),
          },
        ]}
      />

      {/* Filter Bar with Status Tabs & Counts (PRD v2 Section 12) */}
      <div className="card p-4 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Segmented Status Tabs */}
          <div className="segmented-nav">
            <button
              onClick={() => {
                setSelectedStatus("");
                setPage(1);
              }}
              className={`segmented-item ${selectedStatus === "" ? "active" : ""}`}
            >
              <span>All Bills</span>
              {totalBills > 0 && <span className="opacity-75 font-mono">({totalBills})</span>}
            </button>
            <button
              onClick={() => {
                setSelectedStatus("due");
                setPage(1);
              }}
              className={`segmented-item ${selectedStatus === "due" ? "active" : ""}`}
            >
              <WarningCircle size={16} weight="bold" className="text-rose-400" />
              <span>Payment Due</span>
              {dueCount > 0 && <span className="opacity-75 font-mono">({dueCount})</span>}
            </button>
            <button
              onClick={() => {
                setSelectedStatus("partial");
                setPage(1);
              }}
              className={`segmented-item ${selectedStatus === "partial" ? "active" : ""}`}
            >
              <Clock size={16} weight="bold" className="text-amber-400" />
              <span>Partially Paid</span>
              {partialCount > 0 && <span className="opacity-75 font-mono">({partialCount})</span>}
            </button>
            <button
              onClick={() => {
                setSelectedStatus("paid");
                setPage(1);
              }}
              className={`segmented-item ${selectedStatus === "paid" ? "active" : ""}`}
            >
              <CheckCircle size={16} weight="bold" className="text-emerald-400" />
              <span>Paid in Full</span>
              {paidCount > 0 && <span className="opacity-75 font-mono">({paidCount})</span>}
            </button>
          </div>

          {/* Search & Advanced Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Input
                placeholder="Search customer or bill #…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                leftIcon={MagnifyingGlass}
              />
            </div>
            <Button
              variant="secondary"
              icon={SlidersHorizontal}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={hasAdvancedFilters ? "border-emerald-500 text-emerald-400" : ""}
            >
              Filters
              {hasAdvancedFilters && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 ml-1" />
              )}
            </Button>
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in">
            <FormField label="Customer">
              <Select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Source">
              <Select
                value={selectedSource}
                onChange={(e) => {
                  setSelectedSource(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Sources</option>
                <option value="ledger_ai">Ledger AI</option>
                <option value="manual">Manual Entry</option>
                <option value="bill_ai">Single Bill AI</option>
              </Select>
            </FormField>

            <FormField label="From Date">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </FormField>

            <FormField label="To Date">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </FormField>

            {hasAdvancedFilters && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <Button
                  variant="quiet"
                  size="sm"
                  className="text-rose-400 hover:text-rose-300"
                  onClick={() => {
                    setSelectedCustomerId("");
                    setSelectedSource("");
                    setStartDate("");
                    setEndDate("");
                    setPage(1);
                  }}
                >
                  Reset all filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bills Content Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : paginatedBills.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No bills found"
            description={
              search || hasAdvancedFilters || selectedStatus
                ? "No customer bills matched your selected filter criteria. Try clearing filters or search terms."
                : "Create your first customer invoice to record sales and track collections."
            }
            actionLabel="Create Bill"
            onAction={() => setIsManualModalOpen(true)}
          />
        ) : (
          <>
            {/* Desktop Table View (52px min row height, 16px text) */}
            <div className="hidden md:block overflow-x-auto">
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
                    <th className="text-right">Next Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBills.map((b) => {
                    const isPaid = b.payment_status === "paid";
                    return (
                      <tr key={b.id} className="min-h-[52px]">
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-zinc-100 text-base">
                              #{b.bill_no}
                            </span>
                            {b.source === "ledger_ai" && (
                              <span className="badge-info text-xs py-0 px-1.5">AI</span>
                            )}
                          </div>
                          <div className="cell-secondary">{formatDateIN(b.bill_date)}</div>
                        </td>

                        <td>
                          <div className="font-semibold text-zinc-100 text-base">{b.customer_name}</div>
                          {b.customer_phone && (
                            <div className="cell-secondary font-mono">{b.customer_phone}</div>
                          )}
                        </td>

                        <td>
                          <span className="badge-neutral text-xs">
                            {b.payment_method === "UPI" ? (
                              <QrCode size={14} weight="bold" className="text-purple-400" />
                            ) : (
                              <Money size={14} weight="bold" className="text-emerald-400" />
                            )}
                            {b.payment_method || "Cash"}
                          </span>
                        </td>

                        <td className="cell-money text-base text-zinc-100">
                          {formatINR(b.total_amount)}
                        </td>

                        <td className="cell-money text-base text-emerald-400">
                          {formatINR(b.amount_paid)}
                        </td>

                        <td className="cell-money text-base">
                          {b.balance_due > 0 ? (
                            <span className="text-amber-300 font-bold">
                              {formatINR(b.balance_due)}
                            </span>
                          ) : (
                            <span className="text-zinc-500">₹0.00</span>
                          )}
                        </td>

                        <td className="text-center">
                          <StatusBadge status={b.payment_status} />
                        </td>

                        {/* PRD v2 Section 12: ONE next action per row, rest in MoreActions */}
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isPaid ? (
                              <Button
                                variant="primary"
                                size="sm"
                                icon={Wallet}
                                onClick={() => {
                                  setPaymentBill(b);
                                  setPaymentForm({
                                    installment_amount: b.balance_due?.toString() || "",
                                    payment_method: "Cash",
                                    note: "",
                                  });
                                }}
                              >
                                Record Payment
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={FilePdf}
                                onClick={() => downloadBillPdf(b)}
                              >
                                Download PDF
                              </Button>
                            )}

                            {/* Overflow Actions */}
                            <MoreActions
                              label={`More options for #${b.bill_no}`}
                              items={[
                                {
                                  label: "View details",
                                  icon: Eye,
                                  onClick: () => setViewingBill(b),
                                },
                                {
                                  label: "Edit bill",
                                  icon: PencilSimple,
                                  onClick: () => handleOpenEditBill(b),
                                },
                                {
                                  label: "Download PDF invoice",
                                  icon: FilePdf,
                                  onClick: () => downloadBillPdf(b),
                                },
                                {
                                  label: "Send on WhatsApp",
                                  icon: PaperPlaneTilt,
                                  onClick: () => sendInvoiceWhatsApp(b),
                                },
                                {
                                  label: "Thermal Print (80mm)",
                                  icon: Printer,
                                  onClick: () => handleThermalPrint(b),
                                },
                                { divider: true },
                                {
                                  label: "Delete bill",
                                  icon: Trash,
                                  variant: "danger",
                                  onClick: () => setBillToDelete(b),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (< md) */}
            <div className="block md:hidden divide-y divide-zinc-800">
              {paginatedBills.map((b) => {
                const isPaid = b.payment_status === "paid";
                return (
                  <div key={b.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-zinc-100 text-base">
                          #{b.bill_no}
                        </span>
                        <span className="text-xs text-zinc-400">{formatDateIN(b.bill_date)}</span>
                      </div>
                      <StatusBadge status={b.payment_status} />
                    </div>

                    <div className="flex items-center justify-between text-base">
                      <span className="font-semibold text-zinc-100">{b.customer_name}</span>
                      <span className="badge-neutral text-xs">{b.payment_method || "Cash"}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm">
                      <div>
                        <span className="text-xs text-zinc-400 block">Total</span>
                        <span className="font-mono font-bold text-zinc-100 mt-0.5 block tabular-nums">
                          {formatINR(b.total_amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400 block">Paid</span>
                        <span className="font-mono font-semibold text-emerald-400 mt-0.5 block tabular-nums">
                          {formatINR(b.amount_paid)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400 block">Balance</span>
                        <span
                          className={`font-mono font-bold mt-0.5 block tabular-nums ${
                            b.balance_due > 0 ? "text-amber-300" : "text-zinc-500"
                          }`}
                        >
                          {b.balance_due > 0 ? formatINR(b.balance_due) : "₹0.00"}
                        </span>
                      </div>
                    </div>

                    {/* Single Next Action Bar */}
                    <div className="flex items-center justify-between pt-1 gap-2">
                      {!isPaid ? (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Wallet}
                          className="flex-1"
                          onClick={() => {
                            setPaymentBill(b);
                            setPaymentForm({
                              installment_amount: b.balance_due?.toString() || "",
                              payment_method: "Cash",
                              note: "",
                            });
                          }}
                        >
                          Record Payment
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={FilePdf}
                          className="flex-1"
                          onClick={() => downloadBillPdf(b)}
                        >
                          Download PDF
                        </Button>
                      )}

                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Eye}
                        onClick={() => setViewingBill(b)}
                      >
                        View
                      </Button>

                      <MoreActions
                        label="More actions"
                        items={[
                          {
                            label: "Edit bill",
                            icon: PencilSimple,
                            onClick: () => handleOpenEditBill(b),
                          },
                          {
                            label: "Thermal Print (80mm)",
                            icon: Printer,
                            onClick: () => handleThermalPrint(b),
                          },
                          {
                            label: "Send on WhatsApp",
                            icon: PaperPlaneTilt,
                            onClick: () => sendInvoiceWhatsApp(b),
                          },
                          { divider: true },
                          {
                            label: "Delete bill",
                            icon: Trash,
                            variant: "danger",
                            onClick: () => setBillToDelete(b),
                          },
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalBills}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* ─── 4-SECTION MANUAL BILL CREATION MODAL (PRD v2 Section 12) ── */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Create New Bill"
        subtitle="Itemized customer bill supporting standard and live rates"
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-6">
          {/* SECTION 1: CUSTOMER SELECTION & PREVIOUS BALANCE */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <User size={18} weight="bold" className="text-emerald-400" />
              <span>1. Customer & Bill Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Select Customer" required>
                <Select
                  value={billMeta.customer_id}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  required
                >
                  <option value="">Choose customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.total_balance > 0 ? `(Due: ₹${c.total_balance})` : ""}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Bill Date" required>
                <Input
                  type="date"
                  value={billMeta.bill_date}
                  onChange={(e) => setBillMeta({ ...billMeta, bill_date: e.target.value })}
                  required
                />
              </FormField>
            </div>

            {/* Previous Balance banner (shown BEFORE items per PRD v2 Section 12) */}
            {billMeta.customer_id && (() => {
              const selCust = customers.find((c) => String(c.id) === String(billMeta.customer_id));
              if (!selCust) return null;
              const totBal = parseFloat(selCust.total_balance || 0);
              return totBal > 0 ? (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-sm">
                  <span className="text-amber-300 font-medium flex items-center gap-2">
                    <WarningCircle size={18} weight="bold" />
                    <span>Previous Outstanding Balance:</span>
                  </span>
                  <span className="font-mono font-bold text-amber-300 text-base tabular-nums">
                    {formatINR(totBal)}
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
                  <CheckCircle size={18} weight="bold" />
                  <span>Customer has zero previous pending balance.</span>
                </div>
              );
            })()}
          </div>

          {/* SECTION 2: ITEMS & QUANTITIES (NORMAL + LIVE) */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Receipt size={18} weight="bold" className="text-emerald-400" />
                <span>2. Products & Quantities</span>
              </h3>
              {ratesLoading && (
                <span className="text-xs text-zinc-400">Loading customer rates…</span>
              )}
            </div>

            <div className="border border-zinc-800 rounded-lg overflow-x-auto">
              <table className="data-table min-w-[620px]">
                <thead>
                  <tr>
                    <th className="w-44">Product</th>
                    <th className="text-right w-24">Normal Rate</th>
                    <th className="text-right w-24">Normal Qty</th>
                    <th className="text-right w-24 text-sky-400">Live Rate</th>
                    <th className="text-right w-24 text-emerald-400">Live Qty (⊚)</th>
                    <th className="text-right w-28">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((row, idx) => {
                    const normalQ = parseFloat(row.quantity) || 0;
                    const normalR = parseFloat(row.rate) || 0;
                    const normalAmt = normalQ * normalR;

                    const liveQ = parseFloat(row.live_quantity) || 0;
                    const liveR = parseFloat(row.live_rate) || normalR;
                    const liveAmt = liveQ * liveR;

                    const rowAmt = normalAmt + liveAmt;

                    return (
                      <tr key={row.product_id} className={`min-h-[52px] ${liveQ > 0 ? "bg-emerald-950/20" : ""}`}>
                        <td>
                          <span className="font-semibold text-zinc-100 text-base">{row.name}</span>
                          <span className="text-xs text-zinc-400 block font-mono">Unit: {row.unit}</span>
                        </td>

                        <td className="text-right">
                          <input
                            type="number"
                            step="any"
                            value={row.rate}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProductRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, rate: val } : r))
                              );
                            }}
                            className="input min-h-[38px] text-right font-mono py-1 px-2 w-24 text-base"
                            placeholder="0.00"
                          />
                        </td>

                        <td className="text-right">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            value={row.quantity}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProductRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r))
                              );
                            }}
                            className="input min-h-[38px] text-right font-mono font-bold text-zinc-100 py-1 px-2 w-24 text-base"
                          />
                        </td>

                        <td className="text-right">
                          <input
                            type="number"
                            step="any"
                            value={row.live_rate ?? ""}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProductRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, live_rate: val } : r))
                              );
                            }}
                            className="input min-h-[38px] text-right font-mono py-1 px-2 w-24 text-base text-sky-300"
                            placeholder="Live ₹"
                          />
                        </td>

                        <td className="text-right">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="⊚ 0"
                            value={row.live_quantity}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              setProductRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, live_quantity: val } : r))
                              );
                            }}
                            className="input min-h-[38px] text-right font-mono font-bold text-emerald-300 py-1 px-2 w-24 text-base"
                          />
                        </td>

                        <td className="text-right cell-money text-base">
                          {rowAmt > 0 ? formatINR(rowAmt) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: PAYMENT COLLECTION & METHOD */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Wallet size={18} weight="bold" className="text-emerald-400" />
              <span>3. Payment Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Amount Paid Now (₹)">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  max={billTotal}
                  value={billMeta.amount_paid}
                  onChange={(e) => setBillMeta({ ...billMeta, amount_paid: e.target.value })}
                  placeholder="₹0.00"
                  className="font-mono font-bold text-emerald-400"
                />
              </FormField>

              <FormField label="Payment Method">
                <Select
                  value={billMeta.payment_method}
                  onChange={(e) => setBillMeta({ ...billMeta, payment_method: e.target.value })}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </Select>
              </FormField>
            </div>
          </div>

          {/* SECTION 4: REVIEW SUMMARY & CONFIRMATION */}
          <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-700 flex flex-col gap-3">
            <h3 className="text-base font-bold text-zinc-100">4. Review Summary</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-xs text-zinc-400 block">Current Bill Total</span>
                <span className="font-mono font-bold text-zinc-100 text-lg mt-1 block tabular-nums">
                  {formatINR(billTotal)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-xs text-zinc-400 block">Amount Paid Today</span>
                <span className="font-mono font-bold text-emerald-400 text-lg mt-1 block tabular-nums">
                  {formatINR(billMeta.amount_paid || 0)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-xs text-zinc-400 block">Remaining Due</span>
                <span className="font-mono font-bold text-amber-300 text-lg mt-1 block tabular-nums">
                  {formatINR(billBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsManualModalOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="submit"
              isLoading={createMutation.isPending}
              loadingText="Saving bill…"
            >
              Create Bill
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── 4-SECTION EDIT BILL MODAL (PRD v2 Section 12) ── */}
      {isEditBillModalOpen && (
        <Modal
          isOpen={isEditBillModalOpen}
          onClose={() => {
            setIsEditBillModalOpen(false);
            setEditingBill(null);
          }}
          title={`Edit Bill #${editingBill?.bill_no || ""}`}
          subtitle="Update customer, products, quantities, rates, or payment details"
          maxWidth="max-w-4xl"
        >
          <form onSubmit={handleEditSubmit} className="flex flex-col gap-6">
            {/* SECTION 1: CUSTOMER SELECTION & PREVIOUS BALANCE */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <User size={18} weight="bold" className="text-emerald-400" />
                <span>1. Customer & Bill Information</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Select Customer" required>
                  <Select
                    value={editBillMeta.customer_id}
                    onChange={(e) => handleEditCustomerChange(e.target.value)}
                    required
                  >
                    <option value="">Choose customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.total_balance > 0 ? `(Due: ₹${c.total_balance})` : ""}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Bill Date" required>
                  <Input
                    type="date"
                    value={editBillMeta.bill_date}
                    onChange={(e) => setEditBillMeta({ ...editBillMeta, bill_date: e.target.value })}
                    required
                  />
                </FormField>
              </div>

              {/* Customer balance banner */}
              {editBillMeta.customer_id && (() => {
                const selCust = customers.find((c) => String(c.id) === String(editBillMeta.customer_id));
                if (!selCust) return null;
                const totBal = parseFloat(selCust.total_balance || 0);
                return totBal > 0 ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-sm">
                    <span className="text-amber-300 font-medium flex items-center gap-2">
                      <WarningCircle size={18} weight="bold" />
                      <span>Customer Outstanding Balance:</span>
                    </span>
                    <span className="font-mono font-bold text-amber-300 text-base tabular-nums">
                      {formatINR(totBal)}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
                    <CheckCircle size={18} weight="bold" />
                    <span>Customer has zero previous pending balance.</span>
                  </div>
                );
              })()}
            </div>

            {/* SECTION 2: ITEMS & QUANTITIES (NORMAL + LIVE) */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <Receipt size={18} weight="bold" className="text-emerald-400" />
                  <span>2. Products & Quantities</span>
                </h3>
                <span className="text-xs text-zinc-400">Modify quantities & rates below</span>
              </div>

              <div className="border border-zinc-800 rounded-lg overflow-x-auto">
                <table className="data-table min-w-[620px]">
                  <thead>
                    <tr>
                      <th className="w-44">Product</th>
                      <th className="text-right w-24">Normal Rate</th>
                      <th className="text-right w-24">Normal Qty</th>
                      <th className="text-right w-24 text-sky-400">Live Rate</th>
                      <th className="text-right w-24 text-emerald-400">Live Qty (⊚)</th>
                      <th className="text-right w-28">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editProductRows.map((row, idx) => {
                      const normalQ = parseFloat(row.quantity) || 0;
                      const normalR = parseFloat(row.rate) || 0;
                      const normalAmt = normalQ * normalR;

                      const liveQ = parseFloat(row.live_quantity) || 0;
                      const liveR = parseFloat(row.live_rate) || normalR;
                      const liveAmt = liveQ * liveR;

                      const rowAmt = normalAmt + liveAmt;

                      return (
                        <tr key={row.product_id} className={`min-h-[52px] ${liveQ > 0 ? "bg-emerald-950/20" : ""}`}>
                          <td>
                            <span className="font-semibold text-zinc-100 text-base">{row.name}</span>
                            <span className="text-xs text-zinc-400 block font-mono">Unit: {row.unit}</span>
                          </td>

                          <td className="text-right">
                            <input
                              type="number"
                              step="any"
                              value={row.rate}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditProductRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, rate: val } : r))
                                );
                              }}
                              className="input min-h-[38px] text-right font-mono py-1 px-2 w-24 text-base"
                              placeholder="0.00"
                            />
                          </td>

                          <td className="text-right">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="0"
                              value={row.quantity}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditProductRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, quantity: val } : r))
                                );
                              }}
                              className="input min-h-[38px] text-right font-mono font-bold text-zinc-100 py-1 px-2 w-24 text-base"
                            />
                          </td>

                          <td className="text-right">
                            <input
                              type="number"
                              step="any"
                              value={row.live_rate ?? ""}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditProductRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, live_rate: val } : r))
                                );
                              }}
                              className="input min-h-[38px] text-right font-mono py-1 px-2 w-24 text-base text-sky-300"
                              placeholder="Live ₹"
                            />
                          </td>

                          <td className="text-right">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              placeholder="⊚ 0"
                              value={row.live_quantity}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.preventDefault();
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditProductRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, live_quantity: val } : r))
                                );
                              }}
                              className="input min-h-[38px] text-right font-mono font-bold text-emerald-300 py-1 px-2 w-24 text-base"
                            />
                          </td>

                          <td className="text-right cell-money text-base">
                            {rowAmt > 0 ? formatINR(rowAmt) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 3: PAYMENT DETAILS */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Wallet size={18} weight="bold" className="text-emerald-400" />
                <span>3. Payment Details</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Amount Paid (₹)">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    max={editBillTotal}
                    value={editBillMeta.amount_paid}
                    onChange={(e) => setEditBillMeta({ ...editBillMeta, amount_paid: e.target.value })}
                    placeholder="₹0.00"
                    className="font-mono font-bold text-emerald-400"
                  />
                </FormField>

                <FormField label="Payment Method">
                  <Select
                    value={editBillMeta.payment_method}
                    onChange={(e) => setEditBillMeta({ ...editBillMeta, payment_method: e.target.value })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                  </Select>
                </FormField>
              </div>
            </div>

            {/* SECTION 4: REVIEW SUMMARY & CONFIRMATION */}
            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-700 flex flex-col gap-3">
              <h3 className="text-base font-bold text-zinc-100">4. Review Summary</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-xs text-zinc-400 block">Updated Bill Total</span>
                  <span className="font-mono font-bold text-zinc-100 text-lg mt-1 block tabular-nums">
                    {formatINR(editBillTotal)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-xs text-zinc-400 block">Amount Paid</span>
                  <span className="font-mono font-bold text-emerald-400 text-lg mt-1 block tabular-nums">
                    {formatINR(editBillMeta.amount_paid || 0)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-xs text-zinc-400 block">Remaining Due</span>
                  <span className="font-mono font-bold text-amber-300 text-lg mt-1 block tabular-nums">
                    {formatINR(editBillBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsEditBillModalOpen(false);
                  setEditingBill(null);
                }}
                disabled={updateBillMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="submit"
                isLoading={updateBillMutation.isPending}
                loadingText="Updating bill…"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── RECORD PAYMENT MODAL ────────────────────────────────────── */}
      {paymentBill && (
        <Modal
          isOpen={Boolean(paymentBill)}
          onClose={() => setPaymentBill(null)}
          title="Record Payment"
          subtitle={`Invoice #${paymentBill.bill_no} • ${paymentBill.customer_name}`}
          maxWidth="max-w-md"
        >
          <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-2 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Total Amount:</span>
                <span className="font-mono font-semibold text-zinc-100">
                  {formatINR(paymentBill.total_amount)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Already Paid:</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {formatINR(paymentBill.amount_paid)}
                </span>
              </div>
              <div className="border-t border-zinc-800 pt-2 flex justify-between font-bold text-base">
                <span className="text-amber-300">Remaining Balance:</span>
                <span className="font-mono text-amber-300">
                  {formatINR(paymentBill.balance_due)}
                </span>
              </div>
            </div>

            <FormField label="Payment Amount (₹)" required>
              <div className="relative">
                <Input
                  type="number"
                  step="any"
                  min="1"
                  max={paymentBill.balance_due}
                  value={paymentForm.installment_amount}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, installment_amount: e.target.value })
                  }
                  placeholder={`Max ₹${paymentBill.balance_due?.toFixed(2)}`}
                  className="font-mono font-bold text-emerald-400 pr-24"
                  required
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() =>
                    setPaymentForm({
                      ...paymentForm,
                      installment_amount: paymentBill.balance_due?.toString() || "",
                    })
                  }
                >
                  Pay Full
                </Button>
              </div>
            </FormField>

            <FormField label="Payment Method">
              <Select
                value={paymentForm.payment_method}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, payment_method: e.target.value })
                }
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
              </Select>
            </FormField>

            <FormField label="Note / Reference (Optional)">
              <Input
                placeholder="e.g. UPI Ref #, cash counter"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
              />
            </FormField>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800 mt-2">
              <Button
                variant="secondary"
                onClick={() => setPaymentBill(null)}
                disabled={paymentMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={paymentMutation.isPending}
                loadingText="Recording payment…"
              >
                Save Payment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ─── VIEW BILL DETAILS MODAL ─────────────────────────────────── */}
      {viewingBill && (
        <Modal
          isOpen={Boolean(viewingBill)}
          onClose={() => setViewingBill(null)}
          title={`Bill Details #${viewingBill.bill_no}`}
          subtitle={`${viewingBill.customer_name} • ${formatDateIN(viewingBill.bill_date)}`}
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-xs text-zinc-400 block">Total</span>
                <span className="font-mono font-bold text-zinc-100 text-base mt-1 block">
                  {formatINR(viewingBill.total_amount)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-xs text-zinc-400 block">Paid</span>
                <span className="font-mono font-bold text-emerald-400 text-base mt-1 block">
                  {formatINR(viewingBill.amount_paid)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-xs text-zinc-400 block">Balance</span>
                <span className="font-mono font-bold text-amber-300 text-base mt-1 block">
                  {formatINR(viewingBill.balance_due)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                <span className="text-xs text-zinc-400 block">Method</span>
                <span className="font-bold text-zinc-100 text-base mt-1 block">
                  {viewingBill.payment_method || "Cash"}
                </span>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-center">Type</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingBill.items?.map((item) => {
                    const isLive = Boolean(item.is_live || item.circled_value);
                    return (
                      <tr key={item.id} className={isLive ? "bg-emerald-950/20" : ""}>
                        <td className="font-semibold text-zinc-100">{item.product_name}</td>
                        <td className="text-center">
                          {isLive ? (
                            <span className="badge-success text-xs font-mono">⊚ Live</span>
                          ) : (
                            <span className="badge-neutral text-xs font-mono">Standard</span>
                          )}
                        </td>
                        <td className="text-right font-mono text-zinc-300">{item.quantity} {item.unit || "kg"}</td>
                        <td className="text-right font-mono text-zinc-100">₹{item.rate}</td>
                        <td className="cell-money">{formatINR(item.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button
                variant="secondary"
                icon={PencilSimple}
                onClick={() => {
                  const b = viewingBill;
                  setViewingBill(null);
                  handleOpenEditBill(b);
                }}
              >
                Edit Bill
              </Button>
              <Button
                variant="secondary"
                icon={Printer}
                onClick={() => handleThermalPrint(viewingBill)}
              >
                Thermal Print
              </Button>
              <Button
                variant="secondary"
                icon={FilePdf}
                onClick={() => downloadBillPdf(viewingBill)}
              >
                Download PDF
              </Button>
              <Button variant="primary" onClick={() => setViewingBill(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── BULK WHATSAPP DISPATCH MODAL ───────────────────────────── */}
      {isWhatsAppModalOpen && (
        <Modal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          title="Send WhatsApp Invoices"
          subtitle="Send bills directly to customer WhatsApp with itemized breakdown and payment status."
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-col gap-4">
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-3">
              <WhatsappLogo size={24} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-300">
                <p className="font-semibold text-zinc-100 mb-0.5">Automated Gateway & WhatsApp Web</p>
                <p className="text-zinc-400">
                  If an OpenWA or Meta Cloud WhatsApp gateway is active, invoices are delivered automatically.
                  Otherwise, clicking &ldquo;Send Now&rdquo; will open WhatsApp Web or Desktop with the invoice pre-filled.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400 pb-1 border-b border-zinc-800">
              <span>Select bills to dispatch:</span>
              <button
                type="button"
                onClick={() => {
                  const withPhone = bills.filter((b) => b.customer_phone).map((b) => b.id);
                  setSelectedBulkBillIds(selectedBulkBillIds.length === withPhone.length ? [] : withPhone);
                }}
                className="text-emerald-400 hover:text-emerald-300 font-medium"
              >
                {selectedBulkBillIds.length === bills.filter((b) => b.customer_phone).length
                  ? "Deselect All"
                  : "Select All with Phone"}
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {bills.map((b) => {
                const isSelected = selectedBulkBillIds.includes(b.id);
                const hasPhone = Boolean(b.customer_phone);
                return (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "bg-emerald-950/20 border-emerald-500/50"
                        : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700"
                    }`}
                  >
                    <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!hasPhone}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBulkBillIds([...selectedBulkBillIds, b.id]);
                          } else {
                            setSelectedBulkBillIds(selectedBulkBillIds.filter((id) => id !== b.id));
                          }
                        }}
                        className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500/20"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-100 text-sm truncate">{b.customer_name}</span>
                          <span className="text-xs font-mono text-zinc-400">#{b.bill_no}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                          <span>{hasPhone ? b.customer_phone : "No phone number"}</span>
                          <span>•</span>
                          <span className="font-mono text-emerald-400">{formatINR(b.total_amount)}</span>
                          {b.balance_due > 0 && (
                            <span className="text-amber-300 font-mono">({formatINR(b.balance_due)} due)</span>
                          )}
                        </div>
                      </div>
                    </label>

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!hasPhone || sendingBillId === b.id}
                      isLoading={sendingBillId === b.id}
                      onClick={() => sendInvoiceWhatsApp(b)}
                      className="shrink-0 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40"
                    >
                      Send Now
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button variant="secondary" onClick={() => setIsWhatsAppModalOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                icon={PaperPlaneTilt}
                disabled={selectedBulkBillIds.length === 0 || isBulkSending}
                isLoading={isBulkSending}
                loadingText="Dispatching batch…"
                onClick={async () => {
                  try {
                    setIsBulkSending(true);
                    const res = await api.post("/bills/bulk-whatsapp", {
                      bill_ids: selectedBulkBillIds,
                      delay_seconds: 2,
                    });
                    toast.success(
                      `Dispatched ${res.data.sent} bills. Skipped ${res.data.skipped}. Failed ${res.data.failed}.`
                    );
                    setIsWhatsAppModalOpen(false);
                    setSelectedBulkBillIds([]);
                  } catch (err) {
                    toast.error(err.response?.data?.detail || "Batch dispatch failed");
                  } finally {
                    setIsBulkSending(false);
                  }
                }}
              >
                Send Selected ({selectedBulkBillIds.length})
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── EXPLICIT NAMED DELETE CONFIRMATION (PRD v2 Section 11 #6) ── */}
      <ConfirmDialog
        isOpen={Boolean(billToDelete)}
        onClose={() => setBillToDelete(null)}
        recordName={`Bill #${billToDelete?.bill_no}`}
        title="Delete Bill"
        message={`Are you sure you want to permanently delete Bill #${billToDelete?.bill_no} for ${billToDelete?.customer_name}? Outstanding balances will be recalculated.`}
        confirmText="Delete Bill"
        isLoading={deleteMutation.isPending}
        onConfirm={() => billToDelete && deleteMutation.mutate(billToDelete.id)}
      />
    </div>
  );
}
