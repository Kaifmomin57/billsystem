import React, { useState } from "react";
import { formatBillAsText } from "../printer/escpos";
import { Copy, Check, Printer, Edit3, Eye, ZoomIn, ZoomOut } from "lucide-react";
import toast from "react-hot-toast";

const FONT_SIZES = [
  { label: "16px (Normal)", class: "text-[16px] leading-[1.4]" },
  { label: "18px (Bada)", class: "text-[18px] leading-[1.45]" },
  { label: "20px (Extra Bada)", class: "text-[20px] leading-[1.5]" },
  { label: "22px (Huge)", class: "text-[22px] leading-[1.55]" },
];

export default function BillPreview({ billData, onPrint, isPrinting }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("thermal"); // 'thermal' | 'json'
  const [fontSizeIndex, setFontSizeIndex] = useState(1); // Default: 18px (Bada & Clear!)

  const formattedText = formatBillAsText(billData, 48);

  const handleCopyText = () => {
    navigator.clipboard.writeText(formattedText);
    setCopied(true);
    toast.success("Monospace receipt text copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const currentFontSize = FONT_SIZES[fontSizeIndex];

  return (
    <div className="card p-5 border-zinc-800 bg-zinc-900/90 shadow-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div>
          <h3 className="font-semibold text-zinc-100 text-base">80mm Thermal Receipt Preview</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Exact 48-character column representation for Vyapar VYPRTP3001
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Font Size Zoom Controls */}
          {activeTab === "thermal" && (
            <div className="flex items-center rounded-lg bg-zinc-950 p-1 border border-zinc-800 gap-1">
              <button
                type="button"
                onClick={() => setFontSizeIndex((i) => Math.max(0, i - 1))}
                disabled={fontSizeIndex === 0}
                className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                title="Decrease Text Size"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-zinc-300 px-1 font-medium">
                {currentFontSize.label}
              </span>
              <button
                type="button"
                onClick={() => setFontSizeIndex((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
                disabled={fontSizeIndex === FONT_SIZES.length - 1}
                className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                title="Increase Text Size"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Tab Selector */}
          <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab("thermal")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "thermal"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Receipt View</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("json")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "json"
                  ? "bg-zinc-800 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Print Job JSON</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyText}
            className="btn btn-secondary btn-sm p-2 text-zinc-400 hover:text-zinc-200"
            title="Copy monospace text"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              disabled={isPrinting}
              className="btn btn-primary btn-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print This</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-5 flex justify-center overflow-x-auto p-2">
        {activeTab === "thermal" ? (
          /* Thermal Paper Simulator Container - Scaled up for crystal clear readability */
          <div className="w-full max-w-[620px] bg-white text-zinc-950 rounded-t-sm shadow-2xl relative font-mono tracking-tight selection:bg-zinc-300 border border-zinc-300">
            {/* Top serrated tear paper edge */}
            <div
              className="h-2.5 w-full bg-zinc-200 opacity-70"
              style={{
                clipPath: "polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)"
              }}
            />

            {/* Receipt body with enlarged font */}
            <div className="p-5 sm:p-7 overflow-x-auto">
              <pre className={`font-mono whitespace-pre text-zinc-950 font-bold select-all ${currentFontSize.class}`}>
                {formattedText}
              </pre>
            </div>

            {/* Bottom serrated tear paper edge */}
            <div
              className="h-3.5 w-full bg-zinc-200 opacity-80"
              style={{
                clipPath: "polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)"
              }}
            />
          </div>
        ) : (
          /* JSON Print Job View */
          <div className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-300 overflow-x-auto">
            <pre>{JSON.stringify(billData, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
