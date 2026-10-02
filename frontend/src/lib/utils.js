// Utility helpers
export const formatCurrency = (value, symbol = "₹") =>
  `${symbol}${Number(value ?? 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const truncate = (str, max = 40) =>
  str && str.length > max ? str.slice(0, max) + "…" : str;

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
