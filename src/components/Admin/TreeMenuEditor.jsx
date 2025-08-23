import { useRef, useEffect, useMemo, useState } from "react";
import { can, writeLS, LS, audit } from "../../utils.js";

function deepClone(v){ return JSON.parse(JSON.stringify(v||[])); }
function pathKey(p){ return p.join("."); }
function getByPath(tree,p){ let cur=tree; for(let i=0;i<p.length;i++){ cur=(i===p.length-1)?cur[p[i]]:(cur[p[i]].children||(cur[p[i]].children=[])); } return cur; }
function setByPath(tree,p,next){ if(p.length===1){ tree[p[0]]=next; return; } const parent=getByPath(tree,p.slice(0,-1)); parent.children[p[p.length-1]]=next; }
function removeAt(tree,p){ if(p.length===1){ tree.splice(p[0],1); return; } const parent=getByPath(tree,p.slice(0,-1)); parent.children.splice(p[p.length-1],1); }
function moveAt(tree,p,dir){ const parentPath=p.slice(0,-1), idx=p[p.length-1]; const parent=parentPath.length?getByPath(tree,parentPath):tree; const arr=parentPath.length?parent.children:parent; const to=idx+dir; if(to<0||to>=arr.length) return false; const [x]=arr.splice(idx,1); arr.splice(to,0,x); return true; }
function ensureChildren(n){ if(!Array.isArray(n.children)) n.children=[]; return n; }

