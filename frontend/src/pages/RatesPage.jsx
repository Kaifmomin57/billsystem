import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IndianRupee, Users, Package, Plus, Edit2,
  Trash2, History, ArrowRight, ShieldCheck, Sparkles, X,
  CircleDot, HelpCircle, CheckCircle2, AlertTriangle, Info, TrendingUp
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";

export default function RatesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("live"); // live | customer | history
  const [search, setSearch] = useState("");
  const [liveSearch, setLiveSearch] = useState("");

  // Customer Modal state
  const [isCustModalOpen, setIsCustModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(null); // null = new, obj = edit
  const [custForm, setCustForm] = useState({ customer_id: "", product_id: "", rate: "", live_rate: "" });

  // Product Live Rate Modal state
  const [editingLiveProduct, setEditingLiveProduct] = useState(null); // product rate obj
  const [liveRateInput, setLiveRateInput] = useState("");

  // Rate Tester
  const [testCustId, setTestCustId] = useState("");
  const [testProdId, setTestProdId] = useState("");
  const [testIsLive, setTestIsLive] = useState(false);
  const [testResult, setTestResult] = useState(null);

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
    if (isNaN(rateVal) || rateVal < 0) return toast.error("Enter a valid base rate");
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
      r.product_name?.toLowerCase().includes(liveSearch.toLowerCase()) ||
      (r.product_code && r.product_code.toLowerCase().includes(liveSearch.toLowerCase()))
  );

  const configuredLiveCount = baseRates.filter((r) => r.live_rate !== null && r.live_rate > 0).length;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2.5">
            <IndianRupee className="w-7 h-7 text-emerald-400" />
            Rates Management
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage Standard Rates, <strong>Live Fish (Circled ⊚)</strong> Rates, and Customer Overrides
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              if (activeTab === "live" && baseRates.length > 0) {
                openEditLiveRateModal(baseRates[0]);
              } else {
                openNewCustModal();
              }
            }}
            className="btn-primary inline-flex items-center gap-2 shadow-lg shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            {activeTab === "live" ? "Set Live Fish Rate" : "Add Custom Rate"}
          </button>
        </div>
      </div>

      {/* Live Rate Tester */}
      <div className="card p-5 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-emerald-950/20 border border-emerald-500/20">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> Rate Lookup & Resolution Simulator
          </div>
          <span className="text-[11px] text-zinc-400">
            Checks priority: Customer Live &gt; Base Live &gt; Customer &gt; Base
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Customer (optional)</label>
            <select
              value={testCustId}
              onChange={(e) => setTestCustId(e.target.value)}
              className="input-field w-full text-sm"
            >
              <option value="">— Generic / Standard —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Product *</label>
            <select
              value={testProdId}
              onChange={(e) => setTestProdId(e.target.value)}
              className="input-field w-full text-sm"
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
            <label className="block text-xs text-zinc-400 mb-1">Entry Condition</label>
            <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${testIsLive
              ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-300"
              : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}>
              <input
                type="checkbox"
                checked={testIsLive}
                onChange={(e) => setTestIsLive(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-800 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <CircleDot className="w-3.5 h-3.5 text-cyan-400" />
                Live Fish (Circled ⊚)
              </span>
            </label>
          </div>
          <button
            onClick={handleTestResolution}
            className="btn-primary h-[42px] flex items-center justify-center gap-2"
          >
            Check Rate <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {testResult && (
          <div className="mt-4 p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${testResult.is_live
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : testResult.rate_type.includes("customer")
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                }`}>
                {testResult.is_live ? <CircleDot className="w-5 h-5 text-cyan-400" /> : <ShieldCheck className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">{testResult.product_name}</span>
                  {testResult.is_live && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      ⊚ LIVE FISH
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-400 block mt-0.5">
                  Resolution: <strong className="capitalize text-zinc-200">{testResult.rate_type.replace("_", " ")} rate</strong>
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold font-mono ${testResult.is_live ? "text-cyan-400" : "text-emerald-400"}`}>
                ₹{Number(testResult.rate).toFixed(2)}
              </span>
              <span className="text-[11px] text-zinc-500 block">per unit</span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab("live")}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "live"
            ? "bg-zinc-800 text-cyan-400 border border-cyan-500/30 shadow-sm"
            : "text-zinc-400 hover:text-zinc-200"
            }`}
        >
          <CircleDot className="w-4 h-4 text-cyan-400" />
          Live Fish Rates ({configuredLiveCount}/{baseRates.length})
        </button>
        <button
          onClick={() => setActiveTab("customer")}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "customer"
            ? "bg-zinc-800 text-emerald-400 border border-emerald-500/30 shadow-sm"
            : "text-zinc-400 hover:text-zinc-200"
            }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          Customer Overrides ({customerRates.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "history"
            ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
            : "text-zinc-400 hover:text-zinc-200"
            }`}
        >
          <History className="w-4 h-4" />
          Change History
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: LIVE FISH RATES SECTION                                       */}
      {/* =================================================================== */}
      {activeTab === "live" && (
        <div className="space-y-6">


          {/* Product Live Rates Table */}
          <div className="card overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Package className="w-4 h-4 text-cyan-400" />
                  Product Live Fish Base Rates
                </h3>
                <p className="text-xs text-zinc-400">
                  Default live rates applied for all customers without specific overrides
                </p>
              </div>
              <input
                type="text"
                placeholder="Search products or code..."
                value={liveSearch}
                onChange={(e) => setLiveSearch(e.target.value)}
                className="input-field text-xs w-full sm:w-56"
              />
            </div>

            {loadingBase ? (
              <div className="p-12 flex justify-center">
                <div className="w-7 h-7 rounded-full border-2 border-zinc-700 border-t-cyan-500 animate-spin" />
              </div>
            ) : filteredBaseRates.length === 0 ? (
              <div className="p-12 text-center text-sm text-zinc-500">
                No products found. Add products in the Products page first.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[650px]">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-5">Code</th>
                      <th className="py-3 px-5">Product Name</th>
                      <th className="py-3 px-5">Standard Rate (Dead/Fresh)</th>
                      <th className="py-3 px-5 text-cyan-400">Live Fish Rate (Circled ⊚)</th>
                      <th className="py-3 px-5">Live Markup</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-sm">
                    {filteredBaseRates.map((r) => {
                      const hasLive = r.live_rate !== null && r.live_rate !== undefined && r.live_rate > 0;
                      const diff = hasLive ? r.live_rate - r.rate : 0;
                      const pct = hasLive && r.rate > 0 ? ((diff / r.rate) * 100).toFixed(0) : 0;

                      return (
                        <tr key={r.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3.5 px-5 font-mono font-bold text-xs text-emerald-400">
                            {r.product_code || "—"}
                          </td>
                          <td className="py-3.5 px-5 font-medium text-zinc-100">
                            {r.product_name} <span className="text-xs text-zinc-500 font-mono">({r.unit || "kg"})</span>
                          </td>
                          <td className="py-3.5 px-5 font-mono text-zinc-300 font-semibold">
                            ₹{Number(r.rate).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-5 font-mono font-bold text-cyan-400">
                            {hasLive ? (
                              <span className="flex items-center gap-1.5">
                                <CircleDot className="w-3.5 h-3.5 text-cyan-400" />
                                ₹{Number(r.live_rate).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-zinc-500 font-normal italic text-xs">
                                ₹{Number(r.rate).toFixed(2)} (Standard fallback)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-xs">
                            {hasLive ? (
                              <span className="inline-flex items-center gap-1 font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                <TrendingUp className="w-3 h-3" />
                                +₹{diff.toFixed(2)} ({pct}%)
                              </span>
                            ) : (
                              <span className="text-zinc-600 font-mono">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-xs">
                            {hasLive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                                <CheckCircle2 className="w-3 h-3" /> Active Live Rate
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <AlertTriangle className="w-3 h-3" /> Standard Fallback
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <button
                              onClick={() => openEditLiveRateModal(r)}
                              className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              {hasLive ? "Edit Live Rate" : "Set Live Rate"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: CUSTOMER-SPECIFIC RATES                                      */}
      {/* =================================================================== */}
      {activeTab === "customer" && (
        <div className="card overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Customer-Specific Overrides</h3>
              <p className="text-xs text-zinc-400">
                Special contracted rates per customer (supports standard and live fish rates)
              </p>
            </div>
            <input
              type="text"
              placeholder="Search customer or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field text-xs w-full sm:w-56"
            />
          </div>

          {loadingCust ? (
            <div className="p-12 flex justify-center">
              <div className="w-7 h-7 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
            </div>
          ) : filteredRates.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">
                {search ? "No rates match your search." : "No custom rates set yet. Customers will use the base product rates."}
              </p>
              {!search && (
                <button onClick={openNewCustModal} className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Add First Custom Rate
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 font-semibold uppercase">
                    <th className="py-3 px-5">Customer</th>
                    <th className="py-3 px-5">Product</th>
                    <th className="py-3 px-5">Standard Rate</th>
                    <th className="py-3 px-5 text-cyan-400">Live Rate (⊚)</th>
                    <th className="py-3 px-5">Updated</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-sm">
                  {filteredRates.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3.5 px-5 font-medium text-zinc-100">{r.customer_name}</td>
                      <td className="py-3.5 px-5 text-zinc-300">
                        {r.product_name} <span className="text-xs text-zinc-500">({r.unit})</span>
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-emerald-400">
                        ₹{Number(r.rate).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-bold text-cyan-400">
                        {r.live_rate !== null && r.live_rate !== undefined ? (
                          <span className="flex items-center gap-1">
                            <CircleDot className="w-3.5 h-3.5" />
                            ₹{Number(r.live_rate).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-zinc-600 font-normal font-sans text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-zinc-500">
                        {new Date(r.updated_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditCustModal(r)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Edit rate"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remove custom rate for ${r.customer_name} → ${r.product_name}?`)) {
                                deleteCustRateMutation.mutate(r.id);
                              }
                            }}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete rate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: CHANGE HISTORY                                               */}
      {/* =================================================================== */}
      {activeTab === "history" && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-200">Rate Change Log</h3>
          </div>
          {history.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">No rate changes recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 font-semibold uppercase">
                    <th className="py-3 px-5">Type</th>
                    <th className="py-3 px-5">Target</th>
                    <th className="py-3 px-5">Old Rate</th>
                    <th className="py-3 px-5">New Rate</th>
                    <th className="py-3 px-5">By</th>
                    <th className="py-3 px-5">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-sm">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-zinc-800/30">
                      <td className="py-3.5 px-5">
                        <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${h.rate_type === "base_live"
                          ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                          : h.rate_type === "customer"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-blue-500/10 text-blue-400"
                          }`}>
                          {h.rate_type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-medium text-zinc-100">{h.product_name}</span>
                        {h.customer_name && (
                          <span className="text-xs text-zinc-400 block">For: {h.customer_name}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-zinc-500 line-through">
                        {h.old_rate !== null ? `₹${Number(h.old_rate).toFixed(2)}` : "—"}
                      </td>
                      <td className="py-3.5 px-5 font-mono font-semibold text-emerald-400">
                        ₹{Number(h.new_rate).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-zinc-400">{h.changed_by}</td>
                      <td className="py-3.5 px-5 text-xs text-zinc-500">{new Date(h.changed_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: EDIT PRODUCT LIVE FISH RATE                                  */}
      {/* =================================================================== */}
      {editingLiveProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-cyan-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                  <CircleDot className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100">
                    Set Live Fish Rate (⊚)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {editingLiveProduct.product_name} ({editingLiveProduct.product_code || "No code"})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingLiveProduct(null)}
                className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400 block">Current Standard Rate</span>
                  <span className="text-sm font-bold font-mono text-zinc-200">
                    ₹{Number(editingLiveProduct.rate).toFixed(2)} / {editingLiveProduct.unit || "kg"}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500">Dead / Fresh fish</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <CircleDot className="w-3.5 h-3.5 text-cyan-400" />
                  Live Fish Rate (₹ / {editingLiveProduct.unit || "kg"}) <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400 text-sm font-bold pointer-events-none">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 160.00"
                    value={liveRateInput}
                    onChange={(e) => setLiveRateInput(e.target.value)}
                    className="input-field w-full text-base pl-8 font-mono border-cyan-500/40 focus:border-cyan-400 text-cyan-300 font-bold"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  Applied automatically whenever Gemini AI sees a circle around this item in the ledger.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingLiveProduct(null)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLiveRate}
                  disabled={saveProductLiveRateMutation.isPending}
                  className="btn-primary text-sm px-5 py-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 border-none"
                >
                  {saveProductLiveRateMutation.isPending ? "Saving..." : "Save Live Rate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD / EDIT CUSTOMER RATE                                     */}
      {/* =================================================================== */}
      {isCustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                {editingRate ? "Edit Custom Rate" : "New Custom Rate"}
              </h3>
              <button onClick={closeCustModal} className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {/* Customer */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Customer <span className="text-rose-400">*</span>
                </label>
                <select
                  value={custForm.customer_id}
                  onChange={(e) => setCustForm({ ...custForm, customer_id: e.target.value })}
                  className="input-field w-full text-sm"
                  disabled={!!editingRate}
                >
                  <option value="">— Select customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Product */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Product <span className="text-rose-400">*</span>
                </label>
                <select
                  value={custForm.product_id}
                  onChange={(e) => setCustForm({ ...custForm, product_id: e.target.value })}
                  className="input-field w-full text-sm"
                  disabled={!!editingRate}
                >
                  <option value="">— Select product —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                  ))}
                </select>
              </div>

              {/* Standard Rate */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Standard Rate (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium pointer-events-none">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={custForm.rate}
                    onChange={(e) => setCustForm({ ...custForm, rate: e.target.value })}
                    className="input-field w-full text-sm pl-7 font-mono"
                  />
                </div>
              </div>

              {/* Live Rate (Optional) */}
              <div>
                <label className="block text-xs font-medium text-cyan-400 mb-1.5 flex items-center gap-1.5">
                  <CircleDot className="w-3.5 h-3.5" />
                  Live Fish Rate (₹) <span className="text-zinc-500 font-normal">(optional override)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 text-sm font-medium pointer-events-none">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Leave blank to use base live rate"
                    value={custForm.live_rate}
                    onChange={(e) => setCustForm({ ...custForm, live_rate: e.target.value })}
                    className="input-field w-full text-sm pl-7 font-mono border-cyan-500/30 text-cyan-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button type="button" onClick={closeCustModal} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustRate}
                  disabled={saveCustRateMutation.isPending}
                  className="btn-primary text-sm px-5 py-2"
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
