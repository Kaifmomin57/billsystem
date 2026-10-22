import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, AlertTriangle, Phone, MapPin, Wallet, IndianRupee } from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatCurrency } from "../lib/utils";
import Pagination from "../components/Pagination";

function CustomerModal({ onClose, existing }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: existing ? {
      ...existing,
      opening_balance: existing.opening_balance ?? 0,
    } : {
      name: "",
      phone: "",
      address: "",
      notes: "",
      opening_balance: 0,
      is_active: true,
    },
  });

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        opening_balance: parseFloat(data.opening_balance) || 0,
      };
      return existing
        ? api.put(`/customers/${existing.id}`, payload)
        : api.post("/customers", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries(["customers"]);
      qc.invalidateQueries(["customers-chunked"]);
      qc.invalidateQueries(["dashboard-stats"]);
      toast.success(existing ? "Customer updated" : "Customer added");
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.detail || "Error saving customer"),
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md animate-slide-in">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-100">
            {existing ? "Edit Customer" : "Add Customer"}
          </h2>
          {existing?.total_balance > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Total Due: {formatCurrency(existing.total_balance)}
            </span>
          )}
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

          {/* Previous / Opening Balance Input */}
          <div className="input-group">
            <div className="flex items-center justify-between">
              <label className="label mb-0">Previous Balance / Purana Baki (₹)</label>
              <span className="text-[11px] text-zinc-500 font-medium">Unbilled Due</span>
            </div>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-mono">₹</span>
              <input
                type="number"
                step="any"
                min="0"
                className="input-field pl-7 font-mono font-semibold text-amber-400"
                placeholder="0.00"
                {...register("opening_balance")}
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Prior pending payment before using this system (purana baki bina bill wala).
            </p>
          </div>

          {existing?.bills_balance > 0 && (
            <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs flex justify-between items-center text-zinc-400">
              <span>Unpaid Bills In System:</span>
              <span className="font-mono font-semibold text-zinc-200">{formatCurrency(existing.bills_balance)}</span>
            </div>
          )}

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

  const { data: custData, isLoading } = useQuery({
    queryKey: ["customers-chunked", search, page],
    queryFn: () =>
      api.get(`/customers?search=${encodeURIComponent(search)}&page=${page}&page_size=${CUST_PAGE_SIZE}`).then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const customersList = custData?.items || (Array.isArray(custData) ? custData : []);
  const totalCustomers = custData?.total ?? customersList.length;
  const totalPages = custData?.total_pages ?? Math.max(1, Math.ceil(totalCustomers / CUST_PAGE_SIZE));

  const totalPageBalance = useMemo(
    () => customersList.reduce((acc, c) => acc + (parseFloat(c.total_balance) || 0), 0),
    [customersList]
  );

  const toggleActive = useMutation({
    mutationFn: (c) => api.put(`/customers/${c.id}`, { ...c, is_active: !c.is_active }),
    onSuccess: () => { qc.invalidateQueries(["customers"]); qc.invalidateQueries(["customers-chunked"]); toast.success("Status updated"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(["customers"]);
      qc.invalidateQueries(["customers-chunked"]);
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
          <p className="page-subtitle">Directory of registered customers, previous balances & contact details</p>
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
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {totalCustomers} registered customers
          </span>
          {totalPageBalance > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-xs font-semibold">
              Page Due: {formatCurrency(totalPageBalance)}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
          </div>
        ) : customersList.length === 0 ? (
          <div className="p-12 text-center py-10 text-zinc-500 text-sm">
            No customers found matching your search.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table min-w-[620px]">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone Number</th>
                    <th>Address</th>
                    <th className="text-right">Balance Due</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customersList.map((c) => {
                    const totalBal = parseFloat(c.total_balance || 0);
                    const openBal = parseFloat(c.opening_balance || 0);
                    const billsBal = parseFloat(c.bills_balance || 0);

                    return (
                      <tr key={c.id}>
                        <td className="font-medium text-zinc-100">{c.name}</td>
                        <td className="text-zinc-400 font-mono text-xs">{c.phone || "—"}</td>
                        <td className="text-zinc-400 text-xs">{c.address || "—"}</td>
                        <td className="text-right font-mono text-xs">
                          {totalBal > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-amber-400">
                                {formatCurrency(totalBal)}
                              </span>
                              {openBal > 0 && (
                                <span className="text-[10px] text-zinc-500" title="Previous / Purana Baki">
                                  {billsBal > 0 ? `(Prev: ${formatCurrency(openBal)})` : "(Opening Bal)"}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-emerald-400/90 font-medium">₹0.00</span>
                          )}
                        </td>
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
                              title="Edit customer & previous balance"
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (< md) */}
            <div className="block md:hidden divide-y divide-zinc-800/80">
              {customersList.map((c) => {
                const totalBal = parseFloat(c.total_balance || 0);
                const openBal = parseFloat(c.opening_balance || 0);

                return (
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

                    {/* Balance Banner on Card */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                      <div className="flex flex-col">
                        <span className="text-[11px] text-zinc-400 font-medium">Balance Due</span>
                        {openBal > 0 && (
                          <span className="text-[10px] text-zinc-500">
                            Prev (Unbilled): {formatCurrency(openBal)}
                          </span>
                        )}
                      </div>
                      <span className={`font-mono font-bold text-sm ${totalBal > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                        {formatCurrency(totalBal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                      <button
                        onClick={() => setModal(c)}
                        className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1.5 text-xs mr-2 py-2"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit / Set Balance</span>
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
                );
              })}
            </div>
            {/* Pagination */}
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalCustomers}
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
