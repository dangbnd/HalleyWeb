import { useEffect, useMemo, useState } from "react";
import { can, guard, authApi, writeLS, readLS, LS, audit, readAudit } from "../../utils.js";
import { DATA } from "../../data.js";
import ProductEditor from "./ProductEditor.jsx";
import TreeMenuEditor from "./TreeMenuEditor.jsx";
import ProductImage from "../ProductImage.jsx";
import TagPicker from "./TagPicker.jsx";

export default function Admin({
  user, setUser,
  products, setProducts,
  categories, setCategories,
  menu, setMenu,
  pages, setPages,
  onNavigate
}) {
  const [tags, setTags]       = useState(()=>readLS(LS.TAGS,    []));
  const [schemes, setSchemes] = useState(()=>readLS(LS.SCHEMES, []));
  const [types, setTypes]     = useState(()=>readLS(LS.TYPES,   []));
  const [levels, setLevels]   = useState(()=>readLS(LS.LEVELS,  []));

  useEffect(()=>writeLS(LS.TAGS, tags), [tags]);
  useEffect(()=>writeLS(LS.SCHEMES, schemes), [schemes]);
  useEffect(()=>writeLS(LS.TYPES, types), [types]);
  useEffect(()=>writeLS(LS.LEVELS, levels), [levels]);

  const [tab, setTab] = useState("products");
  function logout(){ authApi.logout(); setUser(null); onNavigate?.("home"); }

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        <Tab t="products"   tab={tab} setTab={setTab}>Sản phẩm</Tab>
        <Tab t="categories" tab={tab} setTab={setTab}>Danh mục</Tab>
        <Tab t="menu"       tab={tab} setTab={setTab}>Menu</Tab>
        <Tab t="pages"      tab={tab} setTab={setTab}>Pages</Tab>
        <Tab t="typeSizes"  tab={tab} setTab={setTab}>Loại & Size</Tab>
        <Tab t="levels"     tab={tab} setTab={setTab}>Level giá</Tab>
        <Tab t="tags"       tab={tab} setTab={setTab}>Tags</Tab>
        <Tab t="users"      tab={tab} setTab={setTab}>Users</Tab>
        <Tab t="audit"      tab={tab} setTab={setTab}>Audit</Tab>
        <div className="ml-auto text-sm text-gray-600">Bạn: {user.name} — {user.role}</div>
        <button className="border rounded px-3" onClick={logout}>Đăng xuất</button>
      </div>

      {tab==="products"   && <ProductsPanel user={user} products={products} setProducts={setProducts}
                                            categories={categories}
                                            tags={tags} setTags={setTags}
                                            schemes={schemes} types={types} levels={levels} />}

      {tab==="categories" && <CategoriesPanel user={user} categories={categories} setCategories={setCategories} />}

      {tab==="menu" && (
        <TreeMenuEditor user={user} value={menu} defaultMenu={DATA.nav}
                        onSave={(next)=>{ setMenu(next); writeLS(LS.MENU,next); }} />
      )}

      {tab==="pages"   && <PagesPanel user={user} pages={pages} setPages={setPages} />}

      {/* GỘP Loại + Size vào 1 panel */}
      {tab==="typeSizes" && (
        <TypeSizePanel
          user={user}
          types={types} setTypes={setTypes}
          schemes={schemes} setSchemes={setSchemes}
        />
      )}

      {tab==="levels"  && <LevelsPanel user={user} levels={levels} setLevels={setLevels} schemes={schemes} />}

      {tab==="tags"    && <TagsPanel user={user} tags={tags} setTags={setTags} />}

      {tab==="users"   && <UsersPanel user={user} />}

      {tab==="audit"   && <AuditPanel />}
    </div>
  );
}

function Tab({ t, tab, setTab, children }) {
  const active = tab === t;
  return <button className={`px-3 py-1 rounded border ${active ? "bg-gray-100" : ""}`} onClick={()=>setTab(t)}>{children}</button>;
}

