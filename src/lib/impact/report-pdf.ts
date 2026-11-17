import "server-only";
import { PDFDocument, PDFString, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { brand } from "@/config/brand";
import { computeImpact, type ImpactInputs } from "./model";

// One-page US Letter PDF of a visitor's calculator scenario, for investor or client meetings
// (B2B teams looking for partners or customers). Built with pdf-lib's standard fonts, so text
// must stay within Windows-1252: no ellipsis or arrow characters.

export type ReportGoal = "partnerships" | "customers";

export type ReportData = {
  name: string;
  company: string | null;
  goal: ReportGoal;
  inputs: ImpactInputs;
  createdAt: Date;
};

const INK = rgb(0.06, 0.08, 0.16);
const MUTED = rgb(0.38, 0.41, 0.5);
const LINE = rgb(0.86, 0.87, 0.91);
const SOFT = rgb(0.965, 0.97, 0.98);
const MAGENTA = rgb(0.77, 0, 0.42);
const GOLD = rgb(1, 0.84, 0);
const WHITE = rgb(1, 1, 1);
const GREY_LINE = rgb(0.6, 0.62, 0.68);

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });

const WORDS: Record<ReportGoal, { title: string; deal: string; deals: string }> = {
  partnerships: { title: "New partnerships", deal: "partnership", deals: "Partnerships signed" },
  customers: { title: "New customers", deal: "customer", deals: "Customers won" },
};

type Ctx = { page: PDFPage; regular: PDFFont; bold: PDFFont };

function text(c: Ctx, s: string, x: number, y: number, size: number, opts: { bold?: boolean; color?: RGB } = {}) {
  c.page.drawText(s, { x, y, size, font: opts.bold ? c.bold : c.regular, color: opts.color ?? INK });
}

function rightText(c: Ctx, s: string, right: number, y: number, size: number, opts: { bold?: boolean; color?: RGB } = {}) {
  const w = (opts.bold ? c.bold : c.regular).widthOfTextAtSize(s, size);
  text(c, s, right - w, y, size, opts);
}

// Draws wrapped text and returns the y below it.
function para(c: Ctx, s: string, x: number, y: number, width: number, size: number, opts: { bold?: boolean; color?: RGB; leading?: number } = {}) {
  const font = opts.bold ? c.bold : c.regular;
  const leading = opts.leading ?? size * 1.4;
  let line = "";
  for (const word of s.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      text(c, line, x, y, size, opts);
      y -= leading;
      line = word;
    } else line = next;
  }
  if (line) {
    text(c, line, x, y, size, opts);
    y -= leading;
  }
  return y;
}

function kicker(c: Ctx, s: string, x: number, y: number) {
  text(c, s.toUpperCase(), x, y, 8, { bold: true, color: MAGENTA });
}

