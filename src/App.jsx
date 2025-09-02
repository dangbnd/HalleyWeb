// src/App.jsx
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
import ProductQuickView from "./components/ProductQuickView.jsx";
import { PageViewer } from "./components/PageViewer.jsx";
import Login from "./components/Admin/Login.jsx";
import Admin from "./components/Admin/index.jsx";

import {
  fetchSheetRows,
  fetchTabAsObjects,
  fetchFbUrls,
  mapProducts,
  mapCategories,
  mapTags,
  mapMenu,
  mapPages,
  mapTypes,
  mapLevels,
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

// cấu hình số lượng item hiển thị ở trang chủ mỗi danh mục (fallback default)
const HOME_LIMITS = { default: 8 };

/* ======== Lấy danh mục từ cây menu dưới node 'product' ======== */
const titleOf = (it) =>
  String(it.title ?? it.label ?? it.key).replace(/^"(.*)"$/, "$1");

function buildTreeFromFlat(nav = []) {
  if (nav.some((n) => Array.isArray(n.children))) return nav;
  const map = new Map(nav.map((it) => [it.key, { ...it, children: [] }]));
  const roots = [];
  nav.forEach((it) => {
    const node = map.get(it.key);
    if (it.parent && map.has(it.parent)) map.get(it.parent).children.push(node);
    else roots.push(node);
  });
  const sort = (arr = []) =>
    arr
      .sort((a, b) => (+a.order || 0) - (+b.order || 0))
      .forEach((n) => sort(n.children));
  sort(roots);
  return roots;
}
function findNodeByKey(nodes = [], key) {
  for (const n of nodes) {
    if (n.key === key) return n;
    const f = findNodeByKey(n.children || [], key);
    if (f) return f;
  }
  return null;
}
function getProductCategoriesFromMenu(menu = []) {
  const tree = buildTreeFromFlat(menu);
  const product = findNodeByKey(tree, "product");
  if (!product) return [];
  const out = [];
  const walk = (n) => {
    if (n.key && n.key !== "product") out.push({ key: n.key, title: titleOf(n) });
    (n.children || []).forEach(walk);
  };
  walk(product);
  return out;
}

/* === index các danh mục con: parentKey -> Set(childLeafKeys) === */
function buildDescIndex(menu = []) {
  const tree = buildTreeFromFlat(menu);
  const product = findNodeByKey(tree, "product");
  const idx = new Map();
  const gather = (node) => {
    const kids = node.children || [];
    if (!kids.length) return [node.key];
    const leaves = kids.flatMap(gather);
    if (node.key) idx.set(node.key, new Set(leaves.filter((k) => k !== node.key)));
    return leaves;
  };
  if (product) gather(product);
  return idx;
}
const inMenuCat = (catKey, selectedKey, descIdx) => {
  if (selectedKey === "all") return true;
  if (catKey === selectedKey) return true;
  const set = descIdx.get(selectedKey);
  return !!(set && set.has(catKey));
};
/* =============================================================== */

export default function App() {
  const [route, setRoute] = useState("home"); // 'home' | 'search' | pageKey | categoryKey
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState(null);
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
  ); // giữ cho Admin; CategoryBar lấy theo menu
  const [menu, setMenu] = useState(() => readLS(LS.MENU, DATA.nav || []));
  const [pages, setPages] = useState(() => readLS(LS.PAGES, DATA.pages || []));
  const [tags, setTags] = useState(() => readLS(LS.TAGS, DATA.tags || []));

  const SHEET = {
    id: import.meta.env.VITE_SHEET_ID,
    gid: import.meta.env.VITE_SHEET_GID || "0",
    gids: {
      products:
        import.meta.env.VITE_SHEET_GID_PRODUCTS ||
        import.meta.env.VITE_SHEET_GID ||
        "0",
      categories: import.meta.env.VITE_SHEET_GID_CATEGORIES,
      tags: import.meta.env.VITE_SHEET_GID_TAGS,
      menu: import.meta.env.VITE_SHEET_GID_MENU,
      pages: import.meta.env.VITE_SHEET_GID_PAGES,
      types: import.meta.env.VITE_SHEET_GID_TYPES,
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
    if (!has && route === "search")
      setRoute(activeCat !== "all" ? activeCat : "all");
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
        // cập nhật categories (cho Admin) từ product.category nếu thiếu
        const cats = [
          ...new Set(fromSheet.map((p) => p.category).filter(Boolean)),
        ];
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
        if (mapped?.length) {
          setter(mapped);
          writeLS(lsKey, mapped);
        }
      };
      await Promise.all([
        loadOpt(SHEET.gids.categories, mapCategories, setCategories, LS.CATEGORIES),
        loadOpt(SHEET.gids.tags, mapTags, setTags, LS.TAGS),
        loadOpt(SHEET.gids.menu, mapMenu, setMenu, LS.MENU),
        loadOpt(SHEET.gids.pages, mapPages, setPages, LS.PAGES),
        loadOpt(SHEET.gids.types, mapTypes, (v) => writeLS(LS.TYPES, v), LS.TYPES),
        loadOpt(SHEET.gids.levels, mapLevels, (v) => writeLS(LS.LEVELS, v), LS.LEVELS),
      ]);
    }
    if (SHEET.id) {
      syncAll();
      const t = setInterval(syncAll, SYNC_MS);
      return () => clearInterval(t);
    }
  }, [SHEET.id, SHEET.gid, DRIVE.folderId, DRIVE.apiKey, SYNC_MS]); // eslint-disable-line

  function applyFilters(list = []) {
    if (!filterState) return list;

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
      typeof t === "string" ? t : (t?.id ?? t?.key ?? t?.value ?? t?.label ?? JSON.stringify(t));

    let out = list.filter((p) => {
      const priceOk = (+p.price || 0) >= min && (+p.price || 0) <= max;
      const pTagIds = (p.tags || []).map(tagId).map(String);
      const tagOk  = !tagSet?.size || pTagIds.some((id) => tagSet.has(String(id)));
      const sizeOk = !sizeSet?.size || (p.sizes || []).some((s) => sizeSet.has(String(s)));
      const lvlOk  = !levelSet?.size || (p.level && levelSet.has(String(p.level)));
      const featOk = !featured || !!p.banner;
      const stockOk= !inStock || p.inStock !== false;
      return priceOk && tagOk && sizeOk && lvlOk && featOk && stockOk;
    });

    if (sort === "price-asc")  out.sort((a,b)=>(a.price||0)-(b.price||0));
    if (sort === "price-desc") out.sort((a,b)=>(b.price||0)-(a.price||0));
    if (sort === "newest")     out.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if (sort === "popular")    out.sort((a,b)=>(b.popular||0)-(a.popular||0));

    return out;
  }

  /* ======= DANH MỤC THEO MENU (nhánh 'product') ======= */
  const productCatsFromMenu = useMemo(
    () => getProductCategoriesFromMenu(menu),
    [menu]
  );
  const descByKey = useMemo(() => buildDescIndex(menu), [menu]);

  const menuCatsWithAll = useMemo(
    () => [{ key: "all", title: "Tất cả" }, ...productCatsFromMenu],
    [productCatsFromMenu]
  );
  const categoryKeysFromMenu = useMemo(
    () => new Set(productCatsFromMenu.map((c) => c.key)),
    [productCatsFromMenu]
  );
  const currentKeyForBar =
    route === "search" ? activeCat : route === "home" ? "all" : route;

  function handlePickCategory(key) {
    if (key === "all") {
      setActiveCat("all");
      setRoute(q.trim() ? "search" : "all"); 
      setRoute("search"); // để lọc + list 1 trang
      return;
    }
    setActiveCat(key);
    if (q.trim() || route === "search") setRoute("search");
    else setRoute(key);
  }

  function navigate(key) {
    setRoute(key);
    if (key === "home") setActiveCat("all");
    else if (categoryKeysFromMenu.has(key)) setActiveCat(key);
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
      (productCatsFromMenu || [])
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
  }, [q, products, productCatsFromMenu, tags]);

  function handleSuggestionSelect(s) {
    if (s.type === "danh mục" && s.key) {
      handlePickCategory(s.key);
      return;
    }
    setQ(s.label.replace(/^#/, ""));
    setRoute("search");
  }

  /* danh sách theo tìm kiếm */
  const nqVal = useMemo(() => norm(q), [q]);
  const catTitle = useMemo(
    () =>
      Object.fromEntries(
        productCatsFromMenu.map((c) => [c.key, norm(c.title || c.key)])
      ),
    [productCatsFromMenu]
  );
  const listForSearch = useMemo(() => {
    const base =
      activeCat === "all"
        ? products || []
        : (products || []).filter((p) => inMenuCat(p.category, activeCat, descByKey));
    if (!nqVal) return base;
    return base.filter((p) => {
      const name = norm(p.name);
      const tg = (p.tags || []).map((t) => norm(t)).join(" ");
      const cat = catTitle[p.category] || "";
      return name.includes(nqVal) || tg.includes(nqVal) || cat.includes(nqVal);
    });
  }, [nqVal, products, activeCat, catTitle, descByKey]);

  /* danh sách theo route khi không search */
  const baseForRoute = useMemo(() => {
    if (route === "home" || route === "search") return products || [];
    return (products || []).filter((p) => inMenuCat(p.category, route, descByKey));
  }, [route, products, descByKey]);

  /* const filteredForRoute = useMemo(() => {
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
      const priceOk =
        (Number(p.price) || 0) >= min && (Number(p.price) || 0) <= max;
      const pTagIds = (p.tags || []).map(tagId).map(String);
      const tagOk = !tagSet?.size || pTagIds.some((id) => tagSet.has(String(id)));
      const sizeOk =
        !sizeSet?.size || (p.sizes || []).some((s) => sizeSet.has(String(s)));
      const lvlOk = !levelSet?.size || (p.level && levelSet.has(String(p.level)));
      const featOk = !featured || !!p.banner;
      const stockOk = !inStock || p.inStock !== false;
      return priceOk && tagOk && sizeOk && lvlOk && featOk && stockOk;
    });

    if (sort === "price-asc") out.sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === "price-desc") out.sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sort === "newest")
      out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (sort === "popular")
      out.sort((a, b) => (b.popular || 0) - (a.popular || 0));

    return out;
  }, [filterState, baseForRoute, route]); */

  const filteredForRoute = useMemo(
    () => applyFilters(baseForRoute),
    [filterState, baseForRoute]
  );

  const customPage = useMemo(
    () => (pages || []).find((p) => p.key === route),
    [pages, route]
  );

  /* CategoryBar sticky */
  const CatBar = (
    <div className="sticky top-[56px] md:top-[72px] z-30">
      <div className="max-w-6xl mx-auto p-4 bg-gray-50/90 supports-[backdrop-filter]:bg-gray-50/60 backdrop-blur border rounded-xl">
        <CategoryBar
          categories={menuCatsWithAll}
          currentKey={currentKeyForBar}
          onPick={handlePickCategory}
          onOpenFilters={() => { if (route === "home") setRoute("all"); setFiltersOpen(true); }}
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
  const base = listForSearch;
  const list = applyFilters(base);
    const activeTitle =
      activeCat === "all"
        ? "Tất cả"
        : productCatsFromMenu.find((c) => c.key === activeCat)?.title ||
          activeCat;
    mainContent = (
      <>
        {CatBar}
        <section className="max-w-6xl mx-auto p-4">
          <h2 className="text-xl font-semibold mb-2">
            {activeTitle}
            {q.trim() ? ` · Kết quả cho “${q}”` : ""}
          </h2>
          <div className="text-sm text-gray-600 mb-3">{list.length} sản phẩm</div>
        </section>
        <ProductList products={list} onImageClick={setQuick} />
      </>
    );
  } else {
    const list = filteredForRoute;
    const isHome = route === "home";

    mainContent = (
      <>
        {isHome && <Hero products={products} interval={2000} fbUrls={fbUrls} />}
        {CatBar}

        {isHome ? (
          // === Landing sections theo danh mục (chỉ hiển thị danh mục có sản phẩm trực tiếp) ===
          <section className="max-w-6xl mx-auto p-4 space-y-10">
            {productCatsFromMenu.map((cat) => {
              const limit = (HOME_LIMITS?.[cat.key] ?? HOME_LIMITS?.default ?? 6); 
              const items = (filteredForRoute || [])   // ← ĐÃ ÁP DỤNG FILTER
                .filter((p) => p.category === cat.key)
                .filter((p) => p.category === cat.key)
                .sort(
                  (a, b) =>
                    (b.popular || 0) - (a.popular || 0) ||
                    (b.createdAt || 0) - (a.createdAt || 0)
                )
                .slice(0, limit);

              if (!items.length) return null;

              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">{cat.title}</h3>
                    <button
                      className="text-rose-600 hover:underline"
                      onClick={() => {
                        navigate(cat.key);
                        requestAnimationFrame(() =>
                          window.scrollTo({ top: 0, behavior: "smooth" })
                        );
                      }}
                    >
                      Xem tất cả
                    </button>
                  </div>
                  <ProductList products={items} onImageClick={setQuick} />
                </div>
              );
            })}
          </section>
        ) : (
          // === Trang danh mục thường ===
          <>
            <section className="max-w-6xl mx-auto p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600">{list.length} sản phẩm</div>
              </div>
              <ProductList products={list} onImageClick={setQuick} />
            </section>

            {/* <FilterSheet
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              title="Bộ lọc"
            >
              <Filters
                products={baseForRoute}
                tags={tags}
                onChange={setFilterState}
              />
            </FilterSheet> */}
          </>
        )}
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
        onSearchSubmit={(qq) =>
          setRoute(qq.trim() ? "search" : activeCat !== "all" ? activeCat : "all")
        }
        suggestions={suggestions}
        onSuggestionSelect={handleSuggestionSelect}
      />

      <main>{mainContent}</main>

      {quick && (
        <ProductQuickView
          product={quick}
          onClose={() => setQuick(null)}
        />
      )}

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Bộ lọc"
      >
        <Filters
          products={route === "search" ? listForSearch : baseForRoute}
          tags={tags}
          onChange={setFilterState}
        />
      </FilterSheet>

      <Footer data={DATA.footer} />
    </div>
  );
}
