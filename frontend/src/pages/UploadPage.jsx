import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload as UploadIcon, FileSpreadsheet, CheckCircle2, AlertTriangle,
  Sparkles, RefreshCw, ZoomIn, ZoomOut, ArrowRight,
  Trash2, Plus, Calendar, Eye, Camera, Check,
  Maximize2, Minimize2, Receipt, X, ChevronRight,
  Package, RotateCw, Expand, ChevronDown, ChevronUp,
  Search, Undo2, Redo2,
  Columns3, CheckCheck, Merge, ChevronLeft, ScanLine, Move
} from "lucide-react";
import toast from "react-hot-toast";
import api, { API_BASE_URL } from "../lib/api";
import { formatCurrency, formatDate, formatDateTime, downloadBlob } from "../lib/utils";

// ─── Camera Guide Overlay Modal ──────────────────────────────────────────────
function CameraGuideModal({ isOpen, onClose, onFileSelect }) {
  const fileInputRef = useRef(null);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-5 text-left">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Camera className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Ledger Camera Guide</h3>
              <p className="text-xs text-zinc-400">Tips for 99%+ Gemini OCR accuracy</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Framing Simulation Graphic */}
        <div className="relative w-full h-48 bg-zinc-950 border border-dashed border-emerald-500/40 rounded-xl overflow-hidden flex items-center justify-center p-4 select-none">
          {/* Viewfinder Corners */}
          <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400" />
          <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400" />
          <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400" />
          <ScanLine className="w-8 h-8 text-emerald-400/40 animate-pulse absolute" />

          <div className="text-center space-y-1.5 z-10">
            <span className="text-xs font-mono font-semibold text-emerald-400 bg-zinc-900/90 px-3 py-1 rounded-full border border-emerald-500/30">
              ALIGN NOTEBOOK EDGES INSIDE FRAME
            </span>
            <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
              Ensure column headers (M, R, B, P, K, T, JB) and customer names on left are sharp and evenly lit.
            </p>
          </div>
        </div>

        <ul className="text-xs text-zinc-300 space-y-2 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Hold phone directly parallel above the page (avoid steep angles).</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Avoid strong hand shadows over pencil quantities and circled totals.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>If image appears sideways, you can rotate 90° in the workspace.</span>
          </li>
        </ul>

        <div className="flex items-center justify-end gap-3 pt-2">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files[0];
              if (f) {
                onFileSelect(f);
                onClose();
              }
            }}
          />
          <button onClick={onClose} className="btn-secondary text-xs py-2 px-4">
            Cancel
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-2 shadow-lg shadow-emerald-950/50"
          >
            <Camera className="w-4 h-4" />
            Open Camera / Pick Photo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Extraction Progress Modal ───────────────────────────────────────────────
