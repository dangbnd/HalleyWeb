// src/components/Admin/panels/ProductsPanel.jsx
import React, { useEffect, useRef, useState } from "react";
import { Button, Input, Section, Toolbar, Badge } from "../ui/primitives.jsx";
import { Table } from "../ui/table.jsx";
import { readLS, writeLS } from "../../../utils.js";
import { genId } from "../shared/helpers.js";
import { listSheet, insertToSheet, updateToSheet, deleteFromSheet } from "../shared/sheets.js";

/* ---------------- helpers ---------------- */
const safe = (x) => (Array.isArray(x) ? x.filter((v) => v && typeof v === "object") : []);
const s = (v) => (v == null ? "" : String(v));
const toBool = (v) => v === true || /^1|true|yes$/i.test(String(v).trim());

const sizeKey = (z) => `${String(z?.code || "").trim()}@@${String(z?.height || "").trim()}`;
const sizeLabel = (z) =>
  `${z?.label || z?.code}${z?.height ? ` - cao ${z.height}cm` : ""}`;

const parseMaybeJSON = (v) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t) return t;
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.parse(t);
    } catch {
      return v;
    }
  }
  return v;
};
const normImages = (v) =>
  Array.isArray(v)
    ? v
    : s(v)
        .split(/[\n,|]\s*/)
        .map((x) => x.trim())
        .filter(Boolean);

const firstImg = (p) =>
  Array.isArray(p?.images) ? p.images[0] || "" : normImages(p?.images || p?.image)[0] || "";

/* ---------------- normalization ---------------- */
const normType = (row) => ({
  id: s(row.id) || genId(),
  code: s(row.code).trim(),
  name: s(row.name).trim(),
  sizeCodes: Array.isArray(row.sizeCodes)
    ? row.sizeCodes.filter(Boolean).map(s)
    : (Array.isArray(parseMaybeJSON(row.sizeCodes))
        ? parseMaybeJSON(row.sizeCodes)
        : s(row.sizeCodes).split(/[\s,|]+/)
      )
        .filter(Boolean)
        .map(s),
});

const normSize = (row) => ({
  id: s(row.id) || genId(),
  code: s(row.code).trim(),
  label: s(row.label).trim(),
  height: s(row.height).trim(),
});

const normProduct = (row) => ({
  id: s(row.id) || genId(),
  name: s(row.name).trim(),
  category: s(row.category).trim(),
  type: s(row.type).trim(), // code của Type
  active: toBool(row.active),
  images:
    Array.isArray(row.images) ? row.images : normImages(parseMaybeJSON(row.images ?? row.image)),
  priceBySize:
    (row && typeof parseMaybeJSON(row.priceBySize) === "object"
      ? parseMaybeJSON(row.priceBySize)
      : {}) || {},
  description: s(row.description),
  banner: toBool(row.banner),
  tags: Array.isArray(row.tags)
    ? row.tags
    : s(row.tags)
        .split(/,\s*/)
        .map((x) => x.trim())
        .filter(Boolean),
  createdAt: row.createdAt || new Date().toISOString(),
});

const notEmptyProduct = (p) => !!(s(p.name).trim() && s(p.type).trim());

