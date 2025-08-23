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

export function ProductList({ products = [] }) {
  return (
    <section className="max-w-6xl mx-auto p-4">
      <h2 className="text-xl font-semibold mb-3">Sản phẩm</h2>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => {
          const price = getPrice(p);
          return (
            <div key={p.id} data-testid={`product-${p.id}`} className="group border rounded-2xl p-3">
              <div className="relative aspect-square rounded-xl overflow-hidden mb-2">
                <ProductImage product={p} />
              </div>

              <div className="text-sm font-medium line-clamp-2">{p.name}</div>
              <div className="text-xs text-rose-700 font-semibold">{price != null ? VND.format(price) : "—"}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
