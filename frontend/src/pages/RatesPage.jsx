import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IndianRupee, Users, Package, Plus, Edit2,
  Trash2, History, ArrowRight, ShieldCheck, Sparkles, X,
  CircleDot, CheckCircle2, TrendingUp, Search, ChevronDown, ChevronUp
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 10;

export default function RatesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("base"); // base | customer | history
  const [search, setSearch] = useState("");
  const [baseSearch, setBaseSearch] = useState("");
  const [basePage, setBasePage] = useState(1);
  const [custPage, setCustPage] = useState(1);
  const [histPage, setHistPage] = useState(1);

  // Rate Tester Collapsible State
  const [showTester, setShowTester] = useState(false);
  const [testCustId, setTestCustId] = useState("");
  const [testProdId, setTestProdId] = useState("");
  const [testIsLive, setTestIsLive] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Customer Modal state
  const [isCustModalOpen, setIsCustModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [custForm, setCustForm] = useState({ customer_id: "", product_id: "", rate: "", live_rate: "" });

  // Product Live Rate Modal state
  const [editingLiveProduct, setEditingLiveProduct] = useState(null);
  const [liveRateInput, setLiveRateInput] = useState("");

  // Data fetching
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers").then((r) => r.data),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/products").then((r) => r.data),
  });

  const { data: baseRates = [], isLoading: loadingBase } = useQuery({
    queryKey: ["rates", "products"],
    queryFn: () => api.get("/rates/products").then((r) => r.data),
  });

  const { data: customerRates = [], isLoading: loadingCust } = useQuery({
    queryKey: ["rates", "customers"],
    queryFn: () => api.get("/rates/customers").then((r) => r.data),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["rates", "history"],
    queryFn: () => api.get("/rates/history").then((r) => r.data),
  });

  // Save base product live rate
  const saveProductLiveRateMutation = useMutation({
    mutationFn: ({ productId, liveRate }) =>
      api.post(`/rates/products/${productId}/live-rate`, {
        live_rate: liveRate !== "" && liveRate !== null && !isNaN(parseFloat(liveRate))
          ? parseFloat(liveRate)
          : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(["rates"]);
      toast.success("Live Fish rate updated successfully");
      setEditingLiveProduct(null);
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to update live rate"),
  });

  // Save customer rate (create or update)
  const saveCustRateMutation = useMutation({
    mutationFn: (data) =>
      api.post("/rates/customers", {
        customer_id: parseInt(data.customer_id),
        product_id: parseInt(data.product_id),
        rate: parseFloat(data.rate),
        live_rate: data.live_rate !== "" && data.live_rate !== null && !isNaN(parseFloat(data.live_rate))
          ? parseFloat(data.live_rate)
          : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(["rates"]);
      toast.success(editingRate ? "Custom rate updated" : "Custom rate saved");
      closeCustModal();
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to save rate"),
  });

  const deleteCustRateMutation = useMutation({
    mutationFn: (id) => api.delete(`/rates/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["rates"]);
      toast.success("Custom rate removed");
    },
  });

  const openNewCustModal = () => {
    setEditingRate(null);
    setCustForm({
      customer_id: customers[0]?.id ?? "",
      product_id: products[0]?.id ?? "",
      rate: "",
      live_rate: "",
    });
    setIsCustModalOpen(true);
  };

  const openEditCustModal = (r) => {
    setEditingRate(r);
    setCustForm({
      customer_id: r.customer_id,
      product_id: r.product_id,
      rate: String(r.rate),
      live_rate: r.live_rate !== null && r.live_rate !== undefined ? String(r.live_rate) : "",
    });
    setIsCustModalOpen(true);
  };

  const closeCustModal = () => {
    setIsCustModalOpen(false);
    setEditingRate(null);
  };

  const handleSaveCustRate = () => {
    if (!custForm.customer_id) return toast.error("Select a customer");
    if (!custForm.product_id) return toast.error("Select a product");
    const rateVal = parseFloat(custForm.rate);
    if (isNaN(rateVal) || rateVal < 0) return toast.error("Enter a valid standard rate");
    saveCustRateMutation.mutate(custForm);
  };

  const handleTestResolution = async () => {
    if (!testProdId) { toast.error("Select a product"); return; }
    try {
      const url = `/rates/effective?product_id=${testProdId}${testCustId ? `&customer_id=${testCustId}` : ""}&is_live=${testIsLive}`;
      const res = await api.get(url);
      setTestResult(res.data);
    } catch {
      toast.error("Rate lookup failed");
    }
  };

  const openEditLiveRateModal = (prod) => {
    setEditingLiveProduct(prod);
    setLiveRateInput(prod.live_rate !== null && prod.live_rate !== undefined ? String(prod.live_rate) : "");
  };

  const handleSaveLiveRate = () => {
    if (!editingLiveProduct) return;
    saveProductLiveRateMutation.mutate({
      productId: editingLiveProduct.product_id,
      liveRate: liveRateInput,
    });
  };

  const filteredRates = customerRates.filter(
    (r) =>
      r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBaseRates = baseRates.filter(
    (r) =>
      r.product_name?.toLowerCase().includes(baseSearch.toLowerCase()) ||
      (r.product_code && r.product_code.toLowerCase().includes(baseSearch.toLowerCase()))
  );

  const totalBasePages = Math.ceil(filteredBaseRates.length / PAGE_SIZE) || 1;
  const paginatedBaseRates = useMemo(() => {
    const start = (basePage - 1) * PAGE_SIZE;
    return filteredBaseRates.slice(start, start + PAGE_SIZE);
  }, [filteredBaseRates, basePage]);

  const totalCustPages = Math.ceil(filteredRates.length / PAGE_SIZE) || 1;
  const paginatedCustRates = useMemo(() => {
    const start = (custPage - 1) * PAGE_SIZE;
    return filteredRates.slice(start, start + PAGE_SIZE);
  }, [filteredRates, custPage]);

  const totalHistPages = Math.ceil(history.length / PAGE_SIZE) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (histPage - 1) * PAGE_SIZE;
    return history.slice(start, start + PAGE_SIZE);
  }, [history, histPage]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
            Rates Management
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Set default product rates, live fish rates, and customer special overrides
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowTester(!showTester)}
            className={`btn-secondary text-xs sm:text-sm flex items-center gap-2 ${
              showTester ? "bg-zinc-800 text-emerald-400 border-emerald-500/30" : ""
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Test Rate</span>
            {showTester ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => {
              if (activeTab === "base" && baseRates.length > 0) {
                openEditLiveRateModal(baseRates[0]);
              } else {
                openNewCustModal();
              }
            }}
            className="btn-primary text-xs sm:text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === "base" ? "Set Live Fish Rate" : "Add Custom Rate"}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Rate Tester (Keeps the main page calm and uncluttered) */}
      {showTester && (
        <div className="card p-4 sm:p-5 border-zinc-800 animate-slide-in">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-zinc-200">Rate Calculator & Resolution Checker</h3>
            </div>
            <button
              onClick={() => setShowTester(false)}
              className="p-1 text-zinc-400 hover:text-zinc-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Customer (Optional)</label>
              <select
                value={testCustId}
                onChange={(e) => setTestCustId(e.target.value)}
                className="input-field text-xs sm:text-sm"
              >
                <option value="">— Standard Base Rate —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Product *</label>
              <select
                value={testProdId}
                onChange={(e) => setTestProdId(e.target.value)}
                className="input-field text-xs sm:text-sm"
              >
                <option value="">— Select product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product_code ? `[${p.product_code}] ` : ""}{p.name} ({p.unit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <label className="flex items-center gap-2.5 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg cursor-pointer text-xs sm:text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={testIsLive}
                  onChange={(e) => setTestIsLive(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-0"
                />
                <span className="flex items-center gap-1.5 font-medium">
                  <CircleDot className="w-3.5 h-3.5 text-emerald-400" />
                  Live Fish (Circled ⊚)
                </span>
              </label>
            </div>
            <button
              onClick={handleTestResolution}
              className="btn-primary text-xs sm:text-sm flex items-center justify-center gap-1.5"
            >
              <span>Calculate</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {testResult && (
            <div className="mt-4 p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-200">{testResult.product_name}</span>
                    {testResult.is_live && (
                      <span className="badge-green text-[10px]">⊚ Live Fish</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 mt-0.5 block">
                    Source: <strong className="capitalize text-zinc-300">{testResult.rate_type.replace("_", " ")}</strong>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold font-mono text-emerald-400">
                  ₹{Number(testResult.rate).toFixed(2)}
                </div>
                <div className="text-[11px] text-zinc-500">per unit</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clean Segmented Navigation */}
      <div className="segmented-nav self-start">
        <button
          onClick={() => setActiveTab("base")}
          className={`segmented-item flex items-center gap-2 ${activeTab === "base" ? "active" : ""}`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Product Rates ({baseRates.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("customer")}
          className={`segmented-item flex items-center gap-2 ${activeTab === "customer" ? "active" : ""}`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customer Overrides ({customerRates.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`segmented-item flex items-center gap-2 ${activeTab === "history" ? "active" : ""}`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Rate History</span>
        </button>
      </div>

      {/* ─── TAB 1: PRODUCT BASE & LIVE RATES ──────────────────────────── */}
      {activeTab === "base" && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search products..."
                value={baseSearch}
                onChange={(e) => {
                  setBaseSearch(e.target.value);
                  setBasePage(1);
                }}
                className="input-field pl-9 text-xs sm:text-sm"
              />
            </div>
            <div className="text-xs text-zinc-400">
              Showing {filteredBaseRates.length} products
            </div>
          </div>

          {loadingBase ? (
            <div className="p-12 flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
            </div>
          ) : filteredBaseRates.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">
              No products found matching your search.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Product Name</th>
                      <th>Standard Rate</th>
                      <th>Live Fish Rate (⊚)</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBaseRates.map((r) => {
                      const hasLive = r.live_rate !== null && r.live_rate !== undefined && r.live_rate > 0;
                      return (
                        <tr key={r.id}>
                          <td className="font-mono font-medium text-xs text-zinc-400">
                            {r.product_code || "—"}
                          </td>
                          <td className="font-medium text-zinc-100">
                            {r.product_name} <span className="text-xs text-zinc-500 font-mono">({r.unit || "kg"})</span>
                          </td>
                          <td className="font-mono text-zinc-200">
                            ₹{Number(r.rate).toFixed(2)}
                          </td>
                          <td className="font-mono">
                            {hasLive ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                                <CircleDot className="w-3.5 h-3.5" />
                                ₹{Number(r.live_rate).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-xs italic">Same as standard</span>
                            )}
                          </td>
                          <td>
                            {hasLive ? (
                              <span className="badge-green">Live Rate Active</span>
                            ) : (
                              <span className="badge-zinc">Standard Only</span>
                            )}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => openEditLiveRateModal(r)}
                              className="btn-ghost btn-sm text-xs text-emerald-400 hover:text-emerald-300"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>{hasLive ? "Edit Live Rate" : "Set Live Rate"}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List (< md) */}
              <div className="block md:hidden p-3 sm:p-4 flex flex-col gap-3.5">
                {paginatedBaseRates.map((r) => {
                  const hasLive = r.live_rate !== null && r.live_rate !== undefined && r.live_rate > 0;
                  return (
                    <div key={r.id} className="p-4 flex flex-col gap-3.5 bg-zinc-900/90 border border-zinc-800/90 rounded-xl shadow-sm hover:border-zinc-700/80 transition-all">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-zinc-100 text-sm">{r.product_name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="badge-zinc font-mono text-[10px]">{r.product_code || "No Code"}</span>
                            <span className="text-xs text-zinc-400 font-mono">Unit: {r.unit || "kg"}</span>
                          </div>
                        </div>
                        <span className={hasLive ? "badge-green text-xs" : "badge-zinc text-xs"}>
                          {hasLive ? "Live Active" : "Standard Only"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/70 text-xs">
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Standard Rate</span>
                          <span className="font-mono font-medium text-zinc-200 mt-0.5 block">
                            ₹{Number(r.rate).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Live Fish (⊚)</span>
                          {hasLive ? (
                            <span className="font-mono font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                              <CircleDot className="w-3 h-3" />
                              ₹{Number(r.live_rate).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-xs italic mt-0.5 block">Same as std</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => openEditLiveRateModal(r)}
                        className="btn-secondary btn-sm w-full flex items-center justify-center gap-1.5 text-xs text-emerald-400 border-zinc-800 hover:border-emerald-500/30 py-2"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{hasLive ? "Update Live Fish Rate" : "Set Live Fish Rate"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <Pagination
                page={basePage}
                totalPages={totalBasePages}
                totalItems={filteredBaseRates.length}
                pageSize={PAGE_SIZE}
                onPageChange={setBasePage}
              />
            </>
          )}
        </div>
      )}

      {/* ─── TAB 2: CUSTOMER SPECIAL RATES ─────────────────────────────── */}
      {activeTab === "customer" && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search customer or product..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCustPage(1);
                }}
                className="input-field pl-9 text-xs sm:text-sm"
              />
            </div>
            <button
              onClick={openNewCustModal}
              className="btn-primary btn-sm flex items-center gap-1 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Rate</span>
            </button>
          </div>

          {loadingCust ? (
            <div className="p-12 flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
            </div>
          ) : filteredRates.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">
              {search ? "No custom rates match your search." : "No custom rates added. All customers use base product rates."}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Standard Rate</th>
                      <th>Live Fish Rate (⊚)</th>
                      <th>Last Updated</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCustRates.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium text-zinc-100">{r.customer_name}</td>
                        <td className="text-zinc-300">
                          {r.product_name} <span className="text-xs text-zinc-500">({r.unit})</span>
                        </td>
                        <td className="font-mono font-medium text-zinc-200">
                          ₹{Number(r.rate).toFixed(2)}
                        </td>
                        <td className="font-mono">
                          {r.live_rate !== null && r.live_rate !== undefined ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                              <CircleDot className="w-3.5 h-3.5" />
                              ₹{Number(r.live_rate).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-xs">—</span>
                          )}
                        </td>
                        <td className="text-xs text-zinc-400">
                          {new Date(r.updated_at).toLocaleDateString()}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditCustModal(r)}
                              className="btn-ghost btn-sm !px-2"
                              title="Edit rate"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Remove custom rate for ${r.customer_name} → ${r.product_name}?`)) {
                                  deleteCustRateMutation.mutate(r.id);
                                }
                              }}
                              className="btn-ghost btn-sm !px-2 hover:text-rose-400 hover:bg-rose-500/10"
                              title="Delete rate"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List (< md) */}
              <div className="block md:hidden p-3 sm:p-4 flex flex-col gap-3.5">
                {paginatedCustRates.map((r) => (
                  <div key={r.id} className="p-4 flex flex-col gap-3.5 bg-zinc-900/90 border border-zinc-800/90 rounded-xl shadow-sm hover:border-zinc-700/80 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-zinc-100 text-sm">{r.customer_name}</div>
                      <div className="text-xs text-zinc-500">{new Date(r.updated_at).toLocaleDateString()}</div>
                    </div>

                    <div className="text-xs text-zinc-300">
                      Product: <span className="text-zinc-100 font-medium">{r.product_name}</span>{" "}
                      <span className="text-zinc-500 font-mono">({r.unit || "kg"})</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/70 text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Standard Rate</span>
                        <span className="font-mono font-medium text-zinc-200 mt-0.5 block">
                          ₹{Number(r.rate).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Live Rate (⊚)</span>
                        {r.live_rate !== null && r.live_rate !== undefined ? (
                          <span className="font-mono font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                            <CircleDot className="w-3.5 h-3.5" />
                            ₹{Number(r.live_rate).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-xs mt-0.5 block">—</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => openEditCustModal(r)}
                        className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1.5 text-xs py-2"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Edit Rate</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove custom rate for ${r.customer_name} → ${r.product_name}?`)) {
                            deleteCustRateMutation.mutate(r.id);
                          }
                        }}
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all"
                        title="Delete rate"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                page={custPage}
                totalPages={totalCustPages}
                totalItems={filteredRates.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCustPage}
              />
            </>
          )}
        </div>
      )}

      {/* ─── TAB 3: RATE AUDIT HISTORY ─────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-200">Rate Change Audit Log</h3>
          </div>
          {history.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">No rate changes recorded yet.</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Target</th>
                      <th>Old Rate</th>
                      <th>New Rate</th>
                      <th>Updated By</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <span className="badge-zinc uppercase text-[10px]">
                            {h.rate_type.replace("_", " ")}
                          </span>
                        </td>
                        <td>
                          <span className="font-medium text-zinc-200">{h.product_name}</span>
                          {h.customer_name && (
                            <span className="text-xs text-zinc-400 block">Customer: {h.customer_name}</span>
                          )}
                        </td>
                        <td className="font-mono text-zinc-500 line-through">
                          {h.old_rate !== null ? `₹${Number(h.old_rate).toFixed(2)}` : "—"}
                        </td>
                        <td className="font-mono font-medium text-emerald-400">
                          ₹{Number(h.new_rate).toFixed(2)}
                        </td>
                        <td className="text-xs text-zinc-400">{h.changed_by}</td>
                        <td className="text-xs text-zinc-500">{new Date(h.changed_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List (< md) */}
              <div className="block md:hidden p-3 sm:p-4 flex flex-col gap-3.5">
                {paginatedHistory.map((h) => (
                  <div key={h.id} className="p-4 flex flex-col gap-3 text-xs bg-zinc-900/90 border border-zinc-800/90 rounded-xl shadow-sm hover:border-zinc-700/80 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="badge-zinc uppercase text-[10px]">
                        {h.rate_type.replace("_", " ")}
                      </span>
                      <span className="text-zinc-500 text-[11px]">{new Date(h.changed_at).toLocaleDateString()}</span>
                    </div>

                    <div className="font-semibold text-zinc-100 text-sm">
                      {h.product_name}
                      {h.customer_name && (
                        <span className="text-xs text-zinc-400 block font-normal mt-0.5">Customer: {h.customer_name}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/70">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase block">Old Rate</span>
                        <span className="font-mono text-zinc-500 line-through mt-0.5 block">
                          {h.old_rate !== null ? `₹${Number(h.old_rate).toFixed(2)}` : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500 uppercase block">New Rate</span>
                        <span className="font-mono font-bold text-emerald-400 mt-0.5 block">
                          ₹{Number(h.new_rate).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-400 pt-0.5">
                      Changed by: <span className="text-zinc-200">{h.changed_by}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                page={histPage}
                totalPages={totalHistPages}
                totalItems={history.length}
                pageSize={PAGE_SIZE}
                onPageChange={setHistPage}
              />
            </>
          )}
        </div>
      )}

      {/* ─── MODAL: EDIT PRODUCT LIVE FISH RATE ────────────────────────── */}
      {editingLiveProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md animate-slide-in">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  Set Live Fish Rate (⊚)
                </h3>
                <p className="text-xs text-zinc-400">
                  {editingLiveProduct.product_name} ({editingLiveProduct.product_code || "No code"})
                </p>
              </div>
              <button
                onClick={() => setEditingLiveProduct(null)}
                className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400 block">Current Standard Rate</span>
                  <span className="text-sm font-bold font-mono text-zinc-200">
                    ₹{Number(editingLiveProduct.rate).toFixed(2)} / {editingLiveProduct.unit || "kg"}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500">Standard</span>
              </div>

              <div>
                <label className="label">
                  Live Fish Rate (₹ / {editingLiveProduct.unit || "kg"})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 160.00"
                    value={liveRateInput}
                    onChange={(e) => setLiveRateInput(e.target.value)}
                    className="input-field pl-7 font-mono font-medium text-emerald-400"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Applied when an item is circled ⊚ in ledger scans.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingLiveProduct(null)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLiveRate}
                  disabled={saveProductLiveRateMutation.isPending}
                  className="btn-primary btn-sm"
                >
                  {saveProductLiveRateMutation.isPending ? "Saving..." : "Save Rate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD / EDIT CUSTOMER RATE ───────────────────────────── */}
      {isCustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md animate-slide-in">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-100">
                {editingRate ? "Edit Customer Rate" : "Add Customer Rate"}
              </h3>
              <button onClick={closeCustModal} className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="label">
                  Customer <span className="text-rose-400">*</span>
                </label>
                <select
                  value={custForm.customer_id}
                  onChange={(e) => setCustForm({ ...custForm, customer_id: e.target.value })}
                  className="input-field text-sm"
                  disabled={!!editingRate}
                >
                  <option value="">— Select customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  Product <span className="text-rose-400">*</span>
                </label>
                <select
                  value={custForm.product_id}
                  onChange={(e) => setCustForm({ ...custForm, product_id: e.target.value })}
                  className="input-field text-sm"
                  disabled={!!editingRate}
                >
                  <option value="">— Select product —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  Standard Rate (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={custForm.rate}
                    onChange={(e) => setCustForm({ ...custForm, rate: e.target.value })}
                    className="input-field pl-7 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="label">
                  Live Fish Rate (₹) <span className="text-zinc-500 font-normal">(optional override)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Leave blank to use base live rate"
                    value={custForm.live_rate}
                    onChange={(e) => setCustForm({ ...custForm, live_rate: e.target.value })}
                    className="input-field pl-7 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button type="button" onClick={closeCustModal} className="btn-secondary btn-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustRate}
                  disabled={saveCustRateMutation.isPending}
                  className="btn-primary btn-sm"
                >
                  {saveCustRateMutation.isPending ? "Saving…" : (editingRate ? "Update Rate" : "Save Rate")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
