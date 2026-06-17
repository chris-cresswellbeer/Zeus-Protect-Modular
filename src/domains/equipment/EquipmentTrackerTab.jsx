import { useState } from "react";
import { useWindowWidth } from "../../shared/hooks";
import { HelpTip } from "../../shared/HelpTip";
import { EQ_CATEGORIES } from "../../data/seedEquipment";

function EquipmentTrackerTab({ equipment, setEquipment, staff, Z, font }) {
  const isMobile = useWindowWidth() <= 1024;
  const [view, setView] = useState("dashboard");     // dashboard | list | detail | form
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeId, setActiveId] = useState(null);
  const [detailTab, setDetailTab] = useState("overview"); // overview | inspections | defects | service
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [defectForm, setDefectForm] = useState(null);
  const [serviceForm, setServiceForm] = useState(null);
  const [inspectionForm, setInspectionForm] = useState(null);
  const [saved, setSaved] = useState("");

  const today = new Date().toISOString().slice(0,10);

  const BLANK_EQ = {
    assetNo:"", category:"flt", name:"", make:"", model:"", serial:"", year:new Date().getFullYear(),
    location:"", status:"active", lastService:"", nextService:"", serviceHistory:[], defects:[], inspections:[]
  };

  const [form, setForm] = useState(BLANK_EQ);
  function setF(k,v){ setForm(p=>({...p,[k]:v})); }

  const activeEq = equipment.find(e=>e.id===activeId);
  const cat = id => EQ_CATEGORIES.find(c=>c.id===id)||EQ_CATEGORIES[0];

  // Dashboard stats
  const openDefects   = equipment.flatMap(e=>e.defects.filter(d=>d.status==="open")).length;
  const overdueService = equipment.filter(e=>e.nextService && e.nextService < today && e.status==="active").length;
  const dueSoon = equipment.filter(e=>e.nextService && e.nextService >= today && e.nextService <= new Date(Date.now()+60*86400000).toISOString().slice(0,10) && e.status==="active").length;
  const totalActive = equipment.filter(e=>e.status==="active").length;

  function saveFlash(msg){ setSaved(msg); setTimeout(()=>setSaved(""),2500); }

  function openNew(){
    setForm({...BLANK_EQ});
    setEditingId(null);
    setShowForm(true);
    setView("form");
  }

  const [prevView, setPrevView] = useState("list");

  function openEdit(eq){
    setForm({...eq});
    setEditingId(eq.id);
    setActiveId(eq.id);
    setPrevView(view); // remember where we came from
    setShowForm(true);
    setView("form");
  }

  function submitForm(){
    if(!form.assetNo.trim()||!form.name.trim()||!form.category) return;
    // Check asset number uniqueness
    const duplicate = equipment.find(e=>e.assetNo===form.assetNo && e.id!==editingId);
    if(duplicate){ setSaved("⚠ Asset number already exists"); return; }
    if(editingId){
      setEquipment(p=>p.map(e=>e.id===editingId?{...e,...form}:e));
      setActiveId(editingId);
      setShowForm(false);
      setView(prevView);
    } else {
      const newId = "eq"+Date.now();
      setEquipment(p=>[...p,{...form,id:newId,serviceHistory:[],defects:[],inspections:[]}]);
      setShowForm(false);
      setView("list");
    }
    saveFlash("✓ Equipment saved");
  }

  function deleteEquipment(id){
    setEquipment(p=>p.filter(e=>e.id!==id));
    if(activeId===id){ setView("list"); setActiveId(null); }
    saveFlash("✓ Equipment deleted");
  }

  function addDefect(){
    if(!defectForm||!defectForm.description.trim()) return;
    const d = {...defectForm, id:"d"+Date.now(), date:today, status:"open"};
    setEquipment(p=>p.map(e=>e.id===activeId?{...e,defects:[...e.defects,d]}:e));
    setDefectForm(null);
    saveFlash("✓ Defect logged");
  }

  function resolveDefect(defectId, resolution){
    setEquipment(p=>p.map(e=>e.id===activeId?{...e,defects:e.defects.map(d=>d.id===defectId?{...d,status:"resolved",resolution,resolvedDate:today}:d)}:e));
    saveFlash("✓ Defect resolved");
  }

  function addService(){
    if(!serviceForm||!serviceForm.date||!serviceForm.type.trim()) return;
    const s = {...serviceForm};
    const nextSvc = serviceForm.nextService || "";
    setEquipment(p=>p.map(e=>e.id===activeId?{
      ...e,
      serviceHistory:[s,...e.serviceHistory],
      lastService:s.date,
      ...(nextSvc ? {nextService:nextSvc} : {}),
    }:e));
    setServiceForm(null);
    saveFlash("✓ Service record added");
  }

  function addInspection(){
    if(!inspectionForm||!inspectionForm.date||!inspectionForm.result) return;
    const ins = {...inspectionForm};
    setEquipment(p=>p.map(e=>e.id===activeId?{...e,inspections:[ins,...e.inspections]}:e));
    setInspectionForm(null);
    saveFlash("✓ Inspection recorded");
  }

  const inputSt = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 12px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};
  const labelSt = {fontSize:10,fontWeight:700,letterSpacing:.5,color:Z.muted,textTransform:"uppercase",marginBottom:5,display:"block"};
  const SEV_COL = {low:"#10b981",medium:"#f59e0b",high:"#ef4444",critical:"#dc2626"};
  const STATUS_COL = {active:"#10b981",inactive:Z.muted,retired:"#f87171"};

  // ── HEADER ────────────────────────────────────────────────────────────────
  function exportEquipment() {
    const today = new Date().toISOString().slice(0,10);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => {
      const XLSX = window.XLSX;
      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Asset List ──
      const assetHeaders = [
        "Asset No","Category","Name","Make","Model","Serial No","Year",
        "Location","Status","Last Service","Next Service",
        "Open Defects","Total Defects","Total Services","Total Inspections",
      ];
      const assetRows = equipment.map(e => [
        e.assetNo,
        cat(e.category).label,
        e.name,
        e.make||"",
        e.model||"",
        e.serial||"",
        e.year||"",
        e.location||"",
        e.status==="active"?"Active":"Inactive",
        e.lastService||"",
        e.nextService||"",
        e.defects.filter(d=>d.status==="open").length,
        e.defects.length,
        e.serviceHistory.length,
        e.inspections.length,
      ]);
      const ws1 = XLSX.utils.aoa_to_sheet([assetHeaders, ...assetRows]);
      ws1["!cols"] = [
        {wch:12},{wch:16},{wch:36},{wch:14},{wch:16},{wch:18},{wch:6},
        {wch:22},{wch:10},{wch:14},{wch:14},
        {wch:12},{wch:14},{wch:14},{wch:16},
      ];
      XLSX.utils.book_append_sheet(wb, ws1, "Asset List");

      // ── Sheet 2: Maintenance Log (service history across all assets) ──
      const serviceHeaders = [
        "Asset No","Asset Name","Category","Location","Service Date",
        "Service Type","Engineer / Company","Cost","Notes",
      ];
      const serviceRows = equipment.flatMap(e =>
        e.serviceHistory.map(s => [
          e.assetNo, e.name, cat(e.category).label, e.location||"",
          s.date||"", s.type||"", s.engineer||"",
          s.cost!==""&&s.cost!==undefined ? Number(s.cost) : "",
          s.notes||"",
        ])
      ).sort((a,b) => (b[4]||"").localeCompare(a[4]||""));
      const ws2 = XLSX.utils.aoa_to_sheet([serviceHeaders, ...serviceRows]);
      ws2["!cols"] = [
        {wch:12},{wch:36},{wch:16},{wch:22},{wch:14},
        {wch:28},{wch:28},{wch:10},{wch:50},
      ];
      XLSX.utils.book_append_sheet(wb, ws2, "Maintenance Log");

      // ── Sheet 3: Open Defects ──
      const defectHeaders = [
        "Asset No","Asset Name","Category","Location","Status",
        "Defect Date","Reported By","Severity","Defect Status","Description","Resolution",
      ];
      const defectRows = equipment.flatMap(e =>
        e.defects.map(d => [
          e.assetNo, e.name, cat(e.category).label, e.location||"",
          e.status==="active"?"Active":"Inactive",
          d.date||"", d.reportedBy||"",
          d.severity||"", d.status==="resolved"?"Resolved":"Open",
          d.description||"", d.resolution||"",
        ])
      ).sort((a,b) => {
        if (a[8]==="Open" && b[8]!=="Open") return -1;
        if (a[8]!=="Open" && b[8]==="Open") return 1;
        return (b[5]||"").localeCompare(a[5]||"");
      });
      const ws3 = XLSX.utils.aoa_to_sheet([defectHeaders, ...defectRows]);
      ws3["!cols"] = [
        {wch:12},{wch:36},{wch:16},{wch:22},{wch:10},
        {wch:14},{wch:20},{wch:10},{wch:12},{wch:50},{wch:40},
      ];
      XLSX.utils.book_append_sheet(wb, ws3, "Defects");

      XLSX.writeFile(wb, `zeus-equipment-register-${today}.xlsx`);
    };
    document.head.appendChild(script);
  }

  const Header = () => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div>
        <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 2px",color:Z.white}}>Equipment Register <HelpTip dark={true} text="A full register of equipment on site including inspection due dates, responsible persons and service history. Use this to track PUWER compliance — items approaching their inspection date are highlighted."/></h2>
        <p style={{color:Z.muted,margin:0,fontSize:13}}>Asset register · inspection schedules · defect reporting · service history</p>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        {saved && <span style={{fontSize:12,color:"#10b981",fontWeight:700}}>{saved}</span>}
        <button onClick={()=>setView(view==="dashboard"?"list":"dashboard")}
          style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
          {view==="dashboard"?E("📋 ","")+"Asset List":E("📊 ","")+"Dashboard"}
        </button>
        <button onClick={exportEquipment}
          style={{display:"flex",alignItems:"center",gap:6,background:"rgba(16,185,129,0.12)",color:"#34d399",border:"1px solid rgba(16,185,129,0.3)",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
          ⬇ Export
        </button>
        <button onClick={openNew}
          style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:`0 4px 14px ${Z.accent}44`}}>
          + Add Equipment
        </button>
      </div>
    </div>
  );

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  if(view==="dashboard") return (
    <div>
      <Header/>
      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:28}}>
        {[
          {icon:E("⚙️",""),val:totalActive,label:"Active Assets",col:"#60a5fa"},
          {icon:E("🚨",""),val:openDefects,label:"Open Defects",col:"#f87171"},
          {icon:E("⏰",""),val:overdueService,label:"Overdue Service",col:"#ef4444"},
          {icon:E("📅",""),val:dueSoon,label:"Due in 60 Days",col:"#f59e0b"},
        ].map(s=>(
          <div key={s.label} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"18px 20px",borderLeft:`4px solid ${s.col}`,border:`1px solid ${Z.border}`,borderLeftWidth:4,borderLeftColor:s.col}}>
            <div style={{fontSize:26,marginBottom:4}}>{s.icon}</div>
            <div style={{fontSize:32,fontWeight:900,color:s.col,lineHeight:1,fontFamily:"'Barlow Condensed',sans-serif"}}>{s.val}</div>
            <div style={{fontSize:11,color:Z.muted,marginTop:3,fontWeight:600}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Overdue service alert */}
      {overdueService>0 && (
        <div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:14,padding:"14px 18px",marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:800,color:"#f87171",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>🚨 Overdue Service ({overdueService})</div>
          {equipment.filter(e=>e.nextService&&e.nextService<today&&e.status==="active").map(e=>(
            <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:"rgba(239,68,68,0.06)",borderRadius:10,marginBottom:6,flexWrap:"wrap"}}>
              <span style={{fontSize:20}}>{cat(e.category).icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:"#fca5a5"}}>{e.name}</div>
                <div style={{fontSize:11,color:Z.muted}}>{e.assetNo} · Service due: {e.nextService}</div>
              </div>
              <button onClick={()=>{setActiveId(e.id);setDetailTab("service");setView("detail");}}
                style={{background:"rgba(239,68,68,0.15)",color:"#f87171",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700}}>
                View →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Open defects */}
      {openDefects>0 && (
        <div style={{background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:14,padding:"14px 18px",marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:800,color:"#f59e0b",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>⚠️ Open Defects ({openDefects})</div>
          {equipment.flatMap(e=>e.defects.filter(d=>d.status==="open").map(d=>({...d,eq:e}))).map(d=>(
            <div key={d.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:"#1e2d5a",borderRadius:10,marginBottom:6,flexWrap:"wrap"}}>
              <span style={{fontSize:20}}>{cat(d.eq.category).icon}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:"#ffffff"}}>{d.eq.name}</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>{d.description} · Reported: {d.date}</div>
              </div>
              <span style={{fontSize:10,fontWeight:700,background:`${SEV_COL[d.severity]}22`,color:SEV_COL[d.severity],padding:"2px 8px",borderRadius:99,border:`1px solid ${SEV_COL[d.severity]}44`}}>{d.severity}</span>
              <button onClick={()=>{setActiveId(d.eq.id);setDetailTab("defects");setView("detail");}}
                style={{background:"rgba(245,158,11,0.15)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:font,fontSize:11,fontWeight:700}}>
                View →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Category summary */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
        {EQ_CATEGORIES.map(c=>{
          const items = equipment.filter(e=>e.category===c.id);
          const active = items.filter(e=>e.status==="active").length;
          const defects = items.flatMap(e=>e.defects.filter(d=>d.status==="open")).length;
          const overdue = items.filter(e=>e.nextService&&e.nextService<today&&e.status==="active").length;
          return (
            <div key={c.id} onClick={()=>{setCatFilter(c.id);setView("list");}}
              style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"16px 18px",border:`1px solid ${Z.border}`,cursor:"pointer",transition:"border-color .2s"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:28}}>{c.icon}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:800,color:Z.white}}>{c.label}</div>
                  <div style={{fontSize:11,color:Z.muted}}>{active} active · {items.length} total</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {defects>0&&<span style={{fontSize:10,background:"rgba(239,68,68,0.12)",color:"#f87171",padding:"2px 8px",borderRadius:99,fontWeight:700}}>⚠ {defects} defect{defects!==1?"s":""}</span>}
                {overdue>0&&<span style={{fontSize:10,background:"rgba(239,68,68,0.1)",color:"#fca5a5",padding:"2px 8px",borderRadius:99,fontWeight:700}}>⏰ {overdue} overdue</span>}
                {defects===0&&overdue===0&&<span style={{fontSize:10,background:"rgba(16,185,129,0.1)",color:"#10b981",padding:"2px 8px",borderRadius:99,fontWeight:700}}>✓ All clear</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── LIST ──────────────────────────────────────────────────────────────────
  if(view==="list") return (
    <div>
      <Header/>
      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>setCatFilter("all")} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${catFilter==="all"?Z.accent:Z.borderMd}`,background:catFilter==="all"?`rgba(37,99,235,0.12)`:Z.overlay,color:catFilter==="all"?Z.accentLt:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>All</button>
          {EQ_CATEGORIES.map(c=>(
            <button key={c.id} onClick={()=>setCatFilter(c.id)} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${catFilter===c.id?c.color:Z.borderMd}`,background:catFilter===c.id?`${c.color}18`:Z.overlay,color:catFilter===c.id?c.color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"5px 10px",color:Z.white,fontSize:12,fontFamily:font,outline:"none",cursor:"pointer",marginLeft:"auto"}}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      <div style={{display:"grid",gap:10}}>
        {equipment
          .filter(e=>(catFilter==="all"||e.category===catFilter)&&(statusFilter==="all"||e.status===statusFilter))
          .sort((a,b)=>a.assetNo.localeCompare(b.assetNo))
          .map(e=>{
            const c = cat(e.category);
            const openDef = e.defects.filter(d=>d.status==="open").length;
            const svcOverdue = e.nextService && e.nextService < today && e.status==="active";
            const svcSoon = e.nextService && e.nextService >= today && e.nextService <= new Date(Date.now()+60*86400000).toISOString().slice(0,10) && e.status==="active";
            return (
              <div key={e.id} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,border:`1px solid ${openDef||svcOverdue?"rgba(239,68,68,0.3)":Z.border}`,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                <span style={{fontSize:28,flexShrink:0}}>{c.icon}</span>
                <div style={{flex:1,minWidth:180}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,fontWeight:800,color:c.color}}>{e.assetNo}</span>
                    <span style={{fontSize:11,color:Z.muted}}>·</span>
                    <span style={{fontSize:11,color:Z.muted}}>{c.label}</span>
                    <span style={{fontSize:10,fontWeight:700,color:STATUS_COL[e.status],background:`${STATUS_COL[e.status]}18`,padding:"1px 8px",borderRadius:99}}>{e.status}</span>
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:Z.white,marginBottom:3}}>{e.name}</div>
                  <div style={{fontSize:11,color:Z.muted}}>{e.make} {e.model} · {e.location}</div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {svcOverdue&&<span style={{fontSize:10,fontWeight:700,background:"rgba(239,68,68,0.12)",color:"#f87171",padding:"2px 8px",borderRadius:99,border:"1px solid rgba(239,68,68,0.25)"}}>⏰ Service Overdue</span>}
                  {svcSoon&&!svcOverdue&&<span style={{fontSize:10,fontWeight:700,background:"rgba(245,158,11,0.12)",color:"#f59e0b",padding:"2px 8px",borderRadius:99}}>📅 Due {e.nextService}</span>}
                  {openDef>0&&<span style={{fontSize:10,fontWeight:700,background:"rgba(239,68,68,0.1)",color:"#fca5a5",padding:"2px 8px",borderRadius:99}}>⚠ {openDef} defect{openDef!==1?"s":""}</span>}
                  {!svcOverdue&&!openDef&&e.status==="active"&&<span style={{fontSize:10,fontWeight:700,background:"rgba(16,185,129,0.1)",color:"#10b981",padding:"2px 8px",borderRadius:99}}>✓ OK</span>}
                  <button onClick={()=>{setActiveId(e.id);setDetailTab("overview");setView("detail");}}
                    style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
                    Open →
                  </button>
                  <button onClick={()=>openEdit(e)}
                    style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700,color:Z.muted}}>
                    ✏
                  </button>
                  <button onClick={()=>{ if(window.confirm(`Delete ${e.name}? This cannot be undone.`)) deleteEquipment(e.id); }}
                    style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font}}>
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        {equipment.filter(e=>(catFilter==="all"||e.category===catFilter)&&(statusFilter==="all"||e.status===statusFilter)).length===0&&(
          <div style={{textAlign:"center",padding:40,color:Z.muted,fontSize:13}}>No equipment matches the current filters.</div>
        )}
      </div>
    </div>
  );

  // ── FORM ──────────────────────────────────────────────────────────────────
  if(view==="form") return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
        <button onClick={()=>setView(editingId?prevView:"list")}
          style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
          ← Back
        </button>
        <h2 style={{fontSize:20,fontWeight:900,margin:0,color:Z.white}}>{editingId?"Edit Equipment":"Add New Equipment"}</h2>
      </div>

      <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:28,border:`1px solid ${Z.borderMd}`}}>
        {saved&&<div style={{marginBottom:14,padding:"8px 14px",background:"rgba(239,68,68,0.1)",borderRadius:8,color:"#f87171",fontSize:13}}>{saved}</div>}

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
          <div><label style={labelSt}>ASSET NUMBER *</label><input value={form.assetNo} onChange={e=>setF("assetNo",e.target.value)} placeholder="e.g. FLT-004" style={inputSt}/></div>
          <div>
            <label style={labelSt}>CATEGORY *</label>
            <select value={form.category} onChange={e=>setF("category",e.target.value)} style={{...inputSt,cursor:"pointer"}}>
              {EQ_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{marginBottom:14}}><label style={labelSt}>EQUIPMENT NAME *</label><input value={form.name} onChange={e=>setF("name",e.target.value)} placeholder="e.g. Counterbalance Forklift — Bay 4" style={inputSt}/></div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:14}}>
          <div><label style={labelSt}>MAKE</label><input value={form.make} onChange={e=>setF("make",e.target.value)} placeholder="e.g. Toyota" style={inputSt}/></div>
          <div><label style={labelSt}>MODEL</label><input value={form.model} onChange={e=>setF("model",e.target.value)} placeholder="e.g. 8FBE15" style={inputSt}/></div>
          <div><label style={labelSt}>SERIAL NUMBER</label><input value={form.serial} onChange={e=>setF("serial",e.target.value)} placeholder="e.g. T8F-2024-0001" style={inputSt}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:14,marginBottom:14}}>
          <div><label style={labelSt}>YEAR</label><input type="number" value={form.year} onChange={e=>setF("year",parseInt(e.target.value))} style={inputSt}/></div>
          <div><label style={labelSt}>LOCATION</label><input value={form.location} onChange={e=>setF("location",e.target.value)} placeholder="e.g. Warehouse Bay 2" style={inputSt}/></div>
          <div>
            <label style={labelSt}>STATUS</label>
            <select value={form.status} onChange={e=>setF("status",e.target.value)} style={{...inputSt,cursor:"pointer"}}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="retired">Retired</option>
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
          <div><label style={labelSt}>LAST SERVICE DATE</label><input type="date" value={form.lastService} onChange={e=>setF("lastService",e.target.value)} style={inputSt}/></div>
          <div><label style={labelSt}>NEXT SERVICE DUE</label><input type="date" value={form.nextService} onChange={e=>setF("nextService",e.target.value)} style={inputSt}/></div>
        </div>
        <button onClick={submitForm}
          style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"11px 28px",fontWeight:800,cursor:"pointer",fontFamily:font,fontSize:14,boxShadow:`0 4px 16px ${Z.accent}44`}}>
          💾 {editingId?"Save Changes":"Create Asset Record"}
        </button>
      </div>
    </div>
  );

  // ── DETAIL ────────────────────────────────────────────────────────────────
  if(view==="detail" && activeEq) {
    const c = cat(activeEq.category);
    const openDef = activeEq.defects.filter(d=>d.status==="open").length;
    const svcOverdue = activeEq.nextService && activeEq.nextService < today;
    const DETAIL_TABS = ["overview","inspections","defects","service"];
    const DETAIL_LABELS = {overview:"Overview",inspections:"Inspections",defects:`Defects${openDef>0?` (${openDef})`:""}`,service:"Service History"};

    return (
      <div>
        {/* Back bar */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
          <button onClick={()=>setView("list")}
            style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
            ← Asset List
          </button>
          {saved&&<span style={{fontSize:12,color:"#10b981",fontWeight:700}}>{saved}</span>}
          <div style={{marginLeft:"auto",display:"flex",gap:8}}>
            <button onClick={()=>openEdit(activeEq)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>✏ Edit</button>
            <button onClick={()=>{ if(window.confirm(`Delete ${activeEq.name}? This cannot be undone.`)) deleteEquipment(activeEq.id); }}
              style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"7px 14px",color:"#f87171",cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
              🗑 Delete
            </button>
          </div>
        </div>

        {/* Asset header */}
        <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:"20px 24px",marginBottom:20,border:`1px solid ${svcOverdue?"rgba(239,68,68,0.3)":openDef?"rgba(245,158,11,0.3)":Z.border}`}}>
          <div style={{display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap"}}>
            <span style={{fontSize:48,lineHeight:1}}>{c.icon}</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:800,color:c.color,background:`${c.color}18`,padding:"2px 10px",borderRadius:99}}>{activeEq.assetNo}</span>
                <span style={{fontSize:11,color:Z.muted}}>{c.label}</span>
                <span style={{fontSize:11,fontWeight:700,color:STATUS_COL[activeEq.status],background:`${STATUS_COL[activeEq.status]}18`,padding:"1px 8px",borderRadius:99}}>{activeEq.status}</span>
              </div>
              <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:900,color:Z.white}}>{activeEq.name}</h2>
              <div style={{fontSize:12,color:Z.muted}}>{activeEq.make} {activeEq.model} · Serial: {activeEq.serial} · Year: {activeEq.year} · 📍 {activeEq.location}</div>
            </div>
            <div style={{display:"flex",gap:16,textAlign:"center",flexShrink:0}}>
              <div style={{padding:"12px 16px",background:svcOverdue?"rgba(239,68,68,0.1)":"rgba(16,185,129,0.08)",borderRadius:12,border:`1px solid ${svcOverdue?"rgba(239,68,68,0.25)":"rgba(16,185,129,0.2)"}`}}>
                <div style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Next Service</div>
                <div style={{fontSize:14,fontWeight:800,color:svcOverdue?"#f87171":"#10b981"}}>{activeEq.nextService||"—"}</div>
                {svcOverdue&&<div style={{fontSize:10,color:"#f87171",fontWeight:700,marginTop:2}}>OVERDUE</div>}
              </div>
              <div style={{padding:"12px 16px",background:openDef?"rgba(245,158,11,0.08)":"rgba(16,185,129,0.08)",borderRadius:12,border:`1px solid ${openDef?"rgba(245,158,11,0.2)":"rgba(16,185,129,0.2)"}`}}>
                <div style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Open Defects</div>
                <div style={{fontSize:22,fontWeight:900,color:openDef?"#f59e0b":"#10b981",lineHeight:1}}>{openDef}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Detail tabs */}
        <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
          {DETAIL_TABS.map(t=>(
            <button key={t} onClick={()=>setDetailTab(t)}
              style={{padding:"7px 16px",borderRadius:8,border:`1px solid ${detailTab===t?Z.accent:Z.borderMd}`,background:detailTab===t?`linear-gradient(135deg,${Z.accent},${Z.blue})`:Z.overlay,color:detailTab===t?"#fff":Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>
              {DETAIL_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {detailTab==="overview" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {[
              ["Asset Number",activeEq.assetNo],["Category",c.label],["Name",activeEq.name],
              ["Make",activeEq.make],["Model",activeEq.model],["Serial Number",activeEq.serial],
              ["Year",activeEq.year],["Location",activeEq.location],["Status",activeEq.status],
              ["Last Service",activeEq.lastService||"—"],["Next Service",activeEq.nextService||"—"],
              ["Service Records",activeEq.serviceHistory.length],["Inspections",activeEq.inspections.length],
            ].map(([k,v])=>(
              <div key={k} style={{padding:"12px 16px",background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:12,border:`1px solid ${Z.border}`}}>
                <div style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{k}</div>
                <div style={{fontSize:13,fontWeight:700,color:Z.white}}>{String(v)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── INSPECTIONS ── */}
        {detailTab==="inspections" && (
          <div>
            {/* Log new inspection */}
            {!inspectionForm ? (
              <button onClick={()=>setInspectionForm({date:today,by:"",result:"pass",notes:""})}
                style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"9px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,marginBottom:16}}>
                + Log Inspection
              </button>
            ) : (
              <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"18px 20px",marginBottom:16,border:`1px solid ${Z.borderMd}`}}>
                <div style={{fontSize:12,fontWeight:700,color:Z.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:.5}}>New Inspection Record</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                  <div><label style={labelSt}>DATE *</label><input type="date" value={inspectionForm.date} onChange={e=>setInspectionForm(p=>({...p,date:e.target.value}))} style={inputSt}/></div>
                  <div><label style={labelSt}>INSPECTOR</label><input value={inspectionForm.by} onChange={e=>setInspectionForm(p=>({...p,by:e.target.value}))} placeholder="Name or company" style={inputSt}/></div>
                  <div>
                    <label style={labelSt}>RESULT *</label>
                    <select value={inspectionForm.result} onChange={e=>setInspectionForm(p=>({...p,result:e.target.value}))} style={{...inputSt,cursor:"pointer"}}>
                      <option value="pass">✓ Pass</option>
                      <option value="flag">⚠ Pass with flags</option>
                      <option value="fail">✗ Fail</option>
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:12}}><label style={labelSt}>NOTES</label><textarea value={inspectionForm.notes} onChange={e=>setInspectionForm(p=>({...p,notes:e.target.value}))} rows={2} placeholder="Inspection findings..." style={{...inputSt,resize:"vertical",lineHeight:1.6}}/></div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={addInspection} style={{background:`linear-gradient(135deg,${Z.green},#059669)`,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12}}>Save Inspection</button>
                  <button onClick={()=>setInspectionForm(null)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"8px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>Cancel</button>
                </div>
              </div>
            )}
            {/* Schedule info */}
            <div style={{padding:"10px 16px",background:"rgba(37,99,235,0.07)",borderRadius:10,border:"1px solid rgba(37,99,235,0.15)",marginBottom:16,fontSize:12,color:Z.muted}}>
              📅 Recommended inspection frequency: every <strong style={{color:Z.accentLt}}>{c.scheduleMonths} month{c.scheduleMonths!==1?"s":""}</strong> for {c.label}
            </div>
            {activeEq.inspections.length===0 ? (
              <p style={{color:Z.muted,fontSize:13}}>No inspections recorded yet.</p>
            ) : (
              <div style={{display:"grid",gap:10}}>
                {activeEq.inspections.map((ins,i)=>{
                  const RES_COL={pass:"#10b981",flag:"#f59e0b",fail:"#ef4444"};
                  const RES_LABEL={pass:"✓ Pass",flag:"⚠ Pass with flags",fail:"✗ Fail"};
                  return (
                    <div key={i} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:12,padding:"14px 18px",border:`1px solid ${RES_COL[ins.result]||Z.border}33`}}>
                      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:12,fontWeight:800,color:RES_COL[ins.result]}}>{RES_LABEL[ins.result]||ins.result}</span>
                        <span style={{fontSize:11,color:Z.muted}}>📅 {ins.date}</span>
                        {ins.by&&<span style={{fontSize:11,color:Z.muted}}>👤 {ins.by}</span>}
                      </div>
                      {ins.notes&&<p style={{fontSize:12,color:Z.slate,margin:0,lineHeight:1.6}}>{ins.notes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DEFECTS ── */}
        {detailTab==="defects" && (
          <div>
            {!defectForm ? (
              <button onClick={()=>setDefectForm({description:"",severity:"medium",reportedBy:""})}
                style={{background:"rgba(239,68,68,0.12)",color:"#f87171",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,padding:"9px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,marginBottom:16}}>
                + Report Defect
              </button>
            ) : (
              <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"18px 20px",marginBottom:16,border:"1px solid rgba(239,68,68,0.25)"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#f87171",marginBottom:12,textTransform:"uppercase",letterSpacing:.5}}>Report New Defect</div>
                <div style={{marginBottom:12}}><label style={labelSt}>DESCRIPTION *</label><textarea value={defectForm.description} onChange={e=>setDefectForm(p=>({...p,description:e.target.value}))} rows={2} placeholder="Describe the defect clearly..." style={{...inputSt,resize:"vertical",lineHeight:1.6}}/></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                  <div>
                    <label style={labelSt}>SEVERITY</label>
                    <select value={defectForm.severity} onChange={e=>setDefectForm(p=>({...p,severity:e.target.value}))} style={{...inputSt,cursor:"pointer"}}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical — take out of service</option>
                    </select>
                  </div>
                  <div><label style={labelSt}>REPORTED BY</label><input value={defectForm.reportedBy} onChange={e=>setDefectForm(p=>({...p,reportedBy:e.target.value}))} placeholder="Name" style={inputSt}/></div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={addDefect} style={{background:"linear-gradient(135deg,#ef4444,#b91c1c)",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12}}>Log Defect</button>
                  <button onClick={()=>setDefectForm(null)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"8px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>Cancel</button>
                </div>
              </div>
            )}
            {activeEq.defects.length===0 ? (
              <p style={{color:Z.muted,fontSize:13}}>No defects recorded.</p>
            ) : (
              <div style={{display:"grid",gap:10}}>
                {activeEq.defects.map(d=>(
                  <div key={d.id} style={{background:"#1e2d5a",borderRadius:12,padding:"14px 18px",border:`1px solid ${d.status==="resolved"?"rgba(16,185,129,0.35)":"rgba(239,68,68,0.35)"}`}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:10,fontWeight:700,background:`${SEV_COL[d.severity]}22`,color:SEV_COL[d.severity],padding:"2px 8px",borderRadius:99,border:`1px solid ${SEV_COL[d.severity]}44`}}>{d.severity}</span>
                      <span style={{fontSize:11,color:"#94a3b8"}}>📅 {d.date}</span>
                      {d.reportedBy&&<span style={{fontSize:11,color:"#94a3b8"}}>👤 {d.reportedBy}</span>}
                      <span style={{marginLeft:"auto",fontSize:10,fontWeight:700,color:d.status==="resolved"?"#10b981":"#f87171",background:d.status==="resolved"?"rgba(16,185,129,0.12)":"rgba(239,68,68,0.1)",padding:"2px 8px",borderRadius:99}}>{d.status==="resolved"?"✓ Resolved":"Open"}</span>
                    </div>
                    <p style={{fontSize:13,fontWeight:600,color:"#ffffff",margin:"0 0 6px",lineHeight:1.5}}>{d.description}</p>
                    {d.resolution&&<p style={{fontSize:11,color:"#94a3b8",margin:"0 0 6px",fontStyle:"italic"}}>Resolution: {d.resolution}</p>}
                    {d.status==="open" && (
                      <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center",flexWrap:"wrap"}}>
                        <input placeholder="Resolution / action taken..." style={{...inputSt,flex:1,fontSize:12,padding:"6px 10px"}} id={`res-${d.id}`}/>
                        <button onClick={()=>{const el=document.getElementById(`res-${d.id}`);resolveDefect(d.id,el?.value||"Resolved");}}
                          style={{background:`linear-gradient(135deg,${Z.green},#059669)`,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12,whiteSpace:"nowrap",flexShrink:0}}>
                          ✓ Mark Resolved
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SERVICE HISTORY ── */}
        {detailTab==="service" && (
          <div>
            {!serviceForm ? (
              <button onClick={()=>setServiceForm({date:today,type:"",engineer:"",notes:"",cost:""})}
                style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"9px 20px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:13,marginBottom:16}}>
                + Add Service Record
              </button>
            ) : (
              <div style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:14,padding:"18px 20px",marginBottom:16,border:`1px solid ${Z.borderMd}`}}>
                <div style={{fontSize:12,fontWeight:700,color:Z.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:.5}}>New Service Record</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                  <div><label style={labelSt}>SERVICE DATE *</label><input type="date" value={serviceForm.date} onChange={e=>setServiceForm(p=>({...p,date:e.target.value}))} style={inputSt}/></div>
                  <div><label style={labelSt}>NEXT SERVICE DUE</label><input type="date" value={serviceForm.nextService||""} onChange={e=>setServiceForm(p=>({...p,nextService:e.target.value}))} style={inputSt}/></div>
                  <div><label style={labelSt}>SERVICE TYPE *</label><input value={serviceForm.type} onChange={e=>setServiceForm(p=>({...p,type:e.target.value}))} placeholder="e.g. Annual Full Service" style={inputSt}/></div>
                  <div><label style={labelSt}>ENGINEER / COMPANY</label><input value={serviceForm.engineer} onChange={e=>setServiceForm(p=>({...p,engineer:e.target.value}))} placeholder="e.g. Premier Lift Services" style={inputSt}/></div>
                  <div><label style={labelSt}>COST (€)</label><input type="number" value={serviceForm.cost} onChange={e=>setServiceForm(p=>({...p,cost:e.target.value}))} placeholder="0" style={inputSt}/></div>
                </div>
                <div style={{marginBottom:12}}><label style={labelSt}>NOTES / FINDINGS</label><textarea value={serviceForm.notes} onChange={e=>setServiceForm(p=>({...p,notes:e.target.value}))} rows={3} placeholder="Work carried out, parts replaced, findings..." style={{...inputSt,resize:"vertical",lineHeight:1.6}}/></div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={addService} style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontWeight:700,cursor:"pointer",fontFamily:font,fontSize:12}}>Save Record</button>
                  <button onClick={()=>setServiceForm(null)} style={{background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"8px 14px",color:Z.muted,cursor:"pointer",fontFamily:font,fontSize:12,fontWeight:700}}>Cancel</button>
                </div>
              </div>
            )}
            {activeEq.serviceHistory.length===0 ? (
              <p style={{color:Z.muted,fontSize:13}}>No service records yet.</p>
            ) : (
              <div style={{display:"grid",gap:10}}>
                {activeEq.serviceHistory.map((s,i)=>(
                  <div key={i} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:12,padding:"14px 18px",border:`1px solid ${Z.border}`}}>
                    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:800,color:Z.accentLt}}>{s.type}</span>
                      <span style={{fontSize:11,color:Z.muted}}>📅 {s.date}</span>
                      {s.engineer&&<span style={{fontSize:11,color:Z.muted}}>🔧 {s.engineer}</span>}
                      {s.cost!==undefined&&s.cost!==""&&<span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:Z.muted}}>€{Number(s.cost).toLocaleString()}</span>}
                    </div>
                    {s.notes&&<p style={{fontSize:12,color:Z.slate,margin:0,lineHeight:1.6}}>{s.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}


export { EquipmentTrackerTab };
