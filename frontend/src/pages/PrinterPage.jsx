import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  Printer, Bluetooth, Cable, HelpCircle, CheckCircle2,
  RefreshCw, Sparkles, ShieldCheck
} from "lucide-react";
import PrinterStatus from "../components/PrinterStatus";
import PrinterControls from "../components/PrinterControls";
import BillPreview from "../components/BillPreview";
import { printerService, PRINTER_MODES } from "../printer/printerService";
import { testBill } from "../data/testBill";

export default function PrinterPage() {
  const [status, setStatus] = useState(printerService.getStatus());
  const [activeBill, setActiveBill] = useState(testBill);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    // Subscribe to printer status changes
    const unsubscribe = printerService.subscribe((newStatus) => {
      setStatus({ ...newStatus });
    });

    return () => unsubscribe();
  }, []);

  const handleConnect = async (preferredName = "VYPRTP3001") => {
    try {
      toast.loading(`Opening browser device chooser...`, { id: "connect-toast" });
      await printerService.connect(preferredName);
      toast.success(`Connected to printer!`, { id: "connect-toast" });
    } catch (err) {
      console.error("Connection failed:", err);
      let errorMsg = err.message || "Failed to connect to printer.";

      if (err.name === "NotFoundError" || err.message?.includes("User cancelled")) {
        errorMsg = "Bluetooth pairing dialog was cancelled or no printer was selected.";
      } else if (err.name === "SecurityError") {
        errorMsg = "Bluetooth permission was denied by the browser.";
      } else if (err.message?.includes("Web Bluetooth is not supported")) {
        errorMsg = "Web Bluetooth is supported in Google Chrome on Android & Desktop. Please use Chrome.";
      }

      toast.error(errorMsg, { id: "connect-toast", duration: 5000 });
    }
  };

  const handleDisconnect = async () => {
    try {
      await printerService.disconnect();
      toast.success("Printer disconnected.");
    } catch (err) {
      toast.error("Error disconnecting: " + err.message);
    }
  };

  const handleTestPrint = async () => {
    setIsPrinting(true);
    try {
      toast.loading("Sending Test Print (80mm ESC/POS)...", { id: "print-toast" });
      await printerService.printTest(48);
      toast.success("Test receipt printed successfully!", { id: "print-toast" });
    } catch (err) {
      console.error("Test print failed:", err);
      toast.error("Test Print failed: " + err.message, { id: "print-toast", duration: 5000 });
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintCustomBill = async () => {
    setIsPrinting(true);
    try {
      toast.loading("Sending Custom Bill to VYPRTP3001...", { id: "print-toast" });
      await printerService.printBill(activeBill, 48);
      toast.success("Bill printed successfully!", { id: "print-toast" });
    } catch (err) {
      console.error("Print bill failed:", err);
      toast.error("Print failed: " + err.message, { id: "print-toast", duration: 5000 });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleRefresh = async () => {
    setStatus(printerService.getStatus());
    toast.success("Status refreshed.");
  };

  return (
    <div className="page-container py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Printer className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              Vyapar VYPRTP3001 Print Center
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            100% Web-based thermal receipt printing — Direct from your browser to your VYPRTP3001 hardware
          </p>
        </div>
      </div>

      {/* 1. Printer Status Widget */}
      <PrinterStatus status={status} onRefresh={handleRefresh} />

      {/* 2. Printer Controls Widget */}
      <PrinterControls
        status={status}
        onConnect={() => handleConnect("VYPRTP3001")}
        onDisconnect={handleDisconnect}
        onTestPrint={handleTestPrint}
        onPrintBill={handlePrintCustomBill}
        onRefresh={handleRefresh}
        onModeChange={(m) => printerService.setMode(m)}
        isPrinting={isPrinting}
      />

      {/* 3. Bill Preview & Monospace Thermal Simulation */}
      <BillPreview
        billData={activeBill}
        onPrint={handlePrintCustomBill}
        isPrinting={isPrinting}
      />

      {/* 4. Quick How-To Guide */}
      <div className="card p-5 border-zinc-800 bg-zinc-900/40">
        <h4 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-3">
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          <span>How Direct Browser Printing Works (100% Web-Based)</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400">
          <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px]">1</span>
              <span>Open in Google Chrome</span>
            </div>
            <p>
              Open this React website directly in Google Chrome on your Android phone, tablet, or PC laptop. No app installation needed.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px]">2</span>
              <span>Tap &quot;Connect Printer&quot;</span>
            </div>
            <p>
              Chrome will open the native Bluetooth device selector. Select your paired <strong>VYPRTP3001</strong> from the browser list.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5">
            <div className="flex items-center gap-2 text-zinc-200 font-semibold">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[11px]">3</span>
              <span>Print Custom Bill</span>
            </div>
            <p>
              The website directly streams ESC/POS binary command bytes to the printer to generate your custom 80mm receipt with auto-cut!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
