import { useEffect, useRef } from "react";
export default function ImageUploader({ value = [], onChange }) {
  const ref = useRef(null);
  function addFiles(files){
    const list = Array.from(files||[]).filter(f=>f.type.startsWith("image/"));
    Promise.all(list.map(f=>new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(f);})))
      .then(urls=>onChange?.([...(value||[]), ...urls]));
  }
  function onPaste(e){
    const items=e.clipboardData?.items||[], file=Array.from(items).map(i=>i.getAsFile?.()).find(Boolean);
    if(file&&file.type?.startsWith("image/")){ e.preventDefault(); addFiles([file]); return; }
    const text=e.clipboardData?.getData("text"); if(text&&(text.startsWith("http")||text.startsWith("data:image"))) onChange?.([...(value||[]), text]);
  }
  useEffect(()=>{ const el=ref.current; el?.addEventListener("paste",onPaste); return ()=>el?.removeEventListener("paste",onPaste); },[value]);
  return (<div ref={ref} className="border-2 border-dashed rounded-xl p-3 text-sm"
    onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); addFiles(e.dataTransfer.files);}}>
    <div className="flex items-center gap-2 mb-2">
      <input type="file" accept="image/*" multiple onChange={e=>addFiles(e.target.files)} />
      <button className="border rounded px-3" onClick={()=>onChange?.([])}>Xoá hết</button>
      <span className="text-gray-500">Kéo thả, dán clipboard, hoặc chọn file</span>
    </div>
    <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
      {(value||[]).map((src,idx)=>(
        <div key={idx} className="relative">
          <img src={src} alt="" className="w-full aspect-square object-cover rounded-lg border" />
          <button className="absolute top-1 right-1 bg-white/90 border rounded px-1 text-xs" onClick={()=>onChange?.(value.filter((_,i)=>i!==idx))}>×</button>
        </div>
      ))}
    </div>
  </div>);
}
