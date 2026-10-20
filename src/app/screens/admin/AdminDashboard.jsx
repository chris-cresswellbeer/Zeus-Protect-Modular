/**
 * AdminDashboard.jsx — the admin dashboard: KPI cards (drag to reorder) and summary lists
 * Part of app/screens/AdminPortal.jsx. Reads the app's shared state with useApp() (app/AppContext.js).
 */
import React from "react";
import { EXT_CERT_TYPES } from "../../../data/seedExtCerts";
import { compsFor, isWarehouseWorker, machineState } from "../../../data/seedMachinery";
import { fireSummary, todayLocal as fireToday } from "../../../domains/fireSafety/fireLogic";
import { firstAidSummary } from "../../../domains/firstAid/firstAidLogic";
import { riddorDue } from "../../../domains/incidents/riddor";
import { isPassed } from "../../../domains/training/completion";
import { staffTraining } from "../../../domains/training/compliance";
import { getExpiryStatus, localISO, todayISO, ukDate } from "../../../lib/dates";
import { overdueByPerson } from "../../../lib/dueDates";
import { E } from "../../../lib/emoji";
import { getSiteLists } from "../../../lib/siteLists";
import { signinsOnSite } from "../../../lib/siteSignins";
import { dbWrite, sb } from "../../../lib/supabase";
import { Avatar } from "../../../shared/primitives";
import { useApp } from "../../AppContext";
import { LazySortableStatGrid } from "../../lazyParts";