export async function buildImpactReport(d: ReportData): Promise<Uint8Array> {
  const r = computeImpact(d.inputs);
  const w = WORDS[d.goal];
  const doc = await PDFDocument.create();
  doc.setTitle(`${brand.productName} pipeline impact scenario`);
  doc.setAuthor(`${brand.productName} by ${brand.companyName}`);
  const page = doc.addPage([612, 792]);
  const c: Ctx = { page, regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const L = 44;
  const R = 568;
  const W = R - L;

  // Header band
  page.drawRectangle({ x: 0, y: 718, width: 612, height: 74, color: INK });
  page.drawRectangle({ x: 0, y: 714, width: 612, height: 4, color: MAGENTA });
  text(c, brand.productName, L, 756, 22, { bold: true, color: WHITE });
  text(c, `by ${brand.companyName}`, L, 740, 9, { color: GOLD });
  rightText(c, "Pipeline impact scenario", R, 758, 11, { bold: true, color: WHITE });
  rightText(c, date.format(d.createdAt), R, 742, 9, { color: rgb(0.8, 0.82, 0.88) });

  // Title
  let y = 684;
  kicker(c, `${w.title} through researched outreach`, L, y);
  y -= 22;
  text(c, "What Polaris could add in the first 12 months", L, y, 18, { bold: true });
  y -= 18;
  text(c, `Prepared for ${d.name}${d.company ? `, ${d.company}` : ""}`, L, y, 10, { color: MUTED });

  // Key figures
  y -= 22;
  const tiles: [string, string, string][] = [
    ["Extra revenue, first 12 months", usd.format(r.extraRevenue12), `after a ${d.inputs.salesCycleMonths}-month sales cycle`],
    ["Return on Polaris", r.returnMultiple === null ? "-" : `${one.format(r.returnMultiple)}x`, `vs ${usd.format(r.polarisCost12)} a year`],
    ["Extra meetings a month", one.format(r.extraMeetings), `${one.format(r.extraDealsPerYear)} more ${w.deal}s in year one`],
    ["Pipeline added a month", usd.format(r.extraPipelinePerMonth), "extra meetings x deal value"],
  ];
  const gap = 10;
  const tw = (W - gap * 3) / 4;
  tiles.forEach(([label, value, note], i) => {
    const x = L + i * (tw + gap);
    page.drawRectangle({ x, y: y - 72, width: tw, height: 72, color: i === 0 ? rgb(0.99, 0.94, 0.97) : SOFT, borderColor: i === 0 ? MAGENTA : LINE, borderWidth: 0.8 });
    para(c, label, x + 9, y - 14, tw - 18, 7.5, { color: MUTED, leading: 9 });
    text(c, value, x + 9, y - 44, value.length > 9 ? 16 : 20, { bold: true, color: i === 0 ? MAGENTA : INK });
    para(c, note, x + 9, y - 60, tw - 18, 7, { color: MUTED, leading: 8.5 });
  });
  y -= 96;

  // Monthly comparison (left) and 12-month chart (right)
  const colW = (W - 20) / 2;
  kicker(c, "A month of prospecting", L, y);
  kicker(c, "Revenue won, first 12 months", L + colW + 20, y);
  y -= 10;
  const rows: [string, string, string][] = [
    ["Researched pitches", String(r.without.pitches), String(r.with.pitches)],
    ["Replies", one.format(r.without.replies), one.format(r.with.replies)],
    ["Meetings", one.format(r.without.meetings), one.format(r.with.meetings)],
    [w.deals, one.format(r.without.deals), one.format(r.with.deals)],
    ["Revenue", usd.format(r.without.revenue), usd.format(r.with.revenue)],
  ];
  const rowH = 19;
  page.drawRectangle({ x: L, y: y - rowH, width: colW, height: rowH, color: SOFT });
  text(c, "Each month", L + 8, y - 13, 8.5, { color: MUTED });
  rightText(c, "By hand", L + colW - 82, y - 13, 8.5, { color: MUTED });
  rightText(c, "With Polaris", L + colW - 8, y - 13, 8.5, { bold: true });
  let ty = y - rowH;
  for (const [label, a, b] of rows) {
    page.drawLine({ start: { x: L, y: ty }, end: { x: L + colW, y: ty }, thickness: 0.6, color: LINE });
    text(c, label, L + 8, ty - 13, 9);
    rightText(c, a, L + colW - 82, ty - 13, 9, { color: MUTED });
    rightText(c, b, L + colW - 8, ty - 13, 9, { bold: true });
    ty -= rowH;
  }
  page.drawRectangle({ x: L, y: ty, width: colW, height: y - ty, borderColor: LINE, borderWidth: 0.8 });

  // Chart
  const cx = L + colW + 20;
  const ch = y - ty - 16;
  const cy = ty + 14;
  const max = Math.max(1, ...r.cumulative.map((p) => p.with), ...r.cumulative.map((p) => p.without));
  const px = (m: number) => cx + 4 + ((m - 1) / 11) * (colW - 8);
  const py = (v: number) => cy + (v / max) * (ch - 8);
  for (const f of [0.5, 1]) page.drawLine({ start: { x: cx, y: py(max * f) }, end: { x: cx + colW, y: py(max * f) }, thickness: 0.5, color: LINE, dashArray: [2, 3] });
  page.drawLine({ start: { x: cx, y: cy }, end: { x: cx + colW, y: cy }, thickness: 0.8, color: LINE });
  const series = (k: "with" | "without", color: RGB, thickness: number) => {
    for (let i = 1; i < r.cumulative.length; i++) {
      const a = r.cumulative[i - 1];
      const b = r.cumulative[i];
      page.drawLine({ start: { x: px(a.month), y: py(a[k]) }, end: { x: px(b.month), y: py(b[k]) }, thickness, color });
    }
  };
  series("without", GREY_LINE, 1.6);
  series("with", MAGENTA, 2.2);
  for (const m of [1, 3, 6, 9, 12]) text(c, `M${m}`, px(m) - 6, cy - 10, 7, { color: MUTED });
  const last = r.cumulative[11];
  rightText(c, `With Polaris ${usd.format(last.with)}`, cx + colW, cy + ch + 2, 8, { bold: true, color: MAGENTA });
  text(c, `By hand ${usd.format(last.without)}`, cx, cy + ch + 2, 8, { color: MUTED });

  y = ty - 24;

  // Time line
  page.drawRectangle({ x: L, y: y - 30, width: W, height: 30, color: SOFT });
  para(
    c,
    `Or keep today's volume: sending the same ${r.without.pitches} pitches a month with Polaris frees about ${one.format(r.hoursSavedAtSameVolume)} hours a month, worth ${usd.format(r.timeValueSaved)}.`,
    L + 10,
    y - 13,
    W - 20,
    9,
    { leading: 11 },
  );
  y -= 52;

  // Assumptions (left) and how Polaris gets there (right)
  kicker(c, "The assumptions behind these numbers", L, y);
  kicker(c, `How Polaris finds ${d.goal === "partnerships" ? "partners" : "customers"}`, L + colW + 20, y);
  y -= 16;
  const i = d.inputs;
  const assumptions: [string, string][] = [
    ["Prospecting time", `${i.hoursPerMonth} hours a month`],
    ["Time per pitch by hand", `${i.manualHoursPerPitch} hours`],
    ["Time per pitch with Polaris", `${i.polarisHoursPerPitch} hours`],
    ["Reply rate", `${i.replyRate}%${i.replyUplift ? ` (+${i.replyUplift} ${i.replyUplift === 1 ? "point" : "points"} with Polaris)` : " (same with Polaris)"}`],
    ["Replies that become meetings", `${i.meetingRate}%`],
    [`Meetings that become ${w.deal}s`, `${i.winRate}%`],
    ["Average deal value", usd.format(i.dealValue)],
    ["Sales cycle", `${i.salesCycleMonths} months`],
    ["Value of an hour", usd.format(i.hourlyValue)],
    ["Polaris running cost", `${usd.format(i.polarisMonthlyCost)} a month`],
  ];
  let ay = y;
  for (const [k, v] of assumptions) {
    text(c, k, L, ay, 8.5, { color: MUTED });
    rightText(c, v, L + colW, ay, 8.5, { bold: true });
    ay -= 14;
  }
  const steps: [string, string][] = [
    ["Ideal customer profile", `Turns your offer into the companies and roles worth ${d.goal === "partnerships" ? "partnering with" : "selling to"}.`],
    ["Cited discovery and research", "Finds companies that fit and scores each one, with a source behind every claim."],
    ["Decision-maker contacts", "Finds the right people, only at companies you choose to pursue."],
    ["Pitches you approve", "Drafts a tailored email from the research; nothing is sent without a named person approving it."],
  ];
  let sy = y;
  const sx = L + colW + 20;
  steps.forEach(([title, body], n) => {
    page.drawCircle({ x: sx + 6, y: sy + 3, size: 6, color: INK });
    text(c, String(n + 1), sx + 4, sy + 0.5, 7, { bold: true, color: GOLD });
    text(c, title, sx + 18, sy, 9, { bold: true });
    sy = para(c, body, sx + 18, sy - 12, colW - 18, 8.5, { color: MUTED, leading: 11 }) - 6;
  });

  // Disclaimer and footer
  const fy = 74;
  page.drawLine({ start: { x: L, y: fy + 18 }, end: { x: R, y: fy + 18 }, thickness: 0.6, color: LINE });
  para(
    c,
    `Estimates calculated from the assumptions above, not measured Polaris results. ${
      d.inputs.replyUplift
        ? `The reply rate with Polaris includes an assumed +${d.inputs.replyUplift} ${d.inputs.replyUplift === 1 ? "point" : "points"} for research-led pitches.`
        : "The reply rate is kept the same; only the extra pitches the same hours can cover are counted."
    } Deals are spread evenly over the year; real results vary.`,
    L,
    fy + 4,
    W,
    7.5,
    { color: MUTED, leading: 10 },
  );
  // Footer: TiffanyAI's website and email, both clickable.
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 34, color: INK });
  text(c, `${brand.productName} by ${brand.companyName}`, L, 13, 9, { bold: true, color: WHITE });
  const site = brand.website.replace(/^https?:\/\//, "");
  const sep = "   |   ";
  const size = 9;
  const emailW = c.regular.widthOfTextAtSize(brand.contactEmail, size);
  const sepW = c.regular.widthOfTextAtSize(sep, size);
  const siteW = c.regular.widthOfTextAtSize(site, size);
  const emailX = R - emailW;
  const siteX = emailX - sepW - siteW;
  text(c, site, siteX, 13, size, { color: GOLD });
  text(c, sep, siteX + siteW, 13, size, { color: rgb(0.55, 0.58, 0.66) });
  text(c, brand.contactEmail, emailX, 13, size, { color: GOLD });
  const link = (x: number, w: number, uri: string) =>
    page.node.addAnnot(
      doc.context.register(
        doc.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [x, 9, x + w, 24],
          Border: [0, 0, 0],
          A: { Type: "Action", S: "URI", URI: PDFString.of(uri) },
        }),
      ),
    );
  link(siteX, siteW, brand.website);
  link(emailX, emailW, `mailto:${brand.contactEmail}`);

  return doc.save();
}
