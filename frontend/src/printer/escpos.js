/**
 * ESC/POS Command Generator for 80mm Thermal Receipt Printers (Vyapar VYPRTP3001)
 * Optimized for 42-44 printable column width (prevents right-edge amount truncation)
 * Mirrors the full PDF Invoice format:
 * - Brand & Tax Invoice Header with Status
 * - Customer Details & Payment Mode
 * - Itemized Table (#, Item, Qty, Rate, Amount)
 * - Financial Summary (Current Total, Paid, Balance, Previous Balance, Total Due)
 * - Previous Unpaid Bills Breakdown (Carried Forward Details)
 * - Payment Installments History
 * - Auto-Cutter
 */

export const ESC = 0x1b;
export const GS = 0x1d;
export const LF = 0x0a;

export const ALIGN = {
  LEFT: 0,
  CENTER: 1,
  RIGHT: 2,
};

export const TEXT_SIZE = {
  NORMAL: 0x00,
  DOUBLE_HEIGHT: 0x01,
  DOUBLE_WIDTH: 0x10,
  DOUBLE_BOTH: 0x11,
};

export class EscPosBuilder {
  // 42 columns is the safe printable margin for standard 80mm thermal rolls (prevents amount cutoff)
  constructor(paperWidthCols = 42) {
    this.buffer = [];
    this.paperWidth = paperWidthCols;
  }

  addByte(byte) {
    this.buffer.push(byte & 0xff);
    return this;
  }

  addBytes(...bytes) {
    for (const b of bytes) {
      this.buffer.push(b & 0xff);
    }
    return this;
  }

  addText(str) {
    if (!str) return this;
    const cleanStr = String(str)
      .replace(/₹/g, "Rs.")
      .replace(/–/g, "-")
      .replace(/—/g, "-")
      .replace(/’/g, "'")
      .replace(/“/g, '"')
      .replace(/”/g, '"');

    for (let i = 0; i < cleanStr.length; i++) {
      const code = cleanStr.charCodeAt(i);
      this.buffer.push(code <= 0x7f ? code : 0x3f);
    }
    return this;
  }

  init() {
    return this.addBytes(ESC, 0x40); // ESC @
  }

  lineFeed(lines = 1) {
    for (let i = 0; i < lines; i++) {
      this.addByte(LF);
    }
    return this;
  }

  feedLines(lines = 3) {
    return this.addBytes(ESC, 0x64, Math.min(Math.max(lines, 1), 255));
  }

  setAlignment(alignment) {
    return this.addBytes(ESC, 0x61, alignment);
  }

  setBold(enabled = true) {
    return this.addBytes(ESC, 0x45, enabled ? 0x01 : 0x00);
  }

  setTextSize(size = TEXT_SIZE.NORMAL) {
    return this.addBytes(GS, 0x21, size);
  }

  divider(char = "-", length = null) {
    const len = length || this.paperWidth;
    return this.setAlignment(ALIGN.LEFT)
      .setBold(false)
      .setTextSize(TEXT_SIZE.NORMAL)
      .addText(char.repeat(len))
      .lineFeed();
  }

  doubleDivider(length = null) {
    return this.divider("=", length);
  }

  textLine(text = "", alignment = ALIGN.LEFT, bold = false, size = TEXT_SIZE.NORMAL) {
    return this.setAlignment(alignment)
      .setBold(bold)
      .setTextSize(size)
      .addText(text)
      .lineFeed();
  }

