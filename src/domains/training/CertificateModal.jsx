import React from "react";
import { E } from "../../lib/emoji";
import { ZEUS_LOGO_LIGHT_SRC } from "../../shared/Logo";

/**
 * CertificateModal — certificate viewer / print (moved out of App.jsx).
 * Opened by App.jsx whenever `cert` = { module, score, date, certId } is set, from
 * the History tab AND straight after passing a quiz in the module player (the
 * player screen never rendered the old in-App modal, so "View Certificate" there
 * did nothing).
 * Printing opens a new window with the certificate's HTML and calls window.print()
 * (the app-wide pattern for PDF output — the user chooses "Save as PDF").
 * If certId is missing a random one is shown — it is NOT saved anywhere.
 *
 * Props: cert, user, onClose, T (theme tokens), font
 */
function CertificateModal({ cert, user, onClose, T, font }) {
  const certRef = React.useRef(null);   // hooks first, before any early return
  if (!cert) return null;
    const certId = cert.certId || "ZSL-"+Math.random().toString(36).slice(2,8).toUpperCase();
    const issueDate = cert.date;
    const moduleIcon = cert.module.icon || "🏅";

    function printCert() {
      const el = certRef.current;
      if (!el) return;
      const win = window.open("","_blank","width=900,height=650");
      win.document.write(`
        <html><head><title>Certificate — ${cert.module.title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700;800;900&display=swap');
          * { margin:0; padding:0; box-sizing:border-box; }
          body { background:#091548; font-family:'Barlow',sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          @media print { body { background:#091548; } @page { margin:0; size: A4 landscape; } }
        </style></head>
        <body>${el.outerHTML}<script>window.onload=()=>{window.print();}<\/script></body></html>
      `);
      win.document.close();
    }

    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20,overflow:"auto"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16,width:"100%",maxWidth:640}}>

          {/* Certificate card */}
          <div ref={certRef} style={{
            width:"100%",
            background:"linear-gradient(160deg,#0d1f5c 0%,#091548 60%,#0a1a4a 100%)",
            borderRadius:20,
            padding:0,
            position:"relative",
            overflow:"hidden",
            boxShadow:`0 0 0 1px rgba(245,158,11,0.4), 0 0 0 4px rgba(245,158,11,0.08), 0 40px 80px rgba(0,0,0,0.7)`,
          }}>

            {/* Full decorative border using absolute positioned div */}
            <div style={{position:"absolute",inset:0,borderRadius:20,border:"3px solid rgba(245,158,11,0.6)",pointerEvents:"none",zIndex:2}}/>
            <div style={{position:"absolute",inset:8,borderRadius:14,border:"1px solid rgba(245,158,11,0.2)",pointerEvents:"none",zIndex:2}}/>
            {/* Corner ornaments */}
            {[["top:12px","left:12px"],["top:12px","right:12px"],["bottom:12px","left:12px"],["bottom:12px","right:12px"]].map((pos,i)=>{
              const style = {position:"absolute",width:20,height:20,zIndex:3,pointerEvents:"none"};
              pos.forEach(p=>{ const [k,v]=p.split(":"); style[k]=v; });
              const r = i===1||i===3 ? "rotate(90deg)" : i===2 ? "rotate(-90deg)" : i===3 ? "rotate(180deg)" : "none";
              const transforms = ["none","rotate(90deg)","rotate(-90deg)","rotate(180deg)"];
              return (
                <svg key={i} style={{...style,transform:transforms[i]}} viewBox="0 0 20 20">
                  <path d="M0,0 L16,0 L16,2 L2,2 L2,16 L0,16 Z" fill="#f59e0b" opacity="0.8"/>
                  <circle cx="2" cy="2" r="2" fill="#f59e0b"/>
                </svg>
              );
            })}

            {/* Watermark */}
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",zIndex:0}}>
              <div style={{fontSize:72,fontWeight:900,color:"rgba(245,158,11,0.04)",letterSpacing:8,textTransform:"uppercase",transform:"rotate(-30deg)",whiteSpace:"nowrap",userSelect:"none"}}>
                ZEUS PROTECT
              </div>
            </div>

            {/* Top gold bar */}
            <div style={{height:6,background:"linear-gradient(90deg,#f59e0b,#fbbf24,#f59e0b)",position:"relative",zIndex:1}}/>

            {/* Content */}
            <div style={{padding:"20px 48px 24px",position:"relative",zIndex:1,textAlign:"center"}}>

              {/* Logo + title row */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
                <img src={ZEUS_LOGO_LIGHT_SRC} alt="Zeus" style={{height:44,objectFit:"contain"}}/>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:3,color:"rgba(245,158,11,0.7)",textTransform:"uppercase",marginBottom:2}}>Zeus Protect</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:1}}>Health & Safety Training</div>
                </div>
              </div>

              {/* Divider */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
                <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,rgba(245,158,11,0.4))"}}/>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:3,color:"rgba(245,158,11,0.8)",textTransform:"uppercase"}}>Certificate of Completion</div>
                <div style={{flex:1,height:1,background:"linear-gradient(90deg,rgba(245,158,11,0.4),transparent)"}}/>
              </div>

              {/* This certifies */}
              <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>This is to certify that</div>

              {/* Name */}
              <div style={{fontSize:30,fontWeight:900,color:"#ffffff",letterSpacing:-0.5,marginBottom:2,lineHeight:1.1}}>{user?.name}</div>
              {user?.jobTitle && <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:10}}>{user.jobTitle}</div>}

              {/* has successfully completed */}
              <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>has successfully completed</div>

              {/* Module */}
              <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:12,padding:"10px 24px",marginBottom:12,display:"inline-block",minWidth:300}}>
                <div style={{fontSize:28,marginBottom:6}}>{moduleIcon}</div>
                <div style={{fontSize:18,fontWeight:800,color:"#f59e0b",lineHeight:1.2}}>{cert.module.title}</div>
                {cert.module.category && <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:4}}>{cert.module.category}</div>}
              </div>

              {/* Score + date row */}
              <div style={{display:"flex",justifyContent:"center",gap:32,marginBottom:24}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",marginBottom:4}}>Score Achieved</div>
                  <div style={{fontSize:22,fontWeight:900,color:"#10b981"}}>{cert.score}%</div>
                </div>
                <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",marginBottom:4}}>Date Issued</div>
                  <div style={{fontSize:18,fontWeight:700,color:"rgba(255,255,255,0.8)"}}>{issueDate}</div>
                </div>
                {cert.module.renewalMonths && <>
                  <div style={{width:1,background:"rgba(255,255,255,0.1)"}}/>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:1.5,color:"rgba(255,255,255,0.35)",textTransform:"uppercase",marginBottom:4}}>Valid For</div>
                    <div style={{fontSize:18,fontWeight:700,color:"rgba(255,255,255,0.8)"}}>{cert.module.renewalMonths} months</div>
                  </div>
                </>}
              </div>

              {/* Signature line + seal row */}
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:20}}>
                {/* Signature */}
                <div style={{textAlign:"left"}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:22,color:"rgba(255,255,255,0.7)",letterSpacing:1,marginBottom:4,fontStyle:"italic"}}>Zeus Protect</div>
                  <div style={{width:120,height:1,background:"rgba(255,255,255,0.2)",marginBottom:6}}/>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",letterSpacing:1,textTransform:"uppercase"}}>Authorised Signature</div>
                </div>

                {/* Gold seal */}
                <div style={{position:"relative",width:80,height:80,flexShrink:0}}>
                  <svg viewBox="0 0 80 80" style={{position:"absolute",inset:0,width:"100%",height:"100%"}}>
                    {/* Starburst */}
                    {Array.from({length:16}).map((_,i)=>{
                      const a = (i*22.5)*Math.PI/180;
                      const a2 = (i*22.5+11.25)*Math.PI/180;
                      const x1=40+34*Math.cos(a), y1=40+34*Math.sin(a);
                      const x2=40+28*Math.cos(a2), y2=40+28*Math.sin(a2);
                      const x3=40+34*Math.cos(a+22.5*Math.PI/180), y3=40+34*Math.sin(a+22.5*Math.PI/180);
                      return <polygon key={i} points={`40,40 ${x1},${y1} ${x2},${y2} ${x3},${y3}`} fill="#f59e0b" opacity="0.9"/>;
                    })}
                    <circle cx="40" cy="40" r="24" fill="#0d1f5c" stroke="#f59e0b" strokeWidth="1.5"/>
                    <text x="40" y="35" textAnchor="middle" fill="#f59e0b" fontSize="7" fontWeight="700" fontFamily="Barlow,sans-serif" letterSpacing="1">ZEUS</text>
                    <text x="40" y="44" textAnchor="middle" fill="#fbbf24" fontSize="5.5" fontFamily="Barlow,sans-serif" letterSpacing="0.5">PROTECT</text>
                    <text x="40" y="53" textAnchor="middle" fill="rgba(245,158,11,0.6)" fontSize="4.5" fontFamily="Barlow,sans-serif">VERIFIED</text>
                  </svg>
                </div>

                {/* Cert ref */}
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Certificate ID</div>
                  <div style={{fontSize:12,fontWeight:700,color:"rgba(245,158,11,0.7)",letterSpacing:2,fontFamily:"monospace"}}>{certId}</div>
                </div>
              </div>
            </div>

            {/* Bottom gold bar */}
            <div style={{height:4,background:"linear-gradient(90deg,#f59e0b,#fbbf24,#f59e0b)"}}/>
          </div>

          {/* Buttons */}
          <div style={{display:"flex",gap:10}}>
            <button onClick={printCert}
              style={{background:`linear-gradient(135deg,${T.accent},${T.blue})`,color:"#fff",border:"none",borderRadius:10,padding:"11px 24px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13,boxShadow:"0 4px 14px rgba(37,99,235,0.4)"}}>
              🖨 Print / Save PDF
            </button>
            <button onClick={onClose}
              style={{background:T.headerBgMd,color:T.muted,border:`1px solid ${T.borderMd}`,borderRadius:10,padding:"11px 24px",cursor:"pointer",fontFamily:font,fontWeight:700,fontSize:13}}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
}

export { CertificateModal };