export default function TreeMenuEditor({ user, value=[], onSave, defaultMenu=[] }){
  const canEdit = can(user,"update","menu");
  const [draft,setDraft]=useState(()=>deepClone(value));
  const [expanded,setExpanded]=useState({});
  const [dirty,setDirty]=useState(false);
  useEffect(()=>{ setDraft(deepClone(value)); setDirty(false); setExpanded({}); },[value]);
  useEffect(()=>{ const m={}; draft.forEach((_,i)=>m[String(i)]=true); setExpanded(m); },[draft.length]);
  const dups = useMemo(() => {
  const seen = new Set(), d = [];
  const walk = (arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((n) => {
        if (seen.has(n.key)) d.push(n.key);
        seen.add(n.key);
        walk(n.children || []);
      });
    };
    walk(draft);
    return Array.from(new Set(d));
  }, [draft]);
  
  const saveTimer = useRef(null);

  // Tự lưu sau 400ms mỗi khi draft đổi
  useEffect(() => {
    if (!dirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      writeLS(LS.MENU, draft);
      onSave?.(JSON.parse(JSON.stringify(draft)));
      setDirty(false);
      audit("menu.autosave", { count: draft.length });
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [draft, dirty]);


  function toggleExpand(p){ const k=pathKey(p); setExpanded(s=>({...s,[k]:!s[k]})); }
  function updateNode(p,patch){ setDraft(prev=>{ const next=deepClone(prev); const node=getByPath(next,p); setByPath(next,p,{...ensureChildren(node),...patch}); return next; }); setDirty(true); }
  function addChild(p,item){ setDraft(prev=>{ const next=deepClone(prev); const parent=p.length?ensureChildren(getByPath(next,p)):next; const list=p.length?parent.children:parent; list.push({key:item.key,label:item.label||item.key,children:[]}); return next; }); setDirty(true); setExpanded(s=>({...s,[pathKey(p)]:true})); }
  function removeNode(p){ setDraft(prev=>{ const next=deepClone(prev); removeAt(next,p); return next; }); setDirty(true); }
  function moveNode(p,dir){ setDraft(prev=>{ const next=deepClone(prev); const ok=moveAt(next,p,dir); return ok?next:prev; }); setDirty(true); }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className={`border rounded px-3 ${!canEdit?'opacity-50 cursor-not-allowed':''}`} onClick={()=>addChild([], { key: prompt("Key cấp 1?") || "", label: prompt("Nhãn?") || "" })} disabled={!canEdit}>+ cấp 1</button>
        <button className={`border rounded px-3 ${dirty&&draft.length>0?'':'opacity-50 cursor-not-allowed'}`} onClick={()=>{ if(!(dirty&&draft.length>0)) return; writeLS(LS.MENU,draft); audit("menu.save.all",{count:draft.length}); onSave?.(deepClone(draft)); setDirty(false); }} disabled={!(dirty&&draft.length>0)}>Lưu thay đổi</button>
        <button className="border rounded px-3" onClick={()=>{ setDraft(deepClone(value)); setDirty(false); }}>Hoàn tác</button>
        <button className="border rounded px-3" onClick={()=>{ setDraft(deepClone(defaultMenu)); setDirty(true); }}>Khôi phục mặc định</button>
        {dups.length>0 && <span className="text-xs text-orange-600">Trùng key: {dups.join(", ")}</span>}
      </div>
      <div className="border rounded-lg">
        {draft.length===0 && <div className="p-3 text-sm text-gray-500">Chưa có mục nào.</div>}
        {draft.map((n,i)=>(
          <Row key={i} node={n} path={[i]} depth={0} expanded={expanded}
               onToggleExpand={toggleExpand} onEdit={updateNode} onAdd={addChild}
               onRemove={removeNode} onMove={moveNode} />
        ))}
      </div>
    </div>
  );
}
function Row({ node, path, depth, expanded, onToggleExpand, onEdit, onAdd, onRemove, onMove }){
  const k=path.join("."), isOpen=expanded[k], hasKids=Array.isArray(node.children)&&node.children.length>0;
  const [editing,setEditing]=useState(false), [showAdd,setShowAdd]=useState(false);
  const [ekey,setEkey]=useState(node.key), [elabel,setElabel]=useState(node.label);
  const [ckey,setCkey]=useState(""), [clabel,setClabel]=useState("");
  useEffect(()=>{ setEkey(node.key); setElabel(node.label); },[node.key,node.label]);

  return (<div>
    <div className="flex items-center gap-2 px-3 py-2 border-b last:border-0" style={{paddingLeft:12+depth*16}}>
      <button className={`w-5 text-xs ${hasKids?"":"opacity-40 cursor-default"}`} onClick={()=>hasKids&&onToggleExpand(path)}>{hasKids?(isOpen?"▾":"▸"):"•"}</button>
      {editing?<>
        <input className="border rounded px-2 py-1 w-44" value={ekey} onChange={e=>setEkey(e.target.value)}/>
        <input className="border rounded px-2 py-1 flex-1" value={elabel} onChange={e=>setElabel(e.target.value)}/>
        <button className="border rounded px-2" onClick={()=>{ onEdit(path,{key:ekey,label:elabel}); setEditing(false); }}>Lưu</button>
        <button className="border rounded px-2" onClick={()=>{ setEkey(node.key); setElabel(node.label); setEditing(false); }}>Huỷ</button>
      </>:<>
        <div className="flex-1 truncate">{node.label} <span className="text-xs text-gray-500">({node.key})</span></div>
        <button className="border rounded px-2" onClick={()=>setEditing(true)}>Sửa</button>
      </>}
      <button className="border rounded px-2" onClick={()=>onMove(path,-1)}>↑</button>
      <button className="border rounded px-2" onClick={()=>onMove(path,+1)}>↓</button>
      <button className="border rounded px-2" onClick={()=>setShowAdd(v=>!v)}>+</button>
      <button className="text-red-600 border rounded px-2" onClick={()=>onRemove(path)}>Xoá</button>
    </div>
    {showAdd&&(
      <div className="px-3 py-2 border-b last:border-0" style={{paddingLeft:12+(depth+1)*16}}>
        <div className="flex items-center gap-2">
          <input className="border rounded px-2 py-1 w-44" placeholder="key" value={ckey} onChange={e=>setCkey(e.target.value)}/>
          <input className="border rounded px-2 py-1 flex-1" placeholder="nhãn" value={clabel} onChange={e=>setClabel(e.target.value)}/>
          <button className="border rounded px-2" onClick={()=>{ if(!ckey) return; onAdd(path,{key:ckey,label:clabel}); setCkey(""); setClabel(""); setShowAdd(false); }}>Thêm</button>
          <button className="border rounded px-2" onClick={()=>setShowAdd(false)}>Đóng</button>
        </div>
      </div>
    )}
    {isOpen&&hasKids&&node.children.map((c,idx)=>(
      <Row key={idx} node={c} path={[...path,idx]} depth={depth+1} expanded={expanded}
           onToggleExpand={onToggleExpand} onEdit={onEdit} onAdd={onAdd}
           onRemove={onRemove} onMove={onMove}/>
    ))}
  </div>);
}
