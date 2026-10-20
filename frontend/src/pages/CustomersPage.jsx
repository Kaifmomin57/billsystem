import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, AlertTriangle, Phone, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../lib/api";
import Pagination from "../components/Pagination";

function CustomerModal({ onClose, existing }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: existing || {},
  });
  const mutation = useMutation({
    mutationFn: (data) =>
      existing
        ? api.put(`/customers/${existing.id}`, data)
        : api.post("/customers", data),
    onSuccess: () => {
      qc.invalidateQueries(["customers"]);
      toast.success(existing ? "Customer updated" : "Customer added");
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.detail || "Error saving customer"),
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md animate-slide-in">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-100">
            {existing ? "Edit Customer" : "Add Customer"}
          </h2>
        </div>
        <form onSubmit={handleSubmit(mutation.mutate)} className="p-5 flex flex-col gap-4">
          <div className="input-group">
            <label className="label">Full Name *</label>
            <input
              className={`input-field ${errors.name ? "border-rose-500" : ""}`}
              placeholder="e.g. Ramesh Fish Stall"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="input-group">
              <label className="label">Phone (WhatsApp)</label>
              <input
                className="input-field"
                placeholder="10-digit number"
                {...register("phone")}
              />
            </div>
            <div className="input-group">
              <label className="label">Address / Market</label>
              <input
                className="input-field"
                placeholder="Shop #, Market"
                {...register("address")}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="label">Notes / Preferences</label>
            <textarea
              className="input-field resize-none h-20 text-xs"
              placeholder="Special delivery instructions, rate notes..."
              {...register("notes")}
            />
          </div>

          <div className="flex gap-2.5 justify-end pt-2 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary btn-sm"
            >
              {mutation.isPending ? "Saving…" : "Save Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ customer, onConfirm, onCancel, isPending }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="card w-full max-w-sm">
        <div className="p-5 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Delete Customer?</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Are you sure you want to delete <span className="font-semibold text-zinc-200">{customer.name}</span>?
              <br />
              <span className="text-rose-400/90 mt-1 block">Past bills will remain intact.</span>
            </p>
          </div>
          <div className="flex gap-2 w-full mt-2">
            <button
              onClick={onCancel}
              className="btn-secondary btn-sm flex-1"
              disabled={isPending}
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

const CUST_PAGE_SIZE = 10;

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | "add" | customer obj
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => api.get(`/customers?search=${search}`).then((r) => r.data),
  });

  const totalPages = Math.max(1, Math.ceil(data.length / CUST_PAGE_SIZE));
  const paginatedData = useMemo(() => {
    const start = (page - 1) * CUST_PAGE_SIZE;
    return data.slice(start, start + CUST_PAGE_SIZE);
  }, [data, page]);

  const toggleActive = useMutation({
    mutationFn: (c) => api.put(`/customers/${c.id}`, { ...c, is_active: !c.is_active }),
    onSuccess: () => { qc.invalidateQueries(["customers"]); toast.success("Status updated"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(["customers"]);
      toast.success("Customer removed");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.response?.data?.detail || "Failed to delete customer"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Directory of registered customers and WhatsApp contact details</p>
        </div>
        <button onClick={() => setModal("add")} className="btn-primary btn-sm flex items-center gap-1.5 self-start sm:self-auto">
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Control Bar */}
      <div className="card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="input-field pl-9 text-xs sm:text-sm"
            placeholder="Search customer by name or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <span className="text-xs text-zinc-400">
          {data.length} registered customers
        </span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center py-10 text-zinc-500 text-sm">
            No customers found matching your search.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table min-w-[520px]">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone Number</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium text-zinc-100">{c.name}</td>
                      <td className="text-zinc-400 font-mono text-xs">{c.phone || "—"}</td>
                      <td className="text-zinc-400 text-xs">{c.address || "—"}</td>
                      <td>
                        <span className={c.is_active ? "badge-green" : "badge-zinc"}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setModal(c)}
                            className="btn-ghost btn-sm !px-2"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleActive.mutate(c)}
                            className="btn-ghost btn-sm !px-2"
                            title={c.is_active ? "Deactivate" : "Activate"}
                          >
                            {c.is_active ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-zinc-500" />
                            )}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="btn-ghost btn-sm !px-2 hover:text-rose-400 hover:bg-rose-500/10"
                            title="Delete customer"
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
            <div className="block md:hidden divide-y divide-zinc-800/80">
              {paginatedData.map((c) => (
                <div key={c.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-zinc-100 text-sm">{c.name}</div>
                    <span className={c.is_active ? "badge-green text-xs" : "badge-zinc text-xs"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs">
                    {c.phone ? (
                      <a
                        href={`tel:${c.phone}`}
                        className="text-emerald-400/90 font-mono flex items-center gap-1.5 hover:underline"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{c.phone}</span>
                      </a>
                    ) : (
                      <span className="text-zinc-500 italic">No phone number</span>
                    )}

                    {c.address && (
                      <div className="text-zinc-400 flex items-start gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                        <span>{c.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                    <button
                      onClick={() => setModal(c)}
                      className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1.5 text-xs mr-2 py-2"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Customer</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleActive.mutate(c)}
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-emerald-400 active:scale-95 transition-all"
                        title={c.is_active ? "Deactivate" : "Activate"}
                      >
                        {c.is_active ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-zinc-500" />
                        )}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all"
                        title="Delete customer"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination */}
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={data.length}
              pageSize={CUST_PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Edit / Add Modal */}
      {modal && (
        <CustomerModal
          onClose={() => setModal(null)}
          existing={modal === "add" ? null : modal}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          customer={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