export function AdminDashboard({ staff }) {
  const {
    allMachineTypes, allModules, assigns, comps, contractors, contractorVisits, dashboardLayouts,
    docAcknowledgements, docAssignments, docs, dueDates, equipment, extCerts, fireSafety, firstAidData, font,
    incidents, isMobile, machineComps, quizFailures, ras, setAdminReportView, setAtab, setBulkTarget,
    setDashboardLayouts, setFocusIncidentId, setPagePreset, setShowAdminReportForm, setStaffFilterManager,
    setStaffFilterProgress, setStaffFilterSearch, setStaffGroupByTeam, setStaffStatusFilter, setTarget,
    siteInspections, siteSignins, T, user
  } = useApp();
  const today = todayISO();

  // ── Training stats ────────────────────────────────────────────────
  const staffList = staff;
  const overdueTraining = staffList.filter(u=>{
    const _tr=staffTraining(u.id, assigns, comps, allModules);   // training/compliance.js
    return _tr.total>0 && _tr.good<_tr.total;
  });
  const expiringTraining = staffList.filter(u=>
    (assigns[u.id]||[]).some(mid=>{
      const c=(comps[u.id]||{})[mid];
      const m=allModules.find(x=>x.id===mid);
      if(!c||!m?.renewalMonths) return false;
      const ex=getExpiryStatus(c.date,m.renewalMonths);
      return ex&&(ex.status==="expired"||ex.status==="expiring");
    })
  );

  // ── Incident stats ────────────────────────────────────────────────
  const openIncidents2 = incidents.filter(i=>!i.closed);
  const last30Inc = incidents.filter(i=>i.date>=localISO(new Date(Date.now()-30*86400000)));

  // ── Document stats ────────────────────────────────────────────────
  const unreadDocs = docs.filter(d=>{
    const assigned = docAssignments[d.id]||[];
    return assigned.some(uid=>!(docAcknowledgements[uid]||{})[d.id]);
  });
  const overdueDocReviews = docs.filter(d=>d.reviewDate&&d.reviewDate<today);
  const overdueRAReviews = ras.filter(r=>r.reviewDate&&r.reviewDate<today);

  // ── Equipment stats ───────────────────────────────────────────────
  const overdueEquipment = equipment.filter(e=>e.nextService&&e.nextService<today&&e.status==="active");
  const soonEquipment = equipment.filter(e=>e.nextService&&e.nextService>=today&&Math.ceil((new Date(e.nextService)-new Date())/86400000)<=30&&e.status==="active");
  const outOfService = equipment.filter(e=>e.status==="inactive");

  // ── Quiz failures ─────────────────────────────────────────────────
  const unreviewedFailures = quizFailures.filter(f=>!f.acknowledged);

  // ── External certs ────────────────────────────────────────────────
  const expiredExtCerts = [];
  staffList.forEach(u=>{
    EXT_CERT_TYPES.forEach(ct=>{
      const cert=(extCerts[u.id]||{})[ct.id];
      if(cert&&cert.expiryDate&&cert.expiryDate<today) expiredExtCerts.push({user:u,cert,certType:ct});
    });
  });

  // Each figure opens the list behind it, already filtered (click, or Tab + Enter)
  const showStaff = progress => { setStaffFilterSearch(""); setStaffFilterManager("all"); setStaffStatusFilter("all"); setStaffGroupByTeam(false); setStaffFilterProgress(progress); setAtab("users"); };
  const showOpenIncidents = () => { setPagePreset({tab:"incidents",status:"open"}); setAtab("incidents"); };
  const card = (icon,label,value,sub,col,urgent,onClick) => (
    <div onClick={onClick} role={onClick?"button":undefined} tabIndex={onClick?0:undefined} title={onClick?`Show ${label.toLowerCase()}`:undefined}
      aria-label={onClick?`${label}: ${value}${sub?`, ${sub}`:""}. Show these.`:undefined} data-testid={onClick?"dash-figure":undefined}
      onKeyDown={e=>{ if(onClick&&(e.key==="Enter"||e.key===" ")){ e.preventDefault(); onClick(); } }}
      style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,padding:"18px 20px",border:`1px solid ${urgent?"rgba(239,68,68,0.4)":col?"rgba(245,158,11,0.25)":T.border}`,cursor:onClick?"pointer":"default",transition:"transform .15s,box-shadow .15s"}}
      onMouseEnter={e=>{if(onClick){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.3)";}}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:.5,color:T.muted,textTransform:"uppercase",marginBottom:6}}>{label}</div>
          <div style={{fontSize:32,fontWeight:900,color:urgent?"#f87171":col?"#f59e0b":value===0?T.green:T.white,lineHeight:1}}>{value}</div>
          {sub && <div style={{fontSize:11,color:T.muted,marginTop:5}}>{sub}</div>}
        </div>
        <span style={{fontSize:28,opacity:.7}}>{icon}</span>
      </div>
    </div>
  );

  const section = (title, children) => (
    <div style={{marginBottom:28}}>
      <h3 style={{fontSize:14,fontWeight:700,letterSpacing:.5,color:T.muted,textTransform:"uppercase",margin:"0 0 12px"}}>{title}</h3>
      {children}
    </div>
  );

  const listCard = (items, emptyMsg, renderItem, onMoreClick) => (
    <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:14,border:`1px solid ${T.border}`,overflow:"hidden"}}>
      {items.length===0
        ? <div style={{padding:"20px",textAlign:"center",color:T.green,fontSize:13,fontWeight:600}}>✓ {emptyMsg}</div>
        : items.slice(0,5).map((item,i)=>(
          <div key={i} style={{padding:"12px 16px",borderTop:i>0?`1px solid ${T.border}`:"none",display:"flex",alignItems:"center",gap:12}}>
            {renderItem(item,i)}
          </div>
        ))
      }
      {items.length>5 && (
        <div onClick={onMoreClick} style={{padding:"8px 16px",borderTop:`1px solid ${T.border}`,fontSize:11,color:onMoreClick?T.accentLt:T.muted,textAlign:"center",cursor:onMoreClick?"pointer":"default",fontWeight:onMoreClick?700:400,transition:"background .15s"}}
          onMouseEnter={e=>{if(onMoreClick)e.currentTarget.style.background="rgba(37,99,235,0.08)";}}
          onMouseLeave={e=>{e.currentTarget.style.background="";}}>
          +{items.length-5} more{onMoreClick?" →":""}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Admin Dashboard</h2>
          <p style={{color:T.muted,fontSize:13,margin:0}}>Health & Safety overview — {new Date().toLocaleDateString("en-GB",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setShowAdminReportForm(true);setAtab("incidents");}} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>+ Report Incident</button>
        </div>
      </div>

      {/* Stat grid — order is draggable per-admin via the ⠿⠿ handle, saved to Supabase */}
      {(() => {
        const statCardDefs = [
          { id:"trainingIncomplete", node: card(E("📚",""),"Training Incomplete",overdueTraining.length,`of ${staffList.length} staff`,null,overdueTraining.length>0,()=>showStaff("incomplete")) },
          { id:"trainingPastDue", node: (()=>{ const by = overdueByPerson(assigns, dueDates, (uid, mid) => isPassed((comps[uid]||{})[mid]));
              const people = staffList.filter(u=>(u.status||"active")!=="leaver" && by[String(u.id)]); const n = people.reduce((t,u)=>t+by[String(u.id)],0);
              return card(E("⏰",""),"Training Past Due",people.length,n?`${n} assignment${n!==1?"s":""} late`:"none late",null,people.length>0,()=>showStaff("pastdue")); })() },
          { id:"expiringExpired", node: card(E("🔄",""),"Expiring/Expired",expiringTraining.length,"training renewals",expiringTraining.length>0,false,()=>{setAtab("reports");setAdminReportView("expiry");}) },
          { id:"openIncidents", node: card(E("⚠️",""),"Open Incidents",openIncidents2.length,(()=>{ const un=incidents.filter(i=>riddorDue(i)); const late=un.filter(i=>riddorDue(i).state==="overdue").length; return `${un.length} RIDDOR unreported${late?` · ${late} overdue`:""}`; })(),null,incidents.some(i=>riddorDue(i)),showOpenIncidents) },
          { id:"unreadDocuments", node: card(E("📄",""),"Unread Documents",unreadDocs.length,"assigned but unacknowledged",unreadDocs.length>0,false,()=>{setAtab("reports");setAdminReportView("documents");}) },
          { id:"equipmentOverdue", node: card(E("🔧",""),"Equipment Overdue",overdueEquipment.length,"service overdue",null,overdueEquipment.length>0,()=>{setPagePreset({tab:"equipment",show:"overdue"});setAtab("equipment");}) },
          { id:"machineryRenewals", node: (()=>{ let ex=0, soon=0;
              staffList.filter(u=>(u.status||"active")!=="leaver"&&u.role!=="admin"&&isWarehouseWorker(u)).forEach(u=>compsFor(machineComps,u.id).forEach(c=>{
                if (!allMachineTypes.some(t=>t.id===c.machineId)) return;
                const k=machineState(c,allMachineTypes).key; if(k==="expired")ex++; else if(k==="expiring")soon++; }));
              return card(E("🏗",""),"Machinery Renewals",ex+soon,ex?`${ex} overdue · ${soon} due in 60 days`:soon?`${soon} due in 60 days`:"all in date",soon>0&&!ex,ex>0,()=>{setPagePreset({tab:"machinery",show:"attention"});setAtab("machinery");}); })() },
          { id:"outOfService", node: card(E("📋",""),"Out of Service",outOfService.length,"equipment items",null,false,()=>{setPagePreset({tab:"equipment",status:"inactive"});setAtab("equipment");}) },
          { id:"quizFailures", node: card(E("❌",""),"Quiz Failures",unreviewedFailures.length,"unreviewed",unreviewedFailures.length>0,false,()=>{setAtab("reports");setAdminReportView("failures");}) },
          { id:"reviewsOverdue", node: card(E("📅",""),"Reviews Overdue",overdueDocReviews.length+overdueRAReviews.length,"docs & RAs",overdueDocReviews.length+overdueRAReviews.length>0,false,()=>setAtab(overdueDocReviews.length||!overdueRAReviews.length?"documents":"ra")) },
          { id:"onSiteNow", node: (()=>{
            const onSiteWorkers = [];
            (contractors||[]).forEach(c=>{
              const todayV=(contractorVisits[c.id]||[]).filter(v=>v.date===today);
              todayV.forEach(v=>{
                if(v.workers&&v.workers.length>0) v.workers.forEach(wid=>{const w=(c.workers||[]).find(x=>x.id===wid);if(w)onSiteWorkers.push(w.name);});
                else onSiteWorkers.push(c.name);
              });
            });
            signinsOnSite(siteSignins, today).forEach(s=>onSiteWorkers.push(s.data.workerName));
            const uniqueOnSite=[...new Set(onSiteWorkers)];
            return card(E("🪪",""),"On Site Now",uniqueOnSite.length,uniqueOnSite.length>0?uniqueOnSite.slice(0,2).join(", ")+(uniqueOnSite.length>2?` +${uniqueOnSite.length-2} more`:""):"No contractors today",null,false,()=>setAtab("contractors"));
          })() },
          { id:"fireSafety", node: (()=>{
            // same rules as the Fire Safety screen (domains/fireSafety/fireLogic.js)
            const f = fireSummary({ fireSafety: fireSafety||{}, extCerts: extCerts||{}, staff: staffList, inspections: siteInspections||[], today: fireToday() });
            const sub = f.issues>0?`${f.issues} item${f.issues!==1?"s":""} need attention`:(f.daysSinceDrill!==null?`Last drill ${f.daysSinceDrill}d ago`:"No drills recorded");
            return card(E("🔥",""),"Fire Safety",f.wardens.length,sub,null,f.issues>0,()=>setAtab("firesafety"));
          })() },
          { id:"firstAid", node: (()=>{
            // the same list and rules as the First Aid register (domains/firstAid/firstAidLogic.js)
            const faSum = firstAidSummary({ firstAidData, extCerts, staff: staffList, zones: getSiteLists().firstAidZones, shifts: getSiteLists().firstAidShifts });
            const validAiders = faSum.inDate, gapCount = faSum.gaps, expiredCount = faSum.expired.length + faSum.undated.length;
            const sub = validAiders.length===0 ? "No qualified first aiders" :
              gapCount>0 ? `${gapCount} zone/shift gap${gapCount!==1?"s":""}` :
              expiredCount>0 ? `${expiredCount} cert${expiredCount!==1?"s":""} expired or undated` :
              "All shifts covered";
            const isAlert = validAiders.length===0 || gapCount>0 || expiredCount>0;
            return card(E("🩺",""),"First Aid",validAiders.length,sub,null,isAlert,()=>setAtab("firstaid"));
          })() },
        ];

        // Saved order is filtered against current card ids, and any NEW cards are appended — so
        // adding/removing a card in statCardDefs never breaks a saved layout.
        const defaultOrder = statCardDefs.map(c => c.id);
        const savedOrder = (dashboardLayouts[String(user.id)] || []).filter(id => defaultOrder.includes(id));
        const order = [...savedOrder, ...defaultOrder.filter(id => !savedOrder.includes(id))];
        const nodeById = Object.fromEntries(statCardDefs.map(c => [c.id, c.node]));

        const onReorder = newOrder => {
          setDashboardLayouts(prev => ({ ...prev, [String(user.id)]: newOrder }));
          dbWrite(sb.from("dashboard_layout").upsert({ user_id: String(user.id), card_order: newOrder }, { onConflict: "user_id" }), "dashboard layout");
        };
        const gridStyle = {display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:14,marginBottom:28};
        // the drag-and-drop grid loads separately; until then the same cards show without handles
        return (
          <React.Suspense fallback={<div style={gridStyle}>{order.map(id => <div key={id}>{nodeById[id]}</div>)}</div>}>
            <LazySortableStatGrid order={order} nodeById={nodeById} onReorder={onReorder} gridStyle={gridStyle}/>
          </React.Suspense>
        );
      })()}

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20}}>
        {/* Incomplete training */}
        {section("Staff with incomplete training",
          listCard(overdueTraining,"All staff training complete",u=>{
            const _tr=staffTraining(u.id, assigns, comps, allModules), a=_tr.total, d=_tr.good, pct=_tr.pct;   // training/compliance.js
            return (<>
              <Avatar name={u.name} size={28}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div>
                <div style={{fontSize:11,color:T.muted}}>{d}/{a} modules · {pct}%</div>
              </div>
              <button onClick={()=>{setBulkTarget("individual");setTarget(String(u.id));setAtab("assign");}} style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:`1px solid ${T.accent}33`,borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>Assign →</button>
            </>);
          },()=>showStaff("incomplete"))
        )}

        {/* Open incidents */}
        {section("Open incidents",
          listCard(openIncidents2,"No open incidents",inc=>(
            <>
              <span style={{fontSize:18,flexShrink:0}}>{{accident:"🚑",near_miss:"⚠️",unsafe_condition:"🏗",unsafe_act:"🚫"}[inc.type]||"📋"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{inc.description?.slice(0,60)}{inc.description?.length>60?"…":""}</div>
                <div style={{fontSize:11,color:T.muted}}>{ukDate(inc.date)} · {inc.location}</div>
              </div>
              {inc.riddor&&!inc.riddorReported&&<span style={{fontSize:10,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,0.1)",padding:"2px 7px",borderRadius:6,border:"1px solid rgba(239,68,68,0.25)",flexShrink:0}}>RIDDOR ⚠</span>}
              <button onClick={()=>{setFocusIncidentId(inc.id);setAtab("incidents");}} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>View →</button>
            </>
          ),showOpenIncidents)
        )}

        {/* Equipment overdue */}
        {section("Equipment service due",
          listCard([...overdueEquipment,...soonEquipment].slice(0,5),"All equipment servicing up to date",e=>{
            const overdue = e.nextService<today;
            const days = Math.ceil((new Date(e.nextService)-new Date())/86400000);
            return (<>
              <span style={{fontSize:18,flexShrink:0}}>🔧</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</div>
                <div style={{fontSize:11,color:overdue?"#f87171":"#f59e0b"}}>{overdue?`Overdue by ${Math.abs(days)}d`:`Due in ${days}d`} · {e.location||"—"}</div>
              </div>
              <button onClick={()=>setAtab("equipment")} style={{background:"rgba(245,158,11,0.1)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.2)",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>View →</button>
            </>);
          },()=>setAtab("equipment"))
        )}

        {/* Expiring external certs */}
        {section("Expired external certificates",
          listCard(expiredExtCerts,"All external certificates valid",(item)=>(
            <>
              <span style={{fontSize:18,flexShrink:0}}>{item.certType.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.user.name}</div>
                <div style={{fontSize:11,color:"#f87171"}}>{item.certType.label} expired {ukDate(item.cert.expiryDate)}</div>
              </div>
              <button onClick={()=>setAtab("assign")} style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:font,flexShrink:0}}>Update →</button>
            </>
          ),()=>setAtab("assign"))
        )}
      </div>

      {/* Recent activity */}
      {section("Recent incidents (last 30 days)",
        listCard(last30Inc,"No incidents in the last 30 days",inc=>(
          <>
            <span style={{fontSize:16,flexShrink:0}}>{{accident:"🚑",near_miss:"⚠️",unsafe_condition:"🏗",unsafe_act:"🚫"}[inc.type]||"📋"}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:T.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{inc.description?.slice(0,70)}{inc.description?.length>70?"…":""}</div>
              <div style={{fontSize:11,color:T.muted}}>{ukDate(inc.date)} · {inc.location} · {inc.closed?"Closed":"Open"}</div>
            </div>
          </>
        ),()=>setAtab("incidents"))
      )}
    </div>
  );
}
