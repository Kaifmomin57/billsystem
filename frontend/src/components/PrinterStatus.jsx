import React from "react";
import { Bluetooth, Plug, ArrowsClockwise, CheckCircle } from "@phosphor-icons/react";
import { PRINTER_MODES } from "../printer/printerService";

export default function PrinterStatus({ status, onRefresh }) {
  const isConnected = !!status?.connected;
  const isConnecting = !!status?.isConnecting;
  const isBluetooth = status?.mode === PRINTER_MODES.BLUETOOTH;
  const deviceName = status?.deviceName || "VYPRTP3001";

  return (
    <div className="card p-5 border-zinc-800 bg-zinc-900/90 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status indicator & device info */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
              isConnected
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : isConnecting
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {isBluetooth ? (
              <Bluetooth className="w-6 h-6" />
            ) : (
              <Plug className="w-6 h-6" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isConnected
                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                    : isConnecting
                    ? "bg-amber-500 animate-ping"
                    : "bg-rose-500"
                }`}
              />
              <h3 className="font-semibold text-zinc-100 text-base tracking-tight">
                {isConnected
                  ? `${deviceName} Connected`
                  : isConnecting
                  ? "Connecting to Printer..."
                  : "Printer Disconnected"}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-zinc-400">
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-medium border border-zinc-700/60">
                80mm Thermal Paper
              </span>

              <span className="px-2 py-0.5 rounded-md font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                100% In-Browser (No App Needed)
              </span>

              <span
                className={`px-2 py-0.5 rounded-md font-medium border ${
                  isBluetooth
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                    : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                }`}
              >
                {isBluetooth ? "Web Bluetooth API" : "Web Serial / USB API"}
              </span>
            </div>
          </div>
        </div>

        {/* Refresh / Check Status Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            type="button"
            className="btn btn-secondary btn-sm self-start sm:self-center"
            title="Refresh status"
          >
            <ArrowsClockwise className="w-3.5 h-3.5" />
            <span>Check Status</span>
          </button>
        )}
      </div>
    </div>
  );
}
