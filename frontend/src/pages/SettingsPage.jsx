import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings as SettingsIcon, Package, Users, Tag, Plus, Trash2, Check,
  AlertCircle, RefreshCw, ArrowRight, ToggleLeft, ToggleRight, Sparkles
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("columns"); // columns | aliases | tags

  // --- Column Mappings State ---
  const [newColCode, setNewColCode] = useState("");
  const [newColProductId, setNewColProductId] = useState("");

  // --- Customer Aliases State ---
  const [newAliasCustomerId, setNewAliasCustomerId] = useState("");
  const [newAliasText, setNewAliasText] = useState("");

  // --- Tag Dictionary State ---
  const [newTagCode, setNewTagCode] = useState("");
  const [newTagMeaning, setNewTagMeaning] = useState("");

  // Queries
  const { data: columnMappings = [], isLoading: loadingCols } = useQuery({
    queryKey: ["settings", "columns"],
    queryFn: async () => (await api.get("/settings/columns")).data,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get("/customers")).data,
  });

  const { data: aliases = [], isLoading: loadingAliases } = useQuery({
    queryKey: ["settings", "aliases"],
    queryFn: async () => (await api.get("/settings/aliases")).data,
  });

  const { data: tags = [], isLoading: loadingTags } = useQuery({
    queryKey: ["settings", "tags"],
    queryFn: async () => (await api.get("/settings/tags")).data,
  });

  // Mutations - Column Mapping
  const saveColMappingMutation = useMutation({
    mutationFn: async ({ column_code, product_id, active = true }) => {
      return (await api.post("/settings/columns", {
        column_code: column_code.trim().toUpperCase(),
        product_id: Number(product_id),
        active,
      })).data;
    },
    onSuccess: () => {
      toast.success("Column mapping saved!");
      queryClient.invalidateQueries(["settings", "columns"]);
      setNewColCode("");
      setNewColProductId("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to save column mapping");
    },
  });

  const deleteColMappingMutation = useMutation({
    mutationFn: async (id) => {
      return (await api.delete(`/settings/columns/${id}`)).data;
    },
    onSuccess: () => {
      toast.success("Column mapping removed");
      queryClient.invalidateQueries(["settings", "columns"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to remove mapping");
    },
  });

  // Mutations - Customer Alias
  const saveAliasMutation = useMutation({
    mutationFn: async ({ customer_id, alias }) => {
      return (await api.post("/settings/aliases", {
        customer_id: Number(customer_id),
        alias: alias.trim(),
      })).data;
    },
    onSuccess: () => {
      toast.success("Alias saved!");
      queryClient.invalidateQueries(["settings", "aliases"]);
      setNewAliasCustomerId("");
      setNewAliasText("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to save alias");
    },
  });

  const deleteAliasMutation = useMutation({
    mutationFn: async (id) => {
      return (await api.delete(`/settings/aliases/${id}`)).data;
    },
    onSuccess: () => {
      toast.success("Alias removed");
      queryClient.invalidateQueries(["settings", "aliases"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to remove alias");
    },
  });

  // Mutations - Tag Dictionary
  const saveTagMutation = useMutation({
    mutationFn: async ({ tag, meaning }) => {
      return (await api.post("/settings/tags", {
        tag: tag.trim().toUpperCase(),
        meaning: meaning.trim(),
      })).data;
    },
    onSuccess: () => {
      toast.success("Tag saved!");
      queryClient.invalidateQueries(["settings", "tags"]);
      setNewTagCode("");
      setNewTagMeaning("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to save tag");
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id) => {
      return (await api.delete(`/settings/tags/${id}`)).data;
    },
    onSuccess: () => {
      toast.success("Tag removed");
      queryClient.invalidateQueries(["settings", "tags"]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to remove tag");
    },
  });

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <SettingsIcon className="w-4 h-4" /> System Configuration
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 mt-1">Settings & Ledger Mappings</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Configure column letters to product mappings, customer alias spellings, and tag indicators.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("columns")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "columns"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Column Mappings
          </button>
          <button
            onClick={() => setActiveTab("aliases")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "aliases"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Customer Aliases
          </button>
          <button
            onClick={() => setActiveTab("tags")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "tags"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Tag Dictionary
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 1: COLUMN MAPPINGS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === "columns" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          {/* Quick Explainer Banner */}
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-300 space-y-1">
              <p className="font-semibold text-emerald-300">How Ledger Column Mapping Works:</p>
              <p className="text-zinc-400">
                Your handwritten ledger uses shorthand column codes like <span className="font-mono text-zinc-200 font-bold">M, R, B, P, K, T, JB</span>.
                Here you map each column code to the actual product in your system. Whenever an image is scanned, rates and products are automatically resolved from your database.
              </p>
            </div>
          </div>

          {/* Add / Update Mapping Form */}
          <div className="card p-5 border border-zinc-800 bg-zinc-900/60">
            <h3 className="text-sm font-bold text-zinc-100 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" /> Map Ledger Column to Product
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-3">
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Column Code (e.g. M, R, B)
                </label>
                <input
                  type="text"
                  placeholder="e.g. M"
                  value={newColCode}
                  onChange={(e) => setNewColCode(e.target.value.toUpperCase())}
                  className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono font-bold w-full focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Target Product
                </label>
                <select
                  value={newColProductId}
                  onChange={(e) => setNewColProductId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-100 w-full focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.product_code ? `[Code: ${p.product_code}]` : ""} ({p.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <button
                  type="button"
                  disabled={!newColCode.trim() || !newColProductId || saveColMappingMutation.isLoading}
                  onClick={() =>
                    saveColMappingMutation.mutate({
                      column_code: newColCode,
                      product_id: newColProductId,
                    })
                  }
                  className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {saveColMappingMutation.isLoading ? "Saving..." : "Save Mapping"}
                </button>
              </div>
            </div>
          </div>

          {/* Mappings Table */}
          <div className="card overflow-hidden border border-zinc-800">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-200">Active Column Mappings</h3>
                <p className="text-xs text-zinc-500">{columnMappings.length} column(s) configured</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Column Code</th>
                    <th className="py-3 px-4">Mapped Product</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {columnMappings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-500">
                        No column mappings configured yet. Add one above to get started!
                      </td>
                    </tr>
                  ) : (
                    columnMappings.map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-sm text-zinc-100">
                          <span className="px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700/60 inline-block">
                            {m.column_code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-emerald-400 text-sm">
                          {m.product_name || `Product #${m.product_id}`}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              saveColMappingMutation.mutate({
                                column_code: m.column_code,
                                product_id: m.product_id,
                                active: !m.active,
                              })
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                              m.active
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                            }`}
                          >
                            {m.active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteColMappingMutation.mutate(m.id)}
                            className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete mapping"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 2: CUSTOMER ALIASES */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === "aliases" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400">
            Aliases help map handwritten variations or nicknames (e.g. <span className="text-zinc-200 font-medium">"Ramesh K"</span>, <span className="text-zinc-200 font-medium">"Ramesh Bhai"</span>) to the primary Customer record (<span className="text-emerald-400 font-medium">"Ramesh Kumar"</span>).
          </div>

          {/* Add Alias Form */}
          <div className="card p-5 border border-zinc-800 bg-zinc-900/60">
            <h3 className="text-sm font-bold text-zinc-100 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" /> Add Customer Alias
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Customer
                </label>
                <select
                  value={newAliasCustomerId}
                  onChange={(e) => setNewAliasCustomerId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-100 w-full focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Handwritten Alias / Nickname
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh K"
                  value={newAliasText}
                  onChange={(e) => setNewAliasText(e.target.value)}
                  className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-100 w-full focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="button"
                  disabled={!newAliasCustomerId || !newAliasText.trim() || saveAliasMutation.isLoading}
                  onClick={() =>
                    saveAliasMutation.mutate({
                      customer_id: newAliasCustomerId,
                      alias: newAliasText,
                    })
                  }
                  className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {saveAliasMutation.isLoading ? "Saving..." : "Save Alias"}
                </button>
              </div>
            </div>
          </div>

          {/* Aliases Table */}
          <div className="card overflow-hidden border border-zinc-800">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-200">Existing Aliases</h3>
              <p className="text-xs text-zinc-500">{aliases.length} alias(es) stored</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Primary Customer</th>
                    <th className="py-3 px-4">Alias / Variation</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {aliases.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-zinc-500">
                        No aliases added yet.
                      </td>
                    </tr>
                  ) : (
                    aliases.map((a) => (
                      <tr key={a.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-zinc-100 text-sm">
                          {a.customer_name || `Customer #${a.customer_id}`}
                        </td>
                        <td className="py-3 px-4 text-amber-300 font-mono text-sm">
                          "{a.alias}"
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteAliasMutation.mutate(a.id)}
                            className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete alias"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 3: TAG DICTIONARY */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === "tags" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400">
            Define shorthand symbols used in handwritten ledgers (e.g. <span className="font-mono text-amber-400 font-bold">F</span> for Free, <span className="font-mono text-amber-400 font-bold">D</span> for Damaged, <span className="font-mono text-amber-400 font-bold">R</span> for Return).
          </div>

          {/* Add Tag Form */}
          <div className="card p-5 border border-zinc-800 bg-zinc-900/60">
            <h3 className="text-sm font-bold text-zinc-100 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" /> Add Tag Definition
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-3">
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Tag Letter / Symbol
                </label>
                <input
                  type="text"
                  placeholder="e.g. F"
                  value={newTagCode}
                  onChange={(e) => setNewTagCode(e.target.value.toUpperCase())}
                  className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono font-bold w-full focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                  Meaning / Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Free Sample / Bonus"
                  value={newTagMeaning}
                  onChange={(e) => setNewTagMeaning(e.target.value)}
                  className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-100 w-full focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="button"
                  disabled={!newTagCode.trim() || !newTagMeaning.trim() || saveTagMutation.isLoading}
                  onClick={() =>
                    saveTagMutation.mutate({
                      tag: newTagCode,
                      meaning: newTagMeaning,
                    })
                  }
                  className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {saveTagMutation.isLoading ? "Saving..." : "Save Tag"}
                </button>
              </div>
            </div>
          </div>

          {/* Tags Table */}
          <div className="card overflow-hidden border border-zinc-800">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-200">Tag Dictionary Entries</h3>
              <p className="text-xs text-zinc-500">{tags.length} tag(s) defined</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Tag</th>
                    <th className="py-3 px-4">Meaning</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {tags.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-zinc-500">
                        No tags defined yet.
                      </td>
                    </tr>
                  ) : (
                    tags.map((t) => (
                      <tr key={t.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-sm">
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {t.tag}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-200 text-sm font-medium">
                          {t.meaning}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteTagMutation.mutate(t.id)}
                            className="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete tag"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
