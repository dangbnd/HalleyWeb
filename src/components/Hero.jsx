import { useEffect, useMemo, useRef, useState } from "react";
import { getImageUrl } from "./ProductImage.jsx";
import FbPost from "./FbPost.jsx";
import { DATA } from "../data.js";

/* Thẻ FB tự co theo ô chứa */
function FbCard({ url, className = "" }) {
  const ref = useRef(null);
  const [h, setH] = useState(220);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => {
      setH(Math.max(140, Math.floor(ref.current.clientHeight - 16)));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  if (!url) return null;
  return (
    <div ref={ref} className={"rounded-2xl border bg-white p-2 overflow-hidden " + className}>
      <FbPost url={url} height={h} />
    </div>
  );
}

export function Hero({ products = [], interval = 2000 }) {
  const slides = useMemo(
    () =>
      (products || [])
        .filter((p) => p?.banner)
        .map((p) => ({ id: p.id, src: getImageUrl(p, 0) || getImageUrl(p, 1), alt: p.name || "" }))
        .filter((s) => !!s.src),
    [products]
  );
  const n = slides.length;
  const view = n > 1 ? [slides[n - 1], ...slides, slides[0]] : slides;
  const [i, setI] = useState(n > 1 ? 1 : 0);
  const [anim, setAnim] = useState(true);
  const [pause, setPause] = useState(false);
  useEffect(() => { setI(n > 1 ? 1 : 0); setAnim(true); }, [n]);
  useEffect(() => {
    if (pause || n <= 1) return;
    const t = setInterval(() => setI((x) => x + 1), interval);
    return () => clearInterval(t);
  }, [pause, n, interval]);
  const onEnd = () => {
    if (n <= 1) return;
    if (i === n + 1) { setAnim(false); setI(1); requestAnimationFrame(() => setAnim(true)); }
    else if (i === 0) { setAnim(false); setI(n); requestAnimationFrame(() => setAnim(true)); }
  };
  const go = (to) => { setAnim(true); setI(to); };
  const next = () => go(i + 1);
  const prev = () => go(i - 1);
  const cur = n ? ((i - 1 + n) % n) : 0;

  const fbUrl = (DATA.social?.fbPost || "").trim() || null;

  return (
    <section className="max-w-6xl mx-auto p-4">
      <div className="grid gap-4 md:grid-cols-[1fr_320px] items-stretch">
        {/* SLIDE */}
        <div
          className="relative rounded-3xl border overflow-hidden bg-neutral-50 md:h-[520px]"
          onMouseEnter={() => setPause(true)}
          onMouseLeave={() => setPause(false)}
        >
          <div className="relative aspect-[4/5] md:aspect-auto md:h-full">
            {n === 0 && (
              <div className="grid place-items-center w-full h-full text-sm text-gray-500">
                Chưa có ảnh banner
              </div>
            )}
            {n > 0 && (
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className="h-full flex"
                  style={{ transform: `translateX(-${i * 100}%)`, transition: anim ? "transform 500ms ease" : "none" }}
                  onTransitionEnd={onEnd}
                >
                  {view.map((s, idx) => (
                    <div key={`${s.id}-${idx}`} className="w-full h-full shrink-0 basis-full">
                      <img src={s.src} alt={s.alt} className="w-full h-full object-cover" draggable={false} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {n > 1 && (
              <>
                <button aria-label="Prev" onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center h-10 w-10 rounded-full bg-white/90 ring-1 ring-gray-200 hover:bg-white shadow">‹</button>
                <button aria-label="Next" onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center h-10 w-10 rounded-full bg-white/90 ring-1 ring-gray-200 hover:bg-white shadow">›</button>
              </>
            )}
          </div>
        </div>

        {/* 1 BÀI FB – desktop chung khung với slide */}
        {fbUrl && <FbCard url={fbUrl} className="hidden md:block md:h-[520px]" />}
      </div>

      {/* Mobile: bài FB nằm dưới slide, gọn */}
      {fbUrl && (
        <div className="mt-4 md:hidden">
          <FbCard url={fbUrl} className="h-[200px]" />
        </div>
      )}

      {/* Dots */}
      {n > 0 && (
        <div className="mt-3 flex justify-center gap-2">
          {slides.map((_, di) => (
            <button
              key={di}
              onClick={() => go(di + 1)}
              aria-label={`slide ${di + 1}`}
              className={`h-2.5 w-2.5 rounded-full ${di === cur ? "bg-gray-800" : "bg-gray-300 hover:bg-gray-400"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