/* ---------------- main ---------------- */
export default function ProductsPanel() {
  const [products, setProducts] = useState(() => safe(readLS("products") || []));
  const [types, setTypes] = useState(() => safe(readLS("types") || []));
  const [sizes, setSizes] = useState(() => safe(readLS("sizes") || []));
  const [q, setQ] = useState("");

  const verP = useRef("");
  const verT = useRef("");
  const verS = useRef("");

  // Pull 3 sheet (Products / Types / Sizes)
  useEffect(() => {
    let t;
    let alive = true;
    const loop = async () => {
      const a = await listSheet("Products");
      if (a?.ok && a.version !== verP.current) {
        verP.current = a.version;
        const rows = safe(a.rows).map(normProduct).filter(notEmptyProduct);
        setProducts(rows);
        writeLS("products", rows);
      }
      const b = await listSheet("Types");
      if (b?.ok && b.version !== verT.current) {
        verT.current = b.version;
        const rows = safe(b.rows).map(normType);
        setTypes(rows);
        writeLS("types", rows);
      }
      const c = await listSheet("Sizes");
      if (c?.ok && c.version !== verS.current) {
        verS.current = c.version;
        const rows = safe(c.rows).map(normSize);
        setSizes(rows);
        writeLS("sizes", rows);
      }
      if (alive) t = setTimeout(loop, 8000);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  const [rowNew, setRowNew] = useState({
    name: "",
    category: "",
    type: "",
    active: true,
    images: [],
    priceBySize: {},
    description: "",
    banner: false,
    tags: [],
  });
  const canSaveNew = !!(s(rowNew.name).trim() && s(rowNew.type).trim());
  const dirtyNew =
    !!rowNew.name ||
    !!rowNew.type ||
    !!rowNew.category ||
    !!rowNew.description ||
    rowNew.tags.length ||
    rowNew.images.length ||
    !!Object.keys(rowNew.priceBySize || {}).length ||
    rowNew.banner;

  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);

  const view = products.filter((p) =>
    (p.name + " " + p.category + " " + p.type + " " + (p.tags || []).join(" "))
      .toLowerCase()
      .includes(q.toLowerCase())
  );
  const list = [{ id: "__new__" }, ...view];

  function allowedSizeKeys(typeCode) {
    if (!typeCode) return [];
    const t = (types || []).find((x) => x.code === typeCode);
    return t?.sizeCodes || [];
  }
  function allowedSizeRows(typeCode) {
    const keys = new Set(allowedSizeKeys(typeCode));
    const byKey = new Map((sizes || []).map((z) => [sizeKey(z), z]));
    return [...keys].map((k) => ({ key: k, row: byKey.get(k) })).filter((x) => x.row);
  }

  // ---------- CRUD ----------
  function saveNew() {
    if (!canSaveNew) return;
    const keys = new Set(allowedSizeKeys(rowNew.type));
    const pruned = Object.fromEntries(
      Object.entries(rowNew.priceBySize || {}).filter(([k]) => keys.has(k))
    );
    const item = normProduct({
      id: genId(),
      ...rowNew,
      images: normImages(rowNew.images),
      priceBySize: pruned,
    });
    insertToSheet("Products", item);
    const next = [item, ...products];
    setProducts(next);
    writeLS("products", next);
    setRowNew({
      name: "",
      category: "",
      type: "",
      active: true,
      images: [],
      priceBySize: {},
      description: "",
      banner: false,
      tags: [],
    });
  }

  function startEdit(row) {
    setEditId(row.id);
    setDraft({
      ...row,
      image: firstImg(row),
      images: [...(row.images || [])],
      tags: [...(row.tags || [])],
      priceBySize: { ...(row.priceBySize || {}) },
    });
  }
  function cancelEdit() {
    setEditId(null);
    setDraft(null);
  }
  function saveEdit() {
    const keys = new Set(allowedSizeKeys(draft.type));
    const pruned = Object.fromEntries(
      Object.entries(draft.priceBySize || {}).filter(([k]) => keys.has(k))
    );
    const images = draft.image ? normImages([draft.image, ...(draft.images || [])]) : draft.images;
    const clean = normProduct({ ...draft, images, priceBySize: pruned });
    updateToSheet("Products", clean);
    const next = products.map((p) => (p.id === editId ? clean : p));
    setProducts(next);
    writeLS("products", next);
    cancelEdit();
  }
  function removeRow(row) {
    deleteFromSheet("Products", row.id);
    const next = products.filter((p) => p.id !== row.id);
    setProducts(next);
    writeLS("products", next);
  }

  const Img = ({ src }) =>
    src ? (
      <img
        src={src}
        alt=""
        className="w-12 h-12 object-cover rounded-lg border"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    ) : (
      <div className="w-12 h-12 rounded-lg border bg-gray-50" />
    );

  return (
    <Section
      title="Sản phẩm"
      actions={
        <Toolbar>
          <Input placeholder="Tìm..." value={q} onChange={(e) => setQ(e.target.value)} />
        </Toolbar>
      }
    >
      <Table
        columns={[
          { title: "Ảnh", dataIndex: "image", thClass: "w-[22rem]", tdClass: "w-[22rem]" },
          { title: "Tên", dataIndex: "name", thClass: "w-72" },
          { title: "Loại", dataIndex: "type", thClass: "w-52" },
          { title: "Danh mục", dataIndex: "category", thClass: "w-40" },
          { title: "Size / Giá", dataIndex: "sizes" },
          { title: "Trạng thái", dataIndex: "active", thClass: "w-32" },
          { title: "", dataIndex: "actions", thClass: "w-56" },
        ]}
        data={list}
        rowRender={(row) =>
        // ===== HÀNG THÊM MỚI: DÀN FULL NGANG BẰNG GRID =====
        row.id === "__new__" ? (
          <tr key="__new__">
            <td colSpan={7} className="px-3 py-3">
              <div className="grid grid-cols-12 gap-4 items-start">
                {/* ẢNH */}
                <div className="col-span-12 md:col-span-3 lg:col-span-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-16 rounded-lg border bg-gray-50 overflow-hidden">
                      {firstImg(rowNew) ? (
                        <img src={firstImg(rowNew)} alt="" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                  </div>
                  <Input
                    className="mt-2"
                    value={Array.isArray(rowNew.images) ? rowNew.images.join(", ") : rowNew.images}
                    onChange={(e) => setRowNew({ ...rowNew, images: normImages(e.target.value) })}
                    placeholder="1 hoặc nhiều URL ảnh, cách nhau dấu phẩy/xuống dòng"
                  />
                </div>

                {/* TÊN / MÔ TẢ / TAGS */}
                <div className="col-span-12 md:col-span-5 lg:col-span-4">
                  <Input
                    value={rowNew.name}
                    onChange={(e) => setRowNew({ ...rowNew, name: e.target.value })}
                    placeholder="Tên sản phẩm"
                  />
                  <textarea
                    className="mt-2 w-full border rounded-lg p-2 text-sm"
                    rows={3}
                    value={rowNew.description}
                    onChange={(e) => setRowNew({ ...rowNew, description: e.target.value })}
                    placeholder="Mô tả…"
                  />
                  <Input
                    className="mt-2"
                    value={(rowNew.tags || []).join(", ")}
                    onChange={(e) =>
                      setRowNew({
                        ...rowNew,
                        tags: e.target.value.split(/,\s*/).map((x) => x.trim()).filter(Boolean),
                      })
                    }
                    placeholder="Tags (CSV)"
                  />
                </div>

                {/* LOẠI / DANH MỤC / BANNER + ACTIVE */}
                <div className="col-span-12 md:col-span-4 lg:col-span-3">
                  <select
                    className="w-full px-2 py-1.5 border rounded-lg"
                    value={rowNew.type}
                    onChange={(e) => {
                      const code = e.target.value;
                      const keys = new Set(allowedSizeKeys(code));
                      const pruned = Object.fromEntries(
                        Object.entries(rowNew.priceBySize || {}).filter(([k]) => keys.has(k))
                      );
                      setRowNew({ ...rowNew, type: code, priceBySize: pruned });
                    }}
                  >
                    <option value="">-- chọn loại --</option>
                    {(types || []).map((t) => (
                      <option key={t.id} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  <Input
                    className="mt-2"
                    value={rowNew.category}
                    onChange={(e) => setRowNew({ ...rowNew, category: e.target.value })}
                    placeholder="Danh mục (vd: 100k, basic...)"
                  />

                  <div className="mt-3 flex items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!rowNew.banner}
                        onChange={(e) => setRowNew({ ...rowNew, banner: e.target.checked })}
                      />
                      Gắn banner
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!rowNew.active}
                        onChange={(e) => setRowNew({ ...rowNew, active: e.target.checked })}
                      />
                      Hiển thị
                    </label>
                  </div>
                </div>

                {/* GIÁ THEO SIZE – Ô RỘNG NGUYÊN CỘT */}
                <div className="col-span-12 lg:col-span-3">
                  <InlinePriceEditor
                    sizes={sizes}
                    types={types}
                    typeCode={rowNew.type}
                    value={rowNew.priceBySize}
                    onChange={(v) => setRowNew({ ...rowNew, priceBySize: v })}
                  />
                </div>

                {/* NÚT */}
                <div className="col-span-12 flex justify-end gap-2">
                  <Button disabled={!canSaveNew} onClick={saveNew}>
                    Lưu
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!dirtyNew}
                    onClick={() =>
                      setRowNew({
                        name: "",
                        category: "",
                        type: "",
                        active: true,
                        images: [],
                        priceBySize: {},
                        description: "",
                        banner: false,
                        tags: [],
                      })
                    }
                  >
                    Huỷ
                  </Button>
                </div>
              </div>
            </td>
          </tr>
        ) : (
          // ===== HÀNG ĐANG SỬA: DÀN FULL NGANG NHƯ TRÊN =====
          <tr key={row.id}>
            {editId === row.id ? (
              <td colSpan={7} className="px-3 py-3">
                <div className="grid grid-cols-12 gap-4 items-start">
                  {/* ẢNH */}
                  <div className="col-span-12 md:col-span-3 lg:col-span-2">
                    <div className="w-16 h-16 rounded-lg border bg-gray-50 overflow-hidden">
                      {firstImg(draft) && (
                        <img src={firstImg(draft)} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <Input
                      className="mt-2"
                      value={draft.image || draft.images?.join(", ") || ""}
                      onChange={(e) => setDraft({ ...draft, image: e.target.value })}
                      placeholder="URL ảnh (1 hoặc nhiều URL, cách nhau dấu phẩy)"
                    />
                  </div>

                  {/* TÊN / MÔ TẢ / TAGS */}
                  <div className="col-span-12 md:col-span-5 lg:col-span-4">
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    <textarea
                      className="mt-2 w-full border rounded-lg p-2 text-sm"
                      rows={3}
                      value={draft.description || ""}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    />
                    <Input
                      className="mt-2"
                      value={(draft.tags || []).join(", ")}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          tags: e.target.value.split(/,\s*/).map((x) => x.trim()).filter(Boolean),
                        })
                      }
                      placeholder="tags, cách, nhau, dấu, phẩy"
                    />
                  </div>

                  {/* LOẠI / DANH MỤC / BANNER + ACTIVE */}
                  <div className="col-span-12 md:col-span-4 lg:col-span-3">
                    <select
                      className="w-full px-2 py-1.5 border rounded-lg"
                      value={draft.type}
                      onChange={(e) => {
                        const code = e.target.value;
                        const keys = new Set(allowedSizeKeys(code));
                        const pruned = Object.fromEntries(
                          Object.entries(draft.priceBySize || {}).filter(([k]) => keys.has(k))
                        );
                        setDraft({ ...draft, type: code, priceBySize: pruned });
                      }}
                    >
                      <option value="">-- chọn --</option>
                      {(types || []).map((t) => (
                        <option key={t.id} value={t.code}>
                          {t.name}
                        </option>
                      ))}
                    </select>

                    <Input
                      className="mt-2"
                      value={draft.category || ""}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      placeholder="Danh mục"
                    />

                    <div className="mt-3 flex items-center gap-6">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!draft.banner}
                          onChange={(e) => setDraft({ ...draft, banner: e.target.checked })}
                        />
                        Banner
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!draft.active}
                          onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                        />
                        Hiển thị
                      </label>
                    </div>
                  </div>

                  {/* GIÁ THEO SIZE */}
                  <div className="col-span-12 lg:col-span-3">
                    <InlinePriceEditor
                      sizes={sizes}
                      types={types}
                      typeCode={draft.type}
                      value={draft.priceBySize || {}}
                      onChange={(v) => setDraft({ ...draft, priceBySize: v })}
                    />
                  </div>

                  {/* NÚT */}
                  <div className="col-span-12 flex justify-end gap-2">
                    <Button onClick={saveEdit}>Lưu</Button>
                    <Button variant="ghost" onClick={cancelEdit}>
                      Huỷ
                    </Button>
                  </div>
                </div>
              </td>
            ) : (
              /* Hàng hiển thị bình thường (không sửa) — GIỮ NGUYÊN CODE CŨ CỦA BẠN */
              <>
                {/* ...cells view mode như trước... */}
              </>
            )}
          </tr>
        )
}

      />
      {view.length === 0 && <div className="text-sm text-gray-500 p-3">Chưa có sản phẩm.</div>}
    </Section>
  );
}

/* ---------------- sub components ---------------- */
function InlinePriceEditor({ sizes, types, typeCode, value = {}, onChange }) {
  if (!typeCode)
    return <div className="text-xs text-gray-500">Chọn loại để nhập giá theo size</div>;

  const t = (types || []).find((x) => x.code === typeCode);
  const keys = t?.sizeCodes || [];
  if (!keys.length) return <div className="text-xs text-gray-500">Loại này chưa gán size.</div>;

  const byKey = new Map((sizes || []).map((z) => [sizeKey(z), z]));
  const allowed = keys
    .map((k) => ({ key: k, row: byKey.get(k) }))
    .filter((x) => x.row);

  return (
    <div className="flex flex-wrap gap-2">
      {allowed.map(({ key, row }) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <span className="w-40">{sizeLabel(row)}</span>
          <input
            className="w-32 px-2 py-1 border rounded"
            type="number"
            value={value[key] ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                [key]: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
      ))}
    </div>
  );
}
