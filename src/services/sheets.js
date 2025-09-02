// src/services/sheets.js

/* -------------------- Fetch helpers -------------------- */

// gviz JSON (good for general tabs)
export async function fetchSheetRows({ sheetId, gid = "0" }) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${gid}&t=${Date.now()}`;
  const txt = await fetch(url, { cache: "no-store" }).then((r) => r.text());
  const json = JSON.parse(txt.substring(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
  const cols = json.table.cols.map((c) => (c.label || "").trim().toLowerCase());
  return (json.table.rows || []).map((r) =>
    Object.fromEntries(
      (r.c || []).map((cell, i) => [cols[i] || `col${i}`, cell?.v != null ? String(cell.v) : ""])
    )
  );
}

// Robust CSV → rows (supports quoted commas/newlines)
function parseCSV(text = "") {
  const out = [];
  let row = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nx = text[i + 1];

    if (inQ) {
      if (ch === '"' && nx === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      out.push(row);
      row = [];
      cur = "";
    } else if (ch === "\r") {
      // skip
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  out.push(row);
  return out;
}

// CSV export (good for tabs where cells may contain commas)
export async function fetchTabAsObjects({ sheetId, gid }) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}&t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();

  const rows = parseCSV(text.replace(/^\uFEFF/, "")); // strip BOM if any
  const head = (rows.shift() || []).map((s) => String(s || "").trim().toLowerCase());
  return rows
    .filter((r) => r.some((x) => String(x || "").trim() !== ""))
    .map((r) =>
      Object.fromEntries(head.map((h, i) => [h, String(r[i] ?? "").trim()]))
    );
}

/* -------------------- FB URLs -------------------- */

export async function fetchFbUrls({ sheetId, gid }) {
  const rows = await fetchTabAsObjects({ sheetId, gid });
  const pick = (r) => r.url || r.fb || r.fb_url || r.post || r.link || r.col0 || r.col1 || "";
  const out = [];
  for (const r of rows) {
    String(pick(r))
      .split(/[\n,;|]/)
      .map((s) => s.trim())
      .filter((s) => /^(https?:\/\/)?((m|www)\.)?(facebook\.com|fb\.watch)\//i.test(s))
      .forEach((s) => out.push(s));
  }
  return [...new Set(out)];
}

/* -------------------- Image URL normalizer -------------------- */

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

  const base = (import.meta.env.VITE_IMAGE_BASE || "/images/").replace(/\/+$/, "") + "/";
  return encodeURI(base + s.replace(/^\/+/, ""));
}

/* -------------------- Parsers -------------------- */

// simple list: "6;7;8" or "6, 7, 8" or "6|7"
export function parseSizesCell(cell) {
  return String(cell ?? "")
    .split(/[,;/|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// pairs: '6|Size 6;7|Size 7'
function parseSizesPairs(s = "") {
  return String(s)
    .split(/[\n;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [key, label] = x.split("|");
      return { key: (key || "").trim(), label: (label || key || "").trim() };
    });
}

// prices: "6:290000;7:350000"
function parsePrices(s = "") {
  return Object.fromEntries(
    String(s)
      .split(/[,;]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const [k, v] = x.split(":");
        return [(k || "").trim(), Number(v || 0)];
      })
  );
}

/* -------------------- Mappers (Sheets → App) -------------------- */

// Products (allow per-product sizes override)
export function mapProducts(rows = [], imageIndex) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const parseImages = (s) =>
    String(s || "")
      .split(/\s*[|,\n]\s*/)
      .filter(Boolean)
      .map(normalizeImageUrl);

  const byName = (name) => {
    if (!imageIndex) return [];
    const k = norm(name);
    const exact = imageIndex.map.get(k) || [];
    if (exact.length) return exact;
    const pref = [...imageIndex.map.keys()].filter(
      (x) => x.startsWith(k + " ") || x.startsWith(k + "-")
    );
    return pref.flatMap((x) => imageIndex.map.get(x) || []);
  };

  return rows
    .map((r) => {
      let images = parseImages(r.images);
      if (!images.length && r.name) images = byName(r.name);

      const price = Number(String(r.price || "").replace(/[^\d.]/g, "")) || 0;
      const banner = /^(1|true|yes|x)$/i.test(r.banner || "");
      const sizes = parseSizesCell(r.sizes ?? r.size ?? r.Sizes ?? r.Size); // per-product override

      return {
        id: r.id || (crypto.randomUUID?.() || String(Date.now() + Math.random())),
        name: r.name || "",
        category: String(r.category || "").trim(),
        typeId: r.typeid || r.type || "",
        images,
        banner,
        tags: String(r.tags || "").split(/\s*,\s*/).filter(Boolean),
        price,
        sizes, // <= optional override
      };
    })
    .filter((p) => p.name);
}

export const mapCategories = (rows = []) =>
  rows
    .filter((r) => r.key)
    .map((r) => ({ key: r.key, title: r.title || r.key }));

export const mapTags = (rows = []) =>
  rows
    .filter((r) => r.id || r.label)
    .map((r) => ({
      id: r.id || (r.label || "").toLowerCase().replace(/\s+/g, "-"),
      label: r.label || r.id,
    }));

// Levels (keep both fields for compatibility: schemeId OR typeId)
export const mapLevels = (rows = []) =>
  rows
    .filter((r) => r.id)
    .map((r) => ({
      id: r.id,
      name: r.name || r.id,
      // prefer typeId; fall back to schemeId (legacy)
      typeId: r.typeid || r.type || r.schemeid || r.scheme || "",
      prices: parsePrices(r.prices || ""),
    }));

export const mapPages = (rows = []) =>
  rows
    .filter((r) => r.key)
    .map((r) => ({ key: r.key, title: r.title || r.key, body: r.body || "" }));

// Menu: key,label,parent,order
export const mapMenu = (rows = []) => {
  const items = rows
    .filter((r) => r.key)
    .map((r) => ({
      key: r.key,
      title: r.label || r.title || r.key,
      parent: r.parent || "",
      order: Number(r.order || 0),
    }));

  const byKey = Object.fromEntries(items.map((i) => [i.key, { ...i, children: [] }]));
  const roots = [];
  items.forEach((i) => {
    if (i.parent && byKey[i.parent]) byKey[i.parent].children.push(byKey[i.key]);
    else roots.push(byKey[i.key]);
  });

  const sortTree = (nodes) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);

  const clean = (n) => ({ key: n.key, title: n.title, children: n.children.map(clean) });
  return roots.map(clean);
};

/* -------------------- Types (sizes merged) -------------------- */

export function mapTypes(rows = []) {
  return rows
    .filter((r) => r.id || r.key)
    .map((r) => ({
      id: String(r.id ?? r.key).trim(),
      name: String(r.name ?? r.title ?? r.id).trim(),
      sizes: parseSizesPairs(r.sizes || ""), // [{key,label}]
      order: Number(r.order || 0),
    }))
    .sort((a, b) => a.order - b.order);
}

// Sizes for a product (product.sizes overrides type.sizes)
export function sizesForProduct(product, types = [], _ignored) {
  const t = types.find((x) => x.id === product?.typeId);
  const typeSizes = t?.sizes || [];
  if (product?.sizes?.length) {
    const set = new Set(product.sizes.map(String));
    return typeSizes.filter((sz) => set.has(String(sz.key)));
  }
  return typeSizes;
}

/* -------------------- Back-compat (optional) -------------------- */
// If some old code still imports mapSchemes, keep a thin adapter.
// You can delete this once the app no longer references “schemes”.
export function mapSchemes(rows = []) {
  return rows
    .filter((r) => r.id || r.key)
    .map((r) => ({
      id: String(r.id ?? r.key).trim(),
      name: String(r.name ?? r.title ?? r.id).trim(),
      sizes: parseSizesPairs(r.sizes || ""),
    }));
}
