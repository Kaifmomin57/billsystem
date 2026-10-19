import React, { useState } from "react";
import {
  Plug, Unplug, Printer, FileText, Settings2,
  RefreshCw, Bluetooth, Cable
} from "lucide-react";
import { PRINTER_MODES } from "../printer/printerService";
import { getCustomBleConfig, saveCustomBleConfig } from "../printer/bluetooth";

export default function PrinterControls({
  status,
  onConnect,
  onDisconnect,
  onTestPrint,
  onPrintBill,
  onRefresh,
  onModeChange,
  isPrinting,
}) {
  const isConnected = !!status?.connected;
  const isConnecting = !!status?.isConnecting;
  const currentMode = status?.mode || PRINTER_MODES.BLUETOOTH;

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [bleConfig, setBleConfig] = useState(getCustomBleConfig());

  const handleSaveConfig = (e) => {
    e.preventDefault();
    saveCustomBleConfig(bleConfig);
    setIsConfigOpen(false);
  };

  return (
    <div className="card p-5 border-zinc-800 bg-zinc-900/90 shadow-md">
      <div className="flex flex-col gap-5">
        {/* Connection Mode Selector Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800/80 gap-3">
          <div>
            <h4 className="text-sm font-semibold text-zinc-200">100% Direct Browser Connection</h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select how your browser connects directly to the VYPRTP3001 hardware
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onModeChange(PRINTER_MODES.BLUETOOTH)}
              className={`btn btn-sm ${
                currentMode === PRINTER_MODES.BLUETOOTH
                  ? "bg-cyan-600 text-white font-medium shadow-sm"
                  : "btn-secondary text-zinc-400"
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5" />
              <span>Web Bluetooth (Wireless)</span>
            </button>

            <button
              type="button"
              onClick={() => onModeChange(PRINTER_MODES.SERIAL)}
              className={`btn btn-sm ${
                currentMode === PRINTER_MODES.SERIAL
                  ? "bg-indigo-600 text-white font-medium shadow-sm"
                  : "btn-secondary text-zinc-400"
              }`}
            >
              <Cable className="w-3.5 h-3.5" />
              <span>Web Serial (USB/OTG)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="btn btn-secondary btn-sm p-2 text-zinc-400 hover:text-zinc-200"
              title="Printer & BLE UUID Settings"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Connect Printer */}
          {!isConnected ? (
            <button
              type="button"
              onClick={onConnect}
              disabled={isConnecting || isPrinting}
              className="btn btn-primary min-h-11 shadow-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500"
            >
              {isConnecting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plug className="w-4 h-4" />
              )}
              <span>{isConnecting ? "Connecting..." : "Connect Printer"}</span>
            </button>
          ) : (
            /* 2. Disconnect Printer */
            <button
              type="button"
              onClick={onDisconnect}
              disabled={isPrinting}
              className="btn min-h-11 bg-rose-600/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 flex items-center justify-center gap-2"
            >
              <Unplug className="w-4 h-4" />
              <span>Disconnect Printer</span>
            </button>
          )}

          {/* 3. Test Print */}
          <button
            type="button"
            onClick={onTestPrint}
            disabled={!isConnected || isPrinting}
            className="btn btn-secondary min-h-11 flex items-center justify-center gap-2 border-zinc-700"
            title={!isConnected ? "Connect printer first to run test print" : "Run 80mm hardware test print"}
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>{isPrinting ? "Printing..." : "Test Print"}</span>
          </button>

          {/* 4. Print Custom Bill */}
          <button
            type="button"
            onClick={onPrintBill}
            disabled={!isConnected || isPrinting}
            className="btn min-h-11 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
            title={!isConnected ? "Connect printer first to print bill" : "Send custom bill ESC/POS to VYPRTP3001"}
          >
            <FileText className="w-4 h-4" />
            <span>Print Custom Bill</span>
          </button>

          {/* 5. Refresh / Scan Printer */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isConnecting || isPrinting}
            className="btn btn-secondary min-h-11 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4 text-zinc-400" />
            <span>Scan / Refresh</span>
          </button>
        </div>

        {/* Configuration Modal / Accordion */}
        {isConfigOpen && (
          <form
            onSubmit={handleSaveConfig}
            className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col gap-4 text-xs mt-2"
          >
            <div className="flex items-center justify-between">
              <h5 className="font-semibold text-zinc-200 text-sm">Web Bluetooth &amp; UUID Configuration</h5>
              <span className="text-[11px] text-zinc-400">Settings are persisted in browser</span>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-zinc-400">
                The web application automatically probes standard POS thermal printer GATT profiles. If your VYPRTP3001 uses custom UUIDs, enter them here:
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-zinc-300">Service UUID:</label>
                <input
                  type="text"
                  value={bleConfig.customServiceUuid}
                  onChange={(e) => setBleConfig({ ...bleConfig, customServiceUuid: e.target.value })}
                  placeholder="e.g. 0000ff00-0000-1000-8000-00805f9b34fb"
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-zinc-300">Write Characteristic UUID:</label>
                <input
                  type="text"
                  value={bleConfig.customCharUuid}
                  onChange={(e) => setBleConfig({ ...bleConfig, customCharUuid: e.target.value })}
                  placeholder="e.g. 0000ff02-0000-1000-8000-00805f9b34fb"
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-medium text-zinc-300">Packet Chunk Size (bytes):</label>
                  <input
                    type="number"
                    min="10"
                    max="128"
                    value={bleConfig.chunkSize}
                    onChange={(e) => setBleConfig({ ...bleConfig, chunkSize: parseInt(e.target.value) || 50 })}
                    className="w-full mt-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-zinc-300">Inter-chunk Delay (ms):</label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={bleConfig.chunkDelayMs}
                    onChange={(e) => setBleConfig({ ...bleConfig, chunkDelayMs: parseInt(e.target.value) || 25 })}
                    className="w-full mt-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Save Settings
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
