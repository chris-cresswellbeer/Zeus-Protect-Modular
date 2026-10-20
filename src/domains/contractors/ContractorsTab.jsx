import React from "react";
import { useWindowWidth } from "../../shared/hooks";
import { ContractorDetail } from "./ContractorDetail";
import { CompanyForm } from "./CompanyForm";
import { useRemembered } from "../../lib/remembered";
import { HelpTip } from "../../shared/HelpTip";
import { useSiteSignins, signinsToReview, useSigninSettings } from "../../lib/siteSignins";
import { SigninReview, QrAddedReview } from "./SigninPanel";
import { OnSiteBoard, ApprovalChip, useRegisterCatchUp } from "./OnSiteBoard";
import { approvalOf } from "../../lib/contractorApproval";

import { localISO, todayISO, ukDate } from "../../lib/dates";
/**
 * ContractorsTab — admin contractor management:
 *   • On Site Right Now (OnSiteBoard.jsx): QR sign-ins and visits logged here, with what to
 *     know about each (approval, permit), Sign out, the end-of-day check and the fire roll call
 *   • "Added from QR sign-in – check" (SigninPanel.jsx QrAddedReview): companies and workers the
 *     QR sign-in added to the register, to confirm or merge into the right entry
 *   • the register: approval (lib/contractorApproval.js: required documents on file and in
 *     date, or banned / inactive), search and filter, expired worker certificates
 * Selecting a company opens ContractorDetail.
 *
 * CONTRACTOR DATA MODEL (the app's shared state (app/useAppState.js) → Supabase table)
 *   contractors          [ { id:"con_<ts>" | "con_qr_<…>", name, type, status, email, phone, notes,
 *                            createdFrom:"qr", checked, possibleDuplicates:[id], lastOnSite, signinCount,
 *                            documents:[{ id, type, title, fileName, fileUrl, date, uploadedAt, uploadedBy, note }],
 *                            workers:[{ id:"w_<ts>", name, role, email, phone,
 *                                       createdFrom, checked, firstInducted, lastSignin, signinCount }] } ]   → contractors
 *   contractorVisits     { [companyId]: [ { id:"v_<ts>", date, timeIn, timeOut, purpose, areas,
 *                            signedInBy, workers:[workerId], permitRequired, notes, scheduled? } ] } → contractor_visits
 *   contractorInductions { ["<companyId>_<workerId>"]: { [inductionItemId]: {done,date,by} } } → contractor_inductions
 *   contractorCerts      { ["<companyId>_<workerId>"]: { [certTypeId]: {fileName,fileUrl,issuedDate,expiryDate} } } → contractor_certs
 *   NB: inductions and certs are keyed per WORKER using the composite "<companyId>_<workerId>"
 *   string (stored in the contractor_id column). Induction items / cert types: data/seedContractors.js.
 */
