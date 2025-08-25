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

// thêm hàm mới
export async function fetchFbUrls({ sheetId, gid }) {
  const rows = await fetchSheetRows({ sheetId, gid });

  const pick = (r) =>
    r.url || r.fb || r.fb_url || r.post || r.link || r.col0 || r.col1 || "";

  const out = [];
  for (const r of rows) {
    String(pick(r))
      .split(/[\n,;|]/)
      .map((s) => s.trim())
      .filter((s) =>
        /^(https?:\/\/)?((m|www)\.)?(facebook\.com|fb\.watch)\//i.test(s)
      )
      .forEach((s) => out.push(s));
  }
  return [...new Set(out)];
}

// Bổ sung dưới đây

const csvToRows = (csv) => {
  const lines = csv.trim().split(/\r?\n/);
  const head = lines.shift().split(",").map(s=>s.trim());
  return lines.map(line=>{
    const cols = line.split(","); // dữ liệu thuần, không có dấu phẩy trong ô
    const o = {};
    head.forEach((h,i)=>o[h.trim()] = (cols[i]??"").trim());
    return o;
  });
};

export async function fetchTabAsObjects({ sheetId, gid }) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  const text = await res.text();
  const rows = csvToRows(text);
  return rows;
}

/* ======= MAPPERS ======= */
export const mapCategories = (rows) =>
  rows
    .filter(r => r.key)
    .map(r => ({ key: r.key, title: r.title || r.key }));

export const mapTags = (rows) =>
  rows
    .filter(r => r.id || r.label)
    .map(r => ({ id: r.id || (r.label||"").toLowerCase().replace(/\s+/g,'-'), label: r.label || r.id }));

// sizes: "6|Size 6,7|Size 7"
const parseSizes = (s="") =>
  s.split(/\s*,\s*/).filter(Boolean).map(x=>{
    const [key,label] = x.split("|");
    return { key: (key||"").trim(), label: (label||key||"").trim() };
  });

export const mapSchemes = (rows) =>
  rows.filter(r=>r.id).map(r=>({
    id: r.id,
    name: r.name || r.id,
    sizes: parseSizes(r.sizes||""),
  }));

export const mapTypes = (rows) =>
  rows.filter(r=>r.id).map(r=>({
    id: r.id,
    name: r.name || r.id,
    schemeId: r.schemeId || r.scheme || "",
  }));

// prices: "6:290000,7:350000"
const parsePrices = (s="") => Object.fromEntries(
  s.split(/\s*,\s*/).filter(Boolean).map(p=>{
    const [k,v] = p.split(":");
    return [(k||"").trim(), Number(v||0)];
  })
);
export const mapLevels = (rows) =>
  rows.filter(r=>r.id).map(r=>({
    id: r.id,
    name: r.name || r.id,
    schemeId: r.schemeId || r.scheme || "",
    prices: parsePrices(r.prices||""),
  }));

export const mapPages = (rows) =>
  rows.filter(r=>r.key).map(r=>({
    key: r.key,
    title: r.title || r.key,
    body: r.body || "",
  }));

// menu: key, label, parent(optional), order(optional number)
export const mapMenu = (rows) => {
  const items = rows.filter(r=>r.key).map(r=>({
    key: r.key,
    title: r.label || r.title || r.key,
    parent: r.parent || "",
    order: Number(r.order||0),
  }));
  const byKey = Object.fromEntries(items.map(i=>[i.key,{...i,children:[]}]));
  const roots = [];
  items.forEach(i=>{
    if (i.parent && byKey[i.parent]) byKey[i.parent].children.push(byKey[i.key]);
    else roots.push(byKey[i.key]);
  });
  const sortTree = (nodes)=>{ nodes.sort((a,b)=>a.order-b.order); nodes.forEach(n=>sortTree(n.children)); };
  sortTree(roots);
  // bỏ các field phụ
  const clean = (n)=>({ key:n.key, title:n.title, children: n.children.map(clean) });
  return roots.map(clean);
};

