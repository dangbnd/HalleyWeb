import { useState, useEffect, useMemo } from "react";
import { LS, readLS, writeLS } from "./utils.js";
import { DATA } from "./data.js";

import { Header } from "./components/Header.jsx";
import { Footer } from "./components/Footer.jsx";
import { Hero } from "./components/Hero.jsx";
import CategoryBar from "./components/CategoryBar.jsx";
import Filters from "./components/Filters.jsx";
import FilterSheet from "./components/FilterSheet.jsx";
import { ProductList } from "./components/ProductList.jsx";
import { PageViewer } from "./components/PageViewer.jsx";
import Login from "./components/Admin/Login.jsx";
import Admin from "./components/Admin/index.jsx";

import { fetchSheetRows, mapProducts } from "./services/sheets.js";
import { fetchAllDriveImagesDeep, buildImageMap } from "./services/drive.js";

export default function App() {
  const [route, setRoute] = useState("home");
  const [q, setQ] = useState("");
  const [filterState, setFilterState] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [user, setUser] = useState(() => readLS(LS.AUTH, null));
  const [products, setProducts] = useState(() =>
    readLS(LS.PRODUCTS, DATA.products || [])
  );
  const [categories, setCategories] = useState(() =>
    readLS(LS.CATEGORIES, DATA.categories || [])
  );
  const [menu, setMenu] = useState(() => readLS(LS.MENU, DATA.nav || []));
  const [pages, setPages] = useState(() => readLS(LS.PAGES, DATA.pages || []));
  const [tags, setTags] = useState(() => readLS(LS.TAGS, DATA.tags || []));

  const SHEET = {
    id: import.meta.env.VITE_SHEET_ID,
    gid: import.meta.env.VITE_SHEET_GID || "0",
  };
  const DRIVE = {
    folderId: import.meta.env.VITE_DRIVE_FOLDER_ID,
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  };
  const SYNC_MS = Number(import.meta.env.VITE_SYNC_INTERVAL_MS || 600000);

  // persist
  useEffect(() => writeLS(LS.AUTH, user), [user]);
  useEffect(() => writeLS(LS.PRODUCTS, products), [products]);
  useEffect(() => writeLS(LS.CATEGORIES, categories), [categories]);
  useEffect(() => writeLS(LS.MENU, menu), [menu]);
  useEffect(() => writeLS(LS.PAGES, pages), [pages]);
  useEffect(() => writeLS(LS.TAGS, tags), [tags]);

  // điều hướng auto: q => search/home
  useEffect(() => {
    if (route === "admin") return;
    const has = q.trim().length > 0;
    if (has && route !== "search") setRoute("search");
    if (!has && route === "search") setRoute("home");
  }, [q, route]);

  const norm = (s = "") =>
    s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // ---------- Đồng bộ Sheets + Drive ----------
  useEffect(() => {
    async function syncAll() {
      const [rows, files] = await Promise.all([
        fetchSheetRows({ sheetId: SHEET.id, gid: SHEET.gid }),
        fetchAllDriveImagesDeep(DRIVE),
      ]);
      const imageIndex = buildImageMap(files);
      const fromSheet = mapProducts(rows, imageIndex);
      if (fromSheet?.length) {
        setProducts(fromSheet);
        writeLS(LS.PRODUCTS, fromSheet);

        // cập nhật category nếu thiếu
        const cats = [...new Set(fromSheet.map((p) => p.category).filter(Boolean))];
        if (cats.length) {
          const existed = new Set((categories || []).map((c) => c.key));
          const add = cats.filter((k) => !existed.has(k)).map((k) => ({ key: k, title: k }));
          if (add.length) {
            const next = [...(categories || []), ...add];
            setCategories(next);
            writeLS(LS.CATEGORIES, next);
          }
        }
      }
    }
    if (SHEET.id) {
      syncAll();
      const t = setInterval(syncAll, SYNC_MS);
      return () => clearInterval(t);
    }
  }, [SHEET.id, SHEET.gid, DRIVE.folderId, DRIVE.apiKey, SYNC_MS]); // eslint-disable-line

  // ---------- Gợi ý tìm kiếm ----------
  const suggestions = useMemo(() => {
    const query = q.trim();
    if (!query) return [];
    const nq = norm(query);
    const top = (arr, n) => arr.slice(0, n);

    const prod = top(
      (products || [])
        .filter((p) => norm(p.name).includes(nq))
        .map((p) => ({ type: "sản phẩm", label: p.name, id: p.id })),
      5
    );
    const cat = top(
      (categories || [])
        .filter((c) => norm(c.title || c.key).includes(nq))
        .map((c) => ({ type: "danh mục", label: c.title || c.key, key: c.key })),
      5
    );
    const tgs = top(
      (tags || [])
        .filter((t) => norm(t.label).includes(nq))
        .map((t) => ({ type: "tag", label: `#${t.label}`, id: t.id })),
      5
    );
    return [...cat, ...prod, ...tgs].slice(0, 10);
  }, [q, products, categories, tags]);

  function handleSuggestionSelect(s) {
    if (s.type === "danh mục" && s.key) {
      setRoute(s.key);
      setQ("");
      return;
    }
    setQ(s.label.replace(/^#/, ""));
    setRoute("search");
  }

  // ---------- Các danh sách dẫn xuất (TOP-LEVEL, không trong if) ----------
  const nq = useMemo(() => norm(q), [q]);

  const catTitle = useMemo(
    () =>
      Object.fromEntries((categories || []).map((c) => [c.key, norm(c.title || c.key)])),
    [categories]
  );

  // Kết quả cho route=search
  const listForSearch = useMemo(() => {
    if (!nq) return products || [];
    return (products || []).filter((p) => {
      const name = norm(p.name);
      const tg = (p.tags || []).map((t) => norm(t)).join(" ");
      const cat = catTitle[p.category] || "";
      return name.includes(nq) || tg.includes(nq) || cat.includes(nq);
    });
  }, [nq, products, catTitle]);

  // Sản phẩm cơ sở theo route hiện tại (home hoặc theo category)
  const baseForRoute = useMemo(() => {
    if (route === "home" || route === "search") return products || [];
    return (products || []).filter((p) => p.category === route);
  }, [route, products]);

  // Áp bộ lọc cho route ≠ search
  const filteredForRoute = useMemo(() => {
    if (!filterState || route === "search") return baseForRoute;

    const {
      price = [0, Number.MAX_SAFE_INTEGER],
      tags: tagSet,
      sizes: sizeSet,
      levels: levelSet,
      featured,
      inStock,
      sort,
    } = filterState;

    const [min, max] = price;

    const tagId = (t) =>
      typeof t === "string"
        ? t
        : (t?.id ?? t?.key ?? t?.value ?? t?.label ?? JSON.stringify(t));

    let out = (baseForRoute || []).filter((p) => {
      const priceOk = (Number(p.price) || 0) >= min && (Number(p.price) || 0) <= max;
      const pTagIds = (p.tags || []).map(tagId).map(String);
      const tagOk = !tagSet?.size || pTagIds.some((id) => tagSet.has(String(id)));
      const sizeOk = !sizeSet?.size || (p.sizes || []).some((s) => sizeSet.has(String(s)));
      const lvlOk = !levelSet?.size || (p.level && levelSet.has(String(p.level)));
      const featOk = !featured || !!p.banner;
      const stockOk = !inStock || p.inStock !== false;
      return priceOk && tagOk && sizeOk && lvlOk && featOk && stockOk;
    });

    if (sort === "price-asc") out.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === "price-desc") out.sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sort === "newest") out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (sort === "popular") out.sort((a, b) => (b.popular || 0) - (a.popular || 0));

    return out;
  }, [filterState, baseForRoute, route]);

  // ---------- Render ----------
  const customPage = useMemo(() => (pages || []).find((p) => p.key === route), [pages, route]);

  let mainContent = null;

  if (route === "admin") {
    mainContent = user ? (
      <Admin
        user={user}
        setUser={setUser}
        products={products}
        setProducts={setProducts}
        categories={categories}
        setCategories={setCategories}
        menu={menu}
        setMenu={setMenu}
        pages={pages}
        setPages={setPages}
        onNavigate={setRoute}
      />
    ) : (
      <Login onLogin={(u) => setUser(u)} />
    );
  } else if (customPage) {
    mainContent = <PageViewer page={customPage} />;
  } else if (route === "search") {
    const list = listForSearch;
    mainContent = (
      <>
        <section className="max-w-6xl mx-auto p-4">
          <h2 className="text-xl font-semibold mb-2">
            {nq ? `Kết quả cho “${q}”` : "Tất cả sản phẩm"}
          </h2>
          <div className="text-sm text-gray-600 mb-3">{list.length} sản phẩm</div>
        </section>
        <ProductList products={list} />
      </>
    );
  } else {
    const list = filteredForRoute;
    mainContent = (
      <>
        {route === "home" && <Hero products={products} interval={2000} />}

        <CategoryBar
          categories={categories}
          currentKey={route}
          onPick={setRoute}
          /* maxVisible sẽ được CategoryBar tự tính theo độ rộng (đừng fix cứng ở đây) */
          sticky={false}
          onOpenFilters={() => setFiltersOpen(true)}
          showFilterButton
        />

        <section className="max-w-6xl mx-auto p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">{list.length} sản phẩm</div>
            <button
              className="md:hidden rounded-full border px-3 py-1 text-sm"
              onClick={() => setFiltersOpen(true)}
            >
              Lọc
            </button>
          </div>
          <ProductList products={list} />
        </section>

        <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Bộ lọc">
          <Filters products={baseForRoute} tags={tags} onChange={setFilterState} />
        </FilterSheet>
      </>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header
        currentKey={route}
        navItems={menu}
        onNavigate={setRoute}
        logoText={DATA.logoText}
        hotline={DATA.hotline}
        searchQuery={q}
        onSearchChange={setQ}
        onSearchSubmit={(qq) => setRoute(qq.trim() ? "search" : "home")}
        suggestions={suggestions}
        onSuggestionSelect={handleSuggestionSelect}
      />
      <main>{mainContent}</main>
      <Footer data={DATA.footer} />
    </div>
  );
}
