// src/services/sheets.js
export async function fetchSheetRows({ sheetId, gid = "0" }) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}&t=${Date.now()}`;
  const txt = await fetch(url, { cache: "no-store" }).then(r => r.text());
  const json = JSON.parse(txt.substring(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
  const cols = json.table.cols.map(c => (c.label || "").trim().toLowerCase());
  return (json.table.rows || []).map(r =>
    Object.fromEntries((r.c || []).map((cell, i) => [cols[i] || `col${i}`, cell?.v != null ? String(cell.v) : ""]))
  );
}

export function mapProducts(rows=[], imageIndex) {
  const norm = s => String(s||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();

  const parseImages = (s) =>
    String(s||"").split(/\s*[|,\n]\s*/).filter(Boolean).map(normalizeImageUrl);

  const byName = (name) => {
    if (!imageIndex) return [];
    const k = norm(name);
    const exact = imageIndex.map.get(k) || [];
    if (exact.length) return exact;
    // gom các file bắt đầu bằng tên (Tên - 1, Tên 1, ...)
    const pref = [...imageIndex.map.keys()]
      .filter(x => x.startsWith(k+" ") || x.startsWith(k+"-"));
    return pref.flatMap(x => imageIndex.map.get(x) || []);
  };

  return rows.map(r => {
    let images = parseImages(r.images);
    if (!images.length && r.name) images = byName(r.name);
    const price = Number(String(r.price||"").replace(/[^\d.]/g,""))||0;
    const banner = /^(1|true|yes|x)$/i.test(r.banner||"");
    return {
      id: r.id || (crypto.randomUUID?.() || String(Date.now()+Math.random())),
      name: r.name || "",
      category: r.category || "",
      typeId: r.typeid || "",
      images, banner,
      tags: String(r.tags||"").split(/\s*,\s*/).filter(Boolean),
      price
    };
  }).filter(p=>p.name);
}

export function normalizeImageUrl(u) {
  if (!u) return "";
  const s = String(u).trim();

  const m =
    s.match(/\/file\/d\/([A-Za-z0-9_-]+)/) ||
    s.match(/\/d\/([A-Za-z0-9_-]+)/) ||
    s.match(/[?&]id=([A-Za-z0-9_-]+)/) ||
    s.match(/uc\?id=([A-Za-z0-9_-]+)/);
  if (m) {
    const id = m[1];
    return `https://drive.google.com/thumbnail?id=${id}&sz=w2048`;
  }

  if (/^https?:\/\//i.test(s)) return s;

  const base = (import.meta.env.VITE_IMAGE_BASE || "/images/").replace(/\/+$/,"") + "/";
  return encodeURI(base + s.replace(/^\/+/, ""));
}

