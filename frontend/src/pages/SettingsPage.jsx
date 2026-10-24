import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GearSix,
  Package,
  Users,
  Tag,
  Plus,
  Trash,
  Check,
  Sparkle,
  ArrowRight,
} from "@phosphor-icons/react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Input";
import { FormField } from "../components/ui/FormField";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

function InfoBanner({ icon: Icon, title, children }) {
  return (
    <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
      <Icon size={20} weight="bold" className="text-emerald-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-base font-semibold text-emerald-300">{title}</p>
        <p className="text-sm text-zinc-400 mt-1">{children}</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("columns"); // columns | aliases | tags
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'column'|'alias'|'tag', item: object }

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
    mutationFn: async ({ column_code, product_id, active = true }) =>
      (
        await api.post("/settings/columns", {
          column_code: column_code.trim().toUpperCase(),
          product_id: Number(product_id),
          active,
        })
      ).data,
    onSuccess: () => {
      toast.success("Column mapping saved!");
      queryClient.invalidateQueries(["settings", "columns"]);
      setNewColCode("");
      setNewColProductId("");
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to save column mapping"),
  });

  const deleteColMappingMutation = useMutation({
    mutationFn: async (id) => (await api.delete(`/settings/columns/${id}`)).data,
    onSuccess: () => {
      toast.success("Column mapping removed");
      queryClient.invalidateQueries(["settings", "columns"]);
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to remove mapping"),
  });

  // Mutations - Customer Alias
  const saveAliasMutation = useMutation({
    mutationFn: async ({ customer_id, alias }) =>
      (
        await api.post("/settings/aliases", {
          customer_id: Number(customer_id),
          alias: alias.trim(),
        })
      ).data,
    onSuccess: () => {
      toast.success("Alias saved!");
      queryClient.invalidateQueries(["settings", "aliases"]);
      setNewAliasCustomerId("");
      setNewAliasText("");
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to save alias"),
  });

  const deleteAliasMutation = useMutation({
    mutationFn: async (id) => (await api.delete(`/settings/aliases/${id}`)).data,
    onSuccess: () => {
      toast.success("Alias removed");
      queryClient.invalidateQueries(["settings", "aliases"]);
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to remove alias"),
  });

  // Mutations - Tag Dictionary
  const saveTagMutation = useMutation({
    mutationFn: async ({ tag, meaning }) =>
      (
        await api.post("/settings/tags", {
          tag: tag.trim().toUpperCase(),
          meaning: meaning.trim(),
        })
      ).data,
    onSuccess: () => {
      toast.success("Tag saved!");
      queryClient.invalidateQueries(["settings", "tags"]);
      setNewTagCode("");
      setNewTagMeaning("");
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to save tag"),
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id) => (await api.delete(`/settings/tags/${id}`)).data,
    onSuccess: () => {
      toast.success("Tag removed");
      queryClient.invalidateQueries(["settings", "tags"]);
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to remove tag"),
  });

  const tabs = [
    { id: "columns", label: "Column Mappings", icon: Package, count: columnMappings.length },
    { id: "aliases", label: "Customer Aliases", icon: Users, count: aliases.length },
    { id: "tags", label: "Tag Dictionary", icon: Tag, count: tags.length },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* PRD v2 Page Header */}
      <PageHeader
        title="Settings"
        purpose="Configure ledger column mappings, customer name aliases, and handwritten tag codes"
      />

      {/* Tab Navigation */}
      <div className="segmented-nav self-start flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`segmented-item ${activeTab === t.id ? "active" : ""}`}
          >
            <t.icon size={16} weight="bold" />
            {t.label}
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-xs font-bold px-1.5 ${
                activeTab === t.id
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── TAB 1: COLUMN MAPPINGS ─────────────────────────────────────────── */}
      {activeTab === "columns" && (
        <div className="flex flex-col gap-6">
          <InfoBanner icon={Sparkle} title="How Ledger Column Mapping Works">
            Your handwritten ledger uses shorthand column codes like{" "}
            <span className="font-mono font-bold text-zinc-200">M, R, B, P, K, T, JB</span>. Map
            each code to an actual product so Gemini can automatically resolve rates from
            scanned images.
          </InfoBanner>

          {/* Add / Update Mapping Form */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <Plus size={18} weight="bold" className="text-emerald-400" />
              Map Column Code to Product
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-3">
                <FormField label="Column Code" hint="e.g. M, R, B, JB">
                  <Input
                    placeholder="e.g. M"
                    value={newColCode}
                    onChange={(e) => setNewColCode(e.target.value.toUpperCase())}
                    className="font-mono font-bold text-center"
                    maxLength={6}
                  />
                </FormField>
              </div>

              <div className="sm:col-span-6">
                <FormField label="Target Product">
                  <Select
                    value={newColProductId}
                    onChange={(e) => setNewColProductId(e.target.value)}
                  >
                    <option value="">— Choose Product —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.product_code ? `[Code: ${p.product_code}]` : ""} ({p.unit})
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div className="sm:col-span-3 pb-[0px]">
                <Button
                  variant="primary"
                  icon={Check}
                  isLoading={saveColMappingMutation.isPending}
                  loadingText="Saving…"
                  disabled={!newColCode.trim() || !newColProductId}
                  className="w-full"
                  onClick={() =>
                    saveColMappingMutation.mutate({
                      column_code: newColCode,
                      product_id: newColProductId,
                    })
                  }
                >
                  Save Mapping
                </Button>
              </div>
            </div>
          </div>

          {/* Mappings List */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-200">Active Column Mappings</h2>
              <p className="text-sm text-zinc-400 mt-0.5">{columnMappings.length} column(s) configured</p>
            </div>

            {loadingCols ? (
              <div className="p-10 flex justify-center">
                <div className="w-7 h-7 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
              </div>
            ) : columnMappings.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No column mappings configured"
                description="Add your first mapping above to link ledger column letters to products."
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Column Code</th>
                    <th>Mapped Product</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {columnMappings.map((m) => (
                    <tr key={m.id} className="min-h-[52px]">
                      <td>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 font-mono font-bold text-base text-zinc-100">
                          {m.column_code}
                        </span>
                      </td>
                      <td className="font-semibold text-emerald-400 text-base">
                        {m.product_name || `Product #${m.product_id}`}
                      </td>
                      <td className="text-center">
                        <button
                          type="button"
                          onClick={() =>
                            saveColMappingMutation.mutate({
                              column_code: m.column_code,
                              product_id: m.product_id,
                              active: !m.active,
                            })
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                            m.active
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700"
                          }`}
                        >
                          {m.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash}
                          className="text-rose-400 hover:text-rose-300"
                          onClick={() => setDeleteTarget({ type: "column", item: m })}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: CUSTOMER ALIASES ────────────────────────────────────────── */}
      {activeTab === "aliases" && (
        <div className="flex flex-col gap-6">
          <InfoBanner icon={Users} title="How Customer Aliases Work">
            Map handwritten spelling variations or nicknames (e.g.{" "}
            <span className="font-semibold text-zinc-200">"Ramesh K"</span>,{" "}
            <span className="font-semibold text-zinc-200">"Ramesh Bhai"</span>) to the primary
            customer record{" "}
            <span className="font-semibold text-emerald-400">"Ramesh Kumar"</span> so OCR
            scanning can match them automatically.
          </InfoBanner>

          {/* Add Alias Form */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <Plus size={18} weight="bold" className="text-emerald-400" />
              Add Customer Alias
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-5">
                <FormField label="Primary Customer">
                  <Select
                    value={newAliasCustomerId}
                    onChange={(e) => setNewAliasCustomerId(e.target.value)}
                  >
                    <option value="">— Choose Customer —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div className="sm:col-span-4">
                <FormField label="Alias / Nickname / Variation" hint="As written in the ledger">
                  <Input
                    placeholder="e.g. Ramesh K"
                    value={newAliasText}
                    onChange={(e) => setNewAliasText(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="sm:col-span-3">
                <Button
                  variant="primary"
                  icon={Check}
                  isLoading={saveAliasMutation.isPending}
                  loadingText="Saving…"
                  disabled={!newAliasCustomerId || !newAliasText.trim()}
                  className="w-full"
                  onClick={() =>
                    saveAliasMutation.mutate({
                      customer_id: newAliasCustomerId,
                      alias: newAliasText,
                    })
                  }
                >
                  Save Alias
                </Button>
              </div>
            </div>
          </div>

          {/* Aliases Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-200">Existing Aliases</h2>
              <p className="text-sm text-zinc-400 mt-0.5">{aliases.length} alias(es) stored</p>
            </div>

            {loadingAliases ? (
              <div className="p-10 flex justify-center">
                <div className="w-7 h-7 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
              </div>
            ) : aliases.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No aliases yet"
                description="Add aliases above to help the OCR scanner match handwritten names to customer records."
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Primary Customer</th>
                    <th>
                      <ArrowRight size={14} weight="bold" className="inline mr-1" />
                      Alias / Variation
                    </th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {aliases.map((a) => (
                    <tr key={a.id} className="min-h-[52px]">
                      <td className="font-semibold text-zinc-100 text-base">
                        {a.customer_name || `Customer #${a.customer_id}`}
                      </td>
                      <td>
                        <span className="font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg text-base">
                          "{a.alias}"
                        </span>
                      </td>
                      <td className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash}
                          className="text-rose-400 hover:text-rose-300"
                          onClick={() => setDeleteTarget({ type: "alias", item: a })}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: TAG DICTIONARY ──────────────────────────────────────────── */}
      {activeTab === "tags" && (
        <div className="flex flex-col gap-6">
          <InfoBanner icon={Tag} title="How Tag Codes Work">
            Define shorthand symbols found in handwritten ledgers:{" "}
            <span className="font-mono font-bold text-amber-400">F</span> = Free Sample,{" "}
            <span className="font-mono font-bold text-amber-400">D</span> = Damaged,{" "}
            <span className="font-mono font-bold text-amber-400">R</span> = Return. The AI OCR
            scanner uses these to correctly interpret bill annotations.
          </InfoBanner>

          {/* Add Tag Form */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <Plus size={18} weight="bold" className="text-emerald-400" />
              Add Tag Definition
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-3">
                <FormField label="Tag Letter / Symbol" hint="e.g. F, D, R, BO">
                  <Input
                    placeholder="e.g. F"
                    value={newTagCode}
                    onChange={(e) => setNewTagCode(e.target.value.toUpperCase())}
                    className="font-mono font-bold text-amber-300 text-center"
                    maxLength={5}
                  />
                </FormField>
              </div>

              <div className="sm:col-span-6">
                <FormField label="Meaning / Description">
                  <Input
                    placeholder="e.g. Free Sample / Bonus"
                    value={newTagMeaning}
                    onChange={(e) => setNewTagMeaning(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="sm:col-span-3">
                <Button
                  variant="primary"
                  icon={Check}
                  isLoading={saveTagMutation.isPending}
                  loadingText="Saving…"
                  disabled={!newTagCode.trim() || !newTagMeaning.trim()}
                  className="w-full"
                  onClick={() =>
                    saveTagMutation.mutate({
                      tag: newTagCode,
                      meaning: newTagMeaning,
                    })
                  }
                >
                  Save Tag
                </Button>
              </div>
            </div>
          </div>

          {/* Tags Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-200">Tag Dictionary</h2>
              <p className="text-sm text-zinc-400 mt-0.5">{tags.length} tag(s) defined</p>
            </div>

            {loadingTags ? (
              <div className="p-10 flex justify-center">
                <div className="w-7 h-7 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
              </div>
            ) : tags.length === 0 ? (
              <EmptyState
                icon={Tag}
                title="No tags defined"
                description="Define shorthand symbols found in your handwritten ledger so the scanner can interpret them correctly."
              />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tag Symbol</th>
                    <th>Meaning / Description</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((t) => (
                    <tr key={t.id} className="min-h-[52px]">
                      <td>
                        <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-bold text-base min-w-[48px]">
                          {t.tag}
                        </span>
                      </td>
                      <td className="text-zinc-200 font-medium text-base">{t.meaning}</td>
                      <td className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash}
                          className="text-rose-400 hover:text-rose-300"
                          onClick={() => setDeleteTarget({ type: "tag", item: t })}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Destructive Action Named Confirmation Dialog (PRD v2 Section 11 #6) */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        recordName={
          deleteTarget?.type === "column"
            ? `Column Code "${deleteTarget?.item.column_code}"`
            : deleteTarget?.type === "alias"
            ? `Alias "${deleteTarget?.item.alias}"`
            : `Tag "${deleteTarget?.item.tag}"`
        }
        title={
          deleteTarget?.type === "column"
            ? "Remove Column Mapping"
            : deleteTarget?.type === "alias"
            ? "Remove Customer Alias"
            : "Remove Tag Definition"
        }
        message={
          deleteTarget?.type === "column"
            ? `Are you sure you want to remove mapping for Column "${deleteTarget?.item.column_code}" (${deleteTarget?.item.product_name || `Product #${deleteTarget?.item.product_id}`})? Ledger scans will no longer match this column.`
            : deleteTarget?.type === "alias"
            ? `Are you sure you want to remove alias "${deleteTarget?.item.alias}" for ${deleteTarget?.item.customer_name || `Customer #${deleteTarget?.item.customer_id}`}? OCR scans will no longer recognize this handwriting variant.`
            : `Are you sure you want to delete tag definition "${deleteTarget?.item.tag}" (${deleteTarget?.item.meaning})?`
        }
        confirmText="Remove Record"
        isLoading={
          deleteColMappingMutation.isPending ||
          deleteAliasMutation.isPending ||
          deleteTagMutation.isPending
        }
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === "column") deleteColMappingMutation.mutate(deleteTarget.item.id);
          else if (deleteTarget.type === "alias") deleteAliasMutation.mutate(deleteTarget.item.id);
          else if (deleteTarget.type === "tag") deleteTagMutation.mutate(deleteTarget.item.id);
        }}
      />
    </div>
  );
}
