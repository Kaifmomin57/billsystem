// Sample test bill data matching the VYPRTP3001 80mm receipt format requirements
export const testBill = {
  printer: "VYPRTP3001",
  paperWidth: 80, // 80mm thermal receipt (48 monospace characters width)
  bill: {
    shopName: "KADRI FISH CENTER",
    tagline: "Best Quality Sea Foods",
    address: "Shop No. 12, Main Market, City Center",
    phone: "+91 98765 43210",
    gstin: "27AAAAA0000A1Z5",
    invoiceNumber: "INV-1001",
    date: "19-10-2026",
    time: "21:30",
    cashier: "Admin",
    customer: {
      name: "Walk-in Customer",
      phone: "+91 91234 56789"
    },
    items: [
      {
        name: "Rice (Basmati Premium)",
        quantity: 2,
        rate: 100,
        amount: 200
      },
      {
        name: "Sugar (Refined White)",
        quantity: 1,
        rate: 50,
        amount: 50
      },
      {
        name: "Oil (Refined Sunflower 1L Pouch)",
        quantity: 2,
        rate: 120,
        amount: 240
      }
    ],
    subtotal: 490,
    discount: 0,
    gst: 0,
    total: 490,
    amountPaid: 490,
    paymentMethod: "Cash",
    balanceDue: 0,
    upiId: "kadri@upi",
    footerMessage: "Thank You!\nVisit Again :)"
  }
};
