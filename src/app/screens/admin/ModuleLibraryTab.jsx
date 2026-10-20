/**
 * ModuleLibraryTab.jsx — the Training Library: preview, edit, duplicate, hide, delete or reset modules
 * Part of app/screens/AdminPortal.jsx. Reads the app's shared state with useApp() (app/AppContext.js).
 */
import { ask } from "../../../shared/Feedback";
import { HelpTip } from "../../../shared/HelpTip";
import { Pill } from "../../../shared/primitives";
import { useApp } from "../../AppContext";

export function ModuleLibraryTab({ staff }) {
  const {
    allModules, assigns, comps, dbDeleteCustomModule, duplicateModule, font, setAtab, setCustomModules,
    setEditingModule, setModuleHidden, setPreviewModule, setShowHiddenModules, showHiddenModules, T
  } = useApp();
  return (
      <div>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:24}}>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:0}}>Training Library <HelpTip dark={false} text="All available training modules. Built-in modules come with the portal. Custom modules are ones you've created. Modules with a renewal period will show as expired when due for re-completion. Hidden modules are removed from this library and the assignment picker, but staff who already have them stay unaffected."/></h2>
          {allModules.some(m=>m._hidden) && (
            <button onClick={()=>setShowHiddenModules(v=>!v)}
              style={{background:showHiddenModules?"rgba(37,99,235,0.1)":T.overlay,color:showHiddenModules?T.accentLt:T.muted,border:`1px solid ${showHiddenModules?"rgba(37,99,235,0.25)":T.borderMd}`,borderRadius:10,padding:"8px 16px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>
              {showHiddenModules?"Hide hidden modules":`👁 Show hidden (${allModules.filter(m=>m._hidden).length})`}
            </button>
          )}
        </div>
        {(() => {
          const visibleModules = allModules.filter(m=>showHiddenModules || !m._hidden);
          return (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
          {visibleModules.map(m=>(
            <div key={m.id} style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,padding:24,border:`1px solid ${m._custom?"rgba(245,158,11,0.35)":T.border}`,opacity:m._hidden?0.55:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
                <span style={{fontSize:36}}>{m.icon||"📋"}</span>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {m._hidden && <span style={{fontSize:10,fontWeight:700,color:T.muted,background:"rgba(148,163,184,0.12)",border:`1px solid ${T.borderMd}`,borderRadius:6,padding:"2px 7px",letterSpacing:.5}}>HIDDEN</span>}
                  {m._custom && <span style={{fontSize:10,fontWeight:700,color:T.gold,background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:6,padding:"2px 7px",letterSpacing:.5}}>CUSTOM</span>}
                  <Pill label={m.level} col={m.level==="Mandatory"?"red":"navy"}/>
                </div>
              </div>
              <h3 style={{margin:"0 0 6px",fontSize:16,fontWeight:800}}>{m.title}</h3>
              <p style={{color:T.muted,fontSize:12,margin:"0 0 14px"}}>{m.category} · {m.duration} · {(m.quiz||[]).length} questions</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:m._custom?12:0}}>
                <Pill label={`${staff.filter(u=>(assigns[u.id]||[]).includes(m.id)).length} assigned`} col="navy"/>
                <Pill label={`${staff.filter(u=>comps[u.id]?.[m.id]).length} completed`} col="green"/>
                <Pill label={`v${m.version||1}`} col="amber"/>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                <button onClick={()=>setPreviewModule(m)}
                  style={{background:T.overlay,color:T.accentLt,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,display:"flex",alignItems:"center",gap:5}}>
                  👁 Preview
                </button>
                <button onClick={()=>{ setEditingModule(m); setAtab("create"); }}
                  style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:`1px solid rgba(37,99,235,0.25)`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                  ✏ Edit
                </button>
                <button onClick={()=>duplicateModule(m)}
                  style={{background:"rgba(148,163,184,0.1)",color:T.slate||T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                  ⧉ Duplicate
                </button>
                {m._hidden ? (
                  <button onClick={()=>setModuleHidden(m,false)}
                    style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:"1px solid rgba(37,99,235,0.25)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                    👁 Unhide
                  </button>
                ) : (
                  <button onClick={async()=>{
                    if(!(await ask({ title: `Hide "${m.title||"this module"}"?`, ok: "Hide module", message: `Hide it from the Training Library?\n\nIt won't appear here or in the assignment picker for new assignments, but staff who already have it assigned or completed keep their records. You can unhide it again at any time.` }))) return;
                    setModuleHidden(m,true);
                  }} style={{background:T.overlay,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                    🙈 Hide
                  </button>
                )}
                {m._custom && !m._override && (
                  <button onClick={async()=>{
                    if(!(await ask({ title: `Delete "${m.title||"this module"}"?`, danger: true, ok: "Delete module", message: "This permanently removes the module, its slides and quiz. Staff who have already completed it keep their completion record.\n\nThis can't be undone." }))) return;
                    setCustomModules(prev=>prev.filter(x=>x.id!==m.id));
                    dbDeleteCustomModule(m.id);
                    setAtab("modules");
                  }} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                    🗑 Delete
                  </button>
                )}
                {m._override && (
                  <button onClick={async()=>{
                    if(!(await ask({ title: `Reset "${m.title||"this module"}"?`, danger: true, ok: "Reset to original", message: "Reset it to its original built-in version? Any customisations you've made will be lost.\n\nThis can't be undone." }))) return;
                    setCustomModules(prev=>prev.filter(x=>x.id!==m.id));
                    dbDeleteCustomModule(m.id);
                    setAtab("modules");
                  }} style={{background:"rgba(245,158,11,0.1)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.25)",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>
                    ↩ Reset to Original
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
          );
        })()}
      </div>
    );
}
