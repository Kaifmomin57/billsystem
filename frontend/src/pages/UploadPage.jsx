import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload as UploadIcon, FileSpreadsheet, CheckCircle2, AlertTriangle,
  Sparkles, RefreshCw, ZoomIn, ZoomOut, Download, ArrowRight,
  Trash2, Plus, Calendar, User, Eye, Camera, Check, ShieldAlert,
  Maximize2, Minimize2
} from "lucide-react";
import toast from "react-hot-toast";
import api, { API_BASE_URL } from "../lib/api";

export default function UploadPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadType, setUploadType] = useState("ledger");
  const [isUploading, setIsUploading] = useState(false);

  // Active review workspace state
  const [activeUploadId, setActiveUploadId] = useState(null);
  const [activeDraft, setActiveDraft] = useState(null);
  const [activeDate, setActiveDate] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [isFullWidth, setIsFullWidth] = useState(false);

  // Fetch recent uploads list
  const { data: uploads = [], refetch: refetchUploads } = useQuery({
    queryKey: ["uploads"],
    queryFn: async () => (await api.get("/uploads?limit=15")).data,
    refetchInterval: 6000,
  });

  // Fetch tag dictionary for hover explanations
  const { data: tags = [] } = useQuery({
    queryKey: ["settings", "tags"],
    queryFn: async () => (await api.get("/settings/tags")).data,
  });
  const tagMeaningMap = tags.reduce((acc, t) => { acc[t.tag] = t.meaning; return acc; }, {});

  // Fetch customers for name mapping
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get("/customers")).data,
  });

  // Upload mutation
  const handleUploadSubmit = async () => {
    if (!file) return toast.error("Please select or capture a bill photo first");
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_type", uploadType);

    try {
      toast.loading("Sending to Gemini AI for OCR parsing...", { id: "upload-toast" });
      const res = await api.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("AI extraction completed! Review your entries below.", { id: "upload-toast" });

      // Load into review workspace immediately
      setActiveUploadId(res.data.id);
      setActiveDraft(res.data.draft_data);
      setActiveDate(res.data.page_date || new Date().toISOString().split("T")[0]);
      const img = res.data.image_url;
      setPreviewUrl(img ? (img.startsWith("http") ? img : `${API_BASE_URL}${img}`) : null);
      setFile(null);
      refetchUploads();
    } catch (err) {
      toast.error(err.response?.data?.detail || "AI processing failed. Please try again.", { id: "upload-toast" });
    } finally {
      setIsUploading(false);
    }
  };

  // Open an existing upload in the review workspace
  const openReviewWorkspace = async (upload) => {
    try {
      const res = await api.get(`/uploads/${upload.id}`);
      setActiveUploadId(upload.id);
      setActiveDraft(res.data.draft_data);
      setActiveDate(res.data.page_date || "");
      const img = res.data.image_url;
      setPreviewUrl(img ? (img.startsWith("http") ? img : `${API_BASE_URL}${img}`) : null);
      setSelectedRowIndex(null);
      window.scrollTo({ top: 400, behavior: "smooth" });
    } catch (e) {
      toast.error("Failed to load upload review");
    }
  };

  // Update cell in draft
  const handleCellChange = (rowIndex, colCode, field, value) => {
    if (!activeDraft) return;
    const newDraft = { ...activeDraft };
    const rows = [...newDraft.rows];
    const row = { ...rows[rowIndex] };
    const cells = { ...row.cells };
    const cell = { ...cells[colCode], [field]: value };

    // Auto-calculate if quantity or rate changed
    if (field === "quantity" || field === "rate") {
      cell.confidence = 1.0; // User edited, high confidence
    }
    cells[colCode] = cell;
    row.cells = cells;
    rows[rowIndex] = row;
    newDraft.rows = rows;
    setActiveDraft(newDraft);
  };

  // Update customer name in draft
  const handleCustomerNameChange = (rowIndex, value) => {
    if (!activeDraft) return;
    const newDraft = { ...activeDraft };
    const rows = [...newDraft.rows];
    rows[rowIndex] = { ...rows[rowIndex], customer_name: value };
    newDraft.rows = rows;
    setActiveDraft(newDraft);
  };

  // Toggle skip row
  const toggleSkipRow = (rowIndex) => {
    if (!activeDraft) return;
    const newDraft = { ...activeDraft };
    const rows = [...newDraft.rows];
    rows[rowIndex] = { ...rows[rowIndex], skip: !rows[rowIndex].skip };
    newDraft.rows = rows;
    setActiveDraft(newDraft);
  };

  // Save draft corrections
  const saveDraftMutation = useMutation({
    mutationFn: () => api.put(`/uploads/${activeUploadId}/draft`, {
      page_date: activeDate,
      draft_data: activeDraft,
    }),
    onSuccess: () => {
      toast.success("Draft changes saved");
      refetchUploads();
    },
  });

  // Confirm and create customer bills
  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/uploads/${activeUploadId}/confirm`),
    onSuccess: (res) => {
      toast.success(res.data.message || "Bills created in customer records!");
      queryClient.invalidateQueries(["bills"]);
      queryClient.invalidateQueries(["stats"]);
      queryClient.invalidateQueries(["customers"]);
      refetchUploads();
      setActiveUploadId(null);
      setActiveDraft(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to confirm upload");
    },
  });

  // Download Excel
  const handleDownloadExcel = async (targetUploadId) => {
    const id = targetUploadId || activeUploadId;
    if (!id) return toast.error("No active upload selected to download");
    try {
      toast.loading("Preparing Excel file...", { id: "excel-toast" });
      const res = await api.get(`/uploads/${id}/excel`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `digitized_ledger_${activeDate || id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Excel spreadsheet downloaded!", { id: "excel-toast" });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to download Excel file", { id: "excel-toast" });
    }
  };

  const columnCodes = (() => {
    const codesSet = new Set(activeDraft?.column_codes || []);
    if (activeDraft?.rows) {
      activeDraft.rows.forEach((row) => {
        if (row.cells) {
          Object.keys(row.cells).forEach((k) => codesSet.add(k));
        }
      });
    }
    const list = Array.from(codesSet);
    return list.length > 0 ? list : ["M", "R", "B", "P", "K", "T", "JB"];
  })();

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2.5">
            <Sparkles className="w-7 h-7 text-emerald-400" />
            AI Ledger & Bill Scanner
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Upload or snap photos of handwritten ledgers — Gemini AI extracts customers, quantities, and rates automatically
          </p>
        </div>
      </div>

      {/* Upload Box Card */}
      <div className="card p-4 sm:p-6 bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 border-zinc-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-5 pb-4 border-b border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Document Type:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setUploadType("ledger")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${uploadType === "ledger"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
              >
                Ledger Page (Multi-customer)
              </button>
              <button
                type="button"
                onClick={() => setUploadType("bill")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${uploadType === "bill"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
              >
                Single Bill / Invoice
              </button>
            </div>
          </div>
          <span className="text-[11px] text-zinc-500">Supported: JPG, PNG, WEBP, Camera photos (up to 10MB)</span>
        </div>

        {/* Dropzone */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className={`md:col-span-2 border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${file ? "border-emerald-500/50 bg-emerald-950/10" : "border-zinc-700 hover:border-zinc-500 bg-zinc-950/40"
              }`}
            onClick={() => document.getElementById("ledger-file-input").click()}
          >
            <input
              id="ledger-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) {
                  setFile(f);
                  setPreviewUrl(URL.createObjectURL(f));
                }
              }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                <p className="text-sm font-semibold text-zinc-100">{file.name}</p>
                <p className="text-xs text-zinc-400 font-mono">{(file.size / 1024).toFixed(1)} KB · Ready to scan</p>
                <span className="text-xs text-emerald-400 mt-1 hover:underline">Click to pick a different image</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400">
                  <UploadIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Click to browse or drag & drop handwritten ledger photo</p>
                  <p className="text-xs text-zinc-500 mt-1">Automatic perspective enhancement, contrast tuning & rotation</p>
                </div>
              </div>
            )}
          </div>

          {/* Action side box */}
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80">
            <div>
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Camera className="w-4 h-4 text-emerald-400" /> Mobile Camera Capture
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Take a clear snapshot of the ledger notebook. Ensure columns M, R, B, P, K, T, JB and customer names are visible.
              </p>
            </div>

            <button
              onClick={handleUploadSubmit}
              disabled={!file || isUploading}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2 text-sm py-2.5 shadow-lg shadow-emerald-950/50 disabled:opacity-40"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Gemini AI Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Extract with Gemini AI
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* REVIEW WORKSPACE (Image beside extracted grid) */}
      {/* ========================================================= */}
      {activeDraft && (
        <div className="card p-6 border-emerald-500/30 bg-zinc-900/90 shadow-2xl animate-in fade-in duration-200">
          {/* Workspace Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Verification Workspace
                </span>
                <span className="text-xs text-zinc-400">Upload #{activeUploadId}</span>
              </div>
              <h2 className="text-xl font-bold text-zinc-100 mt-1">Review Extracted Ledger Data</h2>
              <p className="text-xs text-zinc-400">
                Fix any highlighted low-confidence cells or name spellings before adding to customer records.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Confirm Page Date */}
              <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-zinc-400 font-medium">Page Date:</span>
                <input
                  type="date"
                  value={activeDate}
                  onChange={(e) => setActiveDate(e.target.value)}
                  className="bg-transparent text-xs text-emerald-400 font-semibold focus:outline-none"
                />
              </div>

              <button
                onClick={handleDownloadExcel}
                className="btn-secondary text-xs flex items-center gap-1.5 py-2"
                title="Download 3-Sheet Excel (Ledger Grid, Flat Entries, Needs Review)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Download Excel (.xlsx)
              </button>

              <button
                onClick={() => saveDraftMutation.mutate()}
                disabled={saveDraftMutation.isLoading}
                className="btn-secondary text-xs py-2"
              >
                Save Draft
              </button>

              <button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isLoading}
                className="btn-primary text-xs flex items-center gap-1.5 py-2 shadow-lg shadow-emerald-950/60"
              >
                <Check className="w-4 h-4" />
                Confirm & Add to Customers
              </button>
            </div>
          </div>

          {/* Side by Side or Full Width split */}
          <div className={`grid grid-cols-1 ${isFullWidth ? "lg:grid-cols-1" : "lg:grid-cols-12"} gap-6 mt-6`}>
            {/* Left: Original Photo with Zoom */}
            <div className={`${isFullWidth ? "lg:col-span-1" : "lg:col-span-5"} flex flex-col gap-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Original Ledger Page</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.2))}
                    className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs text-zinc-500 font-mono px-1">{(zoomLevel * 100).toFixed(0)}%</span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                    className="p-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className={`relative w-full ${isFullWidth ? "h-[220px]" : "h-[300px] sm:h-[420px] lg:h-[540px]"} bg-zinc-950 rounded-xl border border-zinc-800 overflow-auto flex items-center justify-center p-2`}>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Ledger Preview"
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: "top left" }}
                    className="max-w-none transition-transform duration-100 rounded shadow-md"
                  />
                ) : (
                  <span className="text-xs text-zinc-600">No image available</span>
                )}
              </div>
            </div>

            {/* Right / Main: Editable Grid */}
            <div className={`${isFullWidth ? "lg:col-span-1" : "lg:col-span-7"} flex flex-col gap-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-zinc-300 uppercase tracking-wider">Extracted Customer Grid</span>
                  <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    <AlertTriangle className="w-3 h-3" /> Yellow = Verify
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFullWidth(!isFullWidth)}
                    className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5"
                    title={isFullWidth ? "Switch to side-by-side view" : "Expand grid to full width"}
                  >
                    {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {isFullWidth ? "Split View" : "Full Width Grid"}
                  </button>
                  <span className="text-xs text-zinc-400 font-medium">{activeDraft.rows?.length || 0} rows</span>
                </div>
              </div>

              <div className="border border-zinc-800 rounded-xl overflow-x-auto bg-zinc-950/60 shadow-inner">
                <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                  <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10">
                    <tr className="text-zinc-400 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-8">#</th>
                      <th className="py-2.5 px-3 min-w-[150px]">Customer Name</th>
                      {columnCodes.map((code) => (
                        <th key={code} className="py-2.5 px-2 text-center min-w-[80px]">
                          {code}
                        </th>
                      ))}
                      <th className="py-2.5 px-2 text-center w-12">Skip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {activeDraft.rows?.map((row, rIdx) => {
                      const isSelected = selectedRowIndex === rIdx;
                      return (
                        <tr
                          key={rIdx}
                          onClick={() => setSelectedRowIndex(rIdx)}
                          className={`transition-colors ${row.skip ? "opacity-30 bg-zinc-950" : isSelected ? "bg-emerald-950/30" : "hover:bg-zinc-800/30"
                            }`}
                        >
                          <td className="py-2 px-3 text-zinc-500 font-mono">{rIdx + 1}</td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.customer_name || row.customer_name_raw || row.name || row.customer || ""}
                              onChange={(e) => handleCustomerNameChange(rIdx, e.target.value)}
                              className="bg-zinc-900 border border-zinc-700/80 rounded px-2 py-1 text-xs text-zinc-100 w-full focus:border-emerald-500 focus:outline-none"
                            />
                            {row.customer_name_raw && row.customer_name !== row.customer_name_raw && (
                              <span className="text-[10px] text-zinc-500 block truncate">
                                Raw: {row.customer_name_raw}
                              </span>
                            )}
                          </td>

                          {columnCodes.map((code) => {
                            const cellData = row.cells?.[code] || {};
                            const qty = cellData.quantity;
                            const rate = cellData.rate;
                            const conf = cellData.confidence !== undefined ? cellData.confidence : 1.0;
                            const isLowConf = conf < 0.7 && conf >= 0.4;
                            const isVeryLow = conf < 0.4;
                            const tag = cellData.tag;
                            const tagMeaning = tag ? tagMeaningMap[tag] : null;

                            return (
                              <td
                                key={code}
                                className={`py-1.5 px-1 text-center ${isVeryLow ? "bg-rose-950/40" : isLowConf ? "bg-amber-950/30" : ""
                                  }`}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <input
                                    type="text"
                                    placeholder="-"
                                    value={qty !== null && qty !== undefined ? qty : ""}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      handleCellChange(rIdx, code, "quantity", v === "" ? null : parseFloat(v) || v);
                                    }}
                                    className={`w-14 text-center py-0.5 px-1 rounded font-mono text-xs focus:outline-none ${isLowConf
                                        ? "bg-amber-900/30 text-amber-200 border border-amber-600/50"
                                        : "bg-zinc-900 text-zinc-200 border border-zinc-700/60 focus:border-emerald-500"
                                      }`}
                                  />
                                  {/* Fraction rate indicator or tag badge */}
                                  {(rate || tag || cellData.circled_value) && (
                                    <div className="flex items-center gap-1 text-[10px]">
                                      {rate && <span className="text-zinc-400 font-mono">@{rate}</span>}
                                      {tag && (
                                        <span
                                          title={tagMeaning || "Tag"}
                                          className="text-amber-400 bg-amber-500/20 px-1 rounded cursor-help font-bold"
                                        >
                                          {tag}
                                        </span>
                                      )}
                                      {cellData.circled_value && (
                                        <span className="text-blue-400 font-bold">⊚{cellData.circled_value}</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={!!row.skip}
                              onChange={() => toggleSkipRow(rIdx)}
                              className="rounded border-zinc-700 bg-zinc-800 text-rose-500"
                              title="Skip this row from import"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload History Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-200">Past Scanned Uploads</h3>
          <button onClick={() => refetchUploads()} className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[550px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 font-semibold uppercase">
                <th className="py-3 px-5">Upload ID / Date</th>
                <th className="py-3 px-5">Type</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-sm">
              {uploads.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 px-5">
                    <span className="font-semibold text-zinc-200">#{u.id}</span>
                    <span className="text-xs text-zinc-400 block">{u.page_date || "Undated"}</span>
                  </td>
                  <td className="py-3 px-5 capitalize text-zinc-300 text-xs">{u.upload_type}</td>
                  <td className="py-3 px-5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${u.status === "saved"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : u.status === "needs_review"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : u.status === "processing"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                    >
                      {u.status === "saved" && <CheckCircle2 className="w-3 h-3" />}
                      {u.status === "needs_review" && <AlertTriangle className="w-3 h-3" />}
                      {u.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-xs text-zinc-500">
                    {u.created_at ? new Date(u.created_at).toLocaleString() : "-"}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openReviewWorkspace(u)}
                        className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {u.status === "saved" ? "View Grid" : "Review"}
                      </button>
                      <button
                        onClick={() => handleDownloadExcel(u.id)}
                        className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded-lg"
                        title="Download Excel"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
