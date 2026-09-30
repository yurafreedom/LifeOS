/* JENKIN prototype — one session-only store for tasks, events, inbox + lifecycle history. window.JKStore */
(function(){
const JK = window.JK;
const listeners = new Set();
const pad = n => String(n).padStart(2,'0');
/* --- timezone helpers: wall-clock in tz <-> UTC instant --- */
function tzOffsetMs(utcMs, tz){
  try {
    const f = new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const p = {}; for (const x of f.formatToParts(new Date(utcMs))) p[x.type]=x.value;
    return Date.UTC(+p.year, +p.month-1, +p.day, +p.hour, +p.minute, +p.second) - utcMs;
  } catch(_) { return 0; }
}
/* Resolve wall-clock → instant. Tries both surrounding offsets; the requested components are round-tripped.
   Returns {ok, date, kind:'unique'|'ambiguous'|'nonexistent', candidates:[{date, offsetMin}]} */
function resolveZoned(y,m,d,h,mi,tz){
  const target = Date.UTC(y,m-1,d,h,mi);
  const offs = [...new Set([tzOffsetMs(target - 36e5*14, tz), tzOffsetMs(target, tz), tzOffsetMs(target + 36e5*14, tz)])];
  const cands = [];
  for (const off of offs){ const utc = target - off; const back = utc + tzOffsetMs(utc, tz); if (back === target) cands.push({date:new Date(utc), offsetMin: off/60000}); }
  cands.sort((a,b)=>a.date-b.date);
  if (cands.length===1) return {ok:true, date:cands[0].date, kind:'unique', candidates:cands};
  if (cands.length>1) return {ok:false, date:null, kind:'ambiguous', candidates:cands};
  return {ok:false, date:null, kind:'nonexistent', candidates:[]};
}
/* Legacy helper: unique → instant; ambiguous → earlier (DST-side) instant by policy; nonexistent → null */
function zonedToUtc(y,m,d,h,mi,tz){ const r = resolveZoned(y,m,d,h,mi,tz); if (r.ok) return r.date; if (r.kind==='ambiguous') return r.candidates[0].date; return null; }
const fmtOff = min => { const s=min>=0?'+':'-'; const a=Math.abs(min); return 'UTC'+s+pad(Math.floor(a/60))+':'+pad(a%60); };
function wall(date, tz){ const off = tzOffsetMs(date.getTime(), tz); const u = new Date(date.getTime()+off); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes()); }
function tzLabel(date, tz){ const off = tzOffsetMs(date.getTime(), tz)/60000; const s = off>=0?'+':'-'; const a=Math.abs(off); return 'UTC'+s+pad(Math.floor(a/60))+(a%60?':'+pad(a%60):''); }
/* --- validation --- */
const dim = (y,m) => new Date(y, m, 0).getDate(); // m 1-12
function validDate(y,m,d){ return Number.isInteger(y)&&Number.isInteger(m)&&Number.isInteger(d)&&y>=1900&&y<=2200&&m>=1&&m<=12&&d>=1&&d<=dim(y,m); }
function validTime(h,mi){ return Number.isInteger(h)&&Number.isInteger(mi)&&h>=0&&h<=23&&mi>=0&&mi<=59; }
function parseLocal(str){ const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(str||''); if(!m) return null; const y=+m[1],mo=+m[2],d=+m[3],h=m[4]!=null?+m[4]:0,mi=m[5]!=null?+m[5]:0; if(!validDate(y,mo,d)||!validTime(h,mi)) return null; return {y,m:mo,d,h,mi}; }
function parseTime(str){ const m=/^(\d{1,2}):(\d{2})$/.exec((str||'').trim()); if(!m) return null; const h=+m[1],mi=+m[2]; return validTime(h,mi)?{h,mi}:null; }
/* --- state --- */
let seq = 100; const nid = p => p + (seq++);
function withWall(e){ const sw = wall(e.start, e.tz), ew = wall(e.end, e.tz); return {...e, sw, ew}; }
const S = {
  tasks: JK.tasks.map(k => ({...k, status: k.status || (k.done ? 'done' : 'open'), created: k.due, noDue: !k.due})),
  events: JK.events.map(e => withWall({...e, start: zonedToUtc(e.start.getFullYear(),e.start.getMonth()+1,e.start.getDate(),e.start.getHours(),e.start.getMinutes(),e.tz), end: zonedToUtc(e.end.getFullYear(),e.end.getMonth()+1,e.end.getDate(),e.end.getHours(),e.end.getMinutes(),e.tz)})),
  inbox: JK.inbox.map(i => ({...i})),
  log: [], // lifecycle history: {at, kind, taskId?, eventId?, title}
};
S.log.push({at:new Date(2026,8,27,18), kind:'completed', id:'t9'},{at:new Date(2026,8,29,9), kind:'completed', id:'t10'},{at:new Date(2026,8,20,12), kind:'archived', id:'t15'},{at:new Date(2026,8,22,17), kind:'closed', id:'t16'});
function emit(){ for (const l of listeners) { try { l(); } catch(_){} } }
const store = {
  get: () => S, subscribe(fn){ listeners.add(fn); return () => listeners.delete(fn); },
  zonedToUtc, resolveZoned, fmtOff, wall, tzLabel, validDate, validTime, parseLocal, parseTime, dim,
  /* tasks */
  addTask(t){ const rec = {id:nid('t'), kind:'routine', status:'open', created:new Date(), due:null, ...t}; rec.noDue = !rec.due; if (rec.noDue) rec.due = null; S.tasks = [...S.tasks, rec]; emit(); return rec; },
  updateTask(id, patch){ S.tasks = S.tasks.map(k => k.id===id ? {...k, ...patch} : k); emit(); },
  removeTask(id){ S.tasks = S.tasks.filter(k => k.id!==id); S.log = S.log.filter(l=>l.id!==id); emit(); },
  setTaskStatus(id, status){ const k = S.tasks.find(x=>x.id===id); if(!k) return; const prev = k.status; S.tasks = S.tasks.map(x => x.id===id ? {...x, status, prevStatus: prev} : x); if (status==='done') S.log.unshift({at:new Date(), kind:'completed', id}); else if (status==='archived') S.log.unshift({at:new Date(), kind:'archived', id}); else if (status==='closed') S.log.unshift({at:new Date(), kind:'closed', id}); else if (status==='open') S.log.unshift({at:new Date(), kind:'restored', id}); emit(); },
  /* events — wall-clock values are interpreted in tz */
  buildEvent(f){ const s = parseLocal(f.start), e = parseLocal(f.end); const errors = {}; if(!f.title||!f.title.trim()) errors.title='required'; if(!s) errors.start='invalid'; if(!e) errors.end='invalid'; const tz = f.tz||'Europe/Kyiv'; let start=null,end=null; const pick=(r,key,chosen)=>{ if (r.ok) return r.date; if (r.kind==='nonexistent'){ errors[key]='nonexistent'; return null; } const c = r.candidates.find(x=>x.offsetMin===+chosen); if (c) return c.date; errors[key]='ambiguous'; errors[key+'Candidates']=r.candidates; return null; };
    if(s){ start = pick(resolveZoned(s.y,s.m,s.d,s.h,s.mi,tz),'start',f.startOffset); } if(e){ end = pick(resolveZoned(e.y,e.m,e.d,e.h,e.mi,tz),'end',f.endOffset); } if(start&&end&&end<start) errors.end='before'; return {errors, ok:Object.keys(errors).length===0, rec:{title:(f.title||'').trim(), type:f.type||'meeting', tz, start, end, participants:(f.participants||'').split(',').map(x=>x.trim()).filter(Boolean), venue:(f.venueName||f.venueAddress)?{name:f.venueName||'',address:f.venueAddress||''}:null, notes:f.notes||''}}; },
  addEvent(rec){ const e = withWall({id:nid('e'), participants:[], venue:null, notes:'', ...rec}); S.events = [...S.events, e]; emit(); return e; },
  updateEvent(id, rec){ S.events = S.events.map(e => e.id===id ? withWall({...e, ...rec}) : e); emit(); },
  removeEvent(id){ S.events = S.events.filter(e => e.id!==id); emit(); },
  restoreEvent(rec){ if (!S.events.some(e=>e.id===rec.id)) S.events = [...S.events, rec]; emit(); },
  /* inbox */
  addInbox(i){ const rec = {id:nid('i'), type:null, at:new Date(), ...i}; S.inbox = [rec, ...S.inbox]; emit(); return rec; },
  updateInbox(id, patch){ S.inbox = S.inbox.map(i => i.id===id ? {...i, ...patch} : i); emit(); },
  removeInbox(id){ S.inbox = S.inbox.filter(i => i.id!==id); emit(); },
};
window.JKStore = store;
})();