function ExtractionProgressModal({ isOpen, step, onCancel }) {
  if (!isOpen) return null;

  const steps = [
    { title: "Uploading Ledger Image", desc: "Encrypting and transmitting high-res snapshot" },
    { title: "Preprocessing & Enhancement", desc: "Auto-deskewing, contrast tuning & pencil legibility filter" },
    { title: "Gemini AI Handwriting OCR", desc: "Reading handwritten numbers, column codes & customer names" },
    { title: "Product & Rate Resolution", desc: "Matching product codes and pulling authoritative rates from DB" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-emerald-500/40 rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-6 text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100">Digitizing Handwritten Ledger</h3>
            <p className="text-xs text-zinc-400">Powered by Gemini 2.5 Flash Vision AI</p>
          </div>
        </div>

        {/* Step List */}
        <div className="space-y-4">
          {steps.map((s, idx) => {
            const isCompleted = step > idx;
            const isCurrent = step === idx;

            return (
              <div key={idx} className="flex items-start gap-3.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${isCompleted
                  ? "bg-emerald-500 text-zinc-950"
                  : isCurrent
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/60 ring-2 ring-emerald-500/30 animate-pulse"
                    : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                  }`}>
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isCurrent ? "text-emerald-300 font-bold" : isCompleted ? "text-zinc-200" : "text-zinc-500"}`}>
                    {s.title}
                  </p>
                  <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                    {s.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onCancel}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1 px-3"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Image Lightbox Modal ────────────────────────────────────────────────────
function LedgerImageModal({ isOpen, onClose, imageUrl, rotation, setRotation }) {
  const [modalZoom, setModalZoom] = useState(1);
  const [modalPan, setModalPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const pinchRef = useRef({ startDist: 0, startZoom: 1 });

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: modalPan.x,
      panY: modalPan.y,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setModalPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { }
  };

  const handleReset = () => {
    setModalZoom(1);
    setModalPan({ x: 0, y: 0 });
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current.startDist = Math.sqrt(dx * dx + dy * dy);
      pinchRef.current.startZoom = modalZoom;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / pinchRef.current.startDist;
      const newZoom = Math.min(4, Math.max(0.5, Number((pinchRef.current.startZoom * scale).toFixed(2))));
      setModalZoom(newZoom);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
      {/* Responsive Header: stacks nicely on phone so close button is NEVER cut off */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-zinc-800 bg-zinc-950/95 gap-2 shrink-0">
        {/* Row 1 on mobile: Title + Visible Close Button */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-zinc-100 truncate">
                Ledger Photo Inspection
              </h3>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 hidden sm:block">
                Drag to explore · Zoom in to verify faint handwriting
              </p>
            </div>
          </div>

          {/* Dedicated mobile close button - always right here at top right */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 active:bg-zinc-600 transition-colors border border-zinc-700/60 shrink-0 sm:hidden flex items-center gap-1 text-xs font-semibold"
            title="Close"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-zinc-200" />
            <span>Close</span>
          </button>
        </div>

        {/* Row 2 on mobile (Right side on desktop): Zoom / Rotate controls + Desktop Close */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => setModalZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-zinc-600 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-mono font-bold text-emerald-400 px-2 min-w-[50px] text-center bg-zinc-900 border border-zinc-800 py-1 rounded hover:bg-zinc-800 transition-colors"
              title="Click to reset view"
            >
              {Math.round(modalZoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setModalZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
              className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:bg-zinc-600 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
              title="Fit to screen"
            >
              Fit
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
              <span>Rotate</span> {rotation !== 0 ? `(${rotation}°)` : ""}
            </button>

            <div className="hidden sm:block h-4 w-px bg-zinc-800 mx-0.5" />

            <button
              type="button"
              onClick={onClose}
              className="hidden sm:flex p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
              title="Close viewer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`flex-1 relative overflow-hidden p-4 flex items-center justify-center select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onDoubleClick={handleReset}
      >
        <img
          src={imageUrl}
          alt="Original Ledger Page High-Res"
          style={{
            transform: `translate(${modalPan.x}px, ${modalPan.y}px) rotate(${rotation}deg) scale(${modalZoom})`,
            transformOrigin: "center center",
          }}
          className="max-h-full max-w-full object-contain pointer-events-none transition-transform duration-75 shadow-2xl rounded-lg"
          draggable={false}
        />

        {/* Floating pan/drag instruction badge */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-700/80 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs text-zinc-300 flex items-center gap-2 pointer-events-none shadow-xl">
          <Move className="w-3.5 h-3.5 text-emerald-400" />
          <span>Drag with mouse or finger to move · Double-click to reset</span>
        </div>
      </div>
    </div>
  );
}

// ─── Pre-Bill Confirmation Modal ─────────────────────────────────────────────
function ConfirmBillModal({ isOpen, onClose, onConfirm, draftStats, customerList, isPending, isSaved, isDirty }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-emerald-500/40 rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-5 text-left">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-100">
              {isSaved && isDirty ? "Update & Re-create Bills?" : "Ready to Generate Bills?"}
            </h3>
            <p className="text-xs text-zinc-400">
              {isSaved && isDirty
                ? "Changes detected. Existing unpaid bills for this upload will be safely updated."
                : "Review final totals before creating official invoices"}
            </p>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
          <div>
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider">Total Customers</p>
            <p className="text-xl font-bold text-zinc-100 font-mono mt-0.5">{draftStats?.customerCount || 0}</p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider">Grand Total Amount</p>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">
              {formatCurrency(draftStats?.grandTotal || 0)}
            </p>
          </div>
        </div>

        {/* Customer Breakdown Preview */}
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Customers to be billed:</p>
          {customerList.map((c, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs">
              <span className="font-medium text-zinc-200 truncate max-w-[240px]">{c.name}</span>
              <span className="font-mono font-bold text-emerald-400">{formatCurrency(c.total)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
          <button onClick={onClose} disabled={isPending} className="btn-secondary text-xs py-2 px-4">
            Back to Grid
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending || (isSaved && !isDirty)}
            className="btn-primary text-xs py-2 px-5 flex items-center gap-2 shadow-lg shadow-emerald-950/60 disabled:opacity-50"
          >
            {isPending ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Creating Invoices...</>
            ) : isSaved && isDirty ? (
              <><CheckCheck className="w-4 h-4" />Update & Re-create {draftStats?.customerCount} Bills</>
            ) : (
              <><CheckCheck className="w-4 h-4" />Confirm & Create {draftStats?.customerCount} Bills</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Post-Creation Results Modal ─────────────────────────────────────────────
function BillResultModal({ bills, skipped, onClose, onGoToBills }) {
  const total = bills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">Bills Created Successfully</h3>
              <p className="text-xs text-zinc-400">{bills.length} bills generated and synced</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-zinc-950 m-5 p-4 rounded-xl border border-zinc-800 text-center">
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Bills Created</p>
            <p className="text-xl font-bold text-emerald-400 font-mono">{bills.length}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Total Amount</p>
            <p className="text-xl font-bold text-zinc-100 font-mono">{formatCurrency(total)}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
          {bills.map((bill, i) => (
            <div
              key={bill.bill_id}
              className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center font-mono font-bold text-zinc-400">
                  {i + 1}
                </div>
                <div>
                  <p className="font-semibold text-zinc-100">{bill.customer_name}</p>
                  <p className="text-[11px] text-zinc-500 font-mono">{bill.bill_no} · {bill.items_count} item(s)</p>
                </div>
              </div>
              <div className="text-right font-mono font-bold text-emerald-400">
                {formatCurrency(bill.total_amount)}
              </div>
            </div>
          ))}

          {skipped.length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs">
              <p className="font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Skipped Rows (No quantities)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {skipped.map((s, i) => (
                  <span key={i} className="text-[11px] text-amber-300/70 bg-amber-900/30 px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-800">
          <button onClick={onClose} className="btn-secondary text-xs py-2 px-4">
            Close
          </button>
          <button onClick={onGoToBills} className="btn-primary text-xs py-2 px-4 flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Go to Bills Section
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Bill Preview Panel ───────────────────────────────────────────────
function LedgerBillPreview({ draft }) {
  if (!draft?.rows?.length) return null;

  const rows = draft.rows.filter(r => !r.skip && (r.customer_name || r.customer_name_raw));
  const customerTotals = rows.map(row => {
    let total = 0;
    let itemCount = 0;
    const cells = row.cells || {};
    const items = [];

    for (const [code, cell] of Object.entries(cells)) {
      if (!cell || typeof cell !== "object") continue;
      const qty = parseFloat(cell.quantity) || 0;
      if (qty <= 0) continue;
      const rate = parseFloat(cell.resolved_rate ?? cell.rate) || 0;
      const amount = parseFloat(cell.resolved_amount) || (qty * rate);
      const productName = cell.resolved_product_name || code;
      const productCode = cell.resolved_product_code || "—";
      total += amount;
      itemCount++;
      items.push({
        code,
        productName,
        productCode,
        qty,
        rate,
        amount,
        isLive: !!cell.is_live || !!cell.circled_value
      });
    }
    return {
      name: row.customer_name || row.customer_name_raw,
      total,
      itemCount,
      items,
      isNew: row.is_new_customer,
    };
  });

  const grandTotal = customerTotals.reduce((s, c) => s + c.total, 0);

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/80 shadow-md">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/70">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Bill Preview</span>
          <span className="text-[11px] text-zinc-500">({customerTotals.length} customers)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Grand Total:</span>
          <span className="text-sm font-bold text-emerald-400 font-mono">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>

      <div className="divide-y divide-zinc-800/60 max-h-72 overflow-y-auto">
        {customerTotals.map((c, i) => (
          <details key={i} className="group">
            <summary className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-zinc-800/30 list-none select-none">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 font-mono">
                  {i + 1}
                </div>
                <div>
                  <span className="text-xs font-semibold text-zinc-100">{c.name}</span>
                  {c.isNew && (
                    <span className="ml-2 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">NEW</span>
                  )}
                  <span className="text-[11px] text-zinc-500 ml-2">({c.itemCount} items)</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-emerald-400 font-mono">{formatCurrency(c.total)}</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-open:rotate-90 transition-transform" />
              </div>
            </summary>
            <div className="px-4 pb-2.5 bg-zinc-950/60 text-[11px]">
              <div className="grid grid-cols-4 font-mono text-zinc-400 border-b border-zinc-800/60 py-1">
                <span>Code</span>
                <span>Product</span>
                <span className="text-right">Qty @ Rate</span>
                <span className="text-right">Amount</span>
              </div>
              {c.items.map((itm, j) => (
                <div key={j} className="grid grid-cols-4 py-1 text-zinc-300 font-mono">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    {itm.code}
                    {itm.isLive && (
                      <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        ⊚
                      </span>
                    )}
                  </span>
                  <span className="truncate flex items-center gap-1">
                    {itm.productName}
                    {itm.isLive && (
                      <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-sans font-bold">
                        LIVE
                      </span>
                    )}
                  </span>
                  <span className="text-right text-zinc-400">{itm.qty} @ ₹{itm.rate}</span>
                  <span className="text-right text-emerald-400 font-semibold">₹{itm.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

// ─── Merge Rows Modal ────────────────────────────────────────────────────────
function MergeRowsModal({ isOpen, onClose, rows, onMerge }) {
  const [sourceIdx, setSourceIdx] = useState("");
  const [targetIdx, setTargetIdx] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4 text-left">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Merge className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-zinc-100">Merge Two Customer Rows</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          Combines all quantities from a duplicate or split line into the primary customer row, then removes the source row.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
              Source Row (will be merged & removed):
            </label>
            <select
              value={sourceIdx}
              onChange={(e) => setSourceIdx(e.target.value)}
              className="input-field text-xs w-full"
            >
              <option value="">-- Select Row to merge --</option>
              {rows.map((r, i) => (
                <option key={i} value={i}>
                  #{i + 1}: {r.customer_name || r.customer_name_raw || `(Row ${i + 1})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
              Target Customer (will receive quantities):
            </label>
            <select
              value={targetIdx}
              onChange={(e) => setTargetIdx(e.target.value)}
              className="input-field text-xs w-full"
            >
              <option value="">-- Select Destination Row --</option>
              {rows.map((r, i) => (
                <option key={i} value={i} disabled={Number(sourceIdx) === i}>
                  #{i + 1}: {r.customer_name || r.customer_name_raw || `(Row ${i + 1})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
          <button onClick={onClose} className="btn-secondary text-xs py-1.5 px-3">
            Cancel
          </button>
          <button
            onClick={() => {
              if (sourceIdx === "" || targetIdx === "" || sourceIdx === targetIdx) {
                return toast.error("Please select two different rows to merge");
              }
              onMerge(Number(sourceIdx), Number(targetIdx));
              onClose();
            }}
            className="btn-primary text-xs py-1.5 px-3"
          >
            Confirm Merge
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Upload Page Component ──────────────────────────────────────────────
export default function UploadPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadType, setUploadType] = useState("ledger");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);

  // Active workspace state
  const [activeUploadId, setActiveUploadId] = useState(null);
  const [activeUploadStatus, setActiveUploadStatus] = useState("needs_review"); // needs_review | saved
  const [isDraftDirty, setIsDraftDirty] = useState(false);
  const [activeDraft, setActiveDraft] = useState(null);
  const [activeDate, setActiveDate] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [desktopPan, setDesktopPan] = useState({ x: 0, y: 0 });
  const [isDesktopDragging, setIsDesktopDragging] = useState(false);
  const desktopDragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [mobileZoom, setMobileZoom] = useState(1);
  const [mobilePan, setMobilePan] = useState({ x: 0, y: 0 });
  const [isMobileDragging, setIsMobileDragging] = useState(false);
  const mobileDragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [isMobileImageOpen, setIsMobileImageOpen] = useState(true);
  const mobileImageRef = useRef(null);
  const pinchRef = useRef({ startDist: 0, startZoom: 1 });
  const [isMappingExpanded, setIsMappingExpanded] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [showBillPreview, setShowBillPreview] = useState(false);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Modals
  const [isCameraGuideOpen, setIsCameraGuideOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [billResult, setBillResult] = useState(null);

  // Past Uploads Filter & Search
  const [historyFilter, setHistoryFilter] = useState("all"); // all | needs_review | saved
  const [historySearch, setHistorySearch] = useState("");

  // Undo / Redo History Stack
  const [draftHistory, setDraftHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const navigate = useNavigate();

  // Fetch recent uploads list (polls only when an upload is in processing state)
  const { data: uploads = [], refetch: refetchUploads } = useQuery({
    queryKey: ["uploads"],
    queryFn: async () => (await api.get("/uploads?limit=25")).data,
    refetchInterval: (query) => {
      const data = query?.state?.data;
      return Array.isArray(data) && data.some((u) => u.status === "processing") ? 8000 : false;
    },
    refetchIntervalInBackground: false,
  });

  // Fetch tag dictionary for hover explanations
  const { data: tags = [] } = useQuery({
    queryKey: ["settings", "tags"],
    queryFn: async () => (await api.get("/settings/tags")).data,
    staleTime: 5 * 60_000,
  });
  const tagMeaningMap = useMemo(
    () => tags.reduce((acc, t) => { acc[t.tag] = t.meaning; return acc; }, {}),
    [tags]
  );

  // Fetch customers for autocomplete & fuzzy matching
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get("/customers")).data,
    staleTime: 5 * 60_000,
  });

  // Fetch products for column mapping
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
    staleTime: 5 * 60_000,
  });

  // Fetch column mappings
  const { data: columnMappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ["settings", "columns"],
    queryFn: async () => (await api.get("/settings/columns")).data,
  });

  // Column to product map
  const colToProductMap = useMemo(() => {
    const map = {};
    columnMappings.forEach((m) => {
      if (m.active && m.column_code) {
        map[m.column_code.toUpperCase()] = {
          product_id: m.product_id,
          name: m.product_name,
        };
      }
    });
    products.forEach((p) => {
      if (p.product_code) {
        const code = p.product_code.trim().toUpperCase();
        if (!map[code]) map[code] = { product_id: p.id, name: p.name };
      }
      if (p.name) {
        const nameCode = p.name.trim().toUpperCase();
        if (!map[nameCode]) map[nameCode] = { product_id: p.id, name: p.name };
      }
    });
    return map;
  }, [columnMappings, products]);

  // Column codes detected in draft
  const columnCodes = useMemo(() => {
    const codesSet = new Set(activeDraft?.column_codes || []);
    if (activeDraft?.rows) {
      activeDraft.rows.forEach((row) => {
        if (row.cells) Object.keys(row.cells).forEach((k) => codesSet.add(k));
      });
    }
    const list = Array.from(codesSet);
    return list.length > 0 ? list : ["M", "R", "B", "P", "K", "T", "JB"];
  }, [activeDraft]);

  // Active columns (hides unmapped empty columns by default)
  const activeColumns = useMemo(() => {
    if (showAllColumns) return columnCodes;
    return columnCodes.filter((code) => {
      const isMapped = !!colToProductMap[code.toUpperCase()];
      if (isMapped) return true;
      // Keep if any row has non-zero quantity entered
      const hasData = activeDraft?.rows?.some((r) => {
        if (r.skip) return false;
        const q = parseFloat(r.cells?.[code]?.quantity);
        return q && !isNaN(q) && q > 0;
      });
      return hasData;
    });
  }, [columnCodes, colToProductMap, activeDraft, showAllColumns]);

  // Push draft into undo stack
  const updateDraftWithHistory = useCallback((newDraft) => {
    setIsDraftDirty(true);
    setDraftHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      const nextHistory = [...sliced, structuredClone(newDraft)];
      if (nextHistory.length > 25) nextHistory.shift();
      return nextHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 24));
    setActiveDraft(newDraft);
  }, [historyIndex]);

  // Keyboard Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevDraft = draftHistory[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setActiveDraft(structuredClone(prevDraft));
      setIsDraftDirty(true);
      toast.success("Undo", { id: "undo-toast", duration: 800 });
    }
  }, [historyIndex, draftHistory]);

  const handleRedo = useCallback(() => {
    if (historyIndex < draftHistory.length - 1) {
      const nextDraft = draftHistory[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setActiveDraft(structuredClone(nextDraft));
      setIsDraftDirty(true);
      toast.success("Redo", { id: "undo-toast", duration: 800 });
    }
  }, [historyIndex, draftHistory]);

  // Global Ctrl+Z / Ctrl+Y hotkey listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Cells needing review (low confidence, missing name, or missing rate)
  const reviewItems = useMemo(() => {
    if (!activeDraft?.rows) return [];
    const list = [];
    activeDraft.rows.forEach((row, rIdx) => {
      if (row.skip) return;
      const cName = row.customer_name || row.customer_name_raw;
      if (!cName || cName.trim() === "") {
        list.push({ type: "customer", rowIndex: rIdx, colCode: null, reason: "Customer name missing" });
      }
      columnCodes.forEach((code) => {
        const cell = row.cells?.[code];
        if (!cell) return;
        const q = parseFloat(cell.quantity);
        if (!q || isNaN(q) || q <= 0) return;
        const conf = cell.confidence !== undefined ? cell.confidence : 1.0;
        if (conf < 0.7 || cell.mapping_issue) {
          list.push({
            type: "cell",
            rowIndex: rIdx,
            colCode: code,
            conf,
            reason: conf < 0.4 ? "Very low confidence" : conf < 0.7 ? "Low confidence OCR" : "Unmapped rate"
          });
        }
      });
    });
    return list;
  }, [activeDraft, columnCodes]);

  // Step through review items
  const jumpToReviewItem = (direction) => {
    if (reviewItems.length === 0) return;
    let nextIdx = direction === "next" ? currentReviewIndex + 1 : currentReviewIndex - 1;
    if (nextIdx >= reviewItems.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = reviewItems.length - 1;
    setCurrentReviewIndex(nextIdx);

    const item = reviewItems[nextIdx];
    setSelectedRowIndex(item.rowIndex);

    setTimeout(() => {
      if (item.type === "customer") {
        document.getElementById(`input-customer-${item.rowIndex}`)?.focus();
      } else {
        document.getElementById(`input-cell-${item.rowIndex}-${item.colCode}`)?.focus();
      }
    }, 50);
  };

  // Draft summary statistics
  const draftStats = useMemo(() => {
    if (!activeDraft?.rows) return null;
    const validRows = activeDraft.rows.filter(r => !r.skip && (r.customer_name || r.customer_name_raw));
    let grandTotal = 0;
    validRows.forEach(row => {
      Object.values(row.cells || {}).forEach(cell => {
        if (typeof cell !== "object") return;
        const qty = parseFloat(cell.quantity) || 0;
        const rate = parseFloat(cell.resolved_rate ?? cell.rate) || 0;
        const amount = parseFloat(cell.resolved_amount) || (qty * rate);
        grandTotal += amount;
      });
    });
    return { customerCount: validRows.length, grandTotal };
  }, [activeDraft]);

  // Customer bill items list for pre-bill confirmation modal
  const customerSummaryList = useMemo(() => {
    if (!activeDraft?.rows) return [];
    return activeDraft.rows
      .filter(r => !r.skip && (r.customer_name || r.customer_name_raw))
      .map(row => {
        let total = 0;
        Object.values(row.cells || {}).forEach(c => {
          const q = parseFloat(c.quantity) || 0;
          const r = parseFloat(c.resolved_rate ?? c.rate) || 0;
          total += parseFloat(c.resolved_amount) || (q * r);
        });
        return { name: row.customer_name || row.customer_name_raw, total };
      });
  }, [activeDraft]);

  // Fuzzy match finder for customer names
  const getFuzzySuggestion = (name) => {
    if (!name || name.trim().length < 3) return null;
    const clean = name.trim().toLowerCase();
    if (customers.some(c => c.name.toLowerCase() === clean)) return null;

    return customers.find(c => {
      const cName = c.name.toLowerCase();
      return (
        (cName.includes(clean) || clean.includes(cName)) &&
        Math.abs(cName.length - clean.length) <= 5
      );
    });
  };

  // Cell change handler
  const handleCellChange = (rowIndex, colCode, field, value) => {
    if (!activeDraft) return;
    const newDraft = { ...activeDraft };
    const rows = [...newDraft.rows];
    const row = { ...rows[rowIndex] };
    const cells = { ...row.cells };
    const cell = { ...cells[colCode], [field]: value };
    if (field === "quantity" || field === "rate") {
      cell.confidence = 1.0;
      const q = parseFloat(field === "quantity" ? value : cell.quantity) || 0;
      const r = parseFloat(field === "rate" ? value : (cell.resolved_rate ?? cell.rate)) || 0;
      cell.resolved_amount = parseFloat((q * r).toFixed(2));
    }
    cells[colCode] = cell;
    row.cells = cells;
    rows[rowIndex] = row;
    newDraft.rows = rows;
    updateDraftWithHistory(newDraft);
  };

  // Toggle live fish (circled) on a cell
  const toggleLiveCell = async (rowIndex, colCode) => {
    if (!activeDraft) return;
    const newDraft = { ...activeDraft };
    const rows = [...newDraft.rows];
    const row = { ...rows[rowIndex] };
    const cells = { ...row.cells };
    const cell = { ...cells[colCode] };

    const newIsLive = !cell.is_live;
    cell.is_live = newIsLive;
    if (newIsLive) {
      cell.circled_value = cell.quantity ? String(cell.quantity) : "1";
    } else {
      cell.circled_value = null;
    }

    // Lookup effective rate with new live status
    const prodId = cell.resolved_product_id || colToProductMap[colCode.toUpperCase()]?.product_id;
    if (prodId) {
      try {
        const custId = row.customer_id;
        const res = await api.get(`/rates/effective?product_id=${prodId}${custId ? `&customer_id=${custId}` : ""}&is_live=${newIsLive}`);
        if (res.data && res.data.rate > 0) {
          cell.resolved_rate = res.data.rate;
          cell.rate_source = res.data.rate_type;
          const q = parseFloat(cell.quantity) || 0;
          cell.resolved_amount = parseFloat((q * res.data.rate).toFixed(2));
        }
      } catch (err) {
        const q = parseFloat(cell.quantity) || 0;
        const r = parseFloat(cell.resolved_rate ?? cell.rate) || 0;
        cell.resolved_amount = parseFloat((q * r).toFixed(2));
      }
    }

    cells[colCode] = cell;
    row.cells = cells;
    rows[rowIndex] = row;
    newDraft.rows = rows;
    updateDraftWithHistory(newDraft);
    toast.success(newIsLive ? `Marked ${colCode} as Live Fish (⊚)` : `Set ${colCode} to Standard Rate`, { id: "live-toggle-toast", duration: 900 });
  };

  // Customer name change handler
  const handleCustomerNameChange = (rowIndex, value) => {
    if (!activeDraft) return;
    const newDraft = { ...activeDraft };
    const rows = [...newDraft.rows];
    rows[rowIndex] = { ...rows[rowIndex], customer_name: value };
    newDraft.rows = rows;
    updateDraftWithHistory(newDraft);
  };

  // Toggle skip row
  const toggleSkipRow = (rowIndex) => {
    if (!activeDraft) return;
    const newDraft = { ...activeDraft };
    const rows = [...newDraft.rows];
    rows[rowIndex] = { ...rows[rowIndex], skip: !rows[rowIndex].skip };
    newDraft.rows = rows;
    updateDraftWithHistory(newDraft);
  };

  // Add new customer row
  const handleAddRow = () => {
    if (!activeDraft) return;
    const newDraft = { ...activeDraft };
    const rows = [...(newDraft.rows || [])];
    rows.push({
      customer_name: "",
      is_new_customer: true,
      cells: {},
    });
    newDraft.rows = rows;
    updateDraftWithHistory(newDraft);
    toast.success("New customer row added at bottom");
    setSelectedRowIndex(rows.length - 1);
  };

  // Delete customer row
  const handleDeleteRow = (rowIndex) => {
    if (!activeDraft) return;
    const newDraft = { ...activeDraft };
    const rows = [...newDraft.rows];
    rows.splice(rowIndex, 1);
    newDraft.rows = rows;
    updateDraftWithHistory(newDraft);
    toast.success("Row removed");
    if (selectedRowIndex === rowIndex) setSelectedRowIndex(null);
  };

  // Merge rows handler
  const handleMergeRows = (sIdx, tIdx) => {
    if (!activeDraft) return;
    const newDraft = { ...activeDraft };
    const rows = [...newDraft.rows];
    const sourceRow = rows[sIdx];
    const targetRow = rows[tIdx];

    // Combine cell quantities
    const mergedCells = { ...targetRow.cells };
    Object.entries(sourceRow.cells || {}).forEach(([code, sCell]) => {
      const sQty = parseFloat(sCell.quantity) || 0;
      if (sQty > 0) {
        const tQty = parseFloat(mergedCells[code]?.quantity) || 0;
        mergedCells[code] = {
          ...sCell,
          quantity: tQty + sQty,
          confidence: 1.0,
        };
      }
    });

    targetRow.cells = mergedCells;
    rows.splice(sIdx, 1);
    newDraft.rows = rows;
    updateDraftWithHistory(newDraft);
    toast.success("Rows merged successfully");
  };

  // Map column to product mutation
  const mapColumnMutation = useMutation({
    mutationFn: async ({ column_code, product_id }) => {
      return (await api.post("/settings/columns", {
        column_code,
        product_id: Number(product_id),
        active: true
      })).data;
    },
    onSuccess: async (_, vars) => {
      toast.success(`Mapped column ${vars.column_code} successfully!`);
      refetchMappings();
      if (activeUploadId) {
        const res = await api.get(`/uploads/${activeUploadId}`);
        setActiveDraft(res.data.draft_data);
        setIsDraftDirty(true);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to update mapping");
    }
  });

  // Save draft corrections
  const saveDraftMutation = useMutation({
    mutationFn: () => api.put(`/uploads/${activeUploadId}/draft`, {
      page_date: activeDate,
      draft_data: activeDraft,
    }),
    onSuccess: () => {
      toast.success("Draft saved successfully");
      setLastSavedTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      refetchUploads();
    },
  });

  // Create bills for all customers
  const confirmMutation = useMutation({
    mutationFn: async () => {
      try {
        await api.put(`/uploads/${activeUploadId}/draft`, {
          page_date: activeDate,
          draft_data: activeDraft,
        });
      } catch (_) { }
      return api.post(`/uploads/${activeUploadId}/confirm`);
    },
    onSuccess: (res) => {
      const { created_bills = [], skipped_rows = [] } = res.data;
      queryClient.invalidateQueries(["bills"]);
      queryClient.invalidateQueries(["stats"]);
      queryClient.invalidateQueries(["dashboard-stats"]);
      queryClient.invalidateQueries(["customers"]);
      refetchUploads();
      setBillResult({ bills: created_bills, skipped: skipped_rows });
      setIsConfirmModalOpen(false);
      setActiveUploadStatus("saved");
      setIsDraftDirty(false);
      setShowBillPreview(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to create bills");
    },
  });

  // Delete upload mutation
  const deleteUploadMutation = useMutation({
    mutationFn: (uploadId) => api.delete(`/uploads/${uploadId}`),
    onSuccess: () => {
      toast.success("Upload deleted successfully");
      refetchUploads();
      queryClient.invalidateQueries(["bills"]);
      queryClient.invalidateQueries(["stats"]);
      queryClient.invalidateQueries(["dashboard-stats"]);
      if (activeUploadId) {
        setActiveUploadId(null);
        setActiveDraft(null);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || "Failed to delete upload");
    },
  });

  // Download Excel
  const handleDownloadExcel = async (targetUploadId) => {
    const id = (typeof targetUploadId === "number" || typeof targetUploadId === "string")
      ? targetUploadId
      : activeUploadId;

    if (!id) return toast.error("No active upload selected to download.");

    try {
      toast.loading("Generating 3-sheet Excel report...", { id: "excel-toast" });
      const response = await api.get(`/uploads/${id}/excel`, { responseType: "blob" });
      const filename = `digitized_ledger_upload_${id}.xlsx`;
      downloadBlob(response.data, filename);
      toast.success("Excel report downloaded!", { id: "excel-toast" });
    } catch (err) {
      toast.error("Failed to generate Excel report", { id: "excel-toast" });
    }
  };

  // Upload and extract handler with multi-step feedback
  const handleUploadSubmit = async () => {
    if (!file) return toast.error("Please select or capture a bill photo first");
    setIsUploading(true);
    setUploadStep(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_type", uploadType);

    const stepInterval = setInterval(() => {
      setUploadStep((s) => Math.min(s + 1, 3));
    }, 1800);

    try {
      const res = await api.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      clearInterval(stepInterval);
      setUploadStep(4);
      toast.success("Ledger extracted! Review your entries below.");

      setActiveUploadId(res.data.id);
      setActiveUploadStatus(res.data.status || "needs_review");
      setIsDraftDirty(true);
      setActiveDraft(res.data.draft_data);
      setDraftHistory([JSON.parse(JSON.stringify(res.data.draft_data))]);
      setHistoryIndex(0);
      setActiveDate(res.data.page_date || new Date().toISOString().split("T")[0]);
      const img = res.data.image_url;
      setPreviewUrl(img ? (img.startsWith("http") ? img : `${API_BASE_URL}${img}`) : null);
      setFile(null);
      setShowBillPreview(false);
      refetchUploads();
    } catch (err) {
      clearInterval(stepInterval);
      toast.error(err.response?.data?.detail || "AI extraction failed. Please try again with a clearer photo.");
    } finally {
      setIsUploading(false);
    }
  };

  // Open an existing upload in the review workspace
  const openReviewWorkspace = async (upload) => {
    try {
      const res = await api.get(`/uploads/${upload.id}`);
      setActiveUploadId(upload.id);
      setActiveUploadStatus(res.data.status || upload.status || "needs_review");
      setIsDraftDirty(upload.status !== "saved");
      setActiveDraft(res.data.draft_data);
      setDraftHistory([JSON.parse(JSON.stringify(res.data.draft_data))]);
      setHistoryIndex(0);
      setActiveDate(res.data.page_date || "");
      const img = res.data.image_url;
      setPreviewUrl(img ? (img.startsWith("http") ? img : `${API_BASE_URL}${img}`) : null);
      setSelectedRowIndex(null);
      setShowBillPreview(false);
      window.scrollTo({ top: 400, behavior: "smooth" });
    } catch (e) {
      toast.error("Failed to load upload review");
    }
  };

  // Filtered and prioritized past uploads
  const filteredUploads = useMemo(() => {
    let list = [...uploads];
    // Sort needs_review first, then newest
    list.sort((a, b) => {
      if (a.status === "needs_review" && b.status !== "needs_review") return -1;
      if (b.status === "needs_review" && a.status !== "needs_review") return 1;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    if (historyFilter === "needs_review") {
      list = list.filter(u => u.status === "needs_review");
    } else if (historyFilter === "saved") {
      list = list.filter(u => u.status === "saved");
    }

    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter(u =>
        String(u.id).includes(q) ||
        (u.page_date && u.page_date.toLowerCase().includes(q)) ||
        (u.status && u.status.toLowerCase().includes(q))
      );
    }
    return list;
  }, [uploads, historyFilter, historySearch]);

  const needsReviewCount = useMemo(() => uploads.filter(u => u.status === "needs_review").length, [uploads]);
  const savedCount = useMemo(() => uploads.filter(u => u.status === "saved").length, [uploads]);

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-28">
      {/* Modals */}
      <CameraGuideModal
        isOpen={isCameraGuideOpen}
        onClose={() => setIsCameraGuideOpen(false)}
        onFileSelect={(f) => {
          setFile(f);
          setPreviewUrl(URL.createObjectURL(f));
        }}
      />

      <ExtractionProgressModal
        isOpen={isUploading}
        step={uploadStep}
        onCancel={() => setIsUploading(false)}
      />

      {billResult && (
        <BillResultModal
          bills={billResult.bills}
          skipped={billResult.skipped}
          onClose={() => setBillResult(null)}
          onGoToBills={() => { setBillResult(null); navigate("/bills"); }}
        />
      )}

      <LedgerImageModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        imageUrl={previewUrl}
        rotation={rotation}
        setRotation={setRotation}
      />

      <ConfirmBillModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={() => confirmMutation.mutate()}
        draftStats={draftStats}
        customerList={customerSummaryList}
        isPending={confirmMutation.isPending}
        isSaved={activeUploadStatus === "saved"}
        isDirty={isDraftDirty}
      />

      <MergeRowsModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        rows={activeDraft?.rows || []}
        onMerge={handleMergeRows}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-zinc-100 tracking-tight">
            Upload & Digitize Ledgers
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 hidden sm:block">
            Gemini AI handwriting OCR extracts customer quantities and auto-resolves database rates
          </p>
          <p className="text-xs text-zinc-400 mt-0.5 sm:hidden">
            Scan ledger photos → AI extracts data → Create bills
          </p>
        </div>
      </div>

      {/* Upload Dropzone Card */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <span className="text-xs font-medium text-zinc-400 hidden sm:inline">Document Type:</span>
            <div className="segmented-nav w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setUploadType("ledger")}
                className={`segmented-item flex-1 sm:flex-none text-center ${uploadType === "ledger" ? "active" : ""}`}
              >
                <span className="hidden sm:inline">Ledger Page (Multi-customer)</span>
                <span className="sm:hidden">Ledger Page</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadType("bill")}
                className={`segmented-item flex-1 sm:flex-none text-center ${uploadType === "bill" ? "active" : ""}`}
              >
                <span className="hidden sm:inline">Single Bill / Invoice</span>
                <span className="sm:hidden">Single Bill</span>
              </button>
            </div>
          </div>
          <span className="text-xs text-zinc-500 hidden sm:block">JPG, PNG, WEBP, or Camera (up to 15MB)</span>
        </div>

        {/* Dropzone & Camera Box */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          <div
            className={`md:col-span-2 border-2 border-dashed rounded-2xl p-5 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${file ? "border-emerald-500/50 bg-emerald-950/10" : "border-zinc-700 hover:border-zinc-500 bg-zinc-950/40"
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
                if (f) { setFile(f); setPreviewUrl(URL.createObjectURL(f)); }
              }}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
                <p className="text-sm font-semibold text-zinc-100 break-all">{file.name}</p>
                <p className="text-xs text-zinc-400 font-mono">{(file.size / 1024).toFixed(1)} KB · Ready to scan</p>
                <span className="text-xs text-emerald-400 mt-1">Tap to change</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5 sm:gap-3">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <UploadIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Tap to upload ledger photo</p>
                  <p className="text-xs text-zinc-500 mt-1 hidden sm:block">Automatic perspective enhancement, contrast tuning & rotation</p>
                  <p className="text-xs text-zinc-500 mt-1 sm:hidden">JPG, PNG, WEBP · up to 15MB</p>
                </div>
              </div>
            )}
          </div>

          {/* Action side box */}
          <div className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80">
            <button
              type="button"
              onClick={() => setIsCameraGuideOpen(true)}
              className="btn-secondary w-full text-sm py-2.5 flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              Open Camera
            </button>

            <button
              onClick={handleUploadSubmit}
              disabled={!file || isUploading}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2.5 shadow-lg shadow-emerald-950/50 disabled:opacity-40"
            >
              {isUploading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" />Analyzing...</>
              ) : (
                <><Sparkles className="w-4 h-4" />Extract with AI</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* VERIFICATION WORKSPACE                                         */}
      {/* ============================================================= */}
      {activeDraft && (
        <div className="card p-4 sm:p-6 border-emerald-500/30 bg-zinc-900/95 shadow-2xl animate-in fade-in duration-200 space-y-4 sm:space-y-5">
          {/* Workspace Header Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Review
                </span>
                <span className="text-xs text-zinc-400 font-mono">#{activeUploadId}</span>
                {lastSavedTime && (
                  <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">· Saved {lastSavedTime}</span>
                )}
                {activeUploadStatus === "saved" && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${isDraftDirty
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}>
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="hidden sm:inline">{isDraftDirty ? "Modified · Pending Update" : "Bills Generated"}</span>
                    <span className="sm:hidden">{isDraftDirty ? "Modified" : "Done"}</span>
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-xl font-bold text-zinc-100 mt-1">Verify Extracted Ledger</h2>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Compare row-by-row against the original photo. Use Tab / Enter / Arrows to navigate quickly.
              </p>
            </div>

            {/* Quick Actions — Row 1: Essential controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Review Badge */}
              {reviewItems.length > 0 ? (
                <div className="flex items-center bg-amber-950/40 border border-amber-500/40 rounded-lg px-2 py-1.5 gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs font-semibold text-amber-300">
                    {reviewItems.length} issues
                  </span>
                  <div className="flex items-center gap-0.5 border-l border-amber-500/30 pl-1.5">
                    <button
                      onClick={() => jumpToReviewItem("prev")}
                      className="p-1 text-amber-300 hover:text-amber-100 hover:bg-amber-900/50 rounded"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-mono text-amber-400 min-w-[28px] text-center">
                      {currentReviewIndex + 1}/{reviewItems.length}
                    </span>
                    <button
                      onClick={() => jumpToReviewItem("next")}
                      className="p-1 text-amber-300 hover:text-amber-100 hover:bg-amber-900/50 rounded"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All Verified
                </span>
              )}

              {/* Undo / Redo */}
              <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-0.5">
                <button type="button" onClick={handleUndo} disabled={historyIndex <= 0}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 rounded transition-colors">
                  <Undo2 className="w-4 h-4" />
                </button>
                <button type="button" onClick={handleRedo} disabled={historyIndex >= draftHistory.length - 1}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 rounded transition-colors">
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>

              {/* Date */}
              <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-800">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <input
                  type="date"
                  value={activeDate}
                  onChange={(e) => { setActiveDate(e.target.value); setIsDraftDirty(true); }}
                  className="bg-transparent text-xs text-emerald-400 font-semibold focus:outline-none cursor-pointer"
                />
              </div>

              {/* Add Row + Merge — icons only on mobile */}
              <button type="button" onClick={handleAddRow}
                className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Add Row</span>
              </button>

              <button type="button" onClick={() => setIsMergeModalOpen(true)}
                className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-2.5 sm:px-3">
                <Merge className="w-4 h-4 text-zinc-400" />
                <span className="hidden sm:inline">Merge</span>
              </button>

              {/* View Image on Mobile */}
              {previewUrl && (
                <button type="button" onClick={() => setIsLightboxOpen(true)}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-2.5 md:hidden">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>Photo</span>
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Column Mapping Toolbar */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 shadow-md flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-zinc-200">Ledger Column Products & Rates</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${columnCodes.every(c => colToProductMap[c.toUpperCase()])
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  }`}>
                  {columnCodes.filter(c => colToProductMap[c.toUpperCase()]).length}/{columnCodes.length} mapped
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMappingExpanded(!isMappingExpanded)}
                className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 py-0.5 px-2 rounded hover:bg-zinc-800 transition-colors"
              >
                {isMappingExpanded ? (
                  <><ChevronUp className="w-3.5 h-3.5" /> Collapse</>
                ) : (
                  <><ChevronDown className="w-3.5 h-3.5" /> Edit Mappings</>
                )}
              </button>
            </div>

            {/* Compact Pills Bar */}
            {!isMappingExpanded ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {columnCodes.map((code) => {
                  const mapped = colToProductMap[code.toUpperCase()];
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setIsMappingExpanded(true)}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono border transition-all ${mapped
                        ? "bg-zinc-900 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60"
                        : "bg-amber-950/20 border-amber-500/30 text-amber-300 hover:border-amber-500/60"
                        }`}
                      title={mapped ? `Column ${code} mapped to ${mapped.name}` : `Column ${code} unmapped - click to map`}
                    >
                      <span className="font-bold text-zinc-100">{code}</span>
                      <span className="text-zinc-500">→</span>
                      <span className="font-sans text-[11px] truncate max-w-[95px]">
                        {mapped ? mapped.name : "Unmapped"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Expanded Dropdown Selector Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 pt-2 border-t border-zinc-800 animate-in fade-in duration-150">
                {columnCodes.map((code) => {
                  const mapped = colToProductMap[code.toUpperCase()];
                  return (
                    <div
                      key={code}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${mapped
                        ? "bg-zinc-900 border-emerald-500/30"
                        : "bg-amber-950/20 border-amber-500/30"
                        }`}
                    >
                      <span className="font-mono font-bold px-2 py-1 rounded bg-zinc-800 text-zinc-100 text-xs">
                        {code}
                      </span>
                      <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                      <select
                        value={mapped?.product_id || ""}
                        onChange={(e) => {
                          if (e.target.value) {
                            mapColumnMutation.mutate({
                              column_code: code,
                              product_id: e.target.value,
                            });
                          }
                        }}
                        className={`bg-zinc-900 border rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-full truncate cursor-pointer ${mapped
                          ? "border-emerald-500/40 text-emerald-300 font-semibold"
                          : "border-amber-500/40 text-amber-400"
                          }`}
                      >
                        <option value="">-- Map Product --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.product_code ? `[Code: ${p.product_code}]` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* SPLIT VIEW: STICKY IMAGE (LEFT) & DATA GRID (RIGHT)        */}
          {/* ========================================================= */}
          <div className={`grid grid-cols-1 ${isFullWidth ? "lg:grid-cols-1" : "lg:grid-cols-12"} gap-6`}>
            {/* Left Column: Sticky Ledger Photo Viewer — HIDDEN on mobile, use lightbox */}
            <div className={`${isFullWidth ? "hidden" : "lg:col-span-5"} hidden md:flex flex-col gap-2.5 lg:sticky lg:top-4 self-start`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Ledger Source Photo
                  </span>
                  {selectedRowIndex !== null && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                      Tracking Row #{selectedRowIndex + 1}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(true)}
                    className="p-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors"
                    title="Open Fullscreen Lightbox"
                  >
                    <Expand className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Image Frame Container with Row-Linked Guide Band and Pan Dragging */}
              <div
                className={`relative w-full h-[380px] sm:h-[460px] lg:h-[600px] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden flex items-center justify-center group select-none ${isDesktopDragging ? "cursor-grabbing" : "cursor-grab"
                  }`}
                style={{ touchAction: "none" }}
                onPointerDown={(e) => {
                  if (e.button !== undefined && e.button !== 0) return;
                  setIsDesktopDragging(true);
                  desktopDragStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    panX: desktopPan.x,
                    panY: desktopPan.y,
                  };
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
                }}
                onPointerMove={(e) => {
                  if (!isDesktopDragging) return;
                  const dx = e.clientX - desktopDragStartRef.current.x;
                  const dy = e.clientY - desktopDragStartRef.current.y;
                  setDesktopPan({
                    x: desktopDragStartRef.current.panX + dx,
                    y: desktopDragStartRef.current.panY + dy,
                  });
                }}
                onPointerUp={(e) => {
                  setIsDesktopDragging(false);
                  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }
                }}
                onPointerCancel={() => setIsDesktopDragging(false)}
                onDoubleClick={() => {
                  setZoomLevel(1);
                  setDesktopPan({ x: 0, y: 0 });
                }}
              >
                {previewUrl ? (
                  <div className="w-full h-full flex items-center justify-center p-2 relative pointer-events-none">
                    <img
                      src={previewUrl}
                      alt="Ledger Preview"
                      style={{
                        transform: `translate(${desktopPan.x}px, ${desktopPan.y}px) rotate(${rotation}deg) scale(${zoomLevel})`,
                        transformOrigin: "center center",
                      }}
                      className="max-h-full max-w-full object-contain rounded shadow-lg transition-transform duration-75 select-none"
                      draggable={false}
                    />

                    {/* Synchronized Row-Linked Highlight Band that translates along with pan */}
                    {selectedRowIndex !== null && activeDraft?.rows?.length > 0 && (
                      <div
                        className="absolute left-2 right-2 pointer-events-none transition-all duration-150 border-y-2 border-emerald-400 bg-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.5)] z-20"
                        style={{
                          top: `calc(${Math.min(94, Math.max(2, (selectedRowIndex / activeDraft.rows.length) * 100))}% + ${desktopPan.y}px)`,
                          height: `${Math.max(4.5, 100 / activeDraft.rows.length)}%`,
                        }}
                      >
                        <div className="absolute right-1 top-0.5 text-[9px] font-mono font-bold text-emerald-300 bg-zinc-950/90 px-1.5 py-0.5 rounded border border-emerald-500/40">
                          Row #{selectedRowIndex + 1}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-zinc-600">No image available</span>
                )}

                {previewUrl && (
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(true)}
                    className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs px-2.5 py-1.5 rounded-lg shadow-xl flex items-center gap-1.5 z-30"
                  >
                    <Expand className="w-3.5 h-3.5 text-emerald-400" />
                    Enlarge Photo
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Editable Data Grid */}
            <div className={`${isFullWidth ? "lg:col-span-1" : "lg:col-span-7"} flex flex-col gap-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="font-semibold text-zinc-300 uppercase tracking-wider">
                    Entries ({activeDraft.rows?.length || 0})
                  </span>
                  {/* Column filter toggle — desktop only */}
                  <button
                    type="button"
                    onClick={() => setShowAllColumns(!showAllColumns)}
                    className={`hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${showAllColumns
                      ? "bg-zinc-800 text-zinc-200 border-zinc-700"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}
                  >
                    <Columns3 className="w-3 h-3" />
                    {showAllColumns ? "All columns" : "Active only"}
                  </button>
                </div>

                <div className="hidden md:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFullWidth(!isFullWidth)}
                    className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5"
                  >
                    {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    {isFullWidth ? "Split View" : "Full Width"}
                  </button>
                </div>
              </div>

              {/* ── Desktop Data Table ── */}
              <div className="hidden md:block border border-zinc-800 rounded-xl overflow-x-auto bg-zinc-950/90 shadow-inner max-h-[600px] relative">
                <table className="w-full text-left border-collapse text-xs min-w-[620px]">
                  <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-30 shadow-sm">
                    <tr className="text-zinc-400 font-semibold uppercase tracking-wider">
                      {/* Sticky Row # */}
                      <th className="sticky left-0 bg-zinc-900 z-30 py-3 px-3 w-10 text-center font-mono border-r border-zinc-800">
                        #
                      </th>
                      {/* Sticky Customer Name */}
                      <th className="sticky left-10 bg-zinc-900 z-30 py-3 px-3 min-w-[180px] border-r border-zinc-800 shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
                        Customer Name
                      </th>
                      {/* Active Product Columns */}
                      {activeColumns.map((code) => {
                        const mapped = colToProductMap[code.toUpperCase()];
                        return (
                          <th key={code} className="py-2.5 px-2 text-center min-w-[85px] border-x border-zinc-800/40">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-mono font-bold text-zinc-100 text-sm">{code}</span>
                              {mapped ? (
                                <span
                                  className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-1.5 py-0.2 rounded truncate max-w-[80px]"
                                  title={`Mapped to: ${mapped.name}`}
                                >
                                  {mapped.name}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-400/80 bg-amber-950/40 border border-amber-600/30 px-1.5 py-0.2 rounded font-medium">
                                  ? Unmapped
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                      <th className="py-2.5 px-3 text-right min-w-[110px] font-mono text-zinc-300">
                        Total (₹)
                      </th>
                      <th className="py-2.5 px-2 text-center w-10">Skip</th>
                      <th className="py-2.5 px-2 text-center w-10">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {activeDraft.rows?.map((row, rIdx) => {
                      const isSelected = selectedRowIndex === rIdx;
                      const customerName = row.customer_name || row.customer_name_raw || "";
                      const fuzzySuggestion = getFuzzySuggestion(customerName);

                      // Calculate customer row total amount
                      let rowTotalAmount = 0;
                      columnCodes.forEach((code) => {
                        const cell = row.cells?.[code];
                        if (!cell) return;
                        const q = parseFloat(cell.quantity);
                        if (!q || isNaN(q)) return;
                        const r = parseFloat(cell.resolved_rate ?? cell.rate);
                        const amt = parseFloat(cell.resolved_amount) || (r ? q * r : 0);
                        rowTotalAmount += amt;
                      });

                      return (
                        <tr
                          key={rIdx}
                          onClick={() => setSelectedRowIndex(rIdx)}
                          className={`transition-colors cursor-pointer ${row.skip
                            ? "opacity-35 bg-zinc-950"
                            : isSelected
                              ? "bg-emerald-950/40 ring-1 ring-inset ring-emerald-500/50"
                              : "hover:bg-zinc-800/40 bg-zinc-950"
                            }`}
                        >
                          {/* Sticky # */}
                          <td className={`sticky left-0 z-10 py-2.5 px-3 font-mono text-center border-r border-zinc-800/80 ${isSelected ? "bg-emerald-950/90 text-emerald-300 font-bold" : "bg-zinc-900 text-zinc-500"
                            }`}>
                            {rIdx + 1}
                          </td>

                          {/* Sticky Customer Name Column with Autocomplete Suggestion */}
                          <td className={`sticky left-10 z-10 py-2 px-3 border-r border-zinc-800 shadow-[4px_0_12px_rgba(0,0,0,0.5)] ${isSelected ? "bg-emerald-950/90" : "bg-zinc-900"
                            }`}>
                            <div className="relative">
                              <input
                                id={`input-customer-${rIdx}`}
                                type="text"
                                value={customerName}
                                onFocus={(e) => {
                                  setSelectedRowIndex(rIdx);
                                  e.target.select();
                                }}
                                onChange={(e) => handleCustomerNameChange(rIdx, e.target.value)}
                                placeholder="Customer Name"
                                className="bg-zinc-950 border border-zinc-700/80 rounded px-2.5 py-1 text-xs text-zinc-100 font-medium w-full focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              />

                              {/* Fuzzy match hint */}
                              {fuzzySuggestion && (
                                <div className="mt-1 flex items-center justify-between text-[10px] bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded">
                                  <span className="truncate">Did you mean: <b>{fuzzySuggestion.name}</b>?</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCustomerNameChange(rIdx, fuzzySuggestion.name);
                                    }}
                                    className="ml-1 text-emerald-400 font-bold hover:underline shrink-0"
                                  >
                                    Use
                                  </button>
                                </div>
                              )}

                              {row.is_new_customer && !fuzzySuggestion && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-amber-400 font-medium">⚡ New customer</span>
                                  <select
                                    onChange={(e) => {
                                      if (e.target.value) handleCustomerNameChange(rIdx, e.target.value);
                                    }}
                                    className="bg-transparent text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer border-none p-0 focus:outline-none"
                                  >
                                    <option value="">(link to existing...)</option>
                                    {customers.map(c => (
                                      <option key={c.id} value={c.name} className="bg-zinc-900 text-zinc-200">
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Product Columns */}
                          {activeColumns.map((code) => {
                            const cellData = row.cells?.[code] || {};
                            const qty = cellData.quantity;
                            const hasQty = qty !== null && qty !== undefined && qty !== "" && !isNaN(parseFloat(qty)) && parseFloat(qty) > 0;
                            const resolvedRate = cellData.resolved_rate;
                            const resolvedProduct = cellData.resolved_product_name || colToProductMap[code.toUpperCase()]?.name;
                            const mappingIssue = cellData.mapping_issue;
                            const conf = cellData.confidence !== undefined ? cellData.confidence : 1.0;
                            const isVeryLow = conf < 0.4 && hasQty;
                            const isLowConf = conf < 0.7 && conf >= 0.4 && hasQty;
                            const tag = cellData.tag;
                            const tagMeaning = tag ? tagMeaningMap[tag] : null;

                            return (
                              <td
                                key={code}
                                className={`py-1.5 px-1 text-center border-x border-zinc-900/60 ${isVeryLow ? "bg-rose-950/40" : isLowConf ? "bg-amber-950/30" : ""
                                  }`}
                              >
                                <div className="flex flex-col items-center gap-0.5">
                                  <input
                                    id={`input-cell-${rIdx}-${code}`}
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="-"
                                    value={qty !== null && qty !== undefined ? qty : ""}
                                    onFocus={(e) => {
                                      setSelectedRowIndex(rIdx);
                                      e.target.select();
                                    }}
                                    onKeyDown={(e) => {
                                      // Arrow / Enter keyboard navigation
                                      if (e.key === "Enter" || e.key === "ArrowDown") {
                                        e.preventDefault();
                                        document.getElementById(`input-cell-${rIdx + 1}-${code}`)?.focus();
                                      } else if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        document.getElementById(`input-cell-${rIdx - 1}-${code}`)?.focus();
                                      }
                                    }}
                                    onChange={(e) => {
                                      const v = e.target.value.trim();
                                      if (v === "" || /^[0-9]*\.?[0-9]*$/.test(v)) {
                                        handleCellChange(rIdx, code, "quantity", v === "" ? null : v);
                                      }
                                    }}
                                    className={`w-14 text-center py-1 px-1 rounded font-mono text-xs focus:outline-none transition-colors ${isVeryLow
                                      ? "bg-rose-950/50 text-rose-200 border border-rose-500/60 font-bold"
                                      : isLowConf
                                        ? "bg-amber-900/30 text-amber-200 border border-amber-500/50"
                                        : (cellData.is_live || cellData.circled_value)
                                          ? "bg-cyan-950/40 text-cyan-200 border-2 border-cyan-400 font-bold focus:border-cyan-300 ring-1 ring-cyan-500/30 shadow-sm"
                                          : hasQty
                                            ? "bg-zinc-900 text-zinc-100 border border-emerald-500/40 font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                            : "bg-zinc-900/40 text-zinc-500 border border-zinc-800/80 focus:border-zinc-600"
                                      }`}
                                    title={cellData.raw_text ? `OCR read: "${cellData.raw_text}" (conf: ${Math.round(conf * 100)}%)` : undefined}
                                  />

                                  {/* Rate & Product summary */}
                                  {hasQty && (
                                    <>
                                      {resolvedRate !== undefined && resolvedRate !== null ? (
                                        <div className="flex flex-col items-center leading-tight">
                                          <span
                                            className={`text-[10px] font-mono font-bold ${cellData.is_live || cellData.circled_value
                                              ? "text-cyan-400"
                                              : "text-emerald-400"
                                              }`}
                                            title={`${resolvedProduct || ""} @ ₹${resolvedRate} = ₹${(parseFloat(qty) * resolvedRate).toFixed(2)}${cellData.is_live ? " (Live Fish Rate)" : ""}`}
                                          >
                                            @{resolvedRate}{cellData.is_live || cellData.circled_value ? " ⊚" : ""}
                                          </span>
                                        </div>
                                      ) : mappingIssue ? (
                                        <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/50 px-1 rounded" title={mappingIssue}>
                                          ⚠️ ?rate
                                        </span>
                                      ) : null}
                                    </>
                                  )}

                                  <div className="flex items-center gap-1 text-[10px]">
                                    {/* 1-Click Live Fish Toggle */}
                                    {hasQty && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleLiveCell(rIdx, code);
                                        }}
                                        className={`px-1 py-0.2 rounded text-[10px] font-bold transition-all ${cellData.is_live || cellData.circled_value
                                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950 hover:bg-cyan-500/30"
                                          : "text-zinc-600 hover:text-cyan-400 hover:bg-zinc-800"
                                          }`}
                                        title={cellData.is_live || cellData.circled_value ? "Live Fish (circled). Click to switch to normal rate" : "Click to mark as Live Fish (circled rate)"}
                                      >
                                        ⊚ {cellData.is_live || cellData.circled_value ? "LIVE" : "live?"}
                                      </button>
                                    )}

                                    {tag && (
                                      <span title={tagMeaning || "Tag"} className="text-amber-400 bg-amber-500/20 px-1 rounded cursor-help font-bold">
                                        {tag}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          })}

                          {/* Customer Row Total Amount */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-xs text-emerald-400">
                            {rowTotalAmount > 0 ? formatCurrency(rowTotalAmount) : <span className="text-zinc-600 font-normal">-</span>}
                          </td>

                          {/* Skip Checkbox */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={!!row.skip}
                              onChange={() => toggleSkipRow(rIdx)}
                              className="rounded border-zinc-700 bg-zinc-800 text-rose-500 cursor-pointer"
                              title="Skip this row from bill creation"
                            />
                          </td>

                          {/* Delete Row Button */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRow(rIdx);
                              }}
                              className="p-1 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Summary Totals Footer */}
                  <tfoot className="bg-zinc-900/95 border-t-2 border-zinc-700 font-semibold sticky bottom-0 z-20 shadow-md">
                    <tr>
                      <td className="sticky left-0 bg-zinc-900 z-30 py-2.5 px-3 font-mono text-center text-emerald-400 font-bold border-r border-zinc-800">
                        ∑
                      </td>
                      <td className="sticky left-10 bg-zinc-900 z-30 py-2.5 px-3 text-zinc-200 border-r border-zinc-800 font-bold text-xs shadow-[4px_0_12px_rgba(0,0,0,0.5)]">
                        TOTALS ({activeDraft.rows?.filter(r => !r.skip).length} customers)
                      </td>
                      {activeColumns.map((code) => {
                        let colQtyTotal = 0;
                        activeDraft.rows?.forEach((r) => {
                          if (!r.skip && r.cells?.[code]?.quantity) {
                            const q = parseFloat(r.cells[code].quantity);
                            if (!isNaN(q)) colQtyTotal += q;
                          }
                        });
                        return (
                          <td key={code} className="py-2.5 px-1 text-center font-mono text-xs text-zinc-100 font-bold border-x border-zinc-800">
                            {colQtyTotal > 0 ? colQtyTotal.toFixed(1) : "-"}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-emerald-400">
                        {formatCurrency(draftStats?.grandTotal || 0)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ── Mobile Customer Cards ── */}
              <div className="block md:hidden space-y-3.5">

                {/* ── Mobile Image Viewer with Zoom ── */}
                {previewUrl && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                    {/* Image Header with Toggle + Zoom Controls */}
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/60 bg-zinc-900/80">
                      <button
                        type="button"
                        onClick={() => setIsMobileImageOpen(!isMobileImageOpen)}
                        className="flex items-center gap-2 text-xs font-semibold text-zinc-200"
                      >
                        <Eye className="w-4 h-4 text-emerald-400" />
                        Ledger Photo
                        {isMobileImageOpen ? <ChevronUp className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />}
                      </button>
                      {isMobileImageOpen && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setMobileZoom(z => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 active:bg-zinc-700 transition-colors"
                          >
                            <ZoomOut className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMobileZoom(1);
                              setMobilePan({ x: 0, y: 0 });
                            }}
                            className="text-xs text-emerald-400 font-mono font-bold px-2 py-1 rounded-lg bg-zinc-800 min-w-[44px] text-center"
                            title="Reset zoom & center"
                          >
                            {Math.round(mobileZoom * 100)}%
                          </button>
                          <button
                            type="button"
                            onClick={() => setMobileZoom(z => Math.min(4, Number((z + 0.25).toFixed(2))))}
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 active:bg-zinc-700 transition-colors"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                          <div className="w-px h-5 bg-zinc-700 mx-0.5" />
                          <button
                            type="button"
                            onClick={() => setRotation(r => (r + 90) % 360)}
                            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 active:bg-zinc-700 transition-colors"
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsLightboxOpen(true)}
                            className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 active:bg-emerald-500/25 transition-colors"
                          >
                            <Expand className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Zoomable & Draggable Image Area */}
                    {isMobileImageOpen && (
                      <div
                        ref={mobileImageRef}
                        className={`relative w-full h-[290px] overflow-hidden bg-zinc-950 select-none ${isMobileDragging ? "cursor-grabbing" : "cursor-grab"
                          }`}
                        style={{ touchAction: "none" }}
                        onPointerDown={(e) => {
                          if (e.button !== undefined && e.button !== 0) return;
                          setIsMobileDragging(true);
                          mobileDragStartRef.current = {
                            x: e.clientX,
                            y: e.clientY,
                            panX: mobilePan.x,
                            panY: mobilePan.y,
                          };
                          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { }
                        }}
                        onPointerMove={(e) => {
                          if (!isMobileDragging) return;
                          const dx = e.clientX - mobileDragStartRef.current.x;
                          const dy = e.clientY - mobileDragStartRef.current.y;
                          setMobilePan({
                            x: mobileDragStartRef.current.panX + dx,
                            y: mobileDragStartRef.current.panY + dy,
                          });
                        }}
                        onPointerUp={(e) => {
                          setIsMobileDragging(false);
                          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { }
                        }}
                        onPointerCancel={() => setIsMobileDragging(false)}
                        onTouchStart={(e) => {
                          if (e.touches.length === 2) {
                            const dx = e.touches[0].clientX - e.touches[1].clientX;
                            const dy = e.touches[0].clientY - e.touches[1].clientY;
                            pinchRef.current.startDist = Math.sqrt(dx * dx + dy * dy);
                            pinchRef.current.startZoom = mobileZoom;
                          }
                        }}
                        onTouchMove={(e) => {
                          if (e.touches.length === 2) {
                            e.preventDefault();
                            const dx = e.touches[0].clientX - e.touches[1].clientX;
                            const dy = e.touches[0].clientY - e.touches[1].clientY;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const scale = dist / pinchRef.current.startDist;
                            const newZoom = Math.min(4, Math.max(0.5, Number((pinchRef.current.startZoom * scale).toFixed(2))));
                            setMobileZoom(newZoom);
                          }
                        }}
                        onDoubleClick={() => {
                          setMobileZoom(1);
                          setMobilePan({ x: 0, y: 0 });
                        }}
                      >
                        <div className="w-full h-full flex items-center justify-center p-2 pointer-events-none">
                          <img
                            src={previewUrl}
                            alt="Ledger"
                            style={{
                              transform: `translate(${mobilePan.x}px, ${mobilePan.y}px) rotate(${rotation}deg) scale(${mobileZoom})`,
                              transformOrigin: "center center",
                            }}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-lg transition-transform duration-75 select-none"
                            draggable={false}
                          />
                        </div>

                        {/* Floating Drag & Reset Guide */}
                        <div className="absolute bottom-2 left-2 pointer-events-none bg-zinc-900/85 backdrop-blur-sm border border-zinc-700/80 px-2 py-0.5 rounded-full text-[10px] text-zinc-300 flex items-center gap-1 shadow-md">
                          <Move className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Drag to pan · 2-finger zoom</span>
                        </div>

                        {(mobilePan.x !== 0 || mobilePan.y !== 0 || mobileZoom !== 1) && (
                          <button
                            type="button"
                            onClick={() => {
                              setMobileZoom(1);
                              setMobilePan({ x: 0, y: 0 });
                            }}
                            className="absolute bottom-2 right-2 bg-zinc-900/90 text-[10px] text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full shadow-md active:scale-95 transition-all"
                          >
                            Center
                          </button>
                        )}

                        {/* Row tracking band on mobile that shifts with pan */}
                        {selectedRowIndex !== null && activeDraft?.rows?.length > 0 && (
                          <div
                            className="absolute left-1 right-1 pointer-events-none transition-all duration-150 border-y-2 border-emerald-400 bg-emerald-500/20 z-10"
                            style={{
                              top: `calc(${Math.min(94, Math.max(2, (selectedRowIndex / activeDraft.rows.length) * 100))}% + ${mobilePan.y}px)`,
                              height: `${Math.max(5, 100 / activeDraft.rows.length)}%`,
                            }}
                          >
                            <div className="absolute right-1 top-0 text-[9px] font-mono font-bold text-emerald-300 bg-zinc-950/90 px-1.5 py-0.5 rounded border border-emerald-500/40">
                              Row #{selectedRowIndex + 1}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Grand total summary strip */}
                <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3">
                  <div className="text-sm font-semibold text-zinc-300">
                    {activeDraft.rows?.filter(r => !r.skip).length} Customers
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-zinc-500 mr-1.5">Total</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      {formatCurrency(draftStats?.grandTotal || 0)}
                    </span>
                  </div>
                </div>

                {/* Customer cards */}
                {activeDraft.rows?.map((row, rIdx) => {
                  const customerName = row.customer_name || row.customer_name_raw || "";
                  const fuzzySuggestion = getFuzzySuggestion(customerName);

                  // Calculate row total
                  let rowTotalAmount = 0;
                  const activeItems = [];
                  columnCodes.forEach((code) => {
                    const cell = row.cells?.[code];
                    if (!cell) return;
                    const q = parseFloat(cell.quantity);
                    if (!q || isNaN(q) || q <= 0) return;
                    const r = parseFloat(cell.resolved_rate ?? cell.rate) || 0;
                    const amt = parseFloat(cell.resolved_amount) || (r ? q * r : 0);
                    rowTotalAmount += amt;
                    activeItems.push({ code, qty: q, rate: r, amount: amt, cell });
                  });

                  return (
                    <div
                      key={rIdx}
                      className={`rounded-xl border overflow-hidden transition-all ${row.skip
                        ? "opacity-40 border-zinc-800 bg-zinc-950"
                        : selectedRowIndex === rIdx
                          ? "border-emerald-500/50 bg-zinc-900 ring-1 ring-emerald-500/20"
                          : "border-zinc-800 bg-zinc-900/80"
                        }`}
                    >
                      {/* Card Header: Row #, Customer Name, Total */}
                      <div className="p-4 pb-3 border-b border-zinc-800/60">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className={`text-xs font-mono font-bold shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${selectedRowIndex === rIdx
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-400"
                              }`}>
                              {rIdx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <input
                                id={`input-customer-${rIdx}`}
                                type="text"
                                value={customerName}
                                onFocus={() => setSelectedRowIndex(rIdx)}
                                onChange={(e) => handleCustomerNameChange(rIdx, e.target.value)}
                                placeholder="Customer Name"
                                className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-sm text-zinc-100 font-semibold w-full focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                              />
                              {fuzzySuggestion && (
                                <div className="mt-1.5 flex items-center justify-between text-xs bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 px-2.5 py-1.5 rounded-lg">
                                  <span>Did you mean: <b>{fuzzySuggestion.name}</b>?</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCustomerNameChange(rIdx, fuzzySuggestion.name)}
                                    className="text-emerald-400 font-bold ml-2"
                                  >
                                    Use
                                  </button>
                                </div>
                              )}
                              {row.is_new_customer && !fuzzySuggestion && (
                                <span className="text-xs text-amber-400 mt-1 block">⚡ New customer</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold text-emerald-400 font-mono">
                              {rowTotalAmount > 0 ? formatCurrency(rowTotalAmount) : "₹0"}
                            </p>
                            <p className="text-[11px] text-zinc-500">{activeItems.length} item(s)</p>
                          </div>
                        </div>
                      </div>

                      {/* Card Body: Product entries as clean rows */}
                      <div className="px-4 py-3 space-y-2.5">
                        {activeColumns.map((code) => {
                          const cellData = row.cells?.[code] || {};
                          const qty = cellData.quantity;
                          const hasQty = qty !== null && qty !== undefined && qty !== "" && !isNaN(parseFloat(qty)) && parseFloat(qty) > 0;
                          const resolvedRate = cellData.resolved_rate;
                          const mapped = colToProductMap[code.toUpperCase()];
                          const productName = cellData.resolved_product_name || mapped?.name || code;
                          const conf = cellData.confidence !== undefined ? cellData.confidence : 1.0;
                          const isLowConf = conf < 0.7 && hasQty;

                          return (
                            <div
                              key={code}
                              className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors ${isLowConf
                                ? "border-amber-500/30 bg-amber-950/20"
                                : hasQty
                                  ? "border-zinc-700/60 bg-zinc-950/60"
                                  : "border-zinc-800/40 bg-zinc-950/30"
                                }`}
                            >
                              {/* Product label */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-sm text-zinc-100">{code}</span>
                                  <span className="text-xs text-zinc-400 truncate">{productName !== code ? productName : ""}</span>
                                  {(cellData.is_live || cellData.circled_value) && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">LIVE</span>
                                  )}
                                </div>
                                {hasQty && resolvedRate ? (
                                  <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                                    @₹{resolvedRate} = <span className="text-emerald-400 font-semibold">₹{(parseFloat(qty) * resolvedRate).toFixed(2)}</span>
                                  </p>
                                ) : null}
                              </div>

                              {/* Quantity input */}
                              <div className="flex items-center gap-2">
                                <input
                                  id={`input-cell-${rIdx}-${code}`}
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={qty !== null && qty !== undefined ? qty : ""}
                                  onFocus={() => setSelectedRowIndex(rIdx)}
                                  onChange={(e) => {
                                    const v = e.target.value.trim();
                                    if (v === "" || /^[0-9]*\.?[0-9]*$/.test(v)) {
                                      handleCellChange(rIdx, code, "quantity", v === "" ? null : v);
                                    }
                                  }}
                                  className={`w-16 text-center py-2 px-2 rounded-lg font-mono text-sm font-bold focus:outline-none transition-colors ${(cellData.is_live || cellData.circled_value)
                                    ? "bg-cyan-950/40 text-cyan-200 border-2 border-cyan-400"
                                    : hasQty
                                      ? "bg-zinc-900 text-zinc-100 border border-emerald-500/40"
                                      : "bg-zinc-900/40 text-zinc-500 border border-zinc-800"
                                    }`}
                                />

                                {/* Live toggle */}
                                {hasQty && (
                                  <button
                                    type="button"
                                    onClick={() => toggleLiveCell(rIdx, code)}
                                    className={`p-2 rounded-lg text-xs transition-all ${cellData.is_live || cellData.circled_value
                                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                      : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                                      }`}
                                  >
                                    ⊚
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Card Footer: Actions */}
                      <div className="px-4 py-3 border-t border-zinc-800/60 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            checked={!!row.skip}
                            onChange={() => toggleSkipRow(rIdx)}
                            className="rounded border-zinc-700 bg-zinc-800 text-rose-500"
                          />
                          Skip row
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(rIdx)}
                          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-rose-400 py-1.5 px-2.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* STICKY BOTTOM ACTION BAR                                    */}
          {/* ========================================================= */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-md px-3 sm:px-8 py-2.5 sm:py-3 shadow-2xl">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
              {/* Left: Secondary Actions */}
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => saveDraftMutation.mutate()}
                  disabled={saveDraftMutation.isPending}
                  className="btn-secondary text-xs py-2 px-2.5 sm:px-3 flex items-center gap-1.5"
                >
                  {saveDraftMutation.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Save</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadExcel()}
                  className="btn-secondary text-xs py-2 px-2.5 sm:px-3 items-center gap-1.5 hidden sm:flex"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  Excel
                </button>

                <button
                  type="button"
                  onClick={() => setShowBillPreview(!showBillPreview)}
                  className={`text-xs py-2 px-2.5 sm:px-3 rounded-lg border items-center gap-1.5 transition-all hidden sm:flex ${showBillPreview
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Preview
                </button>
              </div>

              {/* Right: Primary CTA */}
              <div className="flex items-center">
                {activeUploadStatus === "saved" && !isDraftDirty ? (
                  <button
                    type="button"
                    disabled={true}
                    className="text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-4 sm:px-6 rounded-lg bg-zinc-800/90 text-zinc-400 border border-zinc-700/80 cursor-not-allowed font-medium"
                  >
                    <CheckCheck className="w-4 h-4 text-emerald-500" />
                    <span className="hidden sm:inline">Bills Created</span>
                    <span className="sm:hidden">Done ✓</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmModalOpen(true)}
                    disabled={confirmMutation.isPending || !draftStats || draftStats.customerCount === 0}
                    className="btn-primary text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-4 sm:px-6 shadow-xl shadow-emerald-950/60 disabled:opacity-50 font-bold"
                  >
                    <Receipt className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {activeUploadStatus === "saved"
                        ? `Update ${draftStats?.customerCount || 0} Bills · ${formatCurrency(draftStats?.grandTotal || 0)}`
                        : `Create ${draftStats?.customerCount || 0} Bills · ${formatCurrency(draftStats?.grandTotal || 0)}`}
                    </span>
                    <span className="sm:hidden">
                      {activeUploadStatus === "saved" ? "Update" : "Create"} {draftStats?.customerCount || 0} Bills
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Bill Preview Drawer */}
          {showBillPreview && (
            <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
              <LedgerBillPreview draft={activeDraft} />
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/* PAST SCANNED UPLOADS TABLE                                     */}
      {/* ============================================================= */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-emerald-400" />
              Past Scanned Uploads
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              History of digitized ledger notebooks and generated bills
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search ID, date, status..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="input-field pl-8 text-xs py-1.5 w-44 sm:w-56"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setHistoryFilter("all")}
                className={`px-2.5 py-1 rounded-md transition-colors ${historyFilter === "all" ? "bg-zinc-800 text-zinc-100 font-semibold" : "text-zinc-400 hover:text-zinc-200"
                  }`}
              >
                All ({uploads.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter("needs_review")}
                className={`px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors ${historyFilter === "needs_review" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-zinc-400 hover:text-amber-300"
                  }`}
              >
                Needs Review ({needsReviewCount})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter("saved")}
                className={`px-2.5 py-1 rounded-md transition-colors ${historyFilter === "saved" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-zinc-400 hover:text-emerald-300"
                  }`}
              >
                Saved ({savedCount})
              </button>
            </div>

            <button
              onClick={() => refetchUploads()}
              className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Refresh Uploads"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {filteredUploads.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">
            No scanned uploads found matching your filter.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left min-w-[640px]">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/40 text-xs text-zinc-400 font-semibold uppercase">
                    <th className="py-3 px-5">Upload / Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Ledger Content</th>
                    <th className="py-3 px-4">Created Timestamp</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-sm">
                  {filteredUploads.map((u) => {
                    const draftObj = typeof u.draft_data === "string" ? (() => {
                      try { return JSON.parse(u.draft_data); } catch { return null; }
                    })() : u.draft_data;
                    const customerCount = draftObj?.rows?.filter(r => !r.skip && (r.customer_name || r.customer_name_raw)).length || 0;

                    return (
                      <tr
                        key={u.id}
                        onClick={() => openReviewWorkspace(u)}
                        className="hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            {/* Mini Thumbnail */}
                            {u.image_path ? (
                              <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                                <img
                                  src={u.image_path.startsWith("http") ? u.image_path : `${API_BASE_URL}${u.image_path}`}
                                  alt={`Upload ${u.id}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = "none"; }}
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-zinc-500 shrink-0 font-mono text-xs">
                                #{u.id}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-zinc-200 block text-xs">Upload #{u.id}</span>
                              <span className="text-[11px] text-zinc-400 font-mono">
                                {u.page_date ? formatDate(u.page_date) : "Undated page"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${u.status === "saved"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : u.status === "needs_review"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : u.status === "processing"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}>
                            {u.status === "saved" && <CheckCircle2 className="w-3 h-3" />}
                            {u.status === "needs_review" && <AlertTriangle className="w-3 h-3" />}
                            {u.status.replace("_", " ")}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-xs">
                          <span className="text-zinc-300 font-medium">{customerCount} customer(s)</span>
                          <span className="text-zinc-500 text-[11px] block capitalize">{u.upload_type}</span>
                        </td>

                        <td className="py-3 px-4 text-xs font-mono text-zinc-400">
                          {u.created_at ? formatDateTime(u.created_at) : "—"}
                        </td>

                        <td className="py-3 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openReviewWorkspace(u)}
                              className={`text-xs py-1 px-2.5 rounded-lg flex items-center gap-1 transition-colors ${u.status === "needs_review"
                                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                                : "btn-secondary"
                                }`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {u.status === "saved" ? "View Grid" : "Review"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadExcel(u.id)}
                              className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded-lg transition-colors"
                              title="Download Excel (.xlsx)"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete Upload #${u.id}? Any associated unpaid bills will also be deleted.`)) {
                                  deleteUploadMutation.mutate(u.id);
                                }
                              }}
                              disabled={deleteUploadMutation.isPending}
                              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-40"
                              title="Delete Upload"
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

            {/* Mobile Card List (< md) */}
            <div className="block md:hidden space-y-3 p-3">
              {filteredUploads.map((u) => {
                const draftObj = typeof u.draft_data === "string" ? (() => {
                  try { return JSON.parse(u.draft_data); } catch { return null; }
                })() : u.draft_data;
                const customerCount = draftObj?.rows?.filter(r => !r.skip && (r.customer_name || r.customer_name_raw)).length || 0;

                return (
                  <div
                    key={u.id}
                    onClick={() => openReviewWorkspace(u)}
                    className="p-4 flex flex-col gap-3 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/60 active:bg-zinc-800/40 transition-colors"
                  >
                    {/* Top: Thumbnail + Info + Status */}
                    <div className="flex items-center gap-3">
                      {u.image_path ? (
                        <div className="w-11 h-11 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                          <img
                            src={u.image_path.startsWith("http") ? u.image_path : `${API_BASE_URL}${u.image_path}`}
                            alt={`Upload ${u.id}`}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-mono font-bold">
                          #{u.id}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-zinc-200 text-sm">Upload #{u.id}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${u.status === "saved"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : u.status === "needs_review"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : u.status === "processing"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}>
                            {u.status === "saved" && <CheckCircle2 className="w-3 h-3" />}
                            {u.status === "needs_review" && <AlertTriangle className="w-3 h-3" />}
                            {u.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                          <span className="font-mono">{u.page_date ? formatDate(u.page_date) : "Undated"}</span>
                          <span>·</span>
                          <span>{customerCount} customer(s)</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/50" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openReviewWorkspace(u)}
                        className={`text-sm py-2 px-4 rounded-lg flex items-center gap-2 transition-colors font-medium ${u.status === "needs_review"
                          ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          : "btn-secondary"
                          }`}
                      >
                        <Eye className="w-4 h-4" />
                        <span>{u.status === "saved" ? "View" : "Review"}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadExcel(u.id)}
                          className="p-2.5 text-zinc-300 hover:text-emerald-400 bg-zinc-800 rounded-lg active:scale-95 transition-all border border-zinc-700/50"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete Upload #${u.id}?`)) {
                              deleteUploadMutation.mutate(u.id);
                            }
                          }}
                          className="p-2.5 text-zinc-400 hover:text-rose-400 bg-zinc-800 rounded-lg active:scale-95 transition-all border border-zinc-700/50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
