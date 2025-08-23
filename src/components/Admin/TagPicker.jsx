import { useMemo, useState } from "react";
export default function TagPicker({ all=[], setAll, value=[], onChange }) {
  const [q,setQ]=useState(""); const filtered=useMemo(()=>all.filter(t=>t.label.toLowerCase().includes(q.toLowerCase())),[q,all]);
  function toggle(tag){ const has=value.includes(tag.id); onChange?.(has?value.filter(x=>x!==tag.id):[...value,tag.id]); }
  function addNew(){ const label=q.trim(); if(!label) return; const id=label.toLowerCase().replace(/\s+/g,'-');
    if(all.some(t=>t.id===id)){ toggle({id,label}); setQ(""); return; }
    const next=[...all,{id,label}]; setAll(next); onChange?.([...value,id]); setQ(""); }
  return (<div>
    <div className="flex gap-2 mb-2">
      <input className="border rounded px-2 py-1 flex-1" placeholder="Tìm hoặc nhập tag mới" value={q} onChange={e=>setQ(e.target.value)} />
      <button className="border rounded px-3" onClick={addNew}>+ Thêm</button>
    </div>
    <div className="flex flex-wrap gap-2">
      {filtered.map(t=>(
        <button key={t.id} className={`px-2 py-1 rounded-full border text-sm ${value.includes(t.id)?'bg-gray-100 border-gray-400':'hover:bg-gray-50'}`} onClick={()=>toggle(t)}>{t.label}</button>
      ))}
    </div>
  </div>);
}
