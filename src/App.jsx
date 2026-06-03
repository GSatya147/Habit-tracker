import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const Fonts = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    input[type="checkbox"]{accent-color:#f0a84e;cursor:pointer;}
    select option{background:#1a1d26;color:#e6ecf5;}
    ::-webkit-scrollbar{width:5px;height:5px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:#2e3350;border-radius:3px;}
    ::-webkit-scrollbar-thumb:hover{background:#f0a84e55;}
  `}</style>
);

const C = {
  bg: '#111318', s1: '#1a1d26', s2: '#22263a', s3: '#2a2f48',
  bd: '#2e3350', bdS: '#3d4268',
  acc: '#f0a84e', accD: 'rgba(240,168,78,0.13)',
  ok: '#4cc98a', okD: 'rgba(76,201,138,0.13)',
  err: '#f26868', errD: 'rgba(242,104,104,0.13)',
  warn: '#e8c84a',
  text: '#e6ecf5', muted: '#7a80a0', lo: '#4a5070',
  mono: '"JetBrains Mono",monospace',
  body: '"DM Sans",system-ui,sans-serif',
  disp: '"Syne",system-ui,sans-serif',
};

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const ROW_H   = 38;
const THEAD_H = 58;

const DEFAULTS = [
  { id:'h1', name:'Wake up at 6:00 AM',  emoji:'🌅' },
  { id:'h2', name:'Exercise',             emoji:'💪' },
  { id:'h3', name:'Read 10 pages',        emoji:'📖' },
  { id:'h4', name:'Meditation',           emoji:'🧘' },
  { id:'h5', name:'No social media 1H',   emoji:'📵' },
];

// Storage 
const db = {
  get: async (key) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch { return null; }
  },
  set: async (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch(e) { console.warn('storage write failed', key, e); }
  },
};

// Responsive hook 
const useIsMobile = () => {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
};

// Calendar utils
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const buildWeeks  = (y, m) => {
  const total = daysInMonth(y, m);
  const weeks = [];
  for (let s = 1; s <= total; s += 7) {
    const days = [];
    for (let d = s; d < s + 7 && d <= total; d++)
      days.push({ date: d, dayName: DAYS[new Date(y, m, d).getDay()] });
    weeks.push(days);
  }
  return weeks;
};

// Sub-components
function Donut({ pct }) {
  const r = 38, cx = 50, cy = 50;
  const circ   = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.s3} strokeWidth="13"/>
      {pct > 0 && (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.acc} strokeWidth="13"
          strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round"
          style={{transition:'stroke-dashoffset 0.55s cubic-bezier(.4,0,.2,1)'}}/>
      )}
      <text x={cx} y={cy-3}  textAnchor="middle" fill={C.text}  fontSize="13" fontWeight="700" fontFamily={C.mono}>{Math.round(pct*100)}%</text>
      <text x={cx} y={cy+13} textAnchor="middle" fill={C.muted} fontSize="8"  fontFamily={C.body}>overall</text>
    </svg>
  );
}

function ProgBar({ pct }) {
  const color = pct >= 0.8 ? C.ok : pct >= 0.5 ? C.warn : C.err;
  return (
    <div style={{background:C.s3,borderRadius:4,height:7}}>
      <div style={{height:'100%',borderRadius:4,background:color,width:`${Math.round(pct*100)}%`,
        transition:'width 0.4s ease',minWidth:pct>0?4:0}}/>
    </div>
  );
}

// Main 
export default function HabitTracker() {
  const now = new Date();
  const isMobile = useIsMobile();

  const [year,   setYear]   = useState(now.getFullYear());
  const [month,  setMonth]  = useState(now.getMonth());
  const [habits, setHabits] = useState([]);
  const [checks, setChecks] = useState({});
  const [ready,  setReady]  = useState(false);

  const [modal,         setModal]         = useState(null);
  const [mName,         setMName]         = useState('');
  const [mEmoji,        setMEmoji]        = useState('✅');
  const [pendingDelete, setPendingDelete] = useState(null);

  // Bootstrap
  useEffect(() => {
    (async () => {
      const h = await db.get('habits');
      const s = await db.get('settings');
      setHabits(h ?? DEFAULTS);
      if (s) { setYear(s.year); setMonth(s.month); }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const c = await db.get(`checks:${year}-${month}`);
      setChecks(c ?? {});
    })();
  }, [year, month, ready]);

  useEffect(() => { if (ready) db.set('habits', habits); }, [habits, ready]);
  useEffect(() => { if (ready) db.set('settings', { year, month }); }, [year, month, ready]);

  const toggle = useCallback((hid, day) => {
    setChecks(prev => {
      const key  = `${hid}-${day}`;
      const next = { ...prev, [key]: !prev[key] };
      db.set(`checks:${year}-${month}`, next);
      return next;
    });
  }, [year, month]);

  const weeks     = buildWeeks(year, month);
  const totalDays = daysInMonth(year, month);
  const isToday   = (d) => now.getFullYear() === year && now.getMonth() === month && now.getDate() === d;

  const stats = habits.map(h => {
    let done = 0;
    for (let d = 1; d <= totalDays; d++) if (checks[`${h.id}-${d}`]) done++;
    return { ...h, done, goal: totalDays, left: totalDays - done, pct: totalDays > 0 ? done / totalDays : 0 };
  });

  const totalGoal  = habits.length * totalDays;
  const totalDone  = stats.reduce((s, h) => s + h.done, 0);
  const totalLeft  = totalGoal - totalDone;
  const overallPct = totalGoal > 0 ? totalDone / totalGoal : 0;

  const dailyData = Array.from({ length: totalDays }, (_, i) => {
    const d    = i + 1;
    const done = habits.filter(h => checks[`${h.id}-${d}`]).length;
    return { label: String(d), pct: habits.length > 0 ? Math.round(done / habits.length * 100) : 0 };
  });

  const weeklyData = weeks.map((wk, i) => {
    const done  = wk.reduce((s, { date }) => s + habits.filter(h => checks[`${h.id}-${date}`]).length, 0);
    const total = wk.length * habits.length;
    return { label: `W${i + 1}`, pct: total > 0 ? Math.round(done / total * 100) : 0 };
  });

  const openAdd  = () => { setMName(''); setMEmoji('✅'); setModal('add'); setPendingDelete(null); };
  const openEdit = (h) => { setMName(h.name); setMEmoji(h.emoji); setModal(h); setPendingDelete(null); };
  const closeModal = () => setModal(null);

  const doAdd = () => {
    if (!mName.trim()) return;
    setHabits(p => [...p, { id: `h${Date.now()}`, name: mName.trim(), emoji: mEmoji }]);
    closeModal();
  };
  const doEdit = () => {
    if (!mName.trim()) return;
    setHabits(p => p.map(h => h.id === modal.id ? { ...h, name: mName.trim(), emoji: mEmoji } : h));
    closeModal();
  };
  const doDelete = (id) => {
    setHabits(p => p.filter(h => h.id !== id));
    setChecks(prev => {
      const next = Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(`${id}-`)));
      db.set(`checks:${year}-${month}`, next);
      return next;
    });
    setPendingDelete(null);
  };

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);
  const tt = {
    background: C.s2, border:`1px solid ${C.bd}`, borderRadius:6,
    color:C.text, fontSize:11, fontFamily:C.mono, padding:'4px 10px',
  };

  if (!ready) return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',alignItems:'center',
      justifyContent:'center',fontFamily:C.body,color:C.muted}}>
      <Fonts/>
      <div style={{textAlign:'center'}}>
        <div style={{fontFamily:C.disp,fontSize:28,fontWeight:800,color:C.acc,letterSpacing:1}}>HABIT TRACKER</div>
        <div style={{fontSize:13,color:C.lo,marginTop:8}}>Loading your data...</div>
      </div>
    </div>
  );

  const thSticky = (extraH, bg = C.s1) => ({
    position:'sticky', left:0, zIndex:4, background:bg,
    width:240, minWidth:240, height:extraH,
  });

  return (
    <div style={{fontFamily:C.body,background:C.bg,minHeight:'100vh',color:C.text,padding:isMobile?10:16}}>
      <Fonts/>

      {/* TOP ROW */}
      <div style={{
        display:'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap:10,
        marginBottom:10,
        alignItems:'stretch',
      }}>

        {/* Title + Settings — on mobile: row with two columns */}
        <div style={{
          display:'flex',
          flexDirection: isMobile ? 'row' : 'column',
          gap:8,
          flexShrink:0,
          width: isMobile ? '100%' : 178,
        }}>
          {/* Title card */}
          <div style={{background:C.s1,border:`1px solid ${C.bd}`,borderTop:`2px solid ${C.acc}`,
            borderRadius:8,padding:'14px 12px',textAlign:'center',flex:1,
            display:'flex',flexDirection:'column',justifyContent:'center',gap:3}}>
            <div style={{fontFamily:C.disp,fontSize:9,letterSpacing:4,color:C.lo}}>HABIT TRACKER</div>
            <div style={{fontFamily:C.disp,fontSize:17,fontWeight:800,color:C.acc,letterSpacing:1,lineHeight:1.1}}>
              {MONTHS[month].toUpperCase()}
            </div>
            <div style={{fontFamily:C.mono,fontSize:11,color:C.lo,marginTop:2}}>{year}</div>
          </div>

          {/* Settings + Add button */}
          <div style={{display:'flex',flexDirection:'column',gap:8,flex: isMobile ? 1 : undefined}}>
            <div style={{background:C.s1,border:`1px solid ${C.bd}`,borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:8,letterSpacing:2.5,color:C.lo,marginBottom:8,fontFamily:C.mono}}>CALENDAR SETTINGS</div>
              {[
                { label:'YEAR',  val:year,  fn:v=>setYear(Number(v)),  opts:years.map(y=>({v:y,l:String(y)})) },
                { label:'MONTH', val:month, fn:v=>setMonth(Number(v)), opts:MONTHS.map((m,i)=>({v:i,l:m.slice(0,3).toUpperCase()})) },
              ].map(({label,val,fn,opts}) => (
                <div key={label} style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                  <span style={{fontSize:9,color:C.lo,width:40,letterSpacing:1,flexShrink:0,fontFamily:C.mono}}>{label}</span>
                  <select value={val} onChange={e=>fn(e.target.value)}
                    style={{background:C.s2,color:C.text,border:`1px solid ${C.bd}`,borderRadius:4,
                      padding:'3px 6px',fontSize:11,fontFamily:C.mono,cursor:'pointer',flex:1}}>
                    {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <button onClick={openAdd}
              style={{background:C.acc,color:C.bg,border:'none',borderRadius:8,padding:'9px 0',
                cursor:'pointer',fontWeight:700,fontSize:11,letterSpacing:2,fontFamily:C.body}}>
              + ADD HABIT
            </button>
          </div>
        </div>

        {/* Charts row — on mobile: stack vertically */}
        <div style={{
          display:'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap:10,
          flex:1,
          minWidth:0,
        }}>
          {/* Daily Progress */}
          <div style={{background:C.s1,border:`1px solid ${C.bd}`,borderRadius:8,padding:'10px 10px 6px',flex:2,minWidth:0}}>
            <div style={{fontSize:8,letterSpacing:3,color:C.muted,marginBottom:6,fontFamily:C.mono}}>DAILY PROGRESS</div>
            <div style={{width:'100%',height:132}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{top:0,right:2,bottom:0,left:-32}} barCategoryGap="12%">
                  <XAxis dataKey="label" tick={{fill:C.lo,fontSize:8,fontFamily:C.mono}}
                    interval={Math.max(0,Math.floor(totalDays/8)-1)}/>
                  <YAxis tick={{fill:C.lo,fontSize:8,fontFamily:C.mono}} domain={[0,100]}
                    tickFormatter={v=>`${v}%`} tickCount={3}/>
                  <Tooltip formatter={v=>[`${v}%`,'Done']} contentStyle={tt} cursor={{fill:C.accD}}/>
                  <Bar dataKey="pct" fill={C.acc} radius={[2,2,0,0]} maxBarSize={13}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weekly + Stats + Donut row — always horizontal */}
          <div style={{display:'flex',gap:10,minWidth:0}}>
            {/* Weekly Progress */}
            <div style={{background:C.s1,border:`1px solid ${C.bd}`,borderRadius:8,padding:'10px 10px 6px',flex:1,minWidth:0}}>
              <div style={{fontSize:8,letterSpacing:3,color:C.muted,marginBottom:6,fontFamily:C.mono}}>WEEKLY PROGRESS</div>
              <div style={{width:'100%',height:132}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{top:0,right:2,bottom:0,left:-32}}>
                    <XAxis dataKey="label" tick={{fill:C.lo,fontSize:9,fontFamily:C.mono}}/>
                    <YAxis tick={{fill:C.lo,fontSize:8,fontFamily:C.mono}} domain={[0,100]}
                      tickFormatter={v=>`${v}%`} tickCount={3}/>
                    <Tooltip formatter={v=>[`${v}%`,'Done']} contentStyle={tt} cursor={{fill:C.okD}}/>
                    <Bar dataKey="pct" fill={C.ok} radius={[2,2,0,0]} maxBarSize={40}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Stat cards */}
            <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
              {[
                {label:'GOAL',val:totalGoal,color:C.text},
                {label:'DONE',val:totalDone,color:C.ok},
                {label:'LEFT',val:totalLeft,color:C.err},
              ].map(({label,val,color})=>(
                <div key={label} style={{background:C.s1,border:`1px solid ${C.bd}`,borderRadius:8,
                  padding:'6px 14px',textAlign:'center',minWidth:isMobile?64:82}}>
                  <div style={{fontSize:8,letterSpacing:2,color:C.lo,fontFamily:C.mono}}>{label}</div>
                  <div style={{fontFamily:C.mono,fontSize:isMobile?18:24,fontWeight:700,color,lineHeight:1.2,marginTop:2}}>{val}</div>
                </div>
              ))}
            </div>

            {/* Donut */}
            {!isMobile && (
              <div style={{background:C.s1,border:`1px solid ${C.bd}`,borderRadius:8,padding:'10px 12px',
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0,gap:2}}>
                <div style={{fontSize:8,letterSpacing:3,color:C.lo,fontFamily:C.mono}}>OVERALL</div>
                <Donut pct={overallPct}/>
              </div>
            )}
          </div>

          {/* Donut on mobile — shown as a small inline strip */}
          {isMobile && (
            <div style={{background:C.s1,border:`1px solid ${C.bd}`,borderRadius:8,padding:'8px 12px',
              display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div>
                <div style={{fontSize:8,letterSpacing:3,color:C.lo,fontFamily:C.mono,marginBottom:2}}>OVERALL COMPLETION</div>
                <div style={{fontFamily:C.mono,fontSize:22,fontWeight:700,color:C.acc}}>{Math.round(overallPct*100)}%</div>
              </div>
              <Donut pct={overallPct}/>
            </div>
          )}
        </div>
      </div>

      {/* ════ BOTTOM: Habits + Analysis ══════════════════════════ */}
      <div style={{
        display:'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap:10,
        alignItems:'flex-start',
      }}>

        {/* Scrollable habits table */}
        {(() => {
          const dateCols = weeks.reduce((s, wk) => s + wk.length, 0);
          const tW = 240 + dateCols * 34;
          return (
            <div style={{flex:1,minWidth:0,width:'100%',overflowX:'auto',background:C.s1,border:`1px solid ${C.bd}`,borderRadius:8}}>
              <div style={{width:tW,minWidth:tW}}>
                <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
                  <thead>
                    <tr>
                      <th style={{...thSticky(26),textAlign:'left',borderBottom:`1px solid ${C.bd}`,padding:'0 10px'}}>
                        <span style={{fontSize:8,letterSpacing:3,color:C.lo,fontFamily:C.mono}}>MY HABITS</span>
                      </th>
                      {weeks.map((wk,wi)=>(
                        <th key={wi} colSpan={wk.length}
                          style={{height:26,textAlign:'center',color:C.acc,fontSize:10,fontWeight:700,
                            letterSpacing:0.5,borderBottom:`1px solid ${C.bd}`,borderLeft:`2px solid ${C.bdS}`,
                            fontFamily:C.mono,padding:0}}>
                          Week {wi+1}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      <th style={{...thSticky(32),borderBottom:`2px solid ${C.bdS}`}}/>
                      {weeks.map((wk,wi)=>wk.map(({date,dayName},di)=>(
                        <th key={`${wi}-${di}`}
                          style={{height:32,minWidth:33,padding:'0 2px',textAlign:'center',
                            borderBottom:`2px solid ${C.bdS}`,
                            borderLeft:di===0?`2px solid ${C.bdS}`:`1px solid ${C.bd}`,
                            background:isToday(date)?C.accD:'transparent'}}>
                          <div style={{fontSize:8,color:isToday(date)?C.acc:C.lo,fontFamily:C.mono}}>{dayName}</div>
                          <div style={{fontSize:10,fontWeight:isToday(date)?700:500,
                            color:isToday(date)?C.acc:C.text,fontFamily:C.mono}}>{date}</div>
                        </th>
                      )))}
                    </tr>
                  </thead>
                  <tbody>
                    {habits.length===0 ? (
                      <tr>
                        <td colSpan={999} style={{padding:'38px 24px',textAlign:'center',color:C.muted,fontSize:13}}>
                          No habits yet —{' '}
                          <button onClick={openAdd}
                            style={{background:'none',border:'none',cursor:'pointer',color:C.acc,
                              fontWeight:600,fontFamily:C.body,fontSize:13}}>
                            + Add your first habit
                          </button>
                        </td>
                      </tr>
                    ) : stats.map((h,hi)=>{
                      const rowBg  = hi%2===0 ? C.s1 : C.s2;
                      const isPend = pendingDelete === h.id;
                      return (
                        <tr key={h.id}>
                          <td style={{position:'sticky',left:0,zIndex:2,background:rowBg,
                            height:ROW_H,width:240,minWidth:240,
                            padding:'0 6px 0 10px',borderBottom:`1px solid ${C.bd}`}}>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <span style={{fontSize:15,flexShrink:0}}>{h.emoji}</span>
                              <span style={{flex:1,fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',
                                textOverflow:'ellipsis',fontSize:12,maxWidth:136}}>{h.name}</span>
                              <div style={{display:'flex',gap:2,alignItems:'center',flexShrink:0}}>
                                {isPend ? (
                                  <>
                                    <button onClick={()=>doDelete(h.id)}
                                      style={{background:C.errD,border:`1px solid ${C.err}44`,color:C.err,
                                        cursor:'pointer',padding:'2px 6px',borderRadius:3,
                                        fontSize:9,fontWeight:700,letterSpacing:0.5,fontFamily:C.mono}}>
                                      DEL
                                    </button>
                                    <button onClick={()=>setPendingDelete(null)}
                                      style={{background:'none',border:'none',cursor:'pointer',
                                        color:C.lo,fontSize:15,fontWeight:700,padding:'0 3px',lineHeight:1}}>
                                      ×
                                    </button>
                                  </>
                                ):(
                                  <>
                                    <button onClick={()=>openEdit(h)} title="Edit"
                                      style={{background:'none',border:'none',cursor:'pointer',color:C.lo,
                                        fontSize:12,padding:'2px 4px',borderRadius:3,lineHeight:1,fontFamily:C.mono}}
                                      onMouseEnter={e=>e.currentTarget.style.color=C.acc}
                                      onMouseLeave={e=>e.currentTarget.style.color=C.lo}>
                                      ✏
                                    </button>
                                    <button onClick={()=>setPendingDelete(h.id)} title="Delete"
                                      style={{background:'none',border:'none',cursor:'pointer',color:C.lo,
                                        fontSize:15,padding:'2px 4px',borderRadius:3,lineHeight:1,fontWeight:700}}
                                      onMouseEnter={e=>e.currentTarget.style.color=C.err}
                                      onMouseLeave={e=>e.currentTarget.style.color=C.lo}>
                                      ×
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                          {weeks.map((wk,wi)=>wk.map(({date},di)=>{
                            const chk     = !!checks[`${h.id}-${date}`];
                            const todayBg = isToday(date) ? (chk ? C.okD : C.accD) : 'transparent';
                            return (
                              <td key={`${wi}-${di}`}
                                style={{height:ROW_H,textAlign:'center',
                                  borderBottom:`1px solid ${C.bd}`,
                                  borderLeft:di===0?`2px solid ${C.bdS}`:`1px solid ${C.bd}`,
                                  background:todayBg}}>
                                <input type="checkbox" checked={chk} onChange={()=>toggle(h.id,date)}
                                  style={{width:14,height:14}}/>
                              </td>
                            );
                          }))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* Analysis panel */}
        <div style={{
          flexShrink:0,
          width: isMobile ? '100%' : 318,
          background:C.s1,
          border:`1px solid ${C.bd}`,
          borderRadius:8,
          overflow:'hidden',
        }}>
          <div style={{height:THEAD_H,display:'flex',flexDirection:'column',justifyContent:'flex-end',
            borderBottom:`2px solid ${C.bdS}`,background:C.s2}}>
            <div style={{textAlign:'center',paddingBottom:3,fontFamily:C.mono,
              fontSize:9,letterSpacing:4,color:C.acc,fontWeight:700}}>
              ANALYSIS
            </div>
            <div style={{display:'grid',gridTemplateColumns:'42px 42px 42px 1fr 54px',
              padding:'0 8px 6px',alignItems:'center'}}>
              {['GOAL','DONE','LEFT','PROGRESS','%'].map(h=>(
                <div key={h} style={{fontSize:8,letterSpacing:1.5,color:C.lo,
                  textAlign:'center',fontFamily:C.mono}}>{h}</div>
              ))}
            </div>
          </div>

          {habits.length===0 ? (
            <div style={{height:ROW_H*3,display:'flex',alignItems:'center',
              justifyContent:'center',color:C.lo,fontSize:12}}>
              No habits to analyse
            </div>
          ) : stats.map((h,hi)=>(
            <div key={h.id}
              style={{display:'grid',gridTemplateColumns:'42px 42px 42px 1fr 54px',
                padding:'0 8px',height:ROW_H,alignItems:'center',
                borderBottom:`1px solid ${C.bd}`,
                background:hi%2===0?'transparent':C.s2}}>
              <div style={{textAlign:'center',color:C.muted,fontFamily:C.mono,fontSize:11}}>{h.goal}</div>
              <div style={{textAlign:'center',color:C.ok,fontWeight:700,fontFamily:C.mono,fontSize:11}}>{h.done}</div>
              <div style={{textAlign:'center',color:h.left>0?C.err:C.ok,fontWeight:700,fontFamily:C.mono,fontSize:11}}>{h.left}</div>
              <div style={{padding:'0 6px'}}><ProgBar pct={h.pct}/></div>
              <div style={{textAlign:'center',fontWeight:700,fontFamily:C.mono,fontSize:10,
                color:h.pct>=0.8?C.ok:h.pct>=0.5?C.warn:C.err}}>
                {(h.pct*100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════ MODAL ══════════════════════════════════════════════ */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(10,10,18,0.88)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16}}
          onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div style={{background:C.s1,border:`1px solid ${C.bd}`,borderTop:`2px solid ${C.acc}`,
            borderRadius:12,padding:28,width:'100%',maxWidth:400,
            boxShadow:'0 32px 64px rgba(0,0,0,0.7)'}}>
            <div style={{fontFamily:C.disp,fontSize:13,fontWeight:800,color:C.acc,
              letterSpacing:3,marginBottom:22}}>
              {modal==='add'?'ADD HABIT':'EDIT HABIT'}
            </div>

            <div style={{display:'flex',gap:12,marginBottom:18}}>
              <div>
                <div style={{fontSize:8,letterSpacing:2,color:C.lo,marginBottom:5,fontFamily:C.mono}}>EMOJI</div>
                <input value={mEmoji} onChange={e=>setMEmoji(e.target.value)} maxLength={2}
                  style={{background:C.s2,color:C.text,border:`1px solid ${C.bd}`,borderRadius:6,
                    padding:'8px 10px',fontSize:20,width:52,textAlign:'center',
                    outline:'none',fontFamily:'system-ui'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:8,letterSpacing:2,color:C.lo,marginBottom:5,fontFamily:C.mono}}>HABIT NAME</div>
                <input value={mName} onChange={e=>setMName(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&(modal==='add'?doAdd():doEdit())}
                  placeholder="e.g. Wake up at 6:00 AM" autoFocus
                  style={{background:C.s2,color:C.text,border:`1px solid ${C.bd}`,borderRadius:6,
                    padding:'9px 12px',fontSize:13,width:'100%',
                    outline:'none',fontFamily:C.body}}/>
              </div>
            </div>

            <div style={{display:'flex',gap:8}}>
              <button onClick={modal==='add'?doAdd:doEdit}
                style={{flex:1,background:C.acc,color:C.bg,border:'none',borderRadius:6,
                  padding:'11px 0',cursor:'pointer',fontWeight:700,
                  fontSize:12,letterSpacing:1.5,fontFamily:C.body}}>
                {modal==='add'?'ADD':'UPDATE'}
              </button>
              <button onClick={closeModal}
                style={{flex:1,background:'transparent',color:C.muted,
                  border:`1px solid ${C.bd}`,borderRadius:6,padding:'11px 0',
                  cursor:'pointer',fontSize:12,fontFamily:C.body}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}