/**
 * MyHistoryTab.jsx — Training History: completed modules and certificates
 * Part of app/screens/StaffPortal.jsx. Reads the app's shared state with useApp() (app/AppContext.js).
 */
import { PASS_MARK, isPassed, scoreText } from "../../../domains/training/completion";
import { ukDate } from "../../../lib/dates";
import { E } from "../../../lib/emoji";
import { HelpTip } from "../../../shared/HelpTip";
import { MobileCard, MobileCardRow } from "../../../shared/hooks";
import { Pill } from "../../../shared/primitives";
import { useApp } from "../../AppContext";
import { myOverview } from "./myOverview";

export function MyHistoryTab() {
  const app = useApp();
  const {
    allModules, compHistory, font, isMobile, setCert, T, user
  } = app;
  const {
    myC
  } = myOverview(app);
  return (
      <div>
        <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,marginBottom:24}}>Training History <HelpTip dark={true} text="A record of all modules you've completed, including your score and the date. Use the certificate button to view and print your certificates."/></h2>
        {!Object.keys(myC).length
          ? <p style={{color:T.muted}}>No completed training yet.</p>
          : (
            <div>{isMobile ? (
              <div>
                {allModules.filter(m=>myC[m.id]).map((m)=>(
                  <MobileCard key={m.id}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:20}}>{m.icon}</span>
                      <span style={{fontWeight:700,fontSize:14,color:T.white}}>{m.title}</span>
                    </div>
                    <MobileCardRow label="Date" value={myC[m.id].date}/>
                    <MobileCardRow label="Score" value={<span style={{color:isPassed(myC[m.id])?T.green:T.amber,fontWeight:800}}>{scoreText(myC[m.id])}</span>}/>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:4}}>
                      <Pill label={myC[m.id].recorded?"Completed":isPassed(myC[m.id])?"Passed":"Failed"} col={isPassed(myC[m.id])?"green":"red"}/>
                      {isPassed(myC[m.id]) && !myC[m.id].recorded && <button onClick={()=>setCert({module:m,score:myC[m.id].score,date:myC[m.id].date,certId:myC[m.id].certId||null,moduleVersion:myC[m.id].moduleVersion||null})} style={{background:"rgba(245,158,11,0.1)",border:`1px solid rgba(245,158,11,0.3)`,color:T.gold,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>🏅 Certificate</button>}
                    </div>
                  </MobileCard>
                ))}
              </div>
            ) : (
            <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${T.border}`}}>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"12px 20px",background:T.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,textTransform:"uppercase"}}>
                <span>Module</span><span>Date</span><span>Score</span><span>Status</span>
              </div>
              {allModules.filter(m=>myC[m.id]).map((m,i)=>(
                <div key={m.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"16px 20px",borderTop:i>0?`1px solid ${T.border}`:"none",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}><span>{m.icon}</span><span style={{fontSize:14,fontWeight:700}}>{m.title}</span></div>
                  <span style={{color:T.muted,fontSize:13}}>{ukDate(myC[m.id].date)}</span>
                  <span title={myC[m.id].recorded?"Recorded from your earlier training records":undefined} style={{color:isPassed(myC[m.id])?T.green:T.amber,fontWeight:800,fontSize:15}}>{scoreText(myC[m.id])}</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Pill label={myC[m.id].recorded?"Completed":isPassed(myC[m.id])?"Passed":"Failed"} col={isPassed(myC[m.id])?"green":"red"}/>
                    {isPassed(myC[m.id])&&!myC[m.id].recorded&&<button onClick={()=>setCert({module:m,score:myC[m.id].score,date:myC[m.id].date,certId:myC[m.id].certId||null,moduleVersion:myC[m.id].moduleVersion||null})} style={{background:"rgba(245,158,11,0.1)",border:`1px solid rgba(245,158,11,0.3)`,color:T.gold,borderRadius:8,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font}}>🏅 Cert</button>}
                  </div>
                </div>
              ))}
            </div>)}</div>
          )}
        {/* Passed results for EARLIER versions of a module (kept when a module is
            updated — see saveModuleVersion). Certificates stay viewable. */}
        {(()=>{
          const earlier = compHistory.filter(h=>String(h.user_id)===String(user.id) && (h.cert_id || h.recorded || Number(h.score)>=PASS_MARK) && (()=>{
            const m = allModules.find(x=>String(x.id)===String(h.module_id));
            return m && (h.module_version||1) < (m.version||1);
          })()).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
          if (!earlier.length) return null;
          return (
            <div style={{marginTop:28}}>
              <h3 style={{fontSize:15,fontWeight:800,margin:"0 0 10px",color:T.white}}>Earlier versions</h3>
              <p style={{color:T.muted,fontSize:12,margin:"0 0 12px"}}>Modules you passed before they were updated. Your result and certificate for that version are kept here.</p>
              <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${T.border}`}}>
                {earlier.map((h,i)=>{ const m=allModules.find(x=>String(x.id)===String(h.module_id)); return (
                  <div key={i} style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto":"2fr 1fr 1fr 1fr",gap:8,padding:"12px 20px",borderTop:i>0?`1px solid ${T.border}`:"none",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}><span>{m.icon}</span><span style={{fontSize:13,fontWeight:700}}>{m.title} <span style={{color:T.muted,fontWeight:600}}>· v{h.module_version||1}</span></span></div>
                    {!isMobile && <span style={{color:T.muted,fontSize:13}}>{ukDate(h.date)}</span>}
                    {!isMobile && <span style={{color:T.green,fontWeight:800,fontSize:14}}>{h.score}%</span>}
                    <button onClick={()=>setCert({module:m,score:h.score,date:h.date,certId:h.cert_id||null,moduleVersion:h.module_version||null})} style={{justifySelf:"start",background:`${T.gold}1A`,border:`1px solid ${T.gold}4D`,color:T.gold,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>{E("🏅 ","")}Certificate</button>
                  </div>
                );})}
              </div>
            </div>
          );
        })()}
      </div>
    );
}
