/**
 * SignInPage — contractors sign in and out at reception.  <portal>/?signin=CODE
 * Opened by the QR code on the reception poster (Site Settings → Contractor sign-in).
 * No account needed: main.jsx shows this page instead of the portal when the address has
 * ?signin=. Everything goes through netlify/functions/zp-signin.mjs; this page never
 * reads the Contractor Register, and is told only whether to see reception first.
 *
 * This phone remembers today's sign-in (localStorage "zp_signin_v1") so scanning again
 * on the way out offers "Sign out" straight away. On another phone, "Signing out?" asks
 * for the company and name instead.
 */
import React from "react";
import { useBrand } from "../lib/brand";
import { brandCompany } from "../lib/brandCore";
import { ukNow } from "../lib/contractorSignin";

const NAVY = "#0d1f5c", MUTED = "#5b6478", LINE = "#d6dbe7";
const KEEP = "zp_signin_v1";
const FN = "/.netlify/functions/zp-signin";
const BUSY = "Sign-in isn't working just now. Please sign in at reception.";

const readKept = code => { try { const k = JSON.parse(localStorage.getItem(KEEP) || "null"); return k && k.code === code && k.date === ukNow().date ? k : null; } catch { return null; } };
const writeKept = v => { try { if (v) localStorage.setItem(KEEP, JSON.stringify(v)); else localStorage.removeItem(KEEP); } catch { /* private mode */ } };
async function call(body) {
  try { const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return await r.json(); }
  catch { return { ok: false, error: BUSY }; }
}

const inp = { width: "100%", boxSizing: "border-box", padding: "13px 14px", fontSize: 17, border: `1.5px solid ${LINE}`, borderRadius: 10, fontFamily: "inherit", color: "#111827", background: "#fff" };
const btn = (primary, extra) => ({ width: "100%", padding: "15px 18px", fontSize: 18, fontWeight: 800, borderRadius: 12, border: primary ? "none" : `2px solid ${NAVY}`, background: primary ? NAVY : "#fff", color: primary ? "#fff" : NAVY, cursor: "pointer", fontFamily: "inherit", ...extra });

