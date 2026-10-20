/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/screens/LoginScreen.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * The sign-in page (always dark navy: nobody is signed in yet, so there's no theme).
 *
 * Reads the app's shared state and actions with useApp() (app/AppContext.js). Moved out of
 * App.jsx in October 2026 without changing what it shows.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { BrandSignInLogo } from "../../shared/Logo";
import { useApp } from "../AppContext";

// The login screen deliberately ignores the theme (always dark navy) because no user is known yet.
export function LoginScreen() {
  const {
    email, err, font, isMobile, login, pass, setEmail, setPass, signingIn
  } = useApp();
    return (
  <div style={{minHeight:"100vh",background:"#060d2e",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font,padding:20,position:"relative",overflow:"hidden"}}>
    {/* background grid — always dark navy, never themed */}

    <div style={{position:"absolute",top:"-30%",right:"-10%",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,#1a3a9e22,transparent 70%)",pointerEvents:"none"}}/>

    <div style={{background:"linear-gradient(160deg,#152370,#0d1f5c)",borderRadius:isMobile?16:24,padding:isMobile?"28px 20px":"48px 44px",width:"100%",maxWidth:440,boxShadow:"0 30px 80px rgba(0,0,0,.6)",border:"1px solid rgba(255,255,255,0.08)",position:"relative",zIndex:1}}>
      {/* Logo */}
      <div style={{marginBottom:32,paddingBottom:24,borderBottom:"1px solid rgba(255,255,255,0.10)"}}>
        <BrandSignInLogo/>
      </div>

      <div style={{marginBottom:28}}>
        <h3 style={{margin:0,fontSize:16,fontWeight:600,color:"#94a3b8",letterSpacing:-.3}}>Health & Safety Hub</h3>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <label style={{color:"#94a3b8",fontSize:11,fontWeight:700,letterSpacing:1}}>EMAIL ADDRESS</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.co.uk"
            style={{width:"100%",marginTop:6,padding:"11px 14px",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,color:"#ffffff",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:font}}/>
        </div>
        <div>
          <label style={{color:"#94a3b8",fontSize:11,fontWeight:700,letterSpacing:1}}>PASSWORD</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••"
            onKeyDown={e=>e.key==="Enter"&&login()}
            style={{width:"100%",marginTop:6,padding:"11px 14px",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:10,color:"#ffffff",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:font}}/>
        </div>
        {err && <p style={{color:"#f87171",fontSize:13,margin:0}}>{err}</p>}
        <button onClick={login} disabled={signingIn} style={{opacity:signingIn?0.7:1,marginTop:4,background:"linear-gradient(135deg,#2563eb,#152370)",color:"#ffffff",border:"none",borderRadius:10,padding:"13px",fontWeight:800,fontSize:15,cursor:"pointer",letterSpacing:.5,fontFamily:font,boxShadow:"0 4px 20px rgba(37,99,235,.4)"}}>
          {signingIn ? "Signing in…" : "Sign In →"}
        </button>
      </div>

      <div style={{marginTop:28,padding:16,background:"rgba(255,255,255,0.04)",borderRadius:12,fontSize:12}}>
        <strong style={{color:"#94a3b8",letterSpacing:.5,fontSize:11}}>NEED HELP?</strong>
        <div style={{marginTop:6,color:"#94a3b8",fontSize:11,lineHeight:1.6}}>Contact your Health &amp; Safety Manager or IT administrator if you have forgotten your password or cannot access your account.</div>
      </div>
    </div>
    <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}`}</style>
  </div>
);
}
