import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  CheckCircle,
  XCircle,
  Receipt,
  Phone,
  MapPin,
  Wallet,
  ArrowRight,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../lib/api";
import { formatINR } from "../lib/formatters";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { FormField } from "../components/ui/FormField";
import { StatusBadge } from "../components/ui/StatusBadge";
import { MoreActions } from "../components/ui/MoreActions";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { TableSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import Pagination from "../components/Pagination";

const CUST_PAGE_SIZE = 10;

function CustomerModal({ isOpen, onClose, existing }) {
  const qc = useQueryClient();

  const { data: generalSettings } = useQuery({
    queryKey: ["settings", "general"],
    queryFn: async () => (await api.get("/settings/general")).data,
    staleTime: 60_000,
  });

  const configuredDefaultPhone = generalSettings?.default_customer_phone || "9730526659";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: existing
      ? {
          ...existing,
          opening_balance: existing.opening_balance ?? 0,
        }
      : {
          name: "",
          phone: configuredDefaultPhone,
          address: "",
          notes: "",
          opening_balance: 0,
          is_active: true,
        },
  });

  // Sync form when modal opens or target customer changes
  useEffect(() => {
    if (isOpen) {
      if (existing) {
        reset({
          ...existing,
          opening_balance: existing.opening_balance ?? 0,
        });
      } else {
        reset({
          name: "",
          phone: configuredDefaultPhone,
          address: "",
          notes: "",
          opening_balance: 0,
          is_active: true,
        });
      }
    }
  }, [isOpen, existing, configuredDefaultPhone, reset]);

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        name: data.name.trim(),
        phone: data.phone?.trim() || configuredDefaultPhone,
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
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
      toast.success(existing ? "Customer updated" : "Customer created");
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.detail || "Error saving customer"),
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existing ? "Edit Customer" : "Add Customer"}
      subtitle="Maintain customer profile, contact details, and prior ledger dues"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit(mutation.mutate)} className="flex flex-col gap-4">
        {existing?.total_balance > 0 && (
          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
            <span className="text-sm text-amber-300 font-medium">Total Current Due:</span>
            <span className="font-mono font-bold text-amber-300 text-base tabular-nums">
              {formatINR(existing.total_balance)}
            </span>
          </div>
        )}

        <FormField label="Full Name" required error={errors.name?.message}>
          <Input
            placeholder="e.g. Ramesh Fish Stall"
            hasError={Boolean(errors.name)}
            {...register("name", { required: "Customer name is required" })}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Phone Number" hint="WhatsApp updates">
            <Input
              type="tel"
              placeholder="10-digit number"
              leftIcon={Phone}
              {...register("phone")}
            />
          </FormField>

          <FormField label="Address / Market">
            <Input
              placeholder="Shop #, Market"
              leftIcon={MapPin}
              {...register("address")}
            />
          </FormField>
        </div>

        <FormField
          label="Previous Balance / Purana Baki (₹)"
          hint="Unbilled prior balance"
        >
          <Input
            type="number"
            step="any"
            min="0"
            placeholder="0.00"
            className="font-mono font-bold text-amber-400"
            {...register("opening_balance")}
          />
        </FormField>

        {existing?.bills_balance > 0 && (
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm flex justify-between items-center text-zinc-300">
            <span>Incurred via Invoices:</span>
            <span className="font-mono font-bold text-zinc-100 tabular-nums">
              {formatINR(existing.bills_balance)}
            </span>
          </div>
        )}

        <FormField label="Notes / Special Instructions (Optional)">
          <textarea
            className="w-full min-h-[80px] bg-zinc-900 border border-[#71717A] rounded-lg px-3.5 py-2 text-base text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-300 focus-visible:outline-2 focus-visible:outline-[#6EE7B7]"
            placeholder="Delivery timings, preferences, or credit terms…"
            {...register("notes")}
          />
        </FormField>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800 mt-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={mutation.isPending}
            loadingText="Saving customer…"
          >
            {existing ? "Update Customer" : "Save Customer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [modalCustomer, setModalCustomer] = useState(null); // null | "add" | customer obj
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data: custData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["customers-chunked", search, page],
    queryFn: () =>
      api
        .get(
          `/customers?search=${encodeURIComponent(search)}&page=${page}&page_size=${CUST_PAGE_SIZE}`
        )
        .then((r) => r.data),
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
    onSuccess: () => {
      qc.invalidateQueries(["customers"]);
      qc.invalidateQueries(["customers-chunked"]);
      toast.success("Customer status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(["customers"]);
      qc.invalidateQueries(["customers-chunked"]);
      toast.success("Customer removed successfully");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.response?.data?.detail || "Failed to delete customer"),
  });

  return (
    <div className="flex flex-col gap-6">
      {/* PRD v2 Page Header */}
      <PageHeader
        title="Customers"
        purpose="Find customers, inspect balances, and track outstanding dues"
        primaryAction={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setModalCustomer("add")}
          >
            Add Customer
          </Button>
        }
        moreActions={[
          {
            label: isFetching ? "Refreshing…" : "Refresh list",
            icon: ArrowsClockwise,
            onClick: () => refetch(),
          },
          {
            label: "Create new bill",
            icon: Receipt,
            onClick: () => navigate("/bills?new=true"),
          },
        ]}
      />

      {/* Control / Search Filter Bar */}
      <div className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search by name or mobile number…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            leftIcon={MagnifyingGlass}
          />
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-300 font-medium">
            {totalCustomers} registered customer(s)
          </span>
          {totalPageBalance > 0 && (
            <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-bold tabular-nums">
              Page Due: {formatINR(totalPageBalance)}
            </span>
          )}
        </div>
      </div>

      {/* Customers Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : customersList.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "No matching customers found" : "No customers registered yet"}
            description={
              search
                ? `No customer matched "${search}". Try checking spelling or search by phone.`
                : "Add your first customer to begin creating bills and recording ledgers."
            }
            actionLabel="Add Customer"
            onAction={() => setModalCustomer("add")}
          />
        ) : (
          <>
            {/* Desktop Table View (>= md, min 52px row height) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Phone / Mobile</th>
                    <th>Address</th>
                    <th className="text-right">Outstanding Due</th>
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
                      <tr key={c.id} className="min-h-[52px]">
                        <td className="font-semibold text-zinc-100 text-base">{c.name}</td>
                        <td className="cell-secondary font-mono">{c.phone || "—"}</td>
                        <td className="cell-secondary">{c.address || "—"}</td>
                        <td className="cell-money text-base">
                          {totalBal > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-amber-300">
                                {formatINR(totalBal)}
                              </span>
                              {openBal > 0 && (
                                <span className="text-xs text-zinc-400 font-normal">
                                  {billsBal > 0
                                    ? `(Prev: ${formatINR(openBal)})`
                                    : "(Opening Due)"}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-emerald-400 font-medium">₹0.00</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge
                            status={c.is_active ? "active" : "inactive"}
                            label={c.is_active ? "Active" : "Inactive"}
                          />
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Primary row action: View Bills */}
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Receipt}
                              onClick={() => navigate(`/bills?customer_id=${c.id}`)}
                            >
                              View Bills
                            </Button>

                            {/* Secondary actions in MoreActions */}
                            <MoreActions
                              label={`Actions for ${c.name}`}
                              items={[
                                {
                                  label: "Edit details",
                                  icon: PencilSimple,
                                  onClick: () => setModalCustomer(c),
                                },
                                {
                                  label: c.is_active ? "Mark Inactive" : "Mark Active",
                                  icon: c.is_active ? XCircle : CheckCircle,
                                  onClick: () => toggleActive.mutate(c),
                                },
                                {
                                  label: "Create bill",
                                  icon: Plus,
                                  onClick: () =>
                                    navigate(`/bills?new=true&customer_id=${c.id}`),
                                },
                                { divider: true },
                                {
                                  label: "Delete customer",
                                  icon: Trash,
                                  variant: "danger",
                                  onClick: () => setDeleteTarget(c),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (< md) */}
            <div className="block md:hidden divide-y divide-zinc-800">
              {customersList.map((c) => {
                const totalBal = parseFloat(c.total_balance || 0);
                return (
                  <div key={c.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-100 text-base">{c.name}</h3>
                        <p className="text-sm text-zinc-400 font-mono mt-0.5">
                          {c.phone || "No phone saved"}
                        </p>
                      </div>
                      <StatusBadge
                        status={c.is_active ? "active" : "inactive"}
                        label={c.is_active ? "Active" : "Inactive"}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-sm">
                      <span className="text-zinc-400">Total Outstanding</span>
                      <span
                        className={`font-mono font-bold text-base tabular-nums ${
                          totalBal > 0 ? "text-amber-300" : "text-emerald-400"
                        }`}
                      >
                        {formatINR(totalBal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        icon={Receipt}
                        onClick={() => navigate(`/bills?customer_id=${c.id}`)}
                      >
                        View Bills
                      </Button>
                      <Button
                        variant="quiet"
                        size="sm"
                        icon={PencilSimple}
                        onClick={() => setModalCustomer(c)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="quiet"
                        size="sm"
                        className="text-rose-400 hover:text-rose-300"
                        icon={Trash}
                        onClick={() => setDeleteTarget(c)}
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
              totalPages={totalPages}
              totalItems={totalCustomers}
              pageSize={CUST_PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Customer Add/Edit Modal */}
      {modalCustomer && (
        <CustomerModal
          isOpen={Boolean(modalCustomer)}
          onClose={() => setModalCustomer(null)}
          existing={modalCustomer === "add" ? null : modalCustomer}
        />
      )}

      {/* Explicit Named Delete Confirm Dialog (PRD v2 Section 11 #6) */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        recordName={deleteTarget?.name}
        title="Delete Customer"
        message={`Are you sure you want to delete ${deleteTarget?.name}? Existing bills will remain intact, but this customer profile will be removed.`}
        confirmText="Delete Customer"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
