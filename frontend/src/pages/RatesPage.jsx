import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CurrencyInr,
  Users,
  Package,
  Plus,
  PencilSimple,
  Trash,
  ClockCounterClockwise,
  ArrowRight,
  ShieldCheck,
  Sparkle,
  Circle,
  MagnifyingGlass,
  CaretDown,
  CaretUp,
  X,
} from "@phosphor-icons/react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatINR, formatDateTimeIN } from "../lib/formatters";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Input";
import { FormField } from "../components/ui/FormField";
import { StatusBadge } from "../components/ui/StatusBadge";
import { MoreActions } from "../components/ui/MoreActions";
import { Modal } from "../components/ui/Modal";
import { TableSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
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

  // Data queries
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

  const { data: histData = {}, isLoading: loadingHist } = useQuery({
    queryKey: ["rates", "history", histPage],
    queryFn: () =>
      api.get(`/rates/history?page=${histPage}&page_size=${PAGE_SIZE}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const paginatedHistory = histData?.items || (Array.isArray(histData) ? histData : []);
  const totalHistItems = histData?.total ?? paginatedHistory.length;
  const totalHistPages = histData?.total_pages ?? Math.max(1, Math.ceil(totalHistItems / PAGE_SIZE));

  // Mutations
  const saveProductLiveRateMutation = useMutation({
    mutationFn: ({ productId, liveRate }) =>
      api.post(`/rates/products/${productId}/live-rate`, {
        live_rate:
          liveRate !== "" && liveRate !== null && !isNaN(parseFloat(liveRate))
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

  const saveCustRateMutation = useMutation({
    mutationFn: (data) =>
      api.post("/rates/customers", {
        customer_id: parseInt(data.customer_id),
        product_id: parseInt(data.product_id),
        rate: parseFloat(data.rate),
        live_rate:
          data.live_rate !== "" && data.live_rate !== null && !isNaN(parseFloat(data.live_rate))
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

  // Handlers
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
    if (!testProdId) {
      toast.error("Select a product");
      return;
    }
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
    setLiveRateInput(
      prod.live_rate !== null && prod.live_rate !== undefined ? String(prod.live_rate) : ""
    );
  };

  // Derived / filtered data
  const filteredRates = useMemo(() =>
    customerRates.filter(
      (r) =>
        r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.product_name?.toLowerCase().includes(search.toLowerCase())
    ),
    [customerRates, search]
  );

  const filteredBaseRates = useMemo(() =>
    baseRates.filter(
      (r) =>
        r.product_name?.toLowerCase().includes(baseSearch.toLowerCase()) ||
        (r.product_code && r.product_code.toLowerCase().includes(baseSearch.toLowerCase()))
    ),
    [baseRates, baseSearch]
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

  return (
    <div className="flex flex-col gap-6">
      {/* PRD v2 Page Header */}
      <PageHeader
        title="Rates"
        purpose="Manage product default rates, live fish prices, and per-customer overrides"
        primaryAction={
          <Button
            variant="primary"
            icon={activeTab === "base" ? Circle : Plus}
            onClick={() => {
              if (activeTab === "base" && baseRates.length > 0) {
                openEditLiveRateModal(baseRates[0]);
              } else {
                openNewCustModal();
              }
            }}
          >
            {activeTab === "base" ? "Set Live Fish Rate" : "Add Custom Rate"}
          </Button>
        }
        moreActions={[
          {
            label: showTester ? "Hide Rate Tester" : "Open Rate Tester",
            icon: Sparkle,
            onClick: () => setShowTester(!showTester),
          },
        ]}
      />

      {/* Collapsible Rate Tester */}
      {showTester && (
        <div className="card p-5 border-emerald-500/20 bg-emerald-950/10">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
            <div className="flex items-center gap-2">
              <Sparkle size={18} weight="bold" className="text-emerald-400" />
              <h3 className="text-base font-semibold text-zinc-200">Rate Tester</h3>
              <span className="text-sm text-zinc-400">— verify which rate applies for a customer/product combo</span>
            </div>
            <button
              onClick={() => setShowTester(false)}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <FormField label="Customer (optional)">
              <Select value={testCustId} onChange={(e) => setTestCustId(e.target.value)}>
                <option value="">— Base Rate —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Product *">
              <Select value={testProdId} onChange={(e) => setTestProdId(e.target.value)}>
                <option value="">— Select product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product_code ? `[${p.product_code}] ` : ""}{p.name} ({p.unit})
                  </option>
                ))}
              </Select>
            </FormField>

            <div>
              <label className="block text-base font-semibold text-zinc-300 mb-2">Fish Type</label>
              <label className="flex items-center gap-3 min-h-[44px] px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-xl cursor-pointer text-base text-zinc-300 hover:border-emerald-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={testIsLive}
                  onChange={(e) => setTestIsLive(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800 text-emerald-600 w-4 h-4"
                />
                <span className="flex items-center gap-2 font-medium">
                  <Circle size={14} weight="fill" className="text-emerald-400" />
                  Live Fish (⊚)
                </span>
              </label>
            </div>

            <Button variant="primary" icon={ArrowRight} onClick={handleTestResolution}>
              Calculate
            </Button>
          </div>

          {testResult && (
            <div className="mt-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <ShieldCheck size={20} weight="bold" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-zinc-200">{testResult.product_name}</span>
                    {testResult.is_live && (
                      <span className="badge-success text-xs">
                        <Circle size={10} weight="fill" />
                        ⊚ Live Fish
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-zinc-400 mt-0.5 block">
                    Rate source:{" "}
                    <strong className="capitalize text-zinc-300">
                      {testResult.rate_type.replace("_", " ")}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                  {formatINR(testResult.rate)}
                </div>
                <div className="text-sm text-zinc-500">per unit</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="segmented-nav self-start">
        <button
          onClick={() => setActiveTab("base")}
          className={`segmented-item ${activeTab === "base" ? "active" : ""}`}
        >
          <Package size={16} weight="bold" />
          Product Rates ({baseRates.length})
        </button>
        <button
          onClick={() => setActiveTab("customer")}
          className={`segmented-item ${activeTab === "customer" ? "active" : ""}`}
        >
          <Users size={16} weight="bold" />
          Customer Overrides ({customerRates.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`segmented-item ${activeTab === "history" ? "active" : ""}`}
        >
          <ClockCounterClockwise size={16} weight="bold" />
          Rate History
        </button>
      </div>

      {/* Tab 1: Product Base & Live Rates */}
      {activeTab === "base" && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search products…"
                value={baseSearch}
                onChange={(e) => {
                  setBaseSearch(e.target.value);
                  setBasePage(1);
                }}
                leftIcon={MagnifyingGlass}
              />
            </div>
            <span className="text-sm text-zinc-400">{filteredBaseRates.length} products</span>
          </div>

          {loadingBase ? (
            <TableSkeleton rows={5} cols={5} />
          ) : filteredBaseRates.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products found"
              description={
                baseSearch
                  ? `No products matched "${baseSearch}". Try the product name or code.`
                  : "Add products in the Products page to set rates here."
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Product</th>
                      <th className="text-right">Standard Rate</th>
                      <th className="text-right">Live Fish Rate (⊚)</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBaseRates.map((r) => {
                      const hasLive =
                        r.live_rate !== null && r.live_rate !== undefined && r.live_rate > 0;
                      return (
                        <tr key={r.id} className="min-h-[52px]">
                          <td>
                            <span className="badge-neutral text-xs font-mono font-bold">
                              {r.product_code || "—"}
                            </span>
                          </td>
                          <td className="font-semibold text-zinc-100 text-base">
                            {r.product_name}{" "}
                            <span className="cell-secondary font-mono">({r.unit || "kg"})</span>
                          </td>
                          <td className="cell-money text-base text-zinc-100">
                            {formatINR(r.rate)}
                          </td>
                          <td className="cell-money text-base">
                            {hasLive ? (
                              <span className="text-emerald-400 font-bold flex items-center justify-end gap-1.5">
                                <Circle size={14} weight="fill" />
                                {formatINR(r.live_rate)}
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-sm">Same as standard</span>
                            )}
                          </td>
                          <td>
                            <StatusBadge
                              status={hasLive ? "active" : "neutral"}
                              label={hasLive ? "Live Active" : "Standard Only"}
                            />
                          </td>
                          <td className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={PencilSimple}
                              onClick={() => openEditLiveRateModal(r)}
                              className="text-emerald-400"
                            >
                              {hasLive ? "Edit Live Rate" : "Set Live Rate"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="block md:hidden divide-y divide-zinc-800">
                {paginatedBaseRates.map((r) => {
                  const hasLive =
                    r.live_rate !== null && r.live_rate !== undefined && r.live_rate > 0;
                  return (
                    <div key={r.id} className="p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-zinc-100 text-base">{r.product_name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="badge-neutral text-xs font-mono font-bold">
                              {r.product_code || "No Code"}
                            </span>
                            <span className="text-xs text-zinc-400 font-mono">
                              Unit: {r.unit || "kg"}
                            </span>
                          </div>
                        </div>
                        <StatusBadge
                          status={hasLive ? "active" : "neutral"}
                          label={hasLive ? "Live Active" : "Standard"}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm">
                        <div>
                          <span className="text-xs text-zinc-400 block">Standard Rate</span>
                          <span className="font-mono font-bold text-zinc-100 mt-0.5 block tabular-nums">
                            {formatINR(r.rate)}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-zinc-400 block">Live Rate (⊚)</span>
                          <span
                            className={`font-mono font-bold mt-0.5 block tabular-nums ${
                              hasLive ? "text-emerald-400" : "text-zinc-500"
                            }`}
                          >
                            {hasLive ? formatINR(r.live_rate) : "Same as std"}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        icon={PencilSimple}
                        className="w-full justify-center text-emerald-400"
                        onClick={() => openEditLiveRateModal(r)}
                      >
                        {hasLive ? "Update Live Fish Rate" : "Set Live Fish Rate"}
                      </Button>
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

      {/* Tab 2: Customer Special Rates */}
      {activeTab === "customer" && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 max-w-sm">
              <Input
                placeholder="Search by customer or product…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCustPage(1);
                }}
                leftIcon={MagnifyingGlass}
              />
            </div>
            <Button variant="primary" size="sm" icon={Plus} onClick={openNewCustModal}>
              Add Custom Rate
            </Button>
          </div>

          {loadingCust ? (
            <TableSkeleton rows={5} cols={5} />
          ) : filteredRates.length === 0 ? (
            <EmptyState
              icon={Users}
              title={
                search
                  ? "No custom rates matched your search"
                  : "No customer-specific rates yet"
              }
              description={
                search
                  ? `No rates for "${search}". Try a customer or product name.`
                  : "All customers currently use the default product rates. Add an override to give a customer a special price."
              }
              actionLabel="Add Custom Rate"
              onAction={openNewCustModal}
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Product</th>
                      <th className="text-right">Standard Rate</th>
                      <th className="text-right">Live Fish Rate (⊚)</th>
                      <th>Last Updated</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCustRates.map((r) => (
                      <tr key={r.id} className="min-h-[52px]">
                        <td className="font-semibold text-zinc-100 text-base">{r.customer_name}</td>
                        <td className="text-zinc-200 text-base">
                          {r.product_name}{" "}
                          <span className="cell-secondary font-mono">({r.unit})</span>
                        </td>
                        <td className="cell-money text-base text-zinc-100">{formatINR(r.rate)}</td>
                        <td className="cell-money text-base">
                          {r.live_rate !== null && r.live_rate !== undefined ? (
                            <span className="text-emerald-400 font-bold flex items-center justify-end gap-1.5">
                              <Circle size={14} weight="fill" />
                              {formatINR(r.live_rate)}
                            </span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="cell-secondary">{formatDateTimeIN(r.updated_at)}</td>
                        <td className="text-right">
                          <MoreActions
                            label={`Actions for ${r.customer_name} — ${r.product_name}`}
                            items={[
                              {
                                label: "Edit rate",
                                icon: PencilSimple,
                                onClick: () => openEditCustModal(r),
                              },
                              {
                                label: "Remove rate",
                                icon: Trash,
                                variant: "danger",
                                onClick: () => deleteCustRateMutation.mutate(r.id),
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="block md:hidden divide-y divide-zinc-800">
                {paginatedCustRates.map((r) => (
                  <div key={r.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-100 text-base">{r.customer_name}</h3>
                        <p className="text-sm text-zinc-400">
                          {r.product_name} ({r.unit})
                        </p>
                      </div>
                      <span className="text-xs text-zinc-500">{formatDateTimeIN(r.updated_at)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm">
                      <div>
                        <span className="text-xs text-zinc-400 block">Standard Rate</span>
                        <span className="font-mono font-bold text-zinc-100 mt-0.5 block tabular-nums">
                          {formatINR(r.rate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400 block">Live Rate (⊚)</span>
                        <span className="font-mono font-bold mt-0.5 block tabular-nums text-emerald-400">
                          {r.live_rate !== null && r.live_rate !== undefined
                            ? formatINR(r.live_rate)
                            : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={PencilSimple}
                        className="flex-1"
                        onClick={() => openEditCustModal(r)}
                      >
                        Edit Rate
                      </Button>
                      <Button
                        variant="quiet"
                        size="sm"
                        icon={Trash}
                        className="text-rose-400"
                        onClick={() => deleteCustRateMutation.mutate(r.id)}
                      >
                        Remove
                      </Button>
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

      {/* Tab 3: Rate Audit History */}
      {activeTab === "history" && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-base font-semibold text-zinc-200">Rate Change Audit Log</h2>
            <p className="text-sm text-zinc-400 mt-0.5">All historical pricing changes across products and customers</p>
          </div>

          {loadingHist ? (
            <TableSkeleton rows={6} cols={5} />
          ) : paginatedHistory.length === 0 ? (
            <EmptyState
              icon={ClockCounterClockwise}
              title="No rate changes recorded yet"
              description="Any time a product or customer rate is updated, an audit entry will appear here."
            />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Target</th>
                      <th className="text-right">Old Rate</th>
                      <th className="text-right">New Rate</th>
                      <th>Changed By</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.map((h) => (
                      <tr key={h.id} className="min-h-[52px]">
                        <td>
                          <span className="badge-neutral uppercase text-xs">
                            {h.rate_type.replace("_", " ")}
                          </span>
                        </td>
                        <td>
                          <span className="font-semibold text-zinc-200 text-base">{h.product_name}</span>
                          {h.customer_name && (
                            <span className="cell-secondary">Customer: {h.customer_name}</span>
                          )}
                        </td>
                        <td className="cell-money text-base text-zinc-500 line-through">
                          {h.old_rate !== null ? formatINR(h.old_rate) : "—"}
                        </td>
                        <td className="cell-money text-base text-emerald-400 font-bold">
                          {formatINR(h.new_rate)}
                        </td>
                        <td className="cell-secondary">{h.changed_by}</td>
                        <td className="cell-secondary">{formatDateTimeIN(h.changed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="block md:hidden divide-y divide-zinc-800">
                {paginatedHistory.map((h) => (
                  <div key={h.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="badge-neutral uppercase text-xs">
                        {h.rate_type.replace("_", " ")}
                      </span>
                      <span className="text-xs text-zinc-500">{formatDateTimeIN(h.changed_at)}</span>
                    </div>

                    <h3 className="font-semibold text-zinc-100 text-base">
                      {h.product_name}
                      {h.customer_name && (
                        <span className="text-sm text-zinc-400 block font-normal mt-0.5">
                          Customer: {h.customer_name}
                        </span>
                      )}
                    </h3>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm">
                      <div>
                        <span className="text-xs text-zinc-400 block">Old Rate</span>
                        <span className="font-mono text-zinc-500 line-through mt-0.5 block tabular-nums">
                          {h.old_rate !== null ? formatINR(h.old_rate) : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-zinc-400 block">New Rate</span>
                        <span className="font-mono font-bold text-emerald-400 mt-0.5 block tabular-nums">
                          {formatINR(h.new_rate)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400">
                      Changed by: <span className="text-zinc-200 font-medium">{h.changed_by}</span>
                    </p>
                  </div>
                ))}
              </div>

              <Pagination
                page={histPage}
                totalPages={totalHistPages}
                totalItems={totalHistItems}
                pageSize={PAGE_SIZE}
                onPageChange={setHistPage}
              />
            </>
          )}
        </div>
      )}

      {/* Modal: Edit Product Live Fish Rate */}
      <Modal
        isOpen={Boolean(editingLiveProduct)}
        onClose={() => setEditingLiveProduct(null)}
        title="Set Live Fish Rate (⊚)"
        subtitle={
          editingLiveProduct
            ? `${editingLiveProduct.product_name} — applied when item is circled in ledger scan`
            : ""
        }
      >
        {editingLiveProduct && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-sm text-zinc-400 block">Current Standard Rate</span>
                <span className="text-lg font-bold font-mono text-zinc-200 tabular-nums">
                  {formatINR(editingLiveProduct.rate)} / {editingLiveProduct.unit || "kg"}
                </span>
              </div>
              <span className="badge-neutral text-xs">Standard</span>
            </div>

            <FormField
              label={`Live Fish Rate (₹ / ${editingLiveProduct.unit || "kg"})`}
              hint="Leave blank to clear the live rate and fall back to standard."
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 160.00"
                value={liveRateInput}
                onChange={(e) => setLiveRateInput(e.target.value)}
                className="font-mono text-emerald-400"
                autoFocus
              />
            </FormField>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <Button variant="secondary" onClick={() => setEditingLiveProduct(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={saveProductLiveRateMutation.isPending}
                loadingText="Saving…"
                onClick={() =>
                  saveProductLiveRateMutation.mutate({
                    productId: editingLiveProduct.product_id,
                    liveRate: liveRateInput,
                  })
                }
              >
                Save Rate
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Add / Edit Customer Rate */}
      <Modal
        isOpen={isCustModalOpen}
        onClose={closeCustModal}
        title={editingRate ? "Edit Customer Rate" : "Add Customer Rate"}
        subtitle="Override the default product rate for a specific customer"
      >
        <div className="flex flex-col gap-4">
          <FormField label="Customer" required>
            <Select
              value={custForm.customer_id}
              onChange={(e) => setCustForm({ ...custForm, customer_id: e.target.value })}
              disabled={Boolean(editingRate)}
            >
              <option value="">— Select customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Product" required>
            <Select
              value={custForm.product_id}
              onChange={(e) => setCustForm({ ...custForm, product_id: e.target.value })}
              disabled={Boolean(editingRate)}
            >
              <option value="">— Select product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Standard Rate (₹)" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={custForm.rate}
                onChange={(e) => setCustForm({ ...custForm, rate: e.target.value })}
                className="font-mono"
              />
            </FormField>

            <FormField label="Live Fish Rate (₹)" hint="Optional — leave blank for base live rate">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Optional"
                value={custForm.live_rate}
                onChange={(e) => setCustForm({ ...custForm, live_rate: e.target.value })}
                className="font-mono text-emerald-400"
              />
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <Button variant="secondary" onClick={closeCustModal}>Cancel</Button>
            <Button
              variant="primary"
              isLoading={saveCustRateMutation.isPending}
              loadingText="Saving…"
              onClick={handleSaveCustRate}
            >
              {editingRate ? "Update Rate" : "Save Rate"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
