import { formatINR, formatDateIN, formatDateTimeIN } from './formatters';

export { formatINR, formatDateIN, formatDateTimeIN };

export const formatCurrency = (value, symbol = "₹") => {
  return formatINR(value);
};

export const formatDate = (dateStr) => {
  return formatDateIN(dateStr);
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
