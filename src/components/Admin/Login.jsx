import { useState } from "react";
import { authApi } from "../../utils.js";
export default function Login({ onLogin }){
  const [u,setU]=useState('owner'), [p,setP]=useState('owner'), [err,setErr]=useState('');
  function submit(e){ e.preventDefault(); const user = authApi.login(u,p); if(user){ onLogin?.(user); } else { setErr('Sai tài khoản hoặc mật khẩu'); } }
  return (<div className="max-w-sm mx-auto p-4">
    <h2 className="text-xl font-semibold mb-3">Đăng nhập</h2>
    <form onSubmit={submit} className="space-y-2">
      <input className="border rounded px-3 py-2 w-full" placeholder="username" value={u} onChange={e=>setU(e.target.value)}/>
      <input className="border rounded px-3 py-2 w-full" placeholder="password" type="password" value={p} onChange={e=>setP(e.target.value)}/>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <button className="border rounded px-3 py-2 w-full" type="submit">Đăng nhập</button>
    </form></div>);
}