  /**
   * 2-Column Row (Label Left, Value Right)
   * Guaranteed: Right amount is NEVER truncated!
   */
  twoColumnRow(leftText, rightText, bold = false, size = TEXT_SIZE.NORMAL) {
    const totalCols = this.paperWidth;
    const right = String(rightText || "").trim();
    let left = String(leftText || "").trim();

    const maxLeftLen = totalCols - right.length - 1;

    // If left text is too long, wrap it to first line so right amount is never clipped!
    if (left.length > maxLeftLen) {
      this.setAlignment(ALIGN.LEFT)
        .setBold(bold)
        .setTextSize(size)
        .addText(left)
        .lineFeed();
      left = "";
    }

    const spacesCount = Math.max(1, totalCols - left.length - right.length);
    const fullLine = left + " ".repeat(spacesCount) + right;

    return this.setAlignment(ALIGN.LEFT)
      .setBold(bold)
      .setTextSize(size)
      .addText(fullLine)
      .lineFeed();
  }

  /**
   * 4-Column Table Header: ITEM, QTY, RATE, AMT
   * Column Widths for 42 cols: ITEM: 18, QTY: 5, RATE: 8, AMT: 11 = 42 cols
   */
  tableHeader(size = TEXT_SIZE.NORMAL) {
    const itemCol = "ITEM".padEnd(18, " ");
    const qtyCol = "QTY".padStart(5, " ");
    const rateCol = "RATE".padStart(8, " ");
    const amtCol = "AMT".padStart(11, " ");

    return this.setAlignment(ALIGN.LEFT)
      .setBold(true)
      .setTextSize(size)
      .addText(itemCol + qtyCol + rateCol + amtCol)
      .lineFeed();
  }

