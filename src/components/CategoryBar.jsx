import { useEffect, useMemo, useRef, useState } from "react";

function Chip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-1 rounded-full border text-sm whitespace-nowrap transition-colors " +
        (active ? "bg-gray-100 border-gray-400" : "hover:bg-gray-50")
      }
    >
      {children}
    </button>
  );
}

export default function CategoryBar({
  categories = [],
  currentKey,
  onPick,
  sticky = false,
  showFilterButton = false,
  onOpenFilters,
}) {
  const wrapRef = useRef(null);
  const railRef = useRef(null);
  const [hasLeft, setHasLeft] = useState(false);
  const [hasRight, setHasRight] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [q, setQ] = useState("");

  // cập nhật trạng thái mũi tên & fade
  const update = () => {
    const el = railRef.current;
    if (!el) return;
    setHasLeft(el.scrollLeft > 2);
    setHasRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    update();
    const el = railRef.current;
    if (!el) return;
    const onScroll = () => update();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  // cuộn mượt
  const scrollByX = (dx) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dx, behavior: "smooth" });
  };

  // lọc trong popover
  const norm = (s = "") =>
    s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = useMemo(
    () => categories.filter((c) => norm(c.title || c.key).includes(norm(q))),
    [categories, q]
  );

  const clsWrap =
    (sticky ? "sticky top-[64px] z-10 border-b " : "");

  return (
    <section className={clsWrap}>
      <div ref={wrapRef} className="relative max-w-6xl mx-auto px-4 py-3">
        {/* fade hai mép */}
        {hasLeft && (
          <div className="pointer-events-none absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-white to-transparent" />
        )}
        {hasRight && (
          <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent" />
        )}

        <div className="flex items-center gap-2">
          {/* nút trái */}
          <button
            aria-label="Cuộn trái"
            onClick={() => scrollByX(-240)}
            className={`hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
              hasLeft ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            ‹
          </button>

          {/* rail cuộn ngang */}
          <div
            ref={railRef}
            className="flex-1 min-w-0 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]"
            // kéo chuột ngang = cuộn
            onWheel={(e) => {
              if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
                railRef.current?.scrollBy({ left: e.deltaY, behavior: "auto" });
              }
            }}
          >
            <div className="flex items-center gap-2 pr-2">
              {categories.map((c) => (
                <Chip
                  key={c.key}
                  active={currentKey === c.key}
                  onClick={() => onPick?.(c.key)}
                >
                  {c.title || c.key}
                </Chip>
              ))}
            </div>
          </div>

          {/* nút phải */}
          <button
            aria-label="Cuộn phải"
            onClick={() => scrollByX(240)}
            className={`hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
              hasRight ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            ›
          </button>

          {/* nút mở All + Lọc */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAllOpen((v) => !v)}
              className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
              aria-label="Tất cả danh mục"
              title="Tất cả danh mục"
            >
              …
            </button>
            {showFilterButton && (
              <button
                onClick={onOpenFilters}
                className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
                aria-label="Mở bộ lọc"
              >
                Lọc
              </button>
            )}
          </div>
        </div>

        {/* Popover All */}
        {allOpen && (
          <div
            className="absolute right-4 mt-2 w-[min(90vw,28rem)] rounded-xl border bg-white shadow-lg p-3 z-20"
            onMouseLeave={() => setAllOpen(false)}
          >
            <div className="flex items-center gap-2 mb-2">
              <input
                placeholder="Tìm danh mục…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="flex-1 rounded-lg border px-3 py-2 text-sm"
              />
              <button
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => setAllOpen(false)}
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-auto pr-1">
              {filtered.map((c) => (
                <button
                  key={c.key}
                  onClick={() => {
                    onPick?.(c.key);
                    setAllOpen(false);
                    setQ("");
                  }}
                  className={
                    "text-left px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm " +
                    (currentKey === c.key ? "bg-gray-100 border-gray-400" : "")
                  }
                >
                  {c.title || c.key}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-sm text-gray-500 px-1 py-3 col-span-full">
                  Không có kết quả
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
