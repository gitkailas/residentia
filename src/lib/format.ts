export const inr = (n: number | null | undefined) =>
  `₹${(Number(n ?? 0)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

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

export const RATES = {
  "2BHK": { maintenance: 1550, garbage: 100 },
  "3BHK": { maintenance: 1900, garbage: 100 },
} as const;