function Field({ id, label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={{ display: "block", fontWeight: 700, fontSize: 15, color: NAVY, marginBottom: 5 }}>{label}</label>
      {hint && <div style={{ fontSize: 13, color: MUTED, marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  );
}

export function SignInPage({ code: rawCode = "" }) {
  const b = useBrand();
  const code = String(rawCode || "").trim().toUpperCase();
  const [conf, setConf] = React.useState(null);          // null = loading
  const [kept, setKept] = React.useState(() => readKept(code));
  const [mode, setMode] = React.useState(() => (readKept(code) ? "signedin" : "form"));   // form | signedin | signout | out
  const [f, setF] = React.useState({ company: "", name: "", phone: "", host: "", purpose: "", areas: "", permit: "", signature: "" });
  const [ticks, setTicks] = React.useState({});
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [outTime, setOutTime] = React.useState("");
  const topRef = React.useRef(null);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const toTop = () => { try { topRef.current && topRef.current.scrollIntoView({ block: "start" }); } catch { /* */ } };

  React.useEffect(() => { document.title = `Contractor sign-in · ${brandCompany(b)}`; }, [b]);
  React.useEffect(() => {
    let on = true;
    fetch(`${FN}?code=${encodeURIComponent(code)}`, { cache: "no-store" }).then(r => r.json()).catch(() => ({ ok: false, error: BUSY }))
      .then(j => { if (on) setConf(j || { ok: false, error: BUSY }); });
    return () => { on = false; };
  }, [code]);

  const items = (conf && conf.items) || [];
  const allTicked = items.every(i => ticks[i.id]);

  async function signIn(e) {
    e.preventDefault(); setErr("");
    if (!allTicked) { setErr("Please tick every line of the checklist."); return; }
    setBusy(true);
    const r = await call({ action: "signin", code, ...f, answers: ticks });
    setBusy(false);
    if (!r.ok) { setErr(r.notInUse ? "This sign-in code isn't in use any more. Please sign in at reception." : (r.error || BUSY)); return; }
    const k = { code, id: r.id, token: r.token, date: r.date, timeIn: r.timeIn, name: f.name.trim(), company: f.company.trim(), seeReception: !!r.seeReception };
    writeKept(k); setKept(k); setMode("signedin"); toTop();
  }
  async function signOut(e) {
    if (e) e.preventDefault();
    setErr(""); setBusy(true);
    const r = kept && mode === "signedin" ? await call({ action: "signout", code, id: kept.id, token: kept.token })
      : await call({ action: "signout", code, company: f.company, name: f.name });
    setBusy(false);
    if (!r.ok) { setErr(r.error || BUSY); return; }
    writeKept(null); setKept(null); setOutTime(r.timeOut || ""); setMode("out"); toTop();
  }

  const logo = b.logos && (b.logos.light || b.logos.dark);
  const card = { background: "#fff", borderRadius: 16, border: `3px solid ${NAVY}`, padding: "20px 18px", boxShadow: "0 10px 30px rgba(13,31,92,0.08)" };
  const banner = (bg, fg, children, tid) => <div role="status" data-testid={tid} style={{ padding: "14px 16px", borderRadius: 12, background: bg, color: fg, fontWeight: 700, fontSize: 16, lineHeight: 1.45, margin: "12px 0" }}>{children}</div>;
  const error = err ? <div role="alert" data-testid="signin-error" style={{ padding: "12px 14px", borderRadius: 10, background: "#fee2e2", color: "#b91c1c", fontWeight: 700, margin: "12px 0" }}>{err}</div> : null;

  let body;
  if (conf === null) body = <p role="status" style={{ color: MUTED }}>Loading…</p>;
  else if (!conf.ok) body = banner("#fef3c7", "#92400e", conf.notInUse ? "This sign-in code isn't in use. Please sign in at reception." : (conf.error || BUSY), "signin-notinuse");
  else if (mode === "out") body = (
    <div data-testid="signin-out">
      {banner("#dcfce7", "#15803d", <>You're signed out{outTime ? ` at ${outTime}` : ""}. Thank you, and have a safe journey.</>)}
    </div>
  );
  else if (mode === "signedin" && kept) body = (
    <div data-testid="signin-done">
      {banner("#dcfce7", "#15803d", <>✓ {kept.name}, you're signed in{kept.timeIn ? ` since ${kept.timeIn}` : ""}.</>)}
      {kept.seeReception && banner("#fef3c7", "#92400e", "Please see reception before you start work. They need to check a few things with you.", "signin-see-reception")}
      <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.5 }}>When you leave, scan the code at reception again and tap <b>Sign out</b>. If the fire alarm sounds, go straight to the assembly point.</p>
      {error}
      <button type="button" data-testid="signin-signout" style={btn(true, { opacity: busy ? .6 : 1 })} disabled={busy} onClick={() => signOut()}>{busy ? "Signing out…" : "Sign out now"}</button>
      <button type="button" style={{ ...btn(false), marginTop: 10, fontSize: 15, padding: "11px" }} onClick={() => { writeKept(null); setKept(null); setMode("form"); setErr(""); }}>Not {kept.name}? Sign in someone else</button>
    </div>
  );
  else if (mode === "signout") body = (
    <form onSubmit={signOut} data-testid="signin-signout-form">
      <h2 style={{ fontSize: 20, color: NAVY, margin: "4px 0 12px" }}>Signing out</h2>
      <Field id="so-company" label="Your company"><input id="so-company" style={inp} value={f.company} onChange={set("company")} autoComplete="organization" required/></Field>
      <Field id="so-name" label="Your full name"><input id="so-name" style={inp} value={f.name} onChange={set("name")} autoComplete="name" required/></Field>
      {error}
      <button type="submit" style={btn(true, { opacity: busy ? .6 : 1 })} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>
      <button type="button" style={{ ...btn(false), marginTop: 10, fontSize: 15, padding: "11px" }} onClick={() => { setMode("form"); setErr(""); }}>Back to sign in</button>
    </form>
  );
  else body = (
    <form onSubmit={signIn} data-testid="signin-form">
      <button type="button" data-testid="signin-goto-signout" onClick={() => { setMode("signout"); setErr(""); }} style={{ ...btn(false), fontSize: 15, padding: "10px", margin: "14px 0 16px" }}>Leaving site? Sign out here</button>
      <h2 style={{ fontSize: 20, color: NAVY, margin: "4px 0 12px" }}>Your details</h2>
      <Field id="si-company" label="Your company"><input id="si-company" data-testid="si-company" style={inp} value={f.company} onChange={set("company")} autoComplete="organization" maxLength={100} required/></Field>
      <Field id="si-name" label="Your full name"><input id="si-name" data-testid="si-name" style={inp} value={f.name} onChange={set("name")} autoComplete="name" maxLength={80} required/></Field>
      <Field id="si-phone" label="Mobile number" hint="So we can reach you on site, e.g. in an emergency."><input id="si-phone" data-testid="si-phone" type="tel" style={inp} value={f.phone} onChange={set("phone")} autoComplete="tel" maxLength={30} required/></Field>
      <Field id="si-host" label="Who are you here to see?"><input id="si-host" data-testid="si-host" style={inp} value={f.host} onChange={set("host")} maxLength={80} required/></Field>
      <Field id="si-purpose" label="What are you here to do?"><input id="si-purpose" data-testid="si-purpose" style={inp} value={f.purpose} onChange={set("purpose")} maxLength={200} required/></Field>
      <Field id="si-areas" label="Where on site will you work? (optional)"><input id="si-areas" data-testid="si-areas" style={inp} value={f.areas} onChange={set("areas")} maxLength={120}/></Field>
      <fieldset style={{ border: "none", padding: 0, margin: "0 0 14px" }}>
        <legend style={{ fontWeight: 700, fontSize: 15, color: NAVY, marginBottom: 6 }}>Does your work need a permit to work? (hot work, work at height, electrical isolation…)</legend>
        <div style={{ display: "flex", gap: 8 }}>
          {[["yes", "Yes"], ["no", "No"], ["unsure", "Not sure"]].map(([v, l]) => (
            <label key={v} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 4px", borderRadius: 10, border: `2px solid ${f.permit === v ? NAVY : LINE}`, background: f.permit === v ? "#e8ecf7" : "#fff", fontWeight: 700, fontSize: 15, color: NAVY, cursor: "pointer", whiteSpace: "nowrap" }}>
              <input type="radio" name="permit" value={v} checked={f.permit === v} onChange={set("permit")} required style={{ width: 18, height: 18 }}/>{l}
            </label>
          ))}
        </div>
      </fieldset>

      <h2 style={{ fontSize: 20, color: NAVY, margin: "22px 0 8px" }}>Site safety</h2>
      {conf.intro && <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.5, margin: "0 0 12px", whiteSpace: "pre-wrap" }}>{conf.intro}</p>}
      <div data-testid="signin-items">
        {items.map(i => (
          <label key={i.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 12px", marginBottom: 8, borderRadius: 10, border: `2px solid ${ticks[i.id] ? "#15803d" : LINE}`, background: ticks[i.id] ? "#f0fdf4" : "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1.4, color: "#111827" }}>
            <input type="checkbox" checked={!!ticks[i.id]} onChange={e => setTicks(t => ({ ...t, [i.id]: e.target.checked }))} style={{ width: 24, height: 24, flexShrink: 0, marginTop: 1, accentColor: "#15803d" }}/>
            <span>{i.text}</span>
          </label>
        ))}
      </div>
      <Field id="si-sign" label="Sign by typing your full name" hint="By signing you confirm the details above are correct and you'll follow the site rules.">
        <input id="si-sign" data-testid="si-sign" style={{ ...inp, fontStyle: "italic" }} value={f.signature} onChange={set("signature")} maxLength={80} required/>
      </Field>
      {error}
      <button type="submit" data-testid="signin-submit" style={btn(true, { opacity: busy || !allTicked ? .6 : 1 })} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, marginTop: 14 }}>
        {brandCompany(b)} keeps these details to know who is on site, for safety and emergencies. They're seen only by the site's H&amp;S administrators.
      </p>
    </form>
  );

  return (
    <main ref={topRef} style={{ minHeight: "100vh", background: "#f3f5fa", fontFamily: "'Barlow', system-ui, sans-serif", color: "#1f2937", display: "flex", justifyContent: "center", padding: "20px 14px 40px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12 }}>
          {logo ? <img src={logo} alt={brandCompany(b)} style={{ height: 38, maxWidth: 200, objectFit: "contain" }}/> : <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, color: NAVY }}>{brandCompany(b)}</span>}
        </div>
        <section style={card}>
          <h1 style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: NAVY, letterSpacing: .5 }}>Contractor sign-in</h1>
          {conf && conf.ok && conf.site && <div data-testid="signin-site" style={{ color: MUTED, fontWeight: 600, marginTop: 2 }}>{conf.site}</div>}
          {body}
        </section>
      </div>
    </main>
  );
}
