import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IndianRupee, Users, Package, Plus, Edit2,
  Trash2, History, ArrowRight, ShieldCheck, Sparkles, X
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";

export default function RatesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("customer"); // customer | history
  const [search, setSearch] = useState("");

  // Modal state
  const [isCustModalOpen, setIsCustModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(null); // null = new, obj = edit

  // Form
  const [custForm, setCustForm] = useState({ customer_id: "", product_id: "", rate: "" });

  // Rate Tester
  const [testCustId, setTestCustId] = useState("");
  const [testProdId, setTestProdId] = useState("");
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

  const { data: customerRates = [], isLoading: loadingCust } = useQuery({
    queryKey: ["rates", "customers"],
    queryFn: () => api.get("/rates/customers").then((r) => r.data),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["rates", "history"],
    queryFn: () => api.get("/rates/history").then((r) => r.data),
  });

  // Save customer rate (create or update)
  const saveCustRateMutation = useMutation({
    mutationFn: (data) =>
      api.post("/rates/customers", {
        customer_id: parseInt(data.customer_id),
        product_id: parseInt(data.product_id),
        rate: parseFloat(data.rate),
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
    });
    setIsCustModalOpen(true);
  };

  const openEditCustModal = (r) => {
    setEditingRate(r);
    setCustForm({
      customer_id: r.customer_id,
      product_id: r.product_id,
      rate: String(r.rate),
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
    if (isNaN(rateVal) || rateVal < 0) return toast.error("Enter a valid rate");
    saveCustRateMutation.mutate(custForm);
  };

  const handleTestResolution = async () => {
    if (!testProdId) { toast.error("Select a product"); return; }
    try {
      const url = `/rates/effective?product_id=${testProdId}${testCustId ? `&customer_id=${testCustId}` : ""}`;
      const res = await api.get(url);
      setTestResult(res.data);
    } catch {
      toast.error("Rate lookup failed");
    }
  };

  const filteredRates = customerRates.filter(
    (r) =>
      r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2.5">
            <IndianRupee className="w-7 h-7 text-emerald-400" />
            Custom Rates
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Set special rates per customer per product. Base rates are managed in Products page.
          </p>
        </div>
        <button
          onClick={openNewCustModal}
          className="btn-primary inline-flex items-center gap-2 shadow-lg shadow-emerald-950/40 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Custom Rate
        </button>
      </div>

      {/* Live Rate Tester */}
      <div className="card p-5 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-emerald-950/20 border border-emerald-500/20">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-3">
          <Sparkles className="w-4 h-4" /> Live Rate Lookup
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Customer (optional)</label>
            <select
              value={testCustId}
              onChange={(e) => setTestCustId(e.target.value)}
              className="input-field w-full text-sm"
            >
              <option value="">— Generic / No customer —</option>
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
                <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleTestResolution}
            className="btn-primary h-[42px] flex items-center justify-center gap-2"
          >
            Check Rate <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {testResult && (
          <div className="mt-4 p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${testResult.rate_type === "customer" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border border-blue-500/30"}`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-semibold text-zinc-100">{testResult.product_name}</span>
                <span className="text-xs text-zinc-400 block">
                  Via: <strong className="capitalize text-zinc-200">{testResult.rate_type} rate</strong>
                </span>
              </div>
            </div>
            <span className="text-xl font-bold font-mono text-emerald-400">
              ₹{Number(testResult.rate).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab("customer")}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "customer"
              ? "bg-zinc-800 text-emerald-400 border border-emerald-500/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Users className="w-4 h-4" />
          Customer Overrides ({customerRates.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "history"
              ? "bg-zinc-800 text-emerald-400 border border-emerald-500/30"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <History className="w-4 h-4" />
          Change History
        </button>
      </div>

      {/* Customer Rates Tab */}
      {activeTab === "customer" && (
        <div className="card overflow-hidden">
          <div className="p-3.5 sm:p-4 border-b border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-zinc-200">Customer-Specific Rates</h3>
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
              <table className="w-full text-left min-w-[550px]">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 font-semibold uppercase">
                    <th className="py-3 px-5">Customer</th>
                    <th className="py-3 px-5">Product</th>
                    <th className="py-3 px-5">Custom Rate</th>
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

      {/* History Tab */}
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
                        <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${h.rate_type === "customer" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
                          {h.rate_type}
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

      {/* Add / Edit Customer Rate Modal */}
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
                {editingRate && (
                  <p className="text-xs text-zinc-600 mt-1">Customer & product cannot be changed — delete and recreate instead.</p>
                )}
              </div>

              {/* Rate */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Special Rate (₹) <span className="text-rose-400">*</span>
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
                    autoFocus
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
