import type { CommunityPriceReport, PriceSummary, PublicCommunityPriceReport } from "./types";

export const CURRENT_REPORT_DAYS = 30;
export const PUBLIC_PRICE_REPORT_COLUMNS = "id,charger_id,price_per_kwh,observed_at,note,state,created_at";

export function toPublicPriceReport(report: CommunityPriceReport): PublicCommunityPriceReport {
  const { reporter_id: _reporterId, ...publicReport } = report;
  return publicReport;
}

export function isCurrentReport(report: Pick<CommunityPriceReport, "observed_at" | "state">, now = new Date()) {
  if (report.state !== "visible") return false;
  const observed = new Date(`${report.observed_at}T00:00:00Z`);
  const age = now.getTime() - observed.getTime();
  return age >= 0 && age <= CURRENT_REPORT_DAYS * 24 * 60 * 60 * 1000;
}

export function selectRankableReport(reports: CommunityPriceReport[], now = new Date()) {
  return reports
    .filter((report) => isCurrentReport(report, now))
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at) || b.created_at.localeCompare(a.created_at))[0];
}

export function priceSummary(reports: CommunityPriceReport[], now = new Date()): PriceSummary {
  const report = selectRankableReport(reports, now);
  return report
    ? { status: "community", price_per_kwh: report.price_per_kwh, observed_at: report.observed_at }
    : { status: "unknown", price_per_kwh: null, observed_at: null };
}

/** Known current community prices always precede unknown prices. */
export function orderByPrice<T extends { price_summary?: PriceSummary; distance?: number }>(items: T[]) {
  return [...items].sort((a, b) => {
    const ap = a.price_summary?.price_per_kwh;
    const bp = b.price_summary?.price_per_kwh;
    if (ap != null && bp != null) return ap - bp;
    if (ap != null) return -1;
    if (bp != null) return 1;
    return (a.distance ?? Infinity) - (b.distance ?? Infinity);
  });
}