  /**
   * 4-Column Table Row with intelligent multi-line item name wrapping
   */
  tableRow(name, qty, rate, amt, size = TEXT_SIZE.NORMAL, bold = false) {
    const itemColWidth = 18;
    const qtyColWidth = 5;
    const rateColWidth = 8;
    const amtColWidth = 11;

    const qtyStr = String(qty).padStart(qtyColWidth, " ");
    const rateStr = Number(rate).toFixed(2).padStart(rateColWidth, " ");
    const amtStr = Number(amt).toFixed(2).padStart(amtColWidth, " ");

    const itemName = String(name || "").trim();

    if (itemName.length <= itemColWidth) {
      const line = itemName.padEnd(itemColWidth, " ") + qtyStr + rateStr + amtStr;
      return this.setAlignment(ALIGN.LEFT)
        .setBold(bold)
        .setTextSize(size)
        .addText(line)
        .lineFeed();
    }

    // Wrap item name across lines
    const words = itemName.split(/\s+/);
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + (currentLine ? " " : "") + word).length <= itemColWidth) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        if (currentLine) lines.push(currentLine);
        if (word.length > itemColWidth) {
          let remWord = word;
          while (remWord.length > itemColWidth) {
            lines.push(remWord.substring(0, itemColWidth));
            remWord = remWord.substring(itemColWidth);
          }
          currentLine = remWord;
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) lines.push(currentLine);

    // Print first line with numbers
    const firstLineItem = (lines[0] || "").padEnd(itemColWidth, " ");
    this.setAlignment(ALIGN.LEFT)
      .setBold(bold)
      .setTextSize(size)
      .addText(firstLineItem + qtyStr + rateStr + amtStr)
      .lineFeed();

    // Print subsequent wrapped lines
    for (let i = 1; i < lines.length; i++) {
      this.setAlignment(ALIGN.LEFT)
        .setBold(bold)
        .setTextSize(size)
        .addText(lines[i].padEnd(itemColWidth, " "))
        .lineFeed();
    }

    return this;
  }

  qrCode(data) {
    if (!data) return this;
    const cleanData = String(data);
    const len = cleanData.length + 3;
    const pL = len & 0xff;
    const pH = (len >> 8) & 0xff;

    this.setAlignment(ALIGN.CENTER);
    this.addBytes(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    this.addBytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05);
    this.addBytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    this.addBytes(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
    this.addText(cleanData);
    this.addBytes(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    this.lineFeed();
    return this;
  }

  cutPaper(partial = true) {
    this.feedLines(4);
    return this.addBytes(GS, 0x56, partial ? 0x42 : 0x00, 0x00);
  }

  toBytes() {
    return new Uint8Array(this.buffer);
  }

  toBase64() {
    const bytes = this.toBytes();
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

/**
 * Generate binary ESC/POS payload for Test Print
 */
export function buildTestPrintEscPos(paperWidth = 42) {
  const b = new EscPosBuilder(paperWidth);

  b.init()
    .doubleDivider()
    .textLine("PRINTER TEST", ALIGN.CENTER, true, TEXT_SIZE.DOUBLE_HEIGHT)
    .doubleDivider()
    .lineFeed()
    .textLine("VYPRTP3001", ALIGN.CENTER, true, TEXT_SIZE.DOUBLE_WIDTH)
    .lineFeed()
    .textLine("Bluetooth Connection: OK", ALIGN.LEFT, true)
    .textLine("ESC/POS Test: OK", ALIGN.LEFT, true)
    .textLine(`Paper Width: 80mm (${paperWidth} cols)`, ALIGN.LEFT, false)
    .textLine(`Timestamp: ${new Date().toLocaleString()}`, ALIGN.LEFT, false)
    .lineFeed()
    .divider()
    .textLine("CUSTOM PRINT TEST", ALIGN.CENTER, true)
    .divider()
    .lineFeed()
    .textLine("Vyapar Hardware / Custom React Engine", ALIGN.CENTER, false)
    .lineFeed()
    .cutPaper(true);

  return b.toBytes();
}

/**
 * Generate full PDF-style ESC/POS payload for custom bill
 */
export function buildBillEscPos(billData, paperWidth = 42) {
  const b = new EscPosBuilder(paperWidth);
  const data = billData.bill || billData;

  b.init();

  // 1. Header Grid (Brand & Title)
  b.doubleDivider();
  const shopName = data.shopName || "KADRI FISH CENTER";
  b.textLine(shopName.toUpperCase(), ALIGN.CENTER, true, TEXT_SIZE.DOUBLE_BOTH);

  if (data.tagline) b.textLine(data.tagline, ALIGN.CENTER, false);
  if (data.address) b.textLine(data.address, ALIGN.CENTER, false);
  if (data.phone) b.textLine(`Ph: ${data.phone}`, ALIGN.CENTER, false);
  if (data.gstin) b.textLine(`GSTIN: ${data.gstin}`, ALIGN.CENTER, false);

  b.textLine("TAX INVOICE", ALIGN.CENTER, true, TEXT_SIZE.DOUBLE_HEIGHT);
  b.doubleDivider();

  // 2. Invoice Metadata & Status
  const dateStr = data.date || data.bill_date || new Date().toISOString().split("T")[0];
  const invNo = data.invoiceNumber || data.bill_no || "INV-1001";
  const pStatus = (data.paymentStatus || data.payment_status || "UNPAID").toUpperCase();

  b.twoColumnRow(`Invoice No: #${invNo}`, `Date: ${dateStr}`, true, TEXT_SIZE.DOUBLE_HEIGHT);
  b.twoColumnRow("Status", `[ ${pStatus} ]`, true);

  const payMode = data.paymentMethod || data.payment_method || "Cash";

  // 3. Items List (Big Bold Item Names)
  b.divider();
  b.textLine("#  ITEM DESCRIPTION & DETAILS       AMOUNT", ALIGN.LEFT, true);
  b.divider();

  const items = data.items || [];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const name = item.name || item.product_name || "Item";
    const qty = item.quantity ?? 1;
    const unit = item.unit || "";
    const rate = Number(item.rate ?? 0).toFixed(2);
    const amt = Number(item.amount ?? (Number(qty) * Number(rate))).toFixed(2);
    const unitStr = unit && unit !== "none" ? ` ${unit}` : "";

    // 1. Big Bold Item Name (Double Height)
    b.setAlignment(ALIGN.LEFT)
      .setBold(true)
      .setTextSize(TEXT_SIZE.DOUBLE_HEIGHT)
      .addText(`${idx + 1}. ${name.toUpperCase()}`)
      .lineFeed();

    // 2. Qty x Rate (Left) and Total Amount (Right) - Increased Number Size (DOUBLE_HEIGHT)
    b.twoColumnRow(`   ${qty}${unitStr} x Rs.${rate}`, `Rs.${amt}`, true, TEXT_SIZE.DOUBLE_HEIGHT);

    // Space between items
    if (idx < items.length - 1) {
      b.lineFeed();
    }
  }

  b.divider();

  // 5. Compact Financial Summary (Large Numbers)
  const subtotal = data.subtotal ?? items.reduce((sum, it) => sum + (Number(it.amount) || (Number(it.quantity) * Number(it.rate))), 0);
  const total = Number(data.total ?? data.total_amount ?? subtotal);
  const paid = Number(data.amountPaid ?? data.amount_paid ?? 0);
  const balance = Number(data.balanceDue ?? data.balance_due ?? Math.max(0, total - paid));

  b.twoColumnRow("TOTAL AMOUNT:", `Rs.${total.toFixed(2)}`, true, TEXT_SIZE.DOUBLE_HEIGHT);
  b.twoColumnRow(`Paid (${payMode}):`, `Rs.${paid.toFixed(2)}`, true, TEXT_SIZE.DOUBLE_HEIGHT);
  b.twoColumnRow("Balance Due:", `Rs.${balance.toFixed(2)}`, true, TEXT_SIZE.DOUBLE_HEIGHT);
  b.doubleDivider();

  // 6. Payment Installments Recorded (if any)
  const installments = data.payment_history || [];
  if (installments.length > 0) {
    b.textLine("PAYMENT INSTALLMENTS RECORDED:", ALIGN.LEFT, true);
    b.divider();
    installments.forEach((inst, idx) => {
      const rawDate = inst.paid_at ? String(inst.paid_at).replace("T", " ").substring(0, 16) : dateStr;
      const instAmt = `Rs.${Number(inst.amount || 0).toFixed(2)}`;
      const instMode = inst.payment_method || "Cash";
      b.twoColumnRow(`${idx + 1}. ${rawDate} (${instMode})`, instAmt, true);
      if (inst.note) {
        b.textLine(`   Note: ${inst.note}`, ALIGN.LEFT, false);
      }
    });
    b.divider();
  }

  // 7. Optional UPI QR Code
  const upiAmount = balance > 0 ? balance : total;
  if (data.upiId && Number(upiAmount) > 0) {
    const upiPayUri = `upi://pay?pa=${data.upiId}&pn=${encodeURIComponent(shopName)}&am=${upiAmount.toFixed(2)}&cu=INR`;
    b.textLine("Scan to Pay via UPI", ALIGN.CENTER, true);
    b.qrCode(upiPayUri);
    b.lineFeed();
  }

  // 9. Footer
  b.divider();
  const footer = data.footerMessage || "Thank You!\nVisit Again :)";
  for (const line of footer.split("\n")) {
    b.textLine(line, ALIGN.CENTER, false);
  }
  b.divider();

  // Cut Paper
  b.cutPaper(true);

  return b.toBytes();
}

/**
 * Format a bill into pure monospace text representation for screen preview (exact 42-column layout)
 */
export function formatBillAsText(billData, paperWidth = 42) {
  const data = billData.bill || billData;
  const lines = [];

  const center = (text) => {
    const str = String(text || "").trim();
    if (str.length >= paperWidth) return str.substring(0, paperWidth);
    const leftPad = Math.floor((paperWidth - str.length) / 2);
    return " ".repeat(leftPad) + str;
  };

  const twoCol = (left, right) => {
    const l = String(left || "").trim();
    const r = String(right || "").trim();
    const spaces = Math.max(1, paperWidth - l.length - r.length);
    return l + " ".repeat(spaces) + r;
  };

  const d1 = "-".repeat(paperWidth);
  const d2 = "=".repeat(paperWidth);

  // 1. Header
  lines.push(d2);
  const shopName = data.shopName || "KADRI";
  lines.push(center(shopName.toUpperCase()));
  if (data.tagline) lines.push(center(data.tagline));
  if (data.address) lines.push(center(data.address));
  if (data.phone) lines.push(center(`Ph: ${data.phone}`));
  if (data.gstin) lines.push(center(`GSTIN: ${data.gstin}`));
  lines.push(center("TAX INVOICE"));
  lines.push(d2);

  // 2. Metadata & Status
  const dateStr = data.date || data.bill_date || new Date().toISOString().split("T")[0];
  const invNo = data.invoiceNumber || data.bill_no || "INV-1001";
  const pStatus = (data.paymentStatus || data.payment_status || "UNPAID").toUpperCase();

  lines.push(twoCol(`Invoice No: #${invNo}`, `Date: ${dateStr}`));
  lines.push(twoCol("Status", `[ ${pStatus} ]`));

  const payMode = data.paymentMethod || data.payment_method || "Cash";

  // 3. Items List (Big Bold Item Names)
  lines.push(d1);
  lines.push(twoCol("#  ITEM & DETAILS", "AMOUNT"));
  lines.push(d1);

  const items = data.items || [];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const name = item.name || item.product_name || "Item";
    const qty = String(item.quantity ?? 1);
    const unit = item.unit || "";
    const rate = Number(item.rate ?? 0).toFixed(2);
    const amt = Number(item.amount ?? (item.quantity * item.rate)).toFixed(2);
    const unitStr = unit && unit !== "none" ? ` ${unit}` : "";

    lines.push(`▶ ${idx + 1}. ${name.toUpperCase()}`);
    lines.push(twoCol(`   ${qty}${unitStr} x Rs.${rate}`, `Rs.${amt}`));
    if (idx < items.length - 1) {
      lines.push("");
    }
  }

  lines.push(d1);

  // 5. Compact Financial Summary
  const subtotal = data.subtotal ?? items.reduce((s, it) => s + (Number(it.amount) || (it.quantity * it.rate)), 0);
  const total = Number(data.total ?? data.total_amount ?? subtotal);
  const paid = Number(data.amountPaid ?? data.amount_paid ?? 0);
  const balance = Number(data.balanceDue ?? data.balance_due ?? Math.max(0, total - paid));

  lines.push(twoCol("TOTAL AMOUNT:", `Rs.${total.toFixed(2)}`));
  lines.push(twoCol(`Paid (${payMode}):`, `Rs.${paid.toFixed(2)}`));
  lines.push(twoCol("Balance Due:", `Rs.${balance.toFixed(2)}`));
  lines.push(d2);

  // 6. Payment Installments Recorded (if any)
  const installments = data.payment_history || [];
  if (installments.length > 0) {
    lines.push("PAYMENT INSTALLMENTS RECORDED:");
    lines.push(d1);
    installments.forEach((inst, idx) => {
      const rawDate = inst.paid_at ? String(inst.paid_at).replace("T", " ").substring(0, 16) : dateStr;
      const instAmt = `Rs.${Number(inst.amount || 0).toFixed(2)}`;
      const instMode = inst.payment_method || "Cash";
      lines.push(twoCol(`${idx + 1}. ${rawDate} (${instMode})`, instAmt));
      if (inst.note) lines.push(`   Note: ${inst.note}`);
    });
    lines.push(d1);
  }

  const footer = data.footerMessage || "Thank You!\nVisit Again :)";
  for (const f of footer.split("\n")) {
    lines.push(center(f));
  }
  lines.push(d1);
  lines.push(center("[ ✂️ --- CUT RECEIPT HERE --- ✂️ ]"));

  return lines.join("\n");
}
