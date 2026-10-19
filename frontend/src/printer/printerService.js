/**
 * 100% Web-Based Thermal Printer Service for Vyapar VYPRTP3001
 * Direct Browser Printing with ZERO external mobile app or software required!
 *
 * Supported Web APIs:
 * 1. Web Bluetooth API (Wireless direct from Chrome on Android or Desktop)
 * 2. Web Serial API (USB cable / OTG direct from Chrome)
 */

import { webBluetooth } from "./bluetooth";
import { webSerial } from "./serial";
import { buildTestPrintEscPos, buildBillEscPos } from "./escpos";

export const PRINTER_MODES = {
  BLUETOOTH: "bluetooth", // Web Bluetooth API (Wireless in Chrome)
  SERIAL: "serial",       // Web Serial / USB API (Direct cable in Chrome)
};

const STORAGE_KEY_MODE = "vyprtp_active_mode";

class PrinterService {
  constructor() {
    this.mode = localStorage.getItem(STORAGE_KEY_MODE) || PRINTER_MODES.BLUETOOTH;
    this.listeners = new Set();
    this.isPrinting = false;

    // Listen to Web Bluetooth status changes
    webBluetooth.subscribe(() => this._emitChange());

    // Listen to Web Serial status changes
    webSerial.subscribe(() => this._emitChange());
  }

  setMode(newMode) {
    if (newMode === PRINTER_MODES.BLUETOOTH || newMode === PRINTER_MODES.SERIAL) {
      this.mode = newMode;
      localStorage.setItem(STORAGE_KEY_MODE, newMode);
      this._emitChange();
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _emitChange() {
    const status = this.getStatus();
    this.listeners.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.error("PrinterService subscriber error:", err);
      }
    });
  }

  /**
   * Get current unified status for UI badges & buttons
   */
  getStatus() {
    if (this.mode === PRINTER_MODES.BLUETOOTH) {
      return {
        mode: PRINTER_MODES.BLUETOOTH,
        modeLabel: "Web Bluetooth (Wireless)",
        connected: webBluetooth.isConnected(),
        deviceName: webBluetooth.getDeviceName(),
        isConnecting: webBluetooth.isConnecting,
        supported: webBluetooth.isSupported(),
      };
    } else {
      return {
        mode: PRINTER_MODES.SERIAL,
        modeLabel: "Web Serial / USB",
        connected: webSerial.isConnected(),
        deviceName: webSerial.getDeviceName(),
        isConnecting: false,
        supported: webSerial.isSupported(),
      };
    }
  }

  /**
   * Connect to printer directly from the browser
   */
  async connect(preferredDeviceName = "VYPRTP3001") {
    if (this.mode === PRINTER_MODES.BLUETOOTH) {
      return await webBluetooth.connect();
    } else {
      return await webSerial.connect();
    }
  }

  /**
   * Disconnect from printer
   */
  async disconnect() {
    if (this.mode === PRINTER_MODES.BLUETOOTH) {
      webBluetooth.disconnect();
    } else {
      await webSerial.disconnect();
    }
  }

  /**
   * Send binary ESC/POS bytes directly to printer
   */
  async sendRawBytes(uint8Array, onProgress = null) {
    if (this.isPrinting) {
      throw new Error("A print job is already in progress. Please wait.");
    }

    this.isPrinting = true;
    try {
      if (this.mode === PRINTER_MODES.BLUETOOTH) {
        return await webBluetooth.sendData(uint8Array, onProgress);
      } else {
        return await webSerial.sendData(uint8Array);
      }
    } finally {
      this.isPrinting = false;
    }
  }

  /**
   * Run 80mm Hardware Test Print
   */
  async printTest(paperWidth = 48) {
    const bytes = buildTestPrintEscPos(paperWidth);
    return await this.sendRawBytes(bytes);
  }

  /**
   * Print custom bill (Accepts bill object or full print job format)
   */
  async printBill(billData, paperWidth = 48) {
    const bytes = buildBillEscPos(billData, paperWidth);
    return await this.sendRawBytes(bytes);
  }
}

export const printerService = new PrinterService();
