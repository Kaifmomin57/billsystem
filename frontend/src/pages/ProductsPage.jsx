import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, Plus, Search, Edit2, Trash2, CheckCircle2, XCircle,
  X, AlertTriangle, CircleDot
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";

function DeleteConfirmModal({ product, onConfirm, onCancel, isPending }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="card w-full max-w-sm">
        <div className="p-5 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Delete Product?</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Are you sure you want to delete <span className="font-semibold text-zinc-200">{product.name}</span>?
              <br />
              <span className="text-rose-400/90 mt-1 block">Past bills will keep recorded rates.</span>
            </p>
          </div>
          <div className="flex gap-2 w-full mt-2">
            <button
              onClick={onCancel}
              disabled={isPending}
              className="btn-secondary btn-sm flex-1"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="btn-danger btn-sm flex-1"
            >
              {isPending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    unit: "kg",
    product_code: "",
    is_active: true,
    rate: "",
    live_rate: "",
  });

  // Fetch products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await api.get("/products");
      return res.data;
    },
  });

  // Fetch base rates to show alongside products
  const { data: baseRates = [] } = useQuery({
    queryKey: ["rates", "products"],
    queryFn: async () => {
      const res = await api.get("/rates/products");
      return res.data;
    },
  });

  const rateMap = baseRates.reduce((acc, r) => {
    acc[r.product_id] = { rate: r.rate, live_rate: r.live_rate };
    return acc;
  }, {});

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

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => api.post("/products", data),
    onSuccess: async (res) => {
      try {
        await saveRate(res.data.id);
      } catch (e) {
        toast.error("Product created but rate could not be saved");
      }
      queryClient.invalidateQueries(["products"]);
      toast.success("Product created successfully");
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to create product");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/products/${id}`, data),
    onSuccess: async () => {
      try {
        await saveRate(editingProduct.id);
      } catch (e) {
        toast.error("Product updated but rate could not be saved");
      }
      queryClient.invalidateQueries(["products"]);
      toast.success("Product updated");
      closeModal();
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to update product");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(["products"]);
      toast.success("Product deleted");
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to delete product");
    },
  });

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({ name: "", unit: "kg", product_code: "", is_active: true, rate: "", live_rate: "" });
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
    const { rate, live_rate, ...productData } = formData;
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: productData });
    } else {
      createMutation.mutate(productData);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.product_code && p.product_code.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter =
      filterActive === "all"
        ? true
        : filterActive === "active"
        ? p.is_active
        : !p.is_active;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Products Master</h1>
          <p className="page-subtitle">Product catalog, measurement units, and default pricing</p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary btn-sm flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Control Bar */}
      <div className="card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search products or column code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-xs sm:text-sm"
          />
        </div>

        <div className="segmented-nav">
          {["all", "active", "inactive"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterActive(tab)}
              className={`segmented-item capitalize ${filterActive === tab ? "active" : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex items-center justify-center">
            <div className="w-7 h-7 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center text-zinc-500 text-sm">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30 text-zinc-600" />
            No products found matching your search.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table min-w-[600px]">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Ledger Code</th>
                    <th>Unit</th>
                    <th>Standard Rate</th>
                    <th>Live Rate (⊚)</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const rInfo = rateMap[p.id];
                    const baseRate = rInfo?.rate;
                    const liveRate = rInfo?.live_rate;
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="font-medium text-zinc-100">{p.name}</span>
                        </td>
                        <td>
                          <span className="badge-zinc font-mono font-bold text-[11px]">
                            {p.product_code || "—"}
                          </span>
                        </td>
                        <td className="text-zinc-400 font-mono text-xs">{p.unit}</td>
                        <td className="font-mono font-medium text-zinc-200">
                          {baseRate !== undefined ? `₹${Number(baseRate).toFixed(2)}` : "—"}
                        </td>
                        <td className="font-mono">
                          {liveRate !== undefined && liveRate !== null ? (
                            <span className="text-emerald-400 font-semibold flex items-center gap-1 text-xs">
                              <CircleDot className="w-3.5 h-3.5" />
                              ₹{Number(liveRate).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-xs">—</span>
                          )}
                        </td>
                        <td>
                          <span className={p.is_active ? "badge-green" : "badge-zinc"}>
                            {p.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(p)}
                              className="btn-ghost btn-sm !px-2"
                              title="Edit Product"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(p)}
                              className="btn-ghost btn-sm !px-2 hover:text-rose-400 hover:bg-rose-500/10"
                              title="Delete Product"
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

            {/* Mobile Card List (< md) */}
            <div className="block md:hidden divide-y divide-zinc-800/80">
              {filteredProducts.map((p) => {
                const rInfo = rateMap[p.id];
                const baseRate = rInfo?.rate;
                const liveRate = rInfo?.live_rate;
                return (
                  <div key={p.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-zinc-100 text-sm">{p.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="badge-zinc font-mono text-[10px] font-bold">
                            {p.product_code || "No Code"}
                          </span>
                          <span className="text-xs text-zinc-400 font-mono">Unit: {p.unit}</span>
                        </div>
                      </div>
                      <span className={p.is_active ? "badge-green text-xs" : "badge-zinc text-xs"}>
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/70 text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Standard Rate</span>
                        <span className="font-mono font-medium text-zinc-200 mt-0.5 block">
                          {baseRate !== undefined ? `₹${Number(baseRate).toFixed(2)}` : "Not set"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Live Rate (⊚)</span>
                        {liveRate !== undefined && liveRate !== null ? (
                          <span className="font-mono font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                            <CircleDot className="w-3.5 h-3.5" />
                            ₹{Number(liveRate).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-xs mt-0.5 block">—</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/60">
                      <button
                        onClick={() => openEditModal(p)}
                        className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1.5 text-xs py-2"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Edit Product</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all"
                        title="Delete Product"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-100">
                {editingProduct ? "Edit Product" : "Add Product"}
              </h3>
              <button
                onClick={closeModal}
                className="text-zinc-400 hover:text-zinc-100 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              <div>
                <label className="label">
                  Product Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rohu Fish, Catla, Prawns..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Column Code (Ledger)</label>
                  <input
                    type="text"
                    placeholder="e.g. M, R, B"
                    value={formData.product_code}
                    onChange={(e) => setFormData({ ...formData, product_code: e.target.value.toUpperCase() })}
                    className="input-field text-sm font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="input-field text-sm"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="litre">litre (Litre)</option>
                    <option value="pcs">pcs (Pieces)</option>
                    <option value="box">box (Box / Packet)</option>
                    <option value="gm">gm (Gram)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Standard Rate (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.rate}
                      onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                      className="input-field pl-7 font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Live Fish Rate (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Optional"
                      value={formData.live_rate}
                      onChange={(e) => setFormData({ ...formData, live_rate: e.target.value })}
                      className="input-field pl-7 font-mono text-sm text-emerald-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="prod_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="prod_active" className="text-xs text-zinc-300 cursor-pointer">
                  Active (available in billing & ledger scans)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary btn-sm"
                >
                  {editingProduct ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          product={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
