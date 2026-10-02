import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, MagnifyingGlass, PencilSimple, ToggleLeft, ToggleRight, Trash, Warning } from "@phosphor-icons/react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../lib/api";

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
    onError: (e) => toast.error(e.response?.data?.detail || "Error"),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md animate-slide-in">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-200">
            {existing ? "Edit Customer" : "Add Customer"}
          </h2>
        </div>
        <form onSubmit={handleSubmit(mutation.mutate)} className="p-5 flex flex-col gap-4">
          <div className="input-group">
            <label className="label">Name *</label>
            <input className={`input ${errors.name ? "border-rose-500" : ""}`}
              {...register("name", { required: "Name is required" })} />
            {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="input-group">
              <label className="label">Phone</label>
              <input className="input" placeholder="+91 …" {...register("phone")} />
            </div>
            <div className="input-group">
              <label className="label">Address</label>
              <input className="input" {...register("address")} />
            </div>
          </div>
          <div className="input-group">
            <label className="label">Notes</label>
            <textarea className="input resize-none h-20" {...register("notes")} />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-sm btn-secondary flex-1 sm:flex-none">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-sm btn-primary flex-1 sm:flex-none">
              {mutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ customer, onConfirm, onCancel, isPending }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm animate-slide-in">
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <Warning size={28} className="text-rose-400" weight="fill" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-100">Delete Customer?</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-zinc-200">{customer.name}</span>?
              <br />
              <span className="text-rose-400/80 text-xs mt-1 block">This action cannot be undone.</span>
            </p>
          </div>
          <div className="flex gap-3 w-full mt-1">
            <button
              onClick={onCancel}
              className="btn-sm btn-secondary flex-1"
              disabled={isPending}
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

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null); // null | "add" | customer obj
  const [deleteTarget, setDeleteTarget] = useState(null); // customer to delete
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => api.get(`/customers?search=${search}`).then((r) => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: (c) => api.put(`/customers/${c.id}`, { ...c, is_active: !c.is_active }),
    onSuccess: () => { qc.invalidateQueries(["customers"]); toast.success("Updated"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(["customers"]);
      toast.success("Customer deleted");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.response?.data?.detail || "Failed to delete customer"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage your customer master list</p>
        </div>
        <button onClick={() => setModal("add")} className="btn-sm btn-primary self-start sm:self-auto">
          <Plus size={16} weight="bold" /> Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          className="input pl-9"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[500px]">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i}><td colSpan={5} className="py-3 px-4"><div className="h-4 rounded bg-zinc-800 animate-pulse w-full" /></td></tr>
                  ))
                : data.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium text-zinc-200">{c.name}</td>
                      <td className="text-zinc-500">{c.phone || "—"}</td>
                      <td className="text-zinc-500">{c.address || "—"}</td>
                      <td>
                        <span className={c.is_active ? "badge-green" : "badge-zinc"}>
                          {c.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setModal(c)} className="btn-ghost btn-sm !px-2" title="Edit">
                            <PencilSimple size={15} />
                          </button>
                          <button onClick={() => toggleActive.mutate(c)} className="btn-ghost btn-sm !px-2" title="Toggle active">
                            {c.is_active
                              ? <ToggleRight size={18} className="text-emerald-400" />
                              : <ToggleLeft size={18} className="text-zinc-500" />}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="btn-ghost btn-sm !px-2 hover:text-rose-400 hover:bg-rose-500/10"
                            title="Delete customer"
                          >
                            <Trash size={15} className="text-rose-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              {!isLoading && data.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-zinc-600 text-sm">No customers found. Add one to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
