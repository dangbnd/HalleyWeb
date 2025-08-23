import { useEffect, useMemo, useState } from "react";

export default function Filters({ products = [], tags = [], onChange, className = "" }) {
  // ---- chuẩn hóa TAG ----
  const normTag = t => {
    if (typeof t === "string") return { id: t, label: t };
    const id = t?.id ?? t?.key ?? t?.value ?? t?.label ?? JSON.stringify(t);
    const label = t?.label ?? t?.name ?? String(id);
    return { id: String(id), label: String(label) };
  };
  const allTags = useMemo(() => (tags || []).map(normTag), [tags]);

  // ---- khoảng giá tự động từ data ----
  const [priceMin, priceMax] = useMemo(() => {
    if (!products.length) return [0, 0];
    let min = Infinity, max = 0;
    for (const p of products) {
      const v = Number(p.price) || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return [min === Infinity ? 0 : min, max];
  }, [products]);

  const [minV, setMinV] = useState(priceMin);
  const [maxV, setMaxV] = useState(priceMax);
  useEffect(() => { setMinV(priceMin); setMaxV(priceMax); }, [priceMin, priceMax]);

  // ---- facet states ----
  const [qTag, setQTag] = useState("");
  const [tagSet, setTagSet] = useState(new Set());
  const [sizeSet, setSizeSet] = useState(new Set());
  const [lvlSet, setLvlSet] = useState(new Set());
  const [featured, setFeatured] = useState(false);
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState("");

  // phát filter ra ngoài
  useEffect(() => {
    onChange?.({ price: [minV, maxV], tags: tagSet, sizes: sizeSet, levels: lvlSet, featured, inStock, sort });
  }, [minV, maxV, tagSet, sizeSet, lvlSet, featured, inStock, sort, onChange]);

  // size/level từ data
  const allSizes = useMemo(() => {
    const s = new Set();
    for (const p of products) (p.sizes || []).forEach(x => s.add(String(x)));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
  }, [products]);

  const allLevels = useMemo(() => {
    const s = new Set();
    for (const p of products) if (p.level) s.add(String(p.level));
    return Array.from(s).sort();
  }, [products]);

  const filteredTags = useMemo(() => {
    const k = qTag.trim().toLowerCase();
    if (!k) return allTags;
    return allTags.filter(x => x.label.toLowerCase().includes(k));
  }, [allTags, qTag]);

  const fmt = v => new Intl.NumberFormat("vi-VN").format(v);

  return (
    <aside className={`bg-white ${className}`}>
      {/* KHOẢNG GIÁ */}
      <div className="mb-4">
        <div className="mb-1 text-sm font-medium">Khoảng giá</div>
        <div className="flex items-center gap-2">
          <input type="number" className="w-28 rounded border px-2 py-1 text-sm"
            value={minV} onChange={e => setMinV(Math.min(Number(e.target.value || 0), maxV))} />
          <span className="text-xs">đến</span>
          <input type="number" className="w-28 rounded border px-2 py-1 text-sm"
            value={maxV} onChange={e => setMaxV(Math.max(Number(e.target.value || 0), minV))} />
        </div>
        {/* hai range chồng nhau */}
        <div className="mt-2 relative h-6">
          <input type="range" min={priceMin} max={priceMax} step="1000"
            value={minV} onChange={e => setMinV(Math.min(Number(e.target.value), maxV))}
            className="absolute inset-x-0 w-full" />
          <input type="range" min={priceMin} max={priceMax} step="1000"
            value={maxV} onChange={e => setMaxV(Math.max(Number(e.target.value), minV))}
            className="absolute inset-x-0 w-full" />
        </div>
        <div className="mt-1 text-xs text-gray-600">Từ {fmt(minV)}đ đến {fmt(maxV)}đ</div>
      </div>

      {/* TAG */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium">Tag</div>
          <input value={qTag} onChange={e => setQTag(e.target.value)}
                 placeholder="Tìm tag…" className="rounded border px-2 py-1 text-xs" />
        </div>
        <div className="max-h-40 overflow-auto grid grid-cols-2 gap-1">
          {filteredTags.map(x => {
            const on = tagSet.has(x.id);
            return (
              <button key={x.id}
                onClick={() => {
                  const s = new Set(tagSet); on ? s.delete(x.id) : s.add(x.id); setTagSet(s);
                }}
                className={`text-left px-2 py-1 rounded border text-xs ${on ? "bg-gray-100 border-gray-400" : "border-gray-200"}`}
              >{x.label}</button>
            );
          })}
        </div>
      </div>

      {/* SIZE */}
      {!!allSizes.length && (
        <div className="mb-4">
          <div className="text-sm font-medium mb-1">Size</div>
          <div className="flex flex-wrap gap-1">
            {allSizes.map(s => {
              const on = sizeSet.has(s);
              return (
                <button key={s}
                  onClick={() => { const t = new Set(sizeSet); on ? t.delete(s) : t.add(s); setSizeSet(t); }}
                  className={`px-2 py-1 rounded-full border text-xs ${on ? "bg-gray-100 border-gray-400" : "border-gray-200"}`}
                >{s}</button>
              );
            })}
          </div>
        </div>
      )}

      {/* LEVEL GIÁ */}
      {!!allLevels.length && (
        <div className="mb-4">
          <div className="text-sm font-medium mb-1">Level giá</div>
          <div className="flex flex-wrap gap-1">
            {allLevels.map(l => {
              const on = lvlSet.has(l);
              return (
                <button key={l}
                  onClick={() => { const t = new Set(lvlSet); on ? t.delete(l) : t.add(l); setLvlSet(t); }}
                  className={`px-2 py-1 rounded-full border text-xs ${on ? "bg-gray-100 border-gray-400" : "border-gray-200"}`}
                >{l}</button>
              );
            })}
          </div>
        </div>
      )}

      {/* CỜ */}
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} /> Nổi bật/Banner
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={inStock} onChange={e => setInStock(e.target.checked)} /> Còn hàng
        </label>
      </div>

      {/* SẮP XẾP */}
      <div className="mb-2">
        <div className="text-sm font-medium mb-1">Sắp xếp</div>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="w-full rounded border px-2 py-1 text-sm">
          <option value="">Mặc định</option>
          <option value="price-asc">Giá tăng dần</option>
          <option value="price-desc">Giá giảm dần</option>
          <option value="newest">Mới nhất</option>
          <option value="popular">Phổ biến</option>
        </select>
      </div>

      {/* RESET */}
      <button
        className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
        onClick={() => {
          setMinV(priceMin); setMaxV(priceMax);
          setTagSet(new Set()); setSizeSet(new Set()); setLvlSet(new Set());
          setFeatured(false); setInStock(false); setSort(""); setQTag("");
        }}
      >Xóa bộ lọc</button>
    </aside>
  );
}
