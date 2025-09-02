import ProductImage from "./ProductImage.jsx";

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function getPrice(p) {
  const tbl = p?.pricing?.table;
  if (Array.isArray(tbl) && tbl.length) {
    const nums = tbl.map((r) => Number(r.price)).filter((n) => Number.isFinite(n));
    if (nums.length) return Math.min(...nums);
  }
  const n = Number(p?.price);
  return Number.isFinite(n) ? n : null;
}

export function ProductList({ products = [], onImageClick }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
      {products.map((p) => (
        <article key={p.id} className="bg-white rounded-xl border overflow-hidden">
          <button
            className="relative block aspect-square w-full cursor-zoom-in"
            onClick={() => onImageClick?.(p)}
            aria-label={`Xem nhanh ${p.name}`}
          >
            <ProductImage product={p} className="absolute inset-0 w-full h-full object-cover" />
          </button>
          <div className="p-3">
            <div className="text-sm font-medium truncate">{p.name}</div>
            {p.price ? (
              <div className="text-rose-600 text-sm">
                {Number(p.price).toLocaleString("vi-VN")}₫
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
