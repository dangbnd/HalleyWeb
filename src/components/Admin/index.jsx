
import React, { useState } from "react";
import AuthGuard from "./core/AuthGuard.jsx";
import { Card } from "./ui/primitives.jsx";
import ProductsPanel from "./panels/ProductsPanel.jsx";
import TypeSizePanel from "./panels/TypeSizePanel.jsx";
function Sidebar({ current, set }){
  const items = [
    { key:"products", label:"Sản phẩm" },
    { key:"typesize", label:"Loại & Size" },
    { key:"categories", label:"Danh mục" },
    { key:"tags", label:"Tag" },
    { key:"pages", label:"Trang" },
    { key:"users", label:"Người dùng" },
    { key:"audit", label:"Nhật ký" },
  ];
  return (<aside className="w-56 shrink-0"><Card className="p-2">{items.map(it=> (<button key={it.key} className={"w-full text-left px-3 py-2 rounded-lg " + (current===it.key ? "bg-black text-white" : "hover:bg-gray-100")} onClick={()=>set(it.key)}>{it.label}</button>))}</Card></aside> );
}
function Stub({ title }){ return <Card className="p-6"><div className="text-gray-500">Panel “{title}” sẽ được hoàn thiện sau.</div></Card>; }
export default function AdminIndex(){
  const [tab, setTab] = useState("products");
  return (<AuthGuard minRole="editor"><div className="min-h-[calc(100vh-100px)] bg-gray-100 p-4"><div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[14rem_1fr] gap-4"><Sidebar current={tab} set={setTab} /><div className="space-y-4">{tab==="products" && <ProductsPanel />}{tab==="typesize" && <TypeSizePanel />}{tab==="categories" && <Stub title="Danh mục" />}{tab==="tags" && <Stub title="Tag" />}{tab==="pages" && <Stub title="Trang" />}{tab==="users" && <Stub title="Người dùng" />}{tab==="audit" && <Stub title="Nhật ký" />}</div></div></div></AuthGuard> );
}
