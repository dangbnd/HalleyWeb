import { useEffect, useMemo, useState } from "react";
import ImageUploader from "./ImageUploader.jsx";
import TagPicker from "./TagPicker.jsx";
import { LS, writeLS } from "../../utils.js";
import { sizesForProduct } from "../../services/sheets";

export default function ProductEditor({ product, onSave, onCancel, categories, types, schemes, levels, tags, setTags }) {
  const isEdit = Boolean(product?.id);
  const [name,setName]=useState(product?.name||"");
  const [category,setCategory]=useState(product?.category||categories[0]?.key||"");
  const [typeId,setTypeId]=useState(product?.typeId||types[0]?.id||"");
  const [images,setImages]=useState(product?.images||[]);
  const [banner, setBanner] = useState(!!product?.banner);
  const [tagIds,setTagIds]=useState(product?.tags||[]);
  const [mode,setMode]=useState(product?.pricing?.mode||"level"); // level|custom
  const type = useMemo(()=>types.find(t=>t.id===typeId),[types,typeId]);
  const scheme = useMemo(()=>schemes.find(s=>s.id===type?.schemeId),[schemes,type]);
  const [levelId,setLevelId]=useState(product?.pricing?.levelId||"");
  const availableSizes = sizesForProduct(product, types, schemes);
  const levelOptions = useMemo(()=>levels.filter(l=>l.schemeId===scheme?.id),[levels,scheme]);
  useEffect(()=>{ if(levelOptions.length && !levelOptions.some(l=>l.id===levelId)) setLevelId(levelOptions[0]?.id||""); },[scheme?.id]);

  const baseTable = useMemo(()=>{
    const sizes = scheme?.sizes||[];
    if(mode==='level'){
      const lv = levelOptions.find(l=>l.id===levelId);
      return sizes.map(s=>({sizeKey:s.key, price: lv?.prices?.[s.key] ?? 0}));
    }
    const ptab = product?.pricing?.table||[];
    const map = Object.fromEntries(ptab.map(x=>[x.sizeKey,x.price]));
    return sizes.map(s=>({sizeKey:s.key, price: map[s.key] ?? 0}));
  },[mode,levelId,scheme?.id]);

  const [table,setTable]=useState(baseTable);
  useEffect(()=>{ setTable(baseTable); },[baseTable.map(x=>x.sizeKey).join(","), baseTable.map(x=>x.price).join(",")]);

  function submit(){
    const payload = {
      id: product?.id || (crypto.randomUUID?.()||String(Date.now())),
      name, category, typeId, images,banner, tags: tagIds,
      pricing: mode==='level' ? {mode:'level', levelId, table} : {mode:'custom', table}
    };
    onSave?.(payload);
  }

  return (
    <div className="border rounded-xl p-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div><label className="block text-sm mb-1">Tên sản phẩm</label>
          <input className="w-full border rounded px-3 py-2" value={name} onChange={e=>setName(e.target.value)} /></div>
        <div><label className="block text-sm mb-1">Danh mục</label>
          <select className="w-full border rounded px-3 py-2" value={category} onChange={e=>setCategory(e.target.value)}>
            {categories.map(c=><option key={c.key} value={c.key}>{c.title||c.key}</option>)}
          </select></div>
        <div><label className="block text-sm mb-1">Loại bánh</label>
          <select className="w-full border rounded px-3 py-2" value={typeId} onChange={e=>setTypeId(e.target.value)}>
            {types.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="text-xs text-gray-500 mt-1">Scheme size: {scheme?.name||"—"}</div></div>
        <div><label className="block text-sm mb-1">Tag</label>
          <TagPicker all={tags} setAll={(next)=>{ setTags(next); writeLS(LS.TAGS,next); }} value={tagIds} onChange={setTagIds}/>
        </div>
        <div className="md:col-span-2"><label className="block text-sm mb-1">Hình ảnh</label>
          <ImageUploader value={images} onChange={setImages} /></div>
        <div className="md:col-span-2">
          <div className="flex items-center gap-4 mb-2">
            <label className="inline-flex items-center gap-1 text-sm"><input type="radio" name="pmode" checked={mode==='level'} onChange={()=>setMode('level')}/> Giá theo level</label>
            <label className="inline-flex items-center gap-1 text-sm"><input type="radio" name="pmode" checked={mode==='custom'} onChange={()=>setMode('custom')}/> Tự nhập theo size</label>
          </div>
          {mode==='level' && (<div className="flex items-center gap-2 mb-2">
            <span className="text-sm">Level</span>
            <select className="border rounded px-2 py-1" value={levelId} onChange={e=>setLevelId(e.target.value)}>
              {levelOptions.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <span className="text-xs text-gray-500">Tự lấp giá theo level. Có thể chỉnh từng size.</span>
          </div>)}
          <div className="flex items-center gap-2">
            <input id="banner" type="checkbox" checked={banner} onChange={e=>setBanner(e.target.checked)} />
            <label htmlFor="banner" className="text-sm">Hiển thị ở banner (Hero)</label>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-2">Size</th><th>Giá</th></tr></thead>
            <tbody>{table.map((row,i)=>(
              <tr key={row.sizeKey} className="border-b">
                <td className="py-2">{row.sizeKey}</td>
                <td><input className="border rounded px-2 py-1 w-36" type="number" value={row.price}
                  onChange={e=>{ const v=Number(e.target.value||0); setTable(t=>t.map((x,idx)=> idx===i?{...x,price:v}:x)); }}/></td>
              </tr>))}
            </tbody>
          </table>
        </div>
        <div className="md:col-span-2 flex gap-2 justify-end">
          <button className="border rounded px-3" onClick={onCancel}>Huỷ</button>
          <button className="border rounded px-3 bg-rose-600 text-white" onClick={submit}>{isEdit?'Lưu':'Thêm mới'}</button>
        </div>
      </div>
    </div>
  );
}
