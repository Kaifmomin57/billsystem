/**
 * Web Bluetooth (BLE/GATT) Driver for Thermal Receipt Printers
 * Handles device discovery, GATT connection, characteristic resolution,
 * MTU-safe chunking, and disconnect events.
 */

// Common Thermal Printer BLE Service UUIDs
export const KNOWN_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Standard POS Printer Service
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service (NUS)
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Transparent Serial Service
  "0000ff00-0000-1000-8000-00805f9b34fb", // Generic Chinese POS Printer Service
  "0000e781-0000-1000-8000-00805f9b34fb", // Xprinter / Rongta POS Service
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "0000fee7-0000-1000-8000-00805f9b34fb", // Tencent / POS BLE Service
  "49535343-1e4d-4bd9-ba61-23c647249616",
];

export const KNOWN_WRITE_CHARACTERISTICS = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "6e400002-b5a3-f393-e0a9-e50e24dcca9e", // Nordic TX (Write)
  "49535343-8841-43f4-a8d4-ecbe34729bb3", // ISSC TX (Write)
  "0000ff01-0000-1000-8000-00805f9b34fb",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "0000b81d-0000-1000-8000-00805f9b34fb",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
];

const STORAGE_KEY_CUSTOM_UUIDS = "vyprtp_ble_custom_uuids";

export function getCustomBleConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_UUIDS);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    customServiceUuid: "",
    customCharUuid: "",
    chunkSize: 50, // bytes per BLE write packet
    chunkDelayMs: 25, // ms delay between chunks to prevent printer buffer overflow
  };
}

export function saveCustomBleConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_UUIDS, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save BLE config to localStorage", e);
  }
}

class WebBluetoothManager {
  constructor() {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.isConnecting = false;
    this.onStatusChangeCallbacks = new Set();
  }

  isSupported() {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  isConnected() {
    return !!(this.device && this.server && this.server.connected && this.characteristic);
  }

  getDeviceName() {
    return this.device ? (this.device.name || "VYPRTP3001 (BLE)") : null;
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
        console.error("Error in status change callback", err);
      }
    });
  }

  /**
   * Request Bluetooth device via browser dialog and connect to GATT Server
   */
  async connect() {
    if (!this.isSupported()) {
      throw new Error(
        "Web Bluetooth is not supported in this browser. Please use Google Chrome on Android with HTTPS/localhost."
      );
    }

    if (this.isConnected()) {
      return { device: this.device, name: this.getDeviceName() };
    }

    this.isConnecting = true;
    this._notify("connecting", { status: "connecting" });

    try {
      const config = getCustomBleConfig();
      const optionalServices = [...KNOWN_PRINTER_SERVICES];
      if (config.customServiceUuid && !optionalServices.includes(config.customServiceUuid.toLowerCase())) {
        optionalServices.push(config.customServiceUuid.toLowerCase());
      }

      // Request device with printer filter or acceptAllDevices
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: optionalServices,
      });

      this.device = device;

      // Handle spontaneous disconnect
      this.device.addEventListener("gattserverdisconnected", () => {
        this.characteristic = null;
        this.server = null;
        this._notify("disconnected", { status: "disconnected", reason: "Device disconnected" });
      });

      // Connect to GATT Server
      const server = await device.gatt.connect();
      this.server = server;

      // Discover writable characteristic
      const char = await this._findWriteCharacteristic(server, config);
      if (!char) {
        throw new Error(
          "Connected to device, but no writable print characteristic was found. The device may use Bluetooth Classic (SPP) instead of BLE, or requires custom UUIDs."
        );
      }

      this.characteristic = char;
      this.isConnecting = false;
      this._notify("connected", { status: "connected", name: this.getDeviceName() });

      return { device: this.device, name: this.getDeviceName() };
    } catch (err) {
      this.isConnecting = false;
      this.disconnect();
      this._notify("error", { status: "error", error: err.message });
      throw err;
    }
  }

  /**
   * Scan through services on GATT server to locate writable characteristic
   */
  async _findWriteCharacteristic(server, config) {
    // 1. If user supplied a custom Service and Characteristic UUID
    if (config.customServiceUuid && config.customCharUuid) {
      try {
        const service = await server.getPrimaryService(config.customServiceUuid.toLowerCase());
        const char = await service.getCharacteristic(config.customCharUuid.toLowerCase());
        if (this._isWritable(char)) return char;
      } catch (e) {
        console.warn("Custom UUID lookup failed:", e);
      }
    }

    // 2. Try known printer primary services
    const servicesToTry = config.customServiceUuid
      ? [config.customServiceUuid.toLowerCase(), ...KNOWN_PRINTER_SERVICES]
      : KNOWN_PRINTER_SERVICES;

    for (const serviceUuid of servicesToTry) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        if (service) {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (this._isWritable(char)) {
              return char;
            }
          }
        }
      } catch {
        // Service not present on this device, continue
      }
    }

    // 3. Fallback: Query all accessible primary services
    try {
      const allServices = await server.getPrimaryServices();
      for (const service of allServices) {
        try {
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (this._isWritable(c)) {
              return c;
            }
          }
        } catch {
          // Skip restricted service
        }
      }
    } catch (e) {
      console.warn("Could not retrieve all primary services:", e);
    }

    return null;
  }

  _isWritable(characteristic) {
    if (!characteristic || !characteristic.properties) return false;
    return !!(
      characteristic.properties.write ||
      characteristic.properties.writeWithoutResponse
    );
  }

  /**
   * Send binary ESC/POS data in MTU-safe chunks
   */
  async sendData(uint8Array, onProgress = null) {
    if (!this.isConnected()) {
      throw new Error("Printer is not connected. Connect printer first.");
    }

    const config = getCustomBleConfig();
    const chunkSize = Math.max(10, Math.min(config.chunkSize || 50, 200));
    const delayMs = Math.max(5, Math.min(config.chunkDelayMs || 25, 200));

    const totalBytes = uint8Array.length;
    let offset = 0;

    while (offset < totalBytes) {
      const slice = uint8Array.slice(offset, offset + chunkSize);

      if (this.characteristic.properties.writeWithoutResponse && this.characteristic.writeValueWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(slice);
      } else {
        await this.characteristic.writeValue(slice);
      }

      offset += slice.length;

      if (onProgress) {
        onProgress({ sent: offset, total: totalBytes, percent: Math.round((offset / totalBytes) * 100) });
      }

      // Small throttling delay to prevent buffer overrun on thermal printer MCU
      if (offset < totalBytes && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return true;
  }

  /**
   * Disconnect GATT server
   */
  disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      try {
        this.device.gatt.disconnect();
      } catch (err) {
        console.warn("Error disconnecting GATT:", err);
      }
    }
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.isConnecting = false;
    this._notify("disconnected", { status: "disconnected" });
  }
}

export const webBluetooth = new WebBluetoothManager();
