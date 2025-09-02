import React from "react";
import Login from "../Login.jsx";
import { readLS } from "../../../utils.js";

export default function AuthGuard({ children, minRole = "editor", showLogin = true }){
  const me = readLS("auth_user");
  if(!me) return showLogin ? <Login /> : <div className="p-8">Vui lòng đăng nhập.</div>;

  const order = ["staff","editor","manager","owner"];
  const ok = order.indexOf(me?.role) >= order.indexOf(minRole);
  if(!ok) return <div className="p-8">Bạn không có quyền truy cập.</div>;

  return children;
}

export function useMe(){
  return readLS("auth_user");
}