function ContractorsTab({ contractors, setContractors, contractorInductions, setContractorInductions, contractorCerts, setContractorCerts, contractorVisits, setContractorVisits, dbSaveContractor, dbDeleteContractor, dbSaveContractorInductions, dbSaveContractorCerts, dbSaveContractorVisits, staff, permits = [], me, refreshContractors, focusContractorId, setFocusContractorId, T, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [view, setView] = React.useState("list");
  const [selected, setSelected] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const [filterRaw, setFilterStatus] = useRemembered("contractors.approval", "all");
  const filterStatus = ["all","approved","docs","blocked","new"].includes(filterRaw) ? filterRaw : "all";
  const [search, setSearch] = React.useState("");
  // Quick search (app/quickSearch.js) asks for a particular contractor: open it, then clear the request.
  React.useEffect(() => {
    if (!focusContractorId) return;
    setSelected(focusContractorId); setView("detail");
    setFocusContractorId && setFocusContractorId(null);
  }, [focusContractorId]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = todayISO();
  const signins = useSiteSignins(true, { fresh: true });
  const settings = useSigninSettings(true);
  useRegisterCatchUp(signins, contractors, refreshContractors);
  const qrReview = signinsToReview(signins);
  const open = id => { setSelected(id); setView("detail"); };
  const approval = c => approvalOf(c, { required: settings.requiredDocs, today });

  const selCon = contractors.find(c=>c.id===selected);
  const filtered = contractors.filter(c=>{
    if (filterStatus!=="all") {
      const k = approval(c).key;
      if (filterStatus==="approved" && !(k==="approved"||k==="expiring")) return false;
      if (filterStatus==="docs" && !(k==="missing"||k==="expired")) return false;
      if (filterStatus==="blocked" && !(k==="banned"||k==="inactive")) return false;
      if (filterStatus==="new" && !(c.createdFrom==="qr"&&!c.checked)) return false;
    }
    if (search) { const q=search.toLowerCase(); if(!c.name.toLowerCase().includes(q)) return false; }
    return true;
  });

  if (view==="detail"&&selCon) {
    return <ContractorDetail selCon={selCon} settings={settings} me={me} contractorInductions={contractorInductions} setContractorInductions={setContractorInductions} contractorCerts={contractorCerts} setContractorCerts={setContractorCerts} contractorVisits={contractorVisits} setContractorVisits={setContractorVisits} contractors={contractors} setContractors={setContractors} dbSaveContractor={dbSaveContractor} dbDeleteContractor={dbDeleteContractor} dbSaveContractorInductions={dbSaveContractorInductions} dbSaveContractorCerts={dbSaveContractorCerts} dbSaveContractorVisits={dbSaveContractorVisits} staff={staff} isMobile={isMobile} setView={setView} T={T} font={font}/>;
  }

  return (
    <div>
      <OnSiteBoard signins={signins} contractors={contractors} contractorVisits={contractorVisits} setContractorVisits={setContractorVisits} dbSaveContractorVisits={dbSaveContractorVisits}
        contractorCerts={contractorCerts} permits={permits} settings={settings} admin me={me} onOpenCompany={open} T={T} font={font}>
          {/* Upcoming this week */}
          {(()=>{
            const upcomingAll=[];
            const soon=localISO(new Date(Date.now()+7*86400000));
            contractors.forEach(c=>{
              (contractorVisits[c.id]||[]).filter(v=>v.date>today&&v.date<=soon).forEach(v=>{
                const daysUntil=Math.ceil((new Date(v.date)-new Date())/86400000);
                upcomingAll.push({company:c,visit:v,daysUntil});
              });
            });
            upcomingAll.sort((a,b)=>a.visit.date.localeCompare(b.visit.date));
            if(!upcomingAll.length) return null;
            return (
              <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
                <div style={{fontSize:11,fontWeight:700,color:"#f59e0b",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>📅 Scheduled This Week</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {upcomingAll.map((entry,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:10,background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)"}}>
                      <span style={{fontSize:12,fontWeight:800,color:"#f59e0b"}}>{entry.daysUntil===1?"Tomorrow":ukDate(entry.visit.date)}</span>
                      <span style={{fontSize:12,color:T.white,fontWeight:600}}>{entry.company.name}</span>
                      <span style={{fontSize:11,color:T.muted}}>— {entry.visit.purpose}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
      </OnSiteBoard>

      <QrAddedReview contractors={contractors} setContractors={setContractors} signins={signins} dbSaveContractor={dbSaveContractor} dbDeleteContractor={dbDeleteContractor} contractorCerts={contractorCerts} onOpenCompany={open} T={T} font={font}/>

      <SigninReview list={qrReview} contractors={contractors} setContractors={setContractors} dbSaveContractor={dbSaveContractor} onOpenCompany={id=>{setSelected(id);setView("detail");}} T={T} font={font}/>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>Contractor Register <HelpTip dark={false} text="One entry per company that works on site. Companies and workers who sign in with the reception QR code are added automatically. Open a company to upload its insurance, RAMS and policies (with expiry or review dates): a company is Approved when the documents set in Site Settings → Contractor sign-in are on file and in date. Also its workers (with the date of their first QR induction and last day on site), their certificates and each visit. Permits to work are under Risk ▼ → Permits to Work."/></h2>
          <p style={{color:T.muted,fontSize:13,margin:0}}>{contractors.filter(c=>approval(c).approved).length} approved of {contractors.filter(c=>(c.status||"active")==="active").length} active companies · {contractors.reduce((s,c)=>(s+(c.workers||[]).length),0)} workers total</p>
        </div>
        <button onClick={()=>setShowForm(v=>!v)} style={{background:showForm?"rgba(239,68,68,0.1)":`linear-gradient(135deg,${T.accent},${T.blue})`,color:showForm?"#f87171":"#fff",border:showForm?"1px solid rgba(239,68,68,0.2)":"none",borderRadius:10,padding:"10px 20px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>
          {showForm?"✕ Cancel":"+ Add Company"}
        </button>
      </div>
      {showForm && <CompanyForm onSave={c=>{setContractors(p=>[c,...p]);dbSaveContractor(c);setShowForm(false);}} onCancel={()=>setShowForm(false)} T={T} font={font}/>}

      <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",border:`1px solid ${T.border}`}}>
        <div style={{position:"relative",flex:"1 1 200px"}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.muted,pointerEvents:"none"}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company name..."
            style={{width:"100%",background:T.overlay,border:`1px solid ${T.borderMd}`,borderRadius:9,padding:"8px 10px 8px 32px",color:T.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"}}/>
        </div>
        {[["all","All"],["approved","Approved"],["docs","Documents missing or expired"],["blocked","Banned / inactive"],["new","New from QR"]].map(([val,lbl])=>(
          <button key={val} data-testid={`con-filter-${val}`} onClick={()=>setFilterStatus(val)} style={{padding:"7px 14px",borderRadius:9,border:`1px solid ${filterStatus===val?T.accent:T.borderMd}`,background:filterStatus===val?`rgba(37,99,235,0.15)`:T.overlay,color:filterStatus===val?T.accentLt:T.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:filterStatus===val?700:400}}>{lbl}</button>
        ))}
        <span style={{color:T.muted,fontSize:12,marginLeft:"auto"}}>{filtered.length} of {contractors.length}</span>
      </div>

      <div style={{background:`linear-gradient(135deg,${T.navyMd},${T.navy})`,borderRadius:16,overflow:"hidden",border:`1px solid ${T.border}`}}>
        {!isMobile && (
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 80px",padding:"10px 20px",background:T.headerBg,fontSize:11,fontWeight:700,letterSpacing:1,color:T.muted,textTransform:"uppercase"}}>
            <span>Company</span><span>Type</span><span>Approval</span><span>Workers</span><span>Visits</span><span></span>
          </div>
        )}
        {filtered.length===0 && (contractors.length===0
          ? <div style={{padding:"32px 20px",textAlign:"center",color:T.muted,fontSize:14,lineHeight:1.6}}>No contractor companies yet.<br/>Click <strong>+ Add Company</strong>, then open the company to add its certificates, workers and inductions, and to log visits.</div>
          : <div style={{padding:"32px 20px",textAlign:"center",color:T.muted,fontSize:14}}>No companies match the search or filter.</div>)}
        {filtered.map((c,i)=>{
          const cv=contractorVisits[c.id]||[];
          // visits logged by hand + sign-ins from the reception QR code linked to this company
          const qv=signins.filter(s=>s.data&&s.data.companyId===c.id);
          const nVisits=cv.length+qv.length;
          const lastVisit=[...cv.map(v=>v.date),...qv.map(s=>s.data.date),c.lastOnSite].filter(d=>d&&d<=today).sort().pop();
          const onSiteToday=cv.some(v=>v.date===today)||qv.some(s=>s.data.date===today&&!s.data.timeOut);
          const hasExpiredWorkerCert=(c.workers||[]).some(w=>Object.values(contractorCerts[`${c.id}_${w.id}`]||{}).some(cert=>cert.expiryDate&&cert.expiryDate<today));
          return isMobile ? (
            <div key={c.id} onClick={()=>open(c.id)} style={{padding:"14px 16px",borderTop:i>0?`1px solid ${T.border}`:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🏢</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:T.white}}>{c.name}</div>
                <div style={{fontSize:11,color:T.muted}}>{c.type} · {(c.workers||[]).length} workers</div>
              </div>
              <ApprovalChip company={c} required={settings.requiredDocs} today={today} small/>
            </div>
          ) : (
            <div key={c.id} data-testid="con-row" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 80px",padding:"14px 20px",borderTop:i>0?`1px solid ${T.border}`:"none",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${T.accent},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🏢</div>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:T.white,display:"flex",alignItems:"center",gap:6}}>
                    {c.name}
                    {onSiteToday && <span style={{fontSize:9,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,0.12)",padding:"1px 6px",borderRadius:20,border:"1px solid rgba(16,185,129,0.3)"}}>ON SITE</span>}
                    {c.createdFrom==="qr" && !c.checked && <span data-testid="con-new-qr" style={{fontSize:9,fontWeight:700,color:"#fbbf24",background:"rgba(245,158,11,0.1)",padding:"1px 6px",borderRadius:20,border:"1px solid rgba(245,158,11,0.3)"}}>NEW · QR</span>}
                    {hasExpiredWorkerCert && <span style={{fontSize:9,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,0.1)",padding:"1px 6px",borderRadius:20,border:"1px solid rgba(239,68,68,0.2)"}}>CERT EXPIRED</span>}
                  </div>
                  {c.email && <div style={{fontSize:11,color:T.muted}}>{c.email}</div>}
                </div>
              </div>
              <span style={{fontSize:12,color:T.muted}}>{c.type}</span>
              <span><ApprovalChip company={c} required={settings.requiredDocs} today={today}/></span>
              <span style={{fontSize:12,color:T.white,fontWeight:600}}>{(c.workers||[]).length} worker{(c.workers||[]).length!==1?"s":""}</span>
              <div>
                <div data-testid="con-visits" style={{fontSize:12,color:T.white,fontWeight:600}}>{nVisits} visit{nVisits!==1?"s":""}</div>
                {lastVisit && <div style={{fontSize:10,color:T.muted}}>Last: {ukDate(lastVisit)}</div>}
              </div>
              <button onClick={()=>open(c.id)} style={{background:"rgba(37,99,235,0.1)",color:T.accentLt,border:"1px solid rgba(37,99,235,0.25)",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:11}}>View →</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export { ContractorsTab };
