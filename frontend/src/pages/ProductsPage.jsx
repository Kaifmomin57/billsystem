import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Plus,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  CheckCircle,
  XCircle,
  Circle,
  CurrencyInr,
  ArrowsClockwise,
  Info,
} from "@phosphor-icons/react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatINR } from "../lib/formatters";
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

const PROD_PAGE_SIZE = 10;

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [page, setPage] = useState(1);

  const [formData, setFormData] = useState({
    name: "",
    unit: "kg",
    product_code: "",
    is_active: true,
    rate: "",
    live_rate: "",
    purchase_price: "",
  });

  // Fetch products
  const { data: products = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
  });

  // Fetch base rates
  const { data: baseRates = [] } = useQuery({
    queryKey: ["rates", "products"],
    queryFn: async () => (await api.get("/rates/products")).data,
  });

  const rateMap = useMemo(() =>
    baseRates.reduce((acc, r) => {
      acc[r.product_id] = { rate: r.rate, live_rate: r.live_rate };
      return acc;
    }, {}),
    [baseRates]
  );

  // Save rate helper
  const saveRate = async (productId) => {
    const hasRate = formData.rate !== "" && !isNaN(parseFloat(formData.rate));
    const hasLiveRate = formData.live_rate !== "" && !isNaN(parseFloat(formData.live_rate));
    if (hasRate || hasLiveRate) {
      await api.post("/rates/products", {
        product_id: productId,
        rate: hasRate ? parseFloat(formData.rate) : 0,
        live_rate: hasLiveRate ? parseFloat(formData.live_rate) : null,
      });
      queryClient.invalidateQueries(["rates", "products"]);
    }
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => api.post("/products", data),
    onSuccess: async (res) => {
      try {
        await saveRate(res.data.id);
      } catch {
        toast.error("Product created but rate could not be saved");
      }
      queryClient.invalidateQueries(["products"]);
      toast.success("Product created successfully");
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to create product"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/products/${id}`, data),
    onSuccess: async () => {
      try {
        await saveRate(editingProduct.id);
      } catch {
        toast.error("Product updated but rate could not be saved");
      }
      queryClient.invalidateQueries(["products"]);
      toast.success("Product updated successfully");
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Failed to update product"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["products"]);
      toast.success("Product deleted successfully");
      setDeleteTarget(null);
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || "Failed to delete product";
      setDeleteError(msg);
      toast.error(msg);
    },
  });

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: "", unit: "kg", product_code: "", is_active: true, rate: "", live_rate: "", purchase_price: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    const rInfo = rateMap[product.id];
    setFormData({
      name: product.name,
      unit: product.unit || "kg",
      product_code: product.product_code || "",
      is_active: product.is_active,
      rate: rInfo?.rate !== undefined ? String(rInfo.rate) : "",
      live_rate: rInfo?.live_rate !== undefined && rInfo?.live_rate !== null ? String(rInfo.live_rate) : "",
      purchase_price:
        product.purchase_price !== undefined && product.purchase_price !== null
          ? String(product.purchase_price)
          : "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    const { rate, live_rate, purchase_price, ...productData } = formData;
    const hasPurchasePrice = purchase_price !== "" && !isNaN(parseFloat(purchase_price));
    productData.purchase_price = hasPurchasePrice ? parseFloat(purchase_price) : null;

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: productData });
    } else {
      createMutation.mutate(productData);
    }
  };

  const filteredProducts = useMemo(() =>
    products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.product_code && p.product_code.toLowerCase().includes(search.toLowerCase()));
      const matchesFilter =
        filterActive === "all" ? true : filterActive === "active" ? p.is_active : !p.is_active;
      return matchesSearch && matchesFilter;
    }),
    [products, search, filterActive]
  );

  const prodTotalPages = Math.max(1, Math.ceil(filteredProducts.length / PROD_PAGE_SIZE));
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * PROD_PAGE_SIZE;
    return filteredProducts.slice(start, start + PROD_PAGE_SIZE);
  }, [filteredProducts, page]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      {/* PRD v2 Page Header */}
      <PageHeader
        title="Products"
        purpose="Maintain your product catalogue, pricing, and cost information"
        primaryAction={
          <Button variant="primary" icon={Plus} onClick={openAddModal}>
            Add Product
          </Button>
        }
        moreActions={[
          {
            label: isFetching ? "Refreshing…" : "Refresh list",
            icon: ArrowsClockwise,
            onClick: () => refetch(),
          },
        ]}
      />

      {/* Filter & Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search by product name or code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            leftIcon={MagnifyingGlass}
          />
        </div>

        <div className="segmented-nav">
          {["all", "active", "inactive"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setFilterActive(tab);
                setPage(1);
              }}
              className={`segmented-item capitalize ${filterActive === tab ? "active" : ""}`}
            >
              {tab === "active" && <CheckCircle size={16} weight="bold" className="text-emerald-400" />}
              {tab === "inactive" && <XCircle size={16} weight="bold" className="text-zinc-500" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title={search ? "No products matched your search" : "No products in catalogue"}
            description={
              search
                ? `No product matched "${search}". Try searching by full name or ledger column code.`
                : "Add your first product to start creating bills with itemized rates."
            }
            actionLabel="Add Product"
            onAction={openAddModal}
          />
        ) : (
          <>
            {/* Desktop Table (min 52px row height, 16px text, PRD v2 Section 12) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Code</th>
                    <th>Unit</th>
                    <th className="text-right">Purchase Price</th>
                    <th className="text-right">Standard Rate</th>
                    <th className="text-right">Live Rate (⊚)</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((p) => {
                    const rInfo = rateMap[p.id];
                    const baseRate = rInfo?.rate;
                    const liveRate = rInfo?.live_rate;

                    return (
                      <tr key={p.id} className="min-h-[52px]">
                        <td className="font-semibold text-zinc-100 text-base">{p.name}</td>
                        <td>
                          <span className="badge-neutral text-xs font-mono font-bold">
                            {p.product_code || "—"}
                          </span>
                        </td>
                        <td className="cell-secondary font-mono">{p.unit}</td>
                        <td className="cell-money text-base">
                          {p.purchase_price !== undefined && p.purchase_price !== null ? (
                            <span className="text-rose-300 font-bold">
                              {formatINR(p.purchase_price)}
                            </span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="cell-money text-base text-zinc-100">
                          {baseRate !== undefined ? formatINR(baseRate) : <span className="text-zinc-500">—</span>}
                        </td>
                        <td className="cell-money text-base">
                          {liveRate !== undefined && liveRate !== null ? (
                            <span className="text-emerald-400 font-bold flex items-center justify-end gap-1">
                              <Circle size={14} weight="fill" />
                              {formatINR(liveRate)}
                            </span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge
                            status={p.is_active ? "active" : "inactive"}
                            label={p.is_active ? "Active" : "Inactive"}
                          />
                        </td>
                        <td className="text-right">
                          <MoreActions
                            label={`Actions for ${p.name}`}
                            items={[
                              {
                                label: "Edit product",
                                icon: PencilSimple,
                                onClick: () => openEditModal(p),
                              },
                              {
                                label: "Delete product",
                                icon: Trash,
                                variant: "danger",
                                onClick: () => {
                                  setDeleteError(null);
                                  setDeleteTarget(p);
                                },
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="block md:hidden divide-y divide-zinc-800">
              {paginatedProducts.map((p) => {
                const rInfo = rateMap[p.id];
                const baseRate = rInfo?.rate;
                const liveRate = rInfo?.live_rate;
                return (
                  <div key={p.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-100 text-base">{p.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="badge-neutral text-xs font-mono font-bold">
                            {p.product_code || "No Code"}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono">Unit: {p.unit}</span>
                        </div>
                      </div>
                      <StatusBadge
                        status={p.is_active ? "active" : "inactive"}
                        label={p.is_active ? "Active" : "Inactive"}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm">
                      <div>
                        <span className="text-xs text-zinc-400 block">Purchase Cost</span>
                        <span className="font-mono font-bold text-rose-300 mt-0.5 block tabular-nums">
                          {p.purchase_price !== null && p.purchase_price !== undefined
                            ? formatINR(p.purchase_price)
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400 block">Standard Rate</span>
                        <span className="font-mono font-bold text-zinc-100 mt-0.5 block tabular-nums">
                          {baseRate !== undefined ? formatINR(baseRate) : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400 block">Live Rate (⊚)</span>
                        <span className="font-mono font-bold text-emerald-400 mt-0.5 block tabular-nums">
                          {liveRate !== undefined && liveRate !== null ? formatINR(liveRate) : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-800">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={PencilSimple}
                        className="flex-1"
                        onClick={() => openEditModal(p)}
                      >
                        Edit Product
                      </Button>
                      <Button
                        variant="quiet"
                        size="sm"
                        className="text-rose-400 hover:text-rose-300"
                        icon={Trash}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(p);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              page={page}
              totalPages={prodTotalPages}
              totalItems={filteredProducts.length}
              pageSize={PROD_PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? "Edit Product" : "Add Product"}
        subtitle="Configure product name, unit, pricing rates, and cost"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="Product Name" required>
            <Input
              placeholder="e.g. Rohu Fish, Catla, Prawns, Hilsa…"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <FormField label="Column Code (Ledger)">
              <Input
                placeholder="e.g. M, R, B"
                value={formData.product_code}
                onChange={(e) =>
                  setFormData({ ...formData, product_code: e.target.value.toUpperCase() })
                }
                className="font-mono font-bold"
              />
            </FormField>

            <FormField label="Unit of Measurement">
              <Select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              >
                <option value="kg">kg (Kilogram)</option>
                <option value="litre">litre (Litre)</option>
                <option value="pcs">pcs (Pieces)</option>
                <option value="box">box (Box / Packet)</option>
                <option value="gm">gm (Gram)</option>
              </Select>
            </FormField>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <CurrencyInr size={16} weight="bold" className="text-emerald-400" />
              Pricing Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <FormField label="Purchase / Cost Price (₹)" hint="For P&L calculation">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Cost price"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  className="font-mono text-rose-300"
                />
              </FormField>

              <FormField label="Standard Selling Rate (₹)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  className="font-mono"
                />
              </FormField>
            </div>

            <FormField label="Live Fish Rate (₹)" hint="⊚ Premium live-catch price">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Optional — leave blank if same as standard"
                value={formData.live_rate}
                onChange={(e) => setFormData({ ...formData, live_rate: e.target.value })}
                className="font-mono text-emerald-400"
              />
            </FormField>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
            <input
              type="checkbox"
              id="prod_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="mt-0.5 rounded border-zinc-600 bg-zinc-800 text-emerald-600 w-5 h-5 shrink-0"
            />
            <label htmlFor="prod_active" className="text-base text-zinc-200 cursor-pointer">
              <span className="font-semibold">Active product</span>
              <br />
              <span className="text-sm text-zinc-400">
                Visible in billing, rates, and AI ledger scanning.
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800 mt-2">
            <Button variant="secondary" onClick={closeModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              loadingText={editingProduct ? "Saving changes…" : "Creating product…"}
            >
              {editingProduct ? "Save Changes" : "Create Product"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Named Delete Confirmation (PRD v2 Section 11 #6) */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        recordName={deleteTarget?.name}
        title="Delete Product"
        message={
          deleteError
            ? deleteError
            : `Are you sure you want to delete "${deleteTarget?.name}"? Historical bill rates are preserved, but this product will no longer appear in billing or scans.`
        }
        confirmText="Delete Product"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
