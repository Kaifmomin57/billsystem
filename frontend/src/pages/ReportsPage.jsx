import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DownloadSimple, CalendarBlank } from "@phosphor-icons/react";
import toast from "react-hot-toast";
import api from "../lib/api";
import { downloadBlob, formatDate } from "../lib/utils";

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo]     = useState(today);
  const [downloading, setDownloading] = useState(null);

  const download = async (type) => {
    setDownloading(type);
    try {
      const res = await api.get(`/reports/daily/${type}`, {
        params: { date_from: dateFrom, date_to: dateTo },
        responseType: "blob",
      });
      const name = `daily_by_${type}_${dateFrom}${dateFrom !== dateTo ? `_to_${dateTo}` : ""}.xlsx`;
      downloadBlob(res.data, name);
      toast.success(`${name} downloaded`);
    } catch {
      toast.error("Report generation failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Reports</h1>
          <p className="page-subtitle">Download Excel reports by product or by customer</p>
        </div>
      </div>

      {/* Date range picker */}
      <div className="card p-4 sm:p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-zinc-300">Select Date Range</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="input-group">
            <label className="label">From</label>
            <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="label">To</label>
            <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="divider" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => download("by-product")}
            disabled={!!downloading}
            className="btn-md btn-primary w-full"
          >
            {downloading === "by-product"
              ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <DownloadSimple size={16} />}
            By Product
          </button>
          <button
            onClick={() => download("by-customer")}
            disabled={!!downloading}
            className="btn-md btn-secondary w-full"
          >
            {downloading === "by-customer"
              ? <div className="w-4 h-4 rounded-full border-2 border-zinc-400/30 border-t-zinc-200 animate-spin" />
              : <DownloadSimple size={16} />}
            By Customer
          </button>
        </div>

        <p className="text-xs text-zinc-600">
          Report includes both manually entered bills and AI-uploaded bills for the selected period.
        </p>
      </div>
    </div>
  );
}
