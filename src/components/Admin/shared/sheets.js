// Google Sheet client: read + write (form-urlencoded to avoid CORS preflight)
const WEBAPP =
  (typeof localStorage !== "undefined" && localStorage.getItem("https://script.google.com/macros/s/AKfycbzAzNNjpUS7xXTEpO1MNDSe5LOVVOU9RemBp89qbBnytc5Dm5Hdwq2u2aAfpVk1gEU15Q/exec")) ||
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_GS_WEBAPP_URL) ||
  "";

export function setWebAppUrl(u) {
  try { localStorage.setItem("GS_WEBAPP_URL", u || ""); } catch {}
}

const withTimeout = (p, ms = 12000) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

export async function listSheet(kind) {
  if (!WEBAPP) return { ok: false, rows: [], version: "" };
  const r = await withTimeout(fetch(`${WEBAPP}?kind=${encodeURIComponent(kind)}&t=${Date.now()}`), 12000)
    .catch(() => null);
  if (!r) return { ok: false, rows: [], version: "" };
  const data = await r.json().catch(() => ({}));
  return { ok: !!r.ok, rows: Array.isArray(data.rows) ? data.rows : [], version: String(data.version ?? "") };
}

async function post(op, kind, payload = {}) {
  if (!WEBAPP) return { ok: false, error: "WEBAPP_URL empty" };
  const form = new URLSearchParams();
  form.set("op", op);
  form.set("kind", kind);
  if (payload.id) form.set("id", String(payload.id));
  form.set("row", JSON.stringify(payload));
  const r = await withTimeout(fetch(WEBAPP, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: form.toString(),
  }), 12000).catch(() => null);
  if (!r) return { ok: false };
  const data = await r.json().catch(() => ({}));
  return { ok: !!r.ok, ...data };
}

export const insertToSheet = (kind, row)   => post("insert", kind, row);
export const updateToSheet = (kind, row)   => post("update", kind, row);
export const deleteFromSheet = (kind, id)  => post("delete", kind, { id });