/* ---------------- Products ---------------- */
function ProductsPanel({ user, products, setProducts, categories, tags, setTags, schemes, types, levels }) {
  const canCreate=can(user,"create","products"), canUpdate=can(user,"update","products"), canDelete=can(user,"delete","products");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState(null);
  function save(p){
    const next = products.some(x=>x.id===p.id) ? products.map(x=>x.id===p.id?p:x) : [{...p}, ...products];
    setProducts(next); writeLS(LS.PRODUCTS,next);
    audit(products.some(x=>x.id===p.id) ? "product.update" : "product.create", { id:p.id, name:p.name });
    setShowForm(false); setEditing(null);
  }
  const remove = guard(user,"delete","products", id => {
    const next = products.filter(p=>p.id!==id);
    setProducts(next); writeLS(LS.PRODUCTS,next); audit("product.delete",{id});
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="border rounded px-3" onClick={()=>{setEditing(null); setShowForm(true);}} disabled={!canCreate}>+ Thêm sản phẩm</button>
      </div>
      {showForm && (
        <ProductEditor product={editing} onSave={save} onCancel={()=>{setShowForm(false); setEditing(null);}}
                       categories={categories} types={types} schemes={schemes} levels={levels}
                       tags={tags} setTags={setTags}/>
      )}
      <table className="w-full text-sm">
        <thead><tr className="text-left border-b"><th className="py-2">Tên</th><th>Danh mục</th><th>Loại</th><th>Tag</th><th>Ảnh</th><th width="1"></th></tr></thead>
        <tbody>
          {products.map(p=>(
            <tr key={p.id} className="border-b">
              <td className="py-2">{p.name}</td><td>{p.category}</td><td>{p.typeId||"—"}</td>
              <td className="max-w-[220px] truncate">{(p.tags||[]).join(", ")}</td>
              <td><div className="relative w-12 h-12 rounded overflow-hidden border">
                <ProductImage product={p} className="absolute inset-0 w-full h-full object-cover" />
              </div></td>
              <td className="whitespace-nowrap">
                <button className="border rounded px-2 mr-2" onClick={()=>{ if(!canUpdate) return; setEditing(p); setShowForm(true); }}>Sửa</button>
                <button className="text-red-600 border rounded px-2" onClick={()=>remove(p.id)} disabled={!canDelete}>Xoá</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Categories ---------------- */
function CategoriesPanel({ user, categories, setCategories }) {
  const add = guard(user,"create","categories", (key, title) => {
    const next = [{ key, title: title || key }, ...categories];
    setCategories(next); writeLS(LS.CATEGORIES,next); audit("category.create",{key});
  });
  const remove = guard(user,"delete","categories", (k) => {
    const next = categories.filter(c=>c.key!==k);
    setCategories(next); writeLS(LS.CATEGORIES,next); audit("category.delete",{key:k});
  });
  const update = guard(user,"update","categories", (k, patch) => {
    const next = categories.map(c=>c.key===k?{...c,...patch}:c);
    setCategories(next); writeLS(LS.CATEGORIES,next); audit("category.update",{key:k,patch});
  });
  const [keyV,setKeyV]=useState(""),[name,setName]=useState(""),[editing,setEditing]=useState(null);
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input className="border rounded px-2 py-1" placeholder="Key" value={keyV} onChange={e=>setKeyV(e.target.value)} />
        <input className="border rounded px-2 py-1" placeholder="Tiêu đề" value={name} onChange={e=>setName(e.target.value)} />
        <button className="border rounded px-3" onClick={()=>{if(!keyV) return; add(keyV,name); setKeyV(''); setName('');}}>Thêm</button>
      </div>
      <ul className="space-y-1">
        {categories.map(c=>(
          <li key={c.key} className="flex items-center justify-between border rounded px-2 py-1">
            {editing===c.key?(
              <>
                <input className="border rounded px-2 py-1 w-44" defaultValue={c.key} onChange={e=>c._k=e.target.value}/>
                <input className="border rounded px-2 py-1 flex-1 mx-2" defaultValue={c.title} onChange={e=>c._t=e.target.value}/>
                <div className="flex gap-2">
                  <button className="border rounded px-2" onClick={()=>{ update(c.key,{ key:c._k??c.key, title:c._t??c.title }); setEditing(null); }}>Lưu</button>
                  <button className="border rounded px-2" onClick={()=>setEditing(null)}>Huỷ</button>
                </div>
              </>
            ):(
              <>
                <span>{c.title} <span className="text-xs text-gray-500">({c.key})</span></span>
                <div className="flex gap-2">
                  <button className="border rounded px-2" onClick={()=>setEditing(c.key)}>Sửa</button>
                  <button className="text-red-600 border rounded px-2" onClick={()=>remove(c.key)}>Xoá</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Pages ---------------- */
function PagesPanel({ user, pages, setPages }) {
  const canEdit = can(user,"update","pages");
  const [key,setKey]=useState(""),[title,setTitle]=useState(""),[body,setBody]=useState("");
  function add(){ if(!key||!title) return; const next=[...pages,{key,title,body}]; setPages(next); writeLS(LS.PAGES,next); audit("page.add",{key}); setKey(""); setTitle(""); setBody(""); }
  function remove(k){ const next=pages.filter(p=>p.key!==k); setPages(next); writeLS(LS.PAGES,next); audit("page.remove",{k}); }
  function save(i,p){ const next=pages.map((x,idx)=>idx===i?p:x); setPages(next); writeLS(LS.PAGES,next); audit("page.update",{key:p.key}); }
  return (
    <div>
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <input className="border rounded px-2 py-1" placeholder="key" value={key} onChange={e=>setKey(e.target.value)}/>
        <input className="border rounded px-2 py-1" placeholder="Tiêu đề" value={title} onChange={e=>setTitle(e.target.value)}/>
        <button className="border rounded px-3" onClick={add} disabled={!canEdit}>+ Thêm</button>
        <textarea className="md:col-span-3 border rounded px-2 py-1 h-24" placeholder="Nội dung" value={body} onChange={e=>setBody(e.target.value)}/>
      </div>
      {pages.map((p,i)=>(
        <div key={p.key} className="border rounded p-2 mb-2">
          <div className="flex items-center gap-2 mb-2">
            <input className="border rounded px-2 py-1 w-40" defaultValue={p.key} onChange={e=>p._k=e.target.value}/>
            <input className="border rounded px-2 py-1 flex-1" defaultValue={p.title} onChange={e=>p._t=e.target.value}/>
            <button className="border rounded px-2" onClick={()=>save(i,{...p,key:p._k??p.key,title:p._t??p.title,body:p._b??p.body})}>Lưu</button>
            <button className="text-red-600 border rounded px-2" onClick={()=>remove(p.key)}>Xoá</button>
          </div>
          <textarea className="w-full border rounded px-2 py-1" defaultValue={p.body} rows={4} onChange={e=>p._b=e.target.value}/>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Loại & Size (gộp) ---------------- */
function TypeSizePanel({ user, types, setTypes, schemes, setSchemes }) {
  const canEdit = can(user,"update","settings");

  /* ===== Schemes ===== */
  function saveSchemes(next, event, payload){ setSchemes(next); writeLS(LS.SCHEMES, next); audit(event, payload); }
  const addScheme   = guard(user,"update","settings", (id,name)=>{ if(!id||!name) return; const next=[...schemes,{id,name,sizes:[]}]; saveSchemes(next,"scheme.add",{id}); });
  const removeScheme= guard(user,"update","settings", (id)=>{ const next=schemes.filter(s=>s.id!==id); saveSchemes(next,"scheme.remove",{id}); });
  const updateScheme= guard(user,"update","settings", (id,patch)=>{ const next=schemes.map(s=>s.id===id?{...s,...patch}:s); saveSchemes(next,"scheme.update",{id,patch}); });
  const addSize     = guard(user,"update","settings", (sid,size)=>{ const next=schemes.map(s=>s.id===sid?{...s,sizes:[...s.sizes,size]}:s); saveSchemes(next,"scheme.size.add",{sid,size}); });
  const delSize     = guard(user,"update","settings", (sid,key)=>{ const next=schemes.map(s=>s.id===sid?{...s,sizes:s.sizes.filter(z=>String(z.key)!==String(key))}:s); saveSchemes(next,"scheme.size.remove",{sid,key}); });

  /* ===== Types ===== */
  function saveTypes(next,event,payload){ setTypes(next); writeLS(LS.TYPES,next); audit(event,payload); }
  const addType    = guard(user,"update","settings", (name, schemeId)=>{
    const id=(name||"").toLowerCase().trim().replace(/\s+/g,"-");
    if(!id||!schemeId) return;
    if(types.some(t=>t.id===id)) return alert("ID đã tồn tại");
    const t={ id, name: name||id, schemeId, sizes: [] }; // sizes=[] => dùng toàn bộ size của scheme
    saveTypes([t, ...types],"type.add",{id});
  });
  const removeType = guard(user,"update","settings", (id)=>{ saveTypes(types.filter(t=>t.id!==id),"type.remove",{id}); });
  const updateType = guard(user,"update","settings", (id,patch)=>{ saveTypes(types.map(t=>t.id===id?{...t,...patch}:t),"type.update",{id,patch}); });

  const schemeById = useMemo(()=>Object.fromEntries((schemes||[]).map(s=>[s.id,s])),[schemes]);
  const [newTypeName,setNewTypeName]=useState(""); 
  const [newTypeScheme,setNewTypeScheme]=useState(schemes[0]?.id||"");

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* --- Cột 1: Quản lý Schemes (bảng size gốc) --- */}
      <div>
        <h3 className="font-semibold mb-2">Bảng size (Schemes)</h3>
        <div className="flex gap-2 mb-3">
          <input className="border rounded px-2 py-1 w-36" placeholder="ID (vd: round)" onChange={e=>TypeSizePanel._sid=e.target.value}/>
          <input className="border rounded px-2 py-1 flex-1" placeholder="Tên (vd: Bánh tròn)" onChange={e=>TypeSizePanel._sname=e.target.value}/>
          <button className="border rounded px-3" onClick={()=>addScheme(TypeSizePanel._sid, TypeSizePanel._sname)} disabled={!canEdit}>Thêm</button>
        </div>

        {schemes.map(s=>(
          <div key={s.id} className="border rounded p-3 mb-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-sm text-gray-500">ID:</span>
              <input className="border rounded px-2 py-1 w-40" defaultValue={s.id} onChange={e=>s._i=e.target.value}/>
              <span className="text-sm text-gray-500">Tên:</span>
              <input className="border rounded px-2 py-1 flex-1" defaultValue={s.name} onChange={e=>s._n=e.target.value}/>
              <button className="border rounded px-2" onClick={()=>updateScheme(s.id,{ id:s._i??s.id, name:s._n??s.name })} disabled={!canEdit}>Lưu</button>
              <button className="text-red-600 border rounded px-2" onClick={()=>removeScheme(s.id)} disabled={!canEdit}>Xoá</button>
            </div>

            <table className="w-full text-sm">
              <thead><tr className="text-left border-b"><th className="py-1">Key</th><th>Nhãn</th><th width="1"></th></tr></thead>
              <tbody>
                {s.sizes.map(z=>(
                  <tr key={z.key} className="border-b">
                    <td className="py-1">{z.key}</td>
                    <td>{z.label}</td>
                    <td className="whitespace-nowrap">
                      <button className="text-red-600 border rounded px-2" onClick={()=>delSize(s.id,z.key)} disabled={!canEdit}>Xoá</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex gap-2 mt-2">
              <input className="border rounded px-2 py-1 w-32" placeholder="key (vd: 6)" onChange={e=>s._sk=e.target.value}/>
              <input className="border rounded px-2 py-1 flex-1" placeholder="nhãn (vd: Size 6&quot;)" onChange={e=>s._sl=e.target.value}/>
              <button className="border rounded px-3" onClick={()=>addSize(s.id,{ key:s._sk, label:s._sl||s._sk })} disabled={!canEdit}>+ Size</button>
            </div>
          </div>
        ))}
      </div>

      {/* --- Cột 2: Quản lý Loại (chọn scheme + subset size) --- */}
      <div>
        <h3 className="font-semibold mb-2">Loại bánh (Types) & kích cỡ áp dụng</h3>
        <div className="flex gap-2 mb-3">
          <input className="border rounded px-2 py-1" placeholder="Tên loại (vd: Bánh tròn)" value={newTypeName} onChange={e=>setNewTypeName(e.target.value)}/>
          <select className="border rounded px-2 py-1" value={newTypeScheme} onChange={e=>setNewTypeScheme(e.target.value)}>
            {(schemes||[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="border rounded px-3" onClick={()=>{ addType(newTypeName,newTypeScheme); setNewTypeName(""); }} disabled={!canEdit}>Thêm loại</button>
        </div>

        {types.map(t=>{
          const sch = schemeById[t.schemeId];
          const allSizes = sch?.sizes || [];
          const chosen = new Set((t.sizes || []).map(String));
          const useAll = (t.sizes || []).length === 0;

          const toggleSize = (key) => {
            let sizes = new Set(t.sizes || []);
            if (sizes.has(key)) sizes.delete(key); else sizes.add(key);
            updateType(t.id, { sizes: Array.from(sizes) });
          };

          const selectAll = () => updateType(t.id, { sizes: [] }); // rỗng = tất cả
          const clearAll  = () => updateType(t.id, { sizes: [] }); // giữ rỗng để dùng toàn bộ

          return (
            <div key={t.id} className="border rounded p-3 mb-3">
              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-gray-500">ID:</span>
                  <input className="border rounded px-2 py-1 w-40" defaultValue={t.id} onChange={e=>t._i=e.target.value}/>
                  <span className="text-sm text-gray-500">Tên:</span>
                  <input className="border rounded px-2 py-1 flex-1" defaultValue={t.name} onChange={e=>t._n=e.target.value}/>
                  <span className="text-sm text-gray-500">Scheme:</span>
                  <select className="border rounded px-2 py-1" defaultValue={t.schemeId} onChange={e=>t._s=e.target.value}>
                    {(schemes||[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button className="border rounded px-2"
                          onClick={()=>updateType(t.id,{ id:t._i??t.id, name:t._n??t.name, schemeId:t._s??t.schemeId, sizes:t.sizes||[] })}
                          disabled={!canEdit}>Lưu</button>
                  <button className="text-red-600 border rounded px-2" onClick={()=>removeType(t.id)} disabled={!canEdit}>Xoá</button>
                </div>
              </div>

              <div className="text-sm mb-2">
                <span className="mr-2 text-gray-600">Kích cỡ áp dụng:</span>
                <button className="underline mr-2" onClick={selectAll}>Dùng toàn bộ size của scheme</button>
                <span className="text-gray-500">
                  {useAll ? "đang dùng toàn bộ size" : "đang giới hạn theo lựa chọn bên dưới"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {allSizes.map(sz=>{
                  const checked = useAll ? true : chosen.has(String(sz.key));
                  return (
                    <label key={sz.key} className={`px-3 py-1 rounded-full border cursor-pointer ${checked ? "bg-gray-100" : ""}`}>
                      <input type="checkbox" className="mr-2 align-middle"
                             checked={checked} onChange={()=>toggleSize(String(sz.key))}/>
                      {sz.label || sz.key}
                    </label>
                  );
                })}
                {allSizes.length===0 && (
                  <div className="text-sm text-gray-500">Scheme này chưa có size. Hãy thêm size ở cột bên trái.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Levels ---------------- */
function LevelsPanel({ user, levels, setLevels, schemes }) {
  const add = guard(user,"update","settings", (id,name,schemeId)=>{ const next=[...levels,{id,name,schemeId,prices:{}}]; setLevels(next); writeLS(LS.LEVELS,next); audit("level.add",{id}); });
  const remove = guard(user,"update","settings", (id)=>{ const next=levels.filter(l=>l.id!==id); setLevels(next); writeLS(LS.LEVELS,next); audit("level.remove",{id}); });
  const update = guard(user,"update","settings", (id,patch)=>{ const next=levels.map(l=>l.id===id?{...l,...patch}:l); setLevels(next); writeLS(LS.LEVELS,next); audit("level.update",{id}); });
  const [id,setId]=useState(""),[name,setName]=useState(""),[schemeId,setSchemeId]=useState(schemes[0]?.id||"");
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input className="border rounded px-2 py-1 w-32" placeholder="ID" value={id} onChange={e=>setId(e.target.value)}/>
        <input className="border rounded px-2 py-1 flex-1" placeholder="Tên level" value={name} onChange={e=>setName(e.target.value)}/>
        <select className="border rounded px-2 py-1" value={schemeId} onChange={e=>setSchemeId(e.target.value)}>
          {schemes.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="border rounded px-3" onClick={()=>{ if(!id||!name) return; add(id,name,schemeId); setId(''); setName(''); }}>Thêm</button>
      </div>
      {levels.map(l=>{
        const sizes = schemes.find(s=>s.id===l.schemeId)?.sizes || [];
        return (
          <div key={l.id} className="border rounded p-2 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <input className="border rounded px-2 py-1 w-32" defaultValue={l.id} onChange={e=>l._i=e.target.value}/>
              <input className="border rounded px-2 py-1 flex-1" defaultValue={l.name} onChange={e=>l._n=e.target.value}/>
              <select className="border rounded px-2 py-1" defaultValue={l.schemeId} onChange={e=>l._s=e.target.value}>
                {schemes.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="border rounded px-2" onClick={()=>update(l.id,{ id:l._i??l.id, name:l._n??l.name, schemeId:l._s??l.schemeId, prices:l.prices })}>Lưu</button>
              <button className="text-red-600 border rounded px-2" onClick={()=>remove(l.id)}>Xoá</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b"><th className="py-1">Size</th><th>Giá</th></tr></thead>
              <tbody>
                {sizes.map(s=>(
                  <tr key={s.key} className="border-b">
                    <td className="py-1">{s.label}</td>
                    <td>
                      <input className="border rounded px-2 py-1 w-36" type="number"
                        defaultValue={l.prices?.[s.key]||0}
                        onChange={e=>{ l.prices = {...(l.prices||{}), [s.key]: Number(e.target.value||0)}; }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Tags ---------------- */
function TagsPanel({ user, tags, setTags }) {
  const add = guard(user,"update","settings", (id,label)=>{ const next=[...tags,{id,label}]; setTags(next); writeLS(LS.TAGS,next); audit("tag.add",{id}); });
  const remove = guard(user,"update","settings", (id)=>{ const next=tags.filter(t=>t.id!==id); setTags(next); writeLS(LS.TAGS,next); audit("tag.remove",{id}); });
  const [label,setLabel]=useState(""); const id = label.toLowerCase().trim().replace(/\s+/g,'-');
  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input className="border rounded px-2 py-1" placeholder="Tên tag" value={label} onChange={e=>setLabel(e.target.value)}/>
        <button className="border rounded px-3" onClick={()=>{ if(!id) return; add(id,label||id); setLabel(''); }}>Thêm</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map(t=>(
          <span key={t.id} className="inline-flex items-center gap-2 border rounded-full px-3 py-1 text-sm">
            {t.label} <button className="text-red-600" onClick={()=>remove(t.id)}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Users ---------------- */
function UsersPanel({ user }) {
  const canManage = can(user,"manage","users");
  const users = authApi.allUsers(); const [list,setList]=useState(users);
  function save(next){ setList(next); authApi.setUsers(next); }
  if(!canManage) return <p className="text-sm text-gray-500">Bạn không có quyền quản lý người dùng.</p>;
  function setRole(id,role){ const next=list.map(u=>u.id===id?{...u,role}:u); save(next); audit("user.role.update",{id,role}); }
  function remove(id){ if(id===users.find(u=>u.role==="owner")?.id) return alert("Không thể xoá owner."); const next=list.filter(u=>u.id!==id); save(next); audit("user.delete",{id}); }
  function add(){ const username=prompt("username?"); const password=prompt("password?"); const role=prompt("role? (owner|manager|editor|staff|viewer)","viewer"); if(!username||!password) return; const id=crypto.randomUUID?.()||String(Date.now()); const next=[{id,username,password,role,name:username},...list]; save(next); audit("user.create",{id,username,role}); }
  return (
    <div>
      <button className="border rounded px-3 mb-3" onClick={add}>Thêm user</button>
      <table className="w-full text-sm">
        <thead><tr className="text-left border-b"><th className="py-2">Username</th><th>Role</th><th width="1"></th></tr></thead>
        <tbody>
          {list.map(u=>(
            <tr key={u.id} className="border-b">
              <td className="py-2">{u.username}</td>
              <td>
                <select className="border rounded px-2 py-1" value={u.role} onChange={e=>setRole(u.id,e.target.value)}>
                  {["owner","manager","editor","staff","viewer"].map(r=><option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td><button className="text-red-600" onClick={()=>remove(u.id)}>Xoá</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Audit ---------------- */
function AuditPanel() {
  const items = readAudit();
  return (
    <div className="text-sm overflow-auto">
      <table className="w-full">
        <thead><tr className="text-left border-b"><th className="py-2">Thời gian</th><th>Sự kiện</th><th>Chi tiết</th></tr></thead>
        <tbody>
          {items.map(x=>(
            <tr key={x.id} className="border-b align-top">
              <td className="py-2">{new Date(x.ts).toLocaleString()}</td>
              <td>{x.event}</td>
              <td><pre className="whitespace-pre-wrap">{JSON.stringify(x.payload,null,2)}</pre></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
