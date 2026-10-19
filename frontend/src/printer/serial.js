/**
 * Web Serial API Driver for Thermal Receipt Printers
 * Allows 100% web-based printing via USB / OTG cable directly from Chrome
 */

class WebSerialManager {
  constructor() {
    this.port = null;
    this.writer = null;
    this.onStatusChangeCallbacks = new Set();
  }

  isSupported() {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  isConnected() {
    return !!(this.port && this.port.writable);
  }

  getDeviceName() {
    return this.isConnected() ? "VYPRTP3001 (USB/Serial)" : null;
  }

  subscribe(callback) {
    this.onStatusChangeCallbacks.add(callback);
    return () => this.onStatusChangeCallbacks.delete(callback);
  }

  _notify(event, data) {
    this.onStatusChangeCallbacks.forEach((cb) => {
      try {
        cb(event, data);
      } catch (err) {
        console.error("WebSerial callback error:", err);
      }
    });
  }

  async connect(baudRate = 9600) {
    if (!this.isSupported()) {
      throw new Error("Web Serial API is not supported in this browser. Please use Chrome.");
    }

    try {
      this._notify("connecting", { status: "connecting" });
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: baudRate || 9600 });
      this.port = port;
      this._notify("connected", { status: "connected", name: "VYPRTP3001 (USB/Serial)" });
      return { port: this.port, name: "VYPRTP3001 (USB/Serial)" };
    } catch (err) {
      this.disconnect();
      this._notify("error", { status: "error", error: err.message });
      throw err;
    }
  }

  async sendData(uint8Array) {
    if (!this.isConnected()) {
      throw new Error("Printer is not connected via USB/Serial.");
    }

    try {
      const writer = this.port.writable.getWriter();
      await writer.write(uint8Array);
      writer.releaseLock();
      return true;
    } catch (err) {
      console.error("Error writing to serial port:", err);
      throw err;
    }
  }

  async disconnect() {
    if (this.port) {
      try {
        await this.port.close();
      } catch (e) {
        console.warn("Error closing serial port:", e);
      }
    }
    this.port = null;
    this._notify("disconnected", { status: "disconnected" });
  }
}

export const webSerial = new WebSerialManager();
