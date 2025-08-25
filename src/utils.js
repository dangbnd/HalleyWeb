export const LS = {
  AUTH:'auth', USERS:'users', AUDIT:'audit',
  PRODUCTS:'products', CATEGORIES:'categories', MENU:'menu', PAGES:'pages',
  TAGS:'tags', SCHEMES:'schemes', TYPES:'types', LEVELS:'levels',
  FB_URLS: "fb_urls",
};

export function readLS(key, fallback){
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e){ return fallback; }
}
export function writeLS(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

const defaultUsers = [
  { id:'u1', username:'owner',   password:'owner',   role:'owner',   name:'Owner' },
  { id:'u2', username:'manager', password:'manager', role:'manager', name:'Manager' },
  { id:'u3', username:'editor',  password:'editor',  role:'editor',  name:'Editor' },
  { id:'u4', username:'staff',   password:'staff',   role:'staff',   name:'Staff' },
];

export const authApi = {
  allUsers(){
    const users = readLS(LS.USERS, defaultUsers);
    if(!readLS(LS.USERS, null)) writeLS(LS.USERS, users);
    return users;
  },
  setUsers(list){ writeLS(LS.USERS, list); },
  login(username, password){
    const u = this.allUsers().find(x=>x.username===username && x.password===password);
    if(!u) return null;
    writeLS(LS.AUTH, u); return u;
  },
  logout(){ localStorage.removeItem(LS.AUTH); }
};

const roleOrder = { owner:5, manager:4, editor:3, staff:2, viewer:1 };
export function can(user, action, resource){
  const lvl = roleOrder[user?.role || 'viewer'] || 0;
  if(action==='read') return true;
  if(['create','update'].includes(action)) return lvl>=3;
  if(action==='delete') return lvl>=4;
  if(action==='manage' && resource==='users') return lvl>=5;
  if(action==='update' && resource==='settings') return lvl>=3;
  return false;
}
export function guard(user, action, resource, fn){
  return (...args) => { if(!can(user, action, resource)) return; return fn(...args); };
}

function uid(){ return Math.random().toString(36).slice(2) + Date.now().toString(36); }
export function audit(event, payload){
  const list = readLS(LS.AUDIT, []);
  list.unshift({ id: uid(), ts: Date.now(), event, payload });
  writeLS(LS.AUDIT, list.slice(0, 500));
}
export function readAudit(){ return readLS(LS.AUDIT, []); }
