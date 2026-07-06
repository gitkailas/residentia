export const inr = (n: number | string | null | undefined) => {
  const num = Number(n);
  return `₹${(Number.isNaN(num) ? 0 : num).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = date.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

export const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export const RATES: Record<string, { maintenance: number; garbage: number }> = {
  "1BHK": { maintenance: 1200, garbage: 100 },
  "2BHK": { maintenance: 1550, garbage: 100 },
  "3BHK": { maintenance: 1900, garbage: 100 },
  "4BHK": { maintenance: 2250, garbage: 100 },
  "5BHK": { maintenance: 2600, garbage: 100 },
  "6BHK": { maintenance: 2950, garbage: 100 },
};
