/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/siteBars.jsx — createSiteBars(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Things shown over any page: a racking bay opened from its QR label (?rack=), the lone working
 * alert bar. (The racking items for the notification bell: app/bell/rackingNotifications.js.)
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { bayName } from "../lib/racking";
import { LoneAlertBar } from "../shared/LoneRespond";
import { RackBay } from "./lazyParts";

export function createSiteBars(app) {
  const {
    allUsers, font, loneFocus, loneSessions, loneWatch, rackFocus, racking, rackInspector, setLoneFocus,
    setRackFocus, T, user
  } = app;
  const closeRack = () => { setRackFocus(null); try { const u = new URL(window.location.href); u.searchParams.delete("rack"); window.history.replaceState(null, "", u.toString()); } catch { /* */ } };
  const rackWindow = () => {
    if (!user || !rackFocus) return null;
    const loc = racking.locations.find(l => l.id === rackFocus) || null;
    return (
      <div role="dialog" aria-modal="true" aria-label="Racking bay" data-testid="rack-window" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:8500,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"3vh 12px",overflowY:"auto"}}>
        <div style={{background:`linear-gradient(160deg,${T.navyMd},${T.navyDk||T.navy})`,border:`1px solid ${T.borderMd}`,borderRadius:18,width:"100%",maxWidth:620,color:T.white,fontFamily:font}}>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 20px",borderBottom:`1px solid ${T.border}`}}>
            <h2 style={{margin:0,fontSize:19,fontWeight:900,flex:1}}>{loc ? bayName(loc) : `Bay ${rackFocus}`}</h2>
            <button type="button" onClick={closeRack} aria-label="Close" style={{background:T.overlay,border:`1px solid ${T.borderMd}`,color:T.white,borderRadius:10,width:40,height:40,cursor:"pointer"}}>✕</button>
          </div>
          <div style={{padding:20}}>{racking.loaded ? <RackBay code={rackFocus} loc={loc} damage={racking.damage} user={user} isInspector={rackInspector} settings={racking.settings} Z={T} font={font}/> : <div style={{color:T.muted}}>Loading…</div>}</div>
        </div>
      </div>
    );
  };
  const loneBar = () => loneWatch ? <LoneAlertBar sessions={loneSessions} people={allUsers} me={user} focusId={loneFocus} onFocusDone={() => { setLoneFocus(null); try { const u = new URL(window.location.href); u.searchParams.delete("lone"); window.history.replaceState(null, "", u.toString()); } catch { /* */ } }} Z={T} font={font}/> : null;

  return {
    closeRack, rackWindow, loneBar
  };
}
