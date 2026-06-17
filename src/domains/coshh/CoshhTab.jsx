import { useWindowWidth } from "../../shared/hooks";
import { HelpTip } from "../../shared/HelpTip";
import { coshhHazardLevel } from "./coshhHazardLevel";
import { COSHH_DATA } from "../../data/seedCoshh";
import { CoshhAssessmentForm } from "./CoshhAssessmentForm";

function CoshhTab({ Z, font, msdsFiles, setMsdsFiles, customChemicals, setCustomChemicals }) {
  const isMobile = useWindowWidth() <= 1024;
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [hazardFilter, setHazardFilter] = useState("all");
  const [expandedCode, setExpandedCode] = useState(null);
  const [previewMsds, setPreviewMsds] = useState(null);
  const [assessments, setAssessments] = useState({}); // { chemCode: assessmentData }
  const [editingAssessment, setEditingAssessment] = useState(null); // chemCode being edited

  const [showAddForm, setShowAddForm] = useState(false);
  const [addErr, setAddErr] = useState("");
  const BLANK_CHEM = { code:"", name:"", supplier:"", msdsDate:"", un:"Non Dangerous Goods", classification:"" };
  const [addForm, setAddForm] = useState(BLANK_CHEM);
  const fileInputRefs = useRef({});
  const addFormRef = useRef(null);

  useEffect(()=>{ if(showAddForm && addFormRef.current) addFormRef.current.scrollIntoView({behavior:"smooth",block:"nearest"}); },[showAddForm]);

  const allChemicals = [...COSHH_DATA, ...customChemicals];
  const suppliers = ["all", ...Array.from(new Set(allChemicals.map(c=>c.supplier))).sort()];

  const filtered = allChemicals.filter(c => {
    const matchSearch = !search || c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase());
    const matchSupplier = supplierFilter === "all" || c.supplier === supplierFilter;
    const matchHazard = hazardFilter === "all" || coshhHazardLevel(c.classification) === hazardFilter;
    return matchSearch && matchSupplier && matchHazard;
  });

  const hazardConfig = {
    high:   { label:"High Hazard",   color:"#ef4444", bg:"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.3)",   icon:"⚠️" },
    medium: { label:"Medium Hazard", color:"#f59e0b", bg:"rgba(245,158,11,0.12)",  border:"rgba(245,158,11,0.3)",  icon:"⚡" },
    low:    { label:"Low / None",    color:"#10b981", bg:"rgba(16,185,129,0.12)",  border:"rgba(16,185,129,0.3)",  icon:"✓"  },
  };

  const counts = { high: allChemicals.filter(c=>coshhHazardLevel(c.classification)==="high").length, medium: allChemicals.filter(c=>coshhHazardLevel(c.classification)==="medium").length, low: allChemicals.filter(c=>coshhHazardLevel(c.classification)==="low").length };
  const uploadedCount = Object.keys(msdsFiles).length;

  const inp = {width:"100%",background:Z.overlay,border:`1px solid ${Z.borderMd}`,borderRadius:10,padding:"9px 13px",color:Z.white,fontSize:13,outline:"none",fontFamily:font,boxSizing:"border-box"};

  function saveChemical() {
    if (!addForm.code.trim()) { setAddErr("Zeus Code is required."); return; }
    if (!addForm.name.trim()) { setAddErr("Product name is required."); return; }
    if (allChemicals.some(c=>c.code.trim().toLowerCase()===addForm.code.trim().toLowerCase())) { setAddErr(`Code ${addForm.code.trim()} already exists in the register.`); return; }
    const chem = {...addForm, code:addForm.code.trim(), name:addForm.name.trim(), supplier:addForm.supplier.trim(), _custom:true};
    setCustomChemicals(prev=>[...prev, chem]);
    sb.from("custom_chemicals").upsert({ code: chem.code, data: chem }, { onConflict: "code" });
    setAddForm(BLANK_CHEM);
    setShowAddForm(false);
    setAddErr("");
    setExpandedCode(addForm.code.trim());
  }

  async function saveAssessment(code, data) {
    setAssessments(p=>({...p,[code]:data}));
    await sb.from("coshh_assessments").upsert({ code, data }, { onConflict: "code" });
  }

  async function deleteChemical(code) {
    setCustomChemicals(prev=>prev.filter(c=>c.code!==code));
    const msds = msdsFiles[code];
    if (msds) await sb.storage.remove("documents", [`msds/${code}/${msds.fileName}`]);
    setMsdsFiles(prev=>{ const n={...prev}; delete n[code]; return n; });
    await sb.from("custom_chemicals").delete().eq("code", code);
    await sb.from("msds_files").delete().eq("code", code);
    if(expandedCode===code) setExpandedCode(null);
  }

  async function handleMsdsUpload(code, file) {
    // Use a flat path with no subfolders to avoid encoding issues
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `msds_${code}_${safeName}`;
    const { error } = await sb.storage.upload("documents", path, file);
    if (error) {
      console.error("MSDS upload failed:", error);
      alert("Upload failed: " + error);
      return;
    }
    const fileUrl = sb.storage.getPublicUrl("documents", path);
    const rec = { fileName: file.name, fileData: fileUrl, fileUrl, uploadedAt: new Date().toLocaleDateString("en-GB") };
    setMsdsFiles(prev => ({...prev, [code]: rec}));
    await sb.from("msds_files").upsert({ code, file_name: file.name, file_url: fileUrl, uploaded_at: new Date().toLocaleDateString("en-GB") }, { onConflict: "code" });
  }

  async function removeMsds(code) {
    const msds = msdsFiles[code];
    if (msds) {
      const safeName = msds.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      await sb.storage.remove("documents", [`msds_${code}_${safeName}`]);
    }
    setMsdsFiles(prev => { const n = {...prev}; delete n[code]; return n; });
    await sb.from("msds_files").delete().eq("code", code);
  }

  // MSDS full-screen preview modal
  if (previewMsds) {
    const isPdf = previewMsds.fileName.toLowerCase().endsWith(".pdf");
    const isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(previewMsds.fileName);
    const fileUrl = previewMsds.fileUrl || previewMsds.fileData;
    return (
      <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.85)",display:"flex",flexDirection:"column"}}>
        {/* Modal header */}
        <div style={{background:`linear-gradient(135deg,${Z.navyDk},${Z.navyMd})`,borderBottom:`1px solid ${Z.borderMd}`,padding:"14px 20px",display:"flex",alignItems:"center",gap:16,flexShrink:0}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:800,fontSize:15,color:Z.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{previewMsds.name}</div>
            <div style={{fontSize:11,color:Z.muted,marginTop:2}}>{previewMsds.code} · {previewMsds.fileName}</div>
          </div>
          <a href={fileUrl} target="_blank" rel="noreferrer"
            style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:Z.white,border:"none",borderRadius:8,padding:"8px 18px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,textDecoration:"none",whiteSpace:"nowrap"}}>
            ↗ Open
          </a>
          <button onClick={()=>setPreviewMsds(null)}
            style={{background:"rgba(239,68,68,0.15)",color:"#f87171",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font}}>
            ✕ Close
          </button>
        </div>
        {/* Content */}
        <div style={{flex:1,overflow:"auto",padding:isImage?20:0,display:"flex",alignItems:isImage?"center":"stretch",justifyContent:"center"}}>
          {isImage && (
            <img src={fileUrl} alt={previewMsds.fileName} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:8}}/>
          )}
          {!isImage && (
            <div style={{textAlign:"center",padding:60,color:Z.muted}}>
              <div style={{fontSize:56,marginBottom:16}}>{isPdf?"📕":"📄"}</div>
              <div style={{fontSize:17,fontWeight:700,color:Z.white,marginBottom:8}}>{previewMsds.fileName}</div>
              <div style={{fontSize:13,color:Z.muted,marginBottom:28}}>Click the button below to open this file in a new tab.</div>
              <a href={fileUrl} target="_blank" rel="noreferrer"
                style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:Z.white,borderRadius:10,padding:"12px 32px",fontSize:14,fontWeight:700,fontFamily:font,textDecoration:"none",display:"inline-block"}}>
                ↗ Open {isPdf ? "PDF" : "File"} in New Tab
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{marginBottom:20,display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:900,letterSpacing:-.5,margin:"0 0 4px"}}>COSHH Register <HelpTip dark={false} text="All hazardous substances used on site. Hazard level is calculated automatically from the chemical's classification. Upload the MSDS (Safety Data Sheet) for each product — staff can view it from their portal."/></h2>
          <p style={{color:Z.muted,margin:0,fontSize:13}}>Material Safety Data Sheets (MSDS) on file — {allChemicals.length} products across {suppliers.length-1} suppliers</p>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
          {uploadedCount > 0 && (
            <div style={{background:"rgba(16,185,129,0.12)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,padding:"8px 14px",fontSize:12,color:"#34d399",fontWeight:700,whiteSpace:"nowrap"}}>
              📎 {uploadedCount} MSDS uploaded
            </div>
          )}
          <button onClick={()=>{setShowAddForm(s=>!s);setAddErr("");setAddForm(BLANK_CHEM);}}
            style={{background:showAddForm?"rgba(239,68,68,0.12)":`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:showAddForm?"#f87171":Z.white,border:showAddForm?"1px solid rgba(239,68,68,0.3)":"none",borderRadius:10,padding:"9px 20px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
            {showAddForm ? "✕ Cancel" : "+ Add Chemical"}
          </button>
        </div>
      </div>

      {/* Add Chemical Form */}
      {showAddForm && (
        <div ref={addFormRef} style={{background:`linear-gradient(135deg,${Z.navyMd},${Z.navy})`,borderRadius:16,padding:22,marginBottom:20,border:`1px solid rgba(37,99,235,0.4)`}}>
          <h4 style={{margin:"0 0 18px",fontSize:12,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase"}}>New Chemical Entry</h4>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5}}>Zeus Code *</label>
              <input value={addForm.code} onChange={e=>setAddForm(p=>({...p,code:e.target.value}))} placeholder="e.g. CHEM000200" style={inp}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5}}>Supplier</label>
              <input value={addForm.supplier} onChange={e=>setAddForm(p=>({...p,supplier:e.target.value}))} placeholder="e.g. Anglian Chemicals" style={inp}/>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5}}>Product Name *</label>
            <input value={addForm.name} onChange={e=>setAddForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Heavy Duty Floor Cleaner" style={inp}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:14}}>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5}}>Date on MSDS</label>
              <input type="date" value={addForm.msdsDate} onChange={e=>setAddForm(p=>({...p,msdsDate:e.target.value}))} style={inp}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5}}>UN Number / Transport Class</label>
              <input value={addForm.un} onChange={e=>setAddForm(p=>({...p,un:e.target.value}))} placeholder="e.g. 1760 — Corrosive liquid n.o.s" style={inp}/>
            </div>
          </div>
          <div style={{marginBottom:18}}>
            <label style={{fontSize:11,fontWeight:700,color:Z.muted,letterSpacing:.5,textTransform:"uppercase",display:"block",marginBottom:5}}>CLP Hazard Classification</label>
            <textarea value={addForm.classification} onChange={e=>setAddForm(p=>({...p,classification:e.target.value}))} placeholder="e.g. Skin Corr. 1; H314 · Eye Dam. 1; H318" rows={2} style={{...inp,resize:"vertical",lineHeight:1.5}}/>
          </div>
          {addErr && <div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"9px 14px",fontSize:12,color:"#f87171",marginBottom:14}}>{addErr}</div>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
            <button onClick={()=>{setShowAddForm(false);setAddErr("");setAddForm(BLANK_CHEM);}}
              style={{background:Z.overlay,color:Z.muted,border:`1px solid ${Z.borderMd}`,borderRadius:9,padding:"9px 20px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font}}>
              Cancel
            </button>
            <button onClick={saveChemical}
              style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:Z.white,border:"none",borderRadius:9,padding:"9px 24px",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:font}}>
              Add to Register
            </button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {Object.entries(hazardConfig).map(([k,v])=>(
          <div key={k} onClick={()=>setHazardFilter(hazardFilter===k?"all":k)}
            style={{background:hazardFilter===k?v.bg:Z.overlay,borderRadius:14,padding:"14px 18px",border:`1px solid ${hazardFilter===k?v.border:Z.border}`,cursor:"pointer",transition:"all .2s"}}>
            <div style={{fontSize:22,marginBottom:4}}>{v.icon}</div>
            <div style={{fontSize:28,fontWeight:900,color:v.color,letterSpacing:-1}}>{counts[k]}</div>
            <div style={{fontSize:11,color:Z.muted,fontWeight:600,letterSpacing:.5,textTransform:"uppercase"}}>{v.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by code or product name…" style={inp}/>
        <select value={supplierFilter} onChange={e=>setSupplierFilter(e.target.value)} style={{...inp,cursor:"pointer"}}>
          {suppliers.map(s=><option key={s} value={s}>{s==="all"?"All Suppliers":s}</option>)}
        </select>
      </div>

      {/* Results count */}
      <div style={{fontSize:12,color:Z.muted,marginBottom:12,fontWeight:600}}>
        Showing {filtered.length} of {COSHH_DATA.length} products
        {hazardFilter!=="all" && <span style={{marginLeft:8,color:hazardConfig[hazardFilter].color}}>· {hazardConfig[hazardFilter].label} filter active</span>}
      </div>

      {/* Table header - desktop only */}
      {!isMobile && (
        <div style={{background:Z.overlay,borderRadius:"10px 10px 0 0",border:`1px solid ${Z.borderMd}`,borderBottom:"none",padding:"10px 16px",display:"grid",gridTemplateColumns:"130px 1fr 140px 110px 90px 60px",gap:12,alignItems:"center"}}>
          {["Zeus Code","Product Name","Supplier","MSDS Date","Hazard","MSDS"].map(h=>(
            <div key={h} style={{fontSize:10,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase"}}>{h}</div>
          ))}
        </div>
      )}

      {/* Rows */}
      <div style={{borderRadius:isMobile?"14px":"0 0 14px 14px",overflow:"hidden",border:`1px solid ${Z.borderMd}`}}>
        {filtered.length===0 ? (
          <div style={{padding:32,textAlign:"center",color:Z.muted,fontSize:14,background:Z.overlay}}>No products match your search.</div>
        ) : filtered.map((c,i)=>{
          const level = coshhHazardLevel(c.classification);
          const hc = hazardConfig[level];
          const isExpanded = expandedCode === c.code;
          const isDangerous = c.un !== "Non Dangerous Goods" && c.un !== "";
          const msds = msdsFiles[c.code];
          return (
            <div key={c.code} style={{borderTop:i===0?"none":`1px solid ${Z.border}`,background:isExpanded?`linear-gradient(135deg,${Z.navyMd},${Z.navy})`:i%2===0?Z.overlaySm:Z.overlay}}>

              {/* Row — card on mobile, grid on desktop */}
              {isMobile ? (
                <div onClick={()=>setExpandedCode(isExpanded?null:c.code)} style={{padding:"12px 14px",cursor:"pointer",display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <span style={{fontSize:11,fontWeight:700,color:c._custom?Z.gold:Z.accentLt,fontFamily:"monospace"}}>{c.code}{c._custom&&<span style={{fontSize:9,marginLeft:4,color:Z.gold}}> NEW</span>}</span>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:11,fontWeight:700,color:hc.color,background:hc.bg,border:`1px solid ${hc.border}`,borderRadius:6,padding:"2px 8px"}}>{hc.icon}</span>
                      {msds ? <span style={{fontSize:14}}>📎</span> : <span style={{fontSize:10,color:Z.border}}>—</span>}
                    </div>
                  </div>
                  <div style={{fontSize:13,fontWeight:600,color:Z.white}}>{c.name}</div>
                  <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:Z.muted}}>{c.supplier}</span>
                    <span style={{fontSize:11,color:Z.muted}}>MSDS: {c.msdsDate||"—"}</span>
                    {isDangerous&&<span style={{fontSize:10,color:"#f59e0b",fontWeight:700}}>⚠ UN Classified</span>}
                  </div>
                </div>
              ) : (
              <div style={{padding:"12px 16px",display:"grid",gridTemplateColumns:"130px 1fr 140px 110px 90px 60px",gap:12,alignItems:"center"}}>
                <div onClick={()=>setExpandedCode(isExpanded?null:c.code)} style={{fontSize:11,fontWeight:700,color:c._custom?Z.gold:Z.accentLt,fontFamily:"monospace",letterSpacing:.3,cursor:"pointer"}}>
                  {c.code}{c._custom && <span style={{fontSize:9,marginLeft:4,color:Z.gold,fontWeight:700,letterSpacing:.5,verticalAlign:"middle"}}>NEW</span>}
                </div>
                <div onClick={()=>setExpandedCode(isExpanded?null:c.code)} style={{fontSize:12,fontWeight:600,color:Z.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer"}} title={c.name}>{c.name}</div>
                <div onClick={()=>setExpandedCode(isExpanded?null:c.code)} style={{fontSize:11,color:Z.muted,cursor:"pointer"}}>{c.supplier}</div>
                <div onClick={()=>setExpandedCode(isExpanded?null:c.code)} style={{fontSize:11,color:Z.muted,cursor:"pointer"}}>{c.msdsDate||"—"}</div>
                <div onClick={()=>setExpandedCode(isExpanded?null:c.code)} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer"}}>
                  <span style={{fontSize:11,fontWeight:700,color:hc.color,background:hc.bg,border:`1px solid ${hc.border}`,borderRadius:6,padding:"2px 8px",whiteSpace:"nowrap"}}>{hc.icon}</span>
                  {isDangerous && <span style={{fontSize:9,color:"#f59e0b",fontWeight:700,letterSpacing:.5}}>UN</span>}
                </div>
                <div style={{display:"flex",justifyContent:"center"}}>
                  {msds ? <span style={{fontSize:16,cursor:"pointer"}} title={`MSDS uploaded: ${msds.fileName}`} onClick={()=>setExpandedCode(isExpanded?null:c.code)}>📎</span>
                        : <span style={{fontSize:11,color:Z.border,cursor:"pointer"}} title="No MSDS uploaded" onClick={()=>setExpandedCode(isExpanded?null:c.code)}>—</span>}
                </div>
              </div>)}

              {/* Expanded panel */}
              {isExpanded && (
                <div style={{padding:"0 16px 18px",borderTop:`1px solid ${Z.border}`}}>

                  {/* Hazard info */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:14,marginBottom:16}}>
                    <div style={{background:Z.overlaySm,borderRadius:10,padding:"12px 14px",border:`1px solid ${Z.border}`}}>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",marginBottom:6}}>UN / Transport Classification</div>
                      <div style={{fontSize:12,color:isDangerous?"#f59e0b":Z.green,fontWeight:600}}>{c.un||"Non Dangerous Goods"}</div>
                    </div>
                    <div style={{background:hc.bg,borderRadius:10,padding:"12px 14px",border:`1px solid ${hc.border}`}}>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",marginBottom:6}}>Hazard Classification (CLP)</div>
                      <div style={{fontSize:12,color:hc.color,fontWeight:600,lineHeight:1.6}}>{c.classification||"Not classified"}</div>
                    </div>
                  </div>

                  {/* MSDS section */}
                  <div style={{background:Z.overlaySm,borderRadius:12,padding:"14px 16px",border:`1px solid ${Z.borderMd}`}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:1,color:Z.muted,textTransform:"uppercase",marginBottom:12}}>Material Safety Data Sheet (MSDS)</div>
                    {msds ? (
                      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:Z.white,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📎 {msds.fileName}</div>
                          <div style={{fontSize:11,color:Z.muted,marginTop:2}}>Uploaded {msds.uploadedAt}</div>
                        </div>
                        <button onClick={()=>setPreviewMsds({code:c.code, name:c.name, fileName:msds.fileName, fileData:msds.fileData})}
                          style={{background:Z.overlay,color:Z.white,border:`1px solid ${Z.borderMd}`,borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                          👁 View MSDS
                        </button>
                        <a href={msds.fileData} download={msds.fileName}
                          style={{background:`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:Z.white,border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,textDecoration:"none",whiteSpace:"nowrap"}}>
                          ↓ Download
                        </a>
                        <button onClick={()=>removeMsds(c.code)}
                          style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input ref={el=>fileInputRefs.current[c.code]=el} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          style={{display:"none"}}
                          onChange={e=>{ if(e.target.files[0]) handleMsdsUpload(c.code, e.target.files[0]); e.target.value=""; }}/>
                        <label
                          onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=Z.accent;}}
                          onDragLeave={e=>{e.currentTarget.style.borderColor=Z.borderMd;}}
                          onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor=Z.borderMd;if(e.dataTransfer.files[0])handleMsdsUpload(c.code,e.dataTransfer.files[0]);}}
                          onClick={()=>fileInputRefs.current[c.code]&&fileInputRefs.current[c.code].click()}
                          style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:`2px dashed ${Z.borderMd}`,borderRadius:10,padding:"20px 16px",cursor:"pointer",transition:"border-color .2s",textAlign:"center"}}>
                          <div style={{fontSize:28,marginBottom:6}}>📤</div>
                          <div style={{fontSize:13,fontWeight:700,color:Z.white,marginBottom:3}}>Upload MSDS</div>
                          <div style={{fontSize:11,color:Z.muted}}>Drop file here or click to browse · PDF, Word, or image</div>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* COSHH Assessment */}
                  <div style={{marginTop:14,background:Z.overlaySm,borderRadius:12,border:`1px solid ${Z.borderMd}`,overflow:"hidden"}}>
                    <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:assessments[c.code]||editingAssessment===c.code?`1px solid ${Z.border}`:"none"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:16}}>📋</span>
                        <div>
                          <div style={{fontSize:13,fontWeight:700,color:Z.white}}>COSHH Assessment</div>
                          {assessments[c.code] && <div style={{fontSize:10,color:Z.green}}>✓ Completed {assessments[c.code].assessmentDate||""}</div>}
                          {!assessments[c.code] && <div style={{fontSize:10,color:"#f87171"}}>⚠ Not yet completed</div>}
                        </div>
                      </div>
                      <button onClick={()=>setEditingAssessment(editingAssessment===c.code?null:c.code)}
                        style={{background:editingAssessment===c.code?"rgba(239,68,68,0.1)":`linear-gradient(135deg,${Z.accent},${Z.blue})`,color:editingAssessment===c.code?"#f87171":"#fff",border:editingAssessment===c.code?"1px solid rgba(239,68,68,0.25)":"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font,whiteSpace:"nowrap"}}>
                        {editingAssessment===c.code?"✕ Cancel":assessments[c.code]?"✏ Edit Assessment":"+ Complete Assessment"}
                      </button>
                    </div>

                    {/* View completed assessment */}
                    {assessments[c.code] && editingAssessment!==c.code && (() => {
                      const a = assessments[c.code];
                      const riskColors = {low:"#10b981",medium:"#f59e0b",high:"#ef4444"};
                      return (
                        <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12}}>
                          <div><span style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5}}>Prepared by</span><div style={{fontSize:13,color:Z.white,marginTop:2}}>{a.preparedBy||"—"}</div></div>
                          <div><span style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5}}>Risk Rating</span><div style={{fontSize:13,fontWeight:700,color:riskColors[a.riskRating]||Z.muted,marginTop:2,textTransform:"capitalize"}}>{a.riskRating||"—"}</div></div>
                          <div><span style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5}}>Location / Area</span><div style={{fontSize:13,color:Z.white,marginTop:2}}>{a.location||"—"}</div></div>
                          <div><span style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5}}>Next Review</span><div style={{fontSize:13,color:Z.white,marginTop:2}}>{a.nextReviewDate||"—"}</div></div>
                          {a.exposureRoutes && <div style={{gridColumn:isMobile?"1":"1 / -1"}}><span style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5}}>Exposure Routes</span><div style={{fontSize:13,color:Z.white,marginTop:2}}>{Object.entries(a.exposureRoutes).filter(([,v])=>v).map(([k])=>k.charAt(0).toUpperCase()+k.slice(1)).join(", ")||"None specified"}</div></div>}
                          {a.healthEffects && <div style={{gridColumn:isMobile?"1":"1 / -1"}}><span style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5}}>Health Effects</span><div style={{fontSize:13,color:Z.white,marginTop:2}}>{a.healthEffects}</div></div>}
                          {a.controlMeasures && <div style={{gridColumn:isMobile?"1":"1 / -1"}}><span style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5}}>Control Measures</span><div style={{fontSize:13,color:Z.white,marginTop:2}}>{Object.entries(a.controlMeasures).filter(([,v])=>v).map(([k])=>k.charAt(0).toUpperCase()+k.slice(1)).join(", ")||"None specified"}</div></div>}
                          {(a.ppeRequired?.gloves||a.ppeRequired?.respirator||a.ppeRequired?.eyeProtection) && <div style={{gridColumn:isMobile?"1":"1 / -1"}}><span style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5}}>PPE Required</span><div style={{fontSize:13,color:Z.white,marginTop:2}}>{[a.ppeRequired.gloves&&`Gloves: ${a.ppeRequired.gloves}`,a.ppeRequired.respirator&&`Respirator: ${a.ppeRequired.respirator}`,a.ppeRequired.eyeProtection&&`Eye: ${a.ppeRequired.eyeProtection}`,a.ppeRequired.bodyProtection&&`Body: ${a.ppeRequired.bodyProtection}`,a.ppeRequired.footProtection&&`Foot: ${a.ppeRequired.footProtection}`].filter(Boolean).join(" · ")}</div></div>}
                          {a.emergencyProcedures && <div style={{gridColumn:isMobile?"1":"1 / -1"}}><span style={{fontSize:10,fontWeight:700,color:Z.muted,textTransform:"uppercase",letterSpacing:.5}}>Emergency Procedures</span><div style={{fontSize:13,color:Z.white,marginTop:2}}>{a.emergencyProcedures}</div></div>}
                        </div>
                      );
                    })()}

                    {/* Edit / create form */}
                    {editingAssessment===c.code && (
                      <CoshhAssessmentForm
                        c={c}
                        existing={assessments[c.code]||null}
                        onSave={form=>{saveAssessment(c.code,form);setEditingAssessment(null);}}
                        onCancel={()=>setEditingAssessment(null)}
                        Z={Z} font={font} isMobile={isMobile}
                      />
                    )}
                  </div>

                  {/* Delete custom chemical */}
                  {c._custom && (
                    <div style={{marginTop:12,display:"flex",justifyContent:"flex-end"}}>
                      <button onClick={()=>deleteChemical(c.code)}
                        style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font}}>
                        🗑 Remove from Register
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


export { CoshhTab };
