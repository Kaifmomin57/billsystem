import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Package, Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, 
  X, IndianRupee
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../lib/api";

function DeleteConfirmModal({ product, onConfirm, onCancel, isPending }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Delete Product?</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-zinc-200">{product.name}</span>?
              <br />
              <span className="text-rose-400/80 text-xs mt-1 block">This action cannot be undone.</span>
            </p>
          </div>
          <div className="flex gap-3 w-full mt-1">
            <button
              onClick={onCancel}
              disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
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
    is_active: true,
    rate: "",
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
    acc[r.product_id] = r.rate;
    return acc;
  }, {});

  // Save rate helper
  const saveRate = async (productId) => {
    if (formData.rate !== "" && !isNaN(parseFloat(formData.rate))) {
      await api.post("/rates/products", {
        product_id: productId,
        rate: parseFloat(formData.rate),
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

  // Delete mutation (hard delete)
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
    setFormData({ name: "", unit: "kg", is_active: true, rate: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      unit: product.unit || "kg",
      is_active: product.is_active,
      rate: rateMap[product.id] !== undefined ? String(rateMap[product.id]) : "",
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
    const { rate, ...productData } = formData;
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: productData });
    } else {
      createMutation.mutate(productData);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filterActive === "all"
        ? true
        : filterActive === "active"
        ? p.is_active
        : !p.is_active;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2.5">
            <Package className="w-7 h-7 text-emerald-400" />
            Product Master
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage your catalog items, units of measurement, and default pricing
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary inline-flex items-center justify-center gap-2 self-start sm:self-auto shadow-lg shadow-emerald-950/40"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Control Bar: Search & Status Filters */}
      <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium mr-1">
            Status:
          </span>
          {["all", "active", "inactive"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterActive(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                filterActive === tab
                  ? "bg-zinc-800 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
              }`}
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
            <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center">
            <Package className="w-12 h-12 text-zinc-600 mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-semibold text-zinc-300">No products found</h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm mx-auto">
              {search ? "No products matching your search criteria." : "Get started by adding your first product to the master catalog."}
            </p>
            {!search && (
              <button onClick={openAddModal} className="btn-primary mt-4 inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add First Product
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[550px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-5">Product Name</th>
                  <th className="py-3.5 px-5">Unit</th>
                  <th className="py-3.5 px-5">Base Rate</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {filteredProducts.map((p) => {
                  const baseRate = rateMap[p.id];
                  return (
                    <tr key={p.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-emerald-400 font-bold text-xs">
                            {p.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium text-zinc-100 block">{p.name}</span>
                            <span className="text-xs text-zinc-500">ID #{p.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {p.unit}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        {baseRate !== undefined ? (
                          <span className="font-semibold text-zinc-100 font-mono">
                            ₹{Number(baseRate).toFixed(2)} <span className="text-xs text-zinc-500 font-normal">/{p.unit}</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => openEditModal(p)}
                            className="text-xs text-amber-400 hover:text-amber-300 italic flex items-center gap-1 transition-colors"
                          >
                            <IndianRupee className="w-3 h-3" /> Set rate
                          </button>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        {p.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                            <XCircle className="w-3.5 h-3.5" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Product Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. M (Milk), Paneer, Khoya..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field w-full text-sm"
                />
              </div>

              {/* Unit */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Unit of Measurement
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="input-field w-full text-sm"
                >
                  <option value="kg">kg (Kilogram)</option>
                  <option value="litre">litre (Litre)</option>
                  <option value="pcs">pcs (Pieces)</option>
                  <option value="box">box (Box / Packet)</option>
                  <option value="gm">gm (Gram)</option>
                </select>
              </div>

              {/* Base Rate */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Base Rate (₹ per {formData.unit || "unit"})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium pointer-events-none select-none">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    className="input-field w-full text-sm pl-7 font-mono"
                  />
                </div>
                <p className="text-xs text-zinc-600 mt-1">
                  Leave blank to set later. Used as default when no customer-specific rate exists.
                </p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="prod_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/20"
                />
                <label htmlFor="prod_active" className="text-sm text-zinc-300 select-none cursor-pointer">
                  Active (available for billing &amp; rate assignment)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="btn-primary text-sm px-5 py-2 shadow-lg shadow-emerald-950/50"
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
