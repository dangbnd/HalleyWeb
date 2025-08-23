import { useState, useMemo, useRef } from "react";
import SearchBox from "./SearchBox.jsx";

function isInBranch(item, key) {
  if (!key) return false;
  if (item.key === key) return true;
  return (item.children || []).some((c) => isInBranch(c, key));
}

function Node({ item, depth, onNavigate, currentKey, variant = "root" }) {
  const [open, setOpen] = useState(false);
  const tRef = useRef(null);
  const hasKids = Array.isArray(item.children) && item.children.length > 0;
  const active = item.key === currentKey;
  const inBranch = !active && hasKids && isInBranch(item, currentKey);

  const openNow = () => { clearTimeout(tRef.current); setOpen(true); };
  const scheduleClose = () => { clearTimeout(tRef.current); tRef.current = setTimeout(() => setOpen(false), 200); };

  const rootBtn = "px-3 h-9 rounded-md text-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400";
  const rootTone = active ? "text-rose-700 bg-rose-50" : inBranch ? "text-rose-600" : "text-gray-700";
  const menuBtn = "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50";
  const menuTone = active ? "bg-rose-50 text-rose-700" : "text-gray-700";

  return (
    <div className="relative" onMouseEnter={openNow} onMouseLeave={scheduleClose}>
      <button
        className={variant === "root" ? `${rootBtn} ${rootTone}` : `${menuBtn} ${menuTone}`}
        onClick={() => { if (hasKids) setOpen(v=>!v); else onNavigate(item.key); }}
      >
        <span className="inline-flex items-center gap-1">
          {item.label}
          {hasKids && <span className={`text-xs transition-transform ${open ? "rotate-180" : ""} ${variant === "menu" ? "absolute right-2" : ""}`}>▾</span>}
        </span>
      </button>

      {hasKids && (
        <div
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
          className={[
            "absolute z-50 min-w-52 p-1 rounded-lg shadow-md bg-white/95 ring-1 ring-gray-200 backdrop-blur",
            depth === 0 ? "left-0 top-full mt-1" : "left-full top-0 ml-2",
            open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none",
            "transition"
          ].join(" ")}
        >
          <div className="py-1">
            {item.children.map((ch) => (
              <Node key={ch.key} item={ch} depth={depth + 1} onNavigate={onNavigate} currentKey={currentKey} variant="menu" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Header({ currentKey, navItems, onNavigate, logoText, hotline,
  searchQuery, onSearchChange, onSearchSubmit, suggestions=[], onSuggestionSelect }) {
  const roots = useMemo(() => navItems || [], [navItems]);
  return (
    <header className="bg-white/90 backdrop-blur sticky top-0 z-40 border-b border-gray-100">
      <div className="max-w-6xl mx-auto flex justify-between items-center p-4">
        <div className="font-semibold text-lg cursor-pointer tracking-wide" onClick={() => onNavigate("home")}>{logoText}</div>
        <nav className="hidden md:flex items-center gap-2">
          {roots.map((it) => (<Node key={it.key} item={it} depth={0} onNavigate={onNavigate} currentKey={currentKey} />))}
        </nav>
        <div className="md:hidden">
          <select className="border rounded-md px-2 py-1" value={currentKey} onChange={(e) => onNavigate(e.target.value)}>
            {roots.map((i) => (<option key={i.key} value={i.key}>{i.label}</option>))}
          </select>
        </div>
        {/* Search */}
        <div className="hidden md:block">
          <SearchBox
            value={searchQuery}
            onChange={onSearchChange}
            onSubmit={()=>onSearchSubmit?.()}
            suggestions={suggestions}
            onSelect={onSuggestionSelect}
          />
        </div>
{/* <div className="hidden md:block text-sm text-gray-600">{hotline}</div> */}
      </div>
    </header>
  );
}
