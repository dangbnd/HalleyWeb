import { useState, useEffect, useMemo } from "react";
import { LS, readLS, writeLS } from "./utils.js";
import { DATA } from "./data.js";

 import Header from "./components/Header.jsx";
import { Footer } from "./components/Footer.jsx";
import { Hero } from "./components/Hero.jsx";
import CategoryBar from "./components/CategoryBar.jsx";
import Filters from "./components/Filters.jsx";
import FilterSheet from "./components/FilterSheet.jsx";
import { ProductList } from "./components/ProductList.jsx";
import { PageViewer } from "./components/PageViewer.jsx";
import Login from "./components/Admin/Login.jsx";
import Admin from "./components/Admin/index.jsx";

import {
  fetchSheetRows, fetchTabAsObjects, fetchFbUrls,
  mapProducts, mapCategories, mapTags, mapMenu, mapPages, mapTypes, mapSchemes, mapLevels
} from "./services/sheets.js";
import { fetchAllDriveImagesDeep, buildImageMap } from "./services/drive.js";

/* helpers */
const norm = (s = "") =>
  s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normFb = (u) => {
  try {
    const x = new URL(u);
    x.search = "";
    x.hash = "";
    return x.toString();
  } catch {
    return u;
  }
};

export default function App() {
  const [route, setRoute] = useState("home"); // 'home' | 'search' | pageKey | categoryKey
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState("all"); // 'all' | categoryKey
  const [filterState, setFilterState] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [user, setUser] = useState(() => readLS(LS.AUTH, null));
  const [fbUrls, setFbUrls] = useState(() => readLS(LS.FB_URLS, []));
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
    gids: {
    products: import.meta.env.VITE_SHEET_GID_PRODUCTS || import.meta.env.VITE_SHEET_GID || "0",
    categories: import.meta.env.VITE_SHEET_GID_CATEGORIES,
    tags: import.meta.env.VITE_SHEET_GID_TAGS,
    menu: import.meta.env.VITE_SHEET_GID_MENU,
    pages: import.meta.env.VITE_SHEET_GID_PAGES,
    types: import.meta.env.VITE_SHEET_GID_TYPES,
    schemes: import.meta.env.VITE_SHEET_GID_SCHEMES,
    levels: import.meta.env.VITE_SHEET_GID_LEVELS,
    },
  };
  const DRIVE = {
    folderId: import.meta.env.VITE_DRIVE_FOLDER_ID,
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  };
  const SYNC_MS = Number(import.meta.env.VITE_SYNC_INTERVAL_MS || 600000);

  /* persist */
  useEffect(() => writeLS(LS.AUTH, user), [user]);
  useEffect(() => writeLS(LS.PRODUCTS, products), [products]);
  useEffect(() => writeLS(LS.CATEGORIES, categories), [categories]);
  useEffect(() => writeLS(LS.MENU, menu), [menu]);
  useEffect(() => writeLS(LS.PAGES, pages), [pages]);
  useEffect(() => writeLS(LS.TAGS, tags), [tags]);
  useEffect(() => writeLS(LS.FB_URLS, fbUrls), [fbUrls]);

  /* FB urls */
  useEffect(() => {
    const SHEET_ID = import.meta.env.VITE_SHEET_ID;
    const FB_GID =
      import.meta.env.VITE_SHEET_FB_GID || import.meta.env.VITE_SHEET_GID_FB;
    if (!SHEET_ID || !FB_GID) return;
    (async () => {
      try {
        const urls = await fetchFbUrls({ sheetId: SHEET_ID, gid: FB_GID });
        setFbUrls([...new Set(urls.map(normFb))]);
      } catch (e) {
        console.error("load FB sheet fail:", e);
      }
    })();
  }, []);

  /* điều hướng auto theo ô tìm kiếm */
  useEffect(() => {
    if (route === "admin") return;
    const has = q.trim().length > 0;
    if (has && route !== "search") setRoute("search");
    if (!has && route === "search") setRoute(activeCat !== "all" ? activeCat : "home");
  }, [q, route, activeCat]);

  /* đồng bộ Sheets + Drive */
  useEffect(() => {
    async function syncAll() {
      const [prodRows, files] = await Promise.all([
        fetchSheetRows({ sheetId: SHEET.id, gid: SHEET.gids.products }),
        fetchAllDriveImagesDeep(DRIVE),
      ]);
      const imageIndex = buildImageMap(files);
      const fromSheet = mapProducts(prodRows, imageIndex);
      if (fromSheet?.length) {
        setProducts(fromSheet);
        writeLS(LS.PRODUCTS, fromSheet);
        const cats = [...new Set(fromSheet.map((p) => p.category).filter(Boolean))];
        if (cats.length) {
          const existed = new Set((categories || []).map((c) => c.key));
          const add = cats
            .filter((k) => !existed.has(k))
            .map((k) => ({ key: k, title: k }));
          if (add.length) {
            const next = [...(categories || []), ...add];
            setCategories(next);
            writeLS(LS.CATEGORIES, next);
          }
        }
      }
      // ---- Optional tabs (nếu có GID thì load) ----
      const loadOpt = async (gid, mapper, setter, lsKey) => {
        if (!gid) return;
        const rows = await fetchTabAsObjects({ sheetId: SHEET.id, gid });
        const mapped = mapper(rows);
        if (mapped?.length) { setter(mapped); writeLS(lsKey, mapped); }
      };
      await Promise.all([
        loadOpt(SHEET.gids.categories, mapCategories, setCategories, LS.CATEGORIES),
        loadOpt(SHEET.gids.tags,       mapTags,       setTags,       LS.TAGS),
        loadOpt(SHEET.gids.menu,       mapMenu,       setMenu,       LS.MENU),
        loadOpt(SHEET.gids.pages,      mapPages,      setPages,      LS.PAGES),
        loadOpt(SHEET.gids.types,      mapTypes,      (v)=>writeLS(LS.TYPES,v), LS.TYPES),
        loadOpt(SHEET.gids.schemes,    mapSchemes,    (v)=>writeLS(LS.SCHEMES,v), LS.SCHEMES),
        loadOpt(SHEET.gids.levels,     mapLevels,     (v)=>writeLS(LS.LEVELS,v), LS.LEVELS),
      ]);
    }
    if (SHEET.id) {
      syncAll();
      const t = setInterval(syncAll, SYNC_MS);
      return () => clearInterval(t);
    }
  }, [SHEET.id, SHEET.gid, DRIVE.folderId, DRIVE.apiKey, SYNC_MS]); // eslint-disable-line

  /* category helpers */
  const categoriesWithAll = useMemo(
    () => [{ key: "all", title: "Tất cả" }, ...(categories || [])],
    [categories]
  );
  const categoryKeys = useMemo(
    () => new Set((categories || []).map((c) => c.key)),
    [categories]
  );
  const currentKeyForBar =
    route === "search"
      ? activeCat
      : route === "home"
      ? "all"
      : route; // nếu đang xem theo danh mục

  function handlePickCategory(key) {
    if (key === "all") {
      setActiveCat("all");
      setRoute(q.trim() ? "search" : "home");
      return;
    }
    setActiveCat(key);
    if (q.trim() || route === "search") setRoute("search");
    else setRoute(key);
  }

  function navigate(key) {
    setRoute(key);
    if (key === "home") setActiveCat("all");
    else if (categoryKeys.has(key)) setActiveCat(key);
  }

  /* gợi ý */
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
      handlePickCategory(s.key);
      return;
    }
    setQ(s.label.replace(/^#/, ""));
    setRoute("search");
  }

  /* danh sách theo tìm kiếm */
  const nq = useMemo(() => norm(q), [q]);
  const catTitle = useMemo(
    () =>
      Object.fromEntries((categories || []).map((c) => [c.key, norm(c.title || c.key)])),
    [categories]
  );
  const listForSearch = useMemo(() => {
    const inCat =
      activeCat === "all"
        ? (products || [])
        : (products || []).filter((p) => p.category === activeCat);
    if (!nq) return inCat;
    return inCat.filter((p) => {
      const name = norm(p.name);
      const tg = (p.tags || []).map((t) => norm(t)).join(" ");
      const cat = catTitle[p.category] || "";
      return name.includes(nq) || tg.includes(nq) || cat.includes(nq);
    });
  }, [nq, products, activeCat, catTitle]);

  /* danh sách theo route khi không search */
  const baseForRoute = useMemo(() => {
    if (route === "home" || route === "search") return products || [];
    return (products || []).filter((p) => p.category === route);
  }, [route, products]);

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

  const customPage = useMemo(() => (pages || []).find((p) => p.key === route), [pages, route]);

  /* khối CategoryBar sticky dùng chung */
  const CatBar = (
    <div className="sticky top-[56px] md:top-[72px] z-30">
      <div className="max-w-6xl mx-auto p-4 bg-gray-50/90 supports-[backdrop-filter]:bg-gray-50/60 backdrop-blur border rounded-xl">
        <CategoryBar
          categories={categoriesWithAll}
          currentKey={currentKeyForBar}
          onPick={handlePickCategory}
          onOpenFilters={() => setFiltersOpen(true)}
          showFilterButton
        />
      </div>
    </div>
  );

  /* render */
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
        onNavigate={navigate}
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
        {CatBar}
        <section className="max-w-6xl mx-auto p-4">
          <h2 className="text-xl font-semibold mb-2">
            {activeCat === "all" ? "Tất cả" : categories.find((c) => c.key === activeCat)?.title || activeCat}
            {q.trim() ? ` · Kết quả cho “${q}”` : ""}
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
        {route === "home" && <Hero products={products} interval={2000} fbUrls={fbUrls} />}
        {CatBar}
        <section className="max-w-6xl mx-auto p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-gray-600">{list.length} sản phẩm</div>
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
        onNavigate={navigate}
        logoText={DATA.logoText}
        logoSrc={DATA.logoUrl}
        hotline={DATA.hotline}
        searchQuery={q}
        onSearchChange={setQ}
        onSearchSubmit={(qq) => setRoute(qq.trim() ? "search" : activeCat !== "all" ? activeCat : "home")}
        suggestions={suggestions}
        onSuggestionSelect={handleSuggestionSelect}
      />
      <main>{mainContent}</main>
      <Footer data={DATA.footer} />
    </div>
  );
}
