import React, { useEffect, useState } from "react";
import { E } from "../../lib/emoji";
import { buildBackup, lastBackupAt, BACKUP_TABLES } from "../../lib/backup";
import { downloadBlob } from "../../lib/xlsxWriter";
import { auditEvent } from "../../lib/audit";

/**
 * BackupPanel — top of Documents ▼ → Audit Trail (admins). Downloads a full
 * backup of the portal's records (lib/backup.js) and shows when the last one
 * was taken. The notification bell reminds admins after 30 days (App.jsx).
 */
export const BACKUP_DUE_DAYS = 30;
const daysSince = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
const fmt = iso => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function BackupPanel({ user, onBackedUp, Z, font }) {
  const [last, setLast] = useState(undefined);       // undefined = loading, null = never
  const [busy, setBusy] = useState(null);            // { done, total, table }
  const [result, setResult] = useState(null);
  useEffect(() => { let live = true; lastBackupAt().then(at => { if (live) setLast(at); }); return () => { live = false; }; }, []);

  async function run() {
    setResult(null); setBusy({ done: 0, total: BACKUP_TABLES.length, table: "" });
    try {
      const r = await buildBackup({ by: user ? user.name : "", onProgress: (done, total, table) => setBusy({ done, total, table }) });
      const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
      downloadBlob(r.blob, `zeus-protect-backup-${stamp}.zip`);
      const failed = Object.keys(r.errors);
      await auditEvent("backup", "all", "download", `Downloaded a full backup: ${r.total} records${failed.length ? ` (${failed.length} table${failed.length !== 1 ? "s" : ""} not read)` : ""}`, {}, "Full backup");
      const now = new Date().toISOString();
      setLast(now); setResult(r); if (onBackedUp) onBackedUp(now);
    } catch (e) {
      setResult({ fatal: String(e && e.message || e) });
    }
    setBusy(null);
  }

  const due = last === null || (last && daysSince(last) >= BACKUP_DUE_DAYS);
  return (
    <div data-testid="backup-panel" style={{ background: `linear-gradient(135deg,${Z.navyMd},${Z.navy})`, border: `1px solid ${due ? "rgba(245,158,11,0.45)" : Z.border}`, borderRadius: 16, padding: "16px 20px", marginBottom: 22, fontFamily: font }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: Z.white }}>{E("💾 ", "")}Full backup</div>
          <div style={{ fontSize: 12.5, color: Z.muted, marginTop: 3, lineHeight: 1.5 }}>
            Downloads every record in the portal (staff, training, documents, incidents, registers and this audit trail) as one .zip file. Keep it somewhere safe and private. Uploaded files aren't included.
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, fontWeight: 700, color: due ? (Z.amber || "#f59e0b") : Z.green }}>
            {last === undefined ? "Checking when the last backup was taken…" : last === null ? "No backup has been downloaded yet." : `Last backup: ${fmt(last)} (${daysSince(last) === 0 ? "today" : `${daysSince(last)} day${daysSince(last) !== 1 ? "s" : ""} ago`})${due ? " — one is due." : ""}`}
          </div>
        </div>
        <button onClick={run} disabled={!!busy}
          style={{ background: `linear-gradient(135deg,${Z.accent},${Z.blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "11px 20px", fontWeight: 800, fontSize: 13, cursor: busy ? "default" : "pointer", fontFamily: font, opacity: busy ? .7 : 1 }}>
          {busy ? `Reading ${busy.done}/${busy.total}…` : `${E("⬇ ", "")}Download full backup`}
        </button>
      </div>
      {result && !result.fatal && (
        <div role="status" style={{ marginTop: 12, fontSize: 12.5, color: Z.muted }}>
          <b style={{ color: Z.green }}>✓ Backup downloaded: {result.total} records.</b>
          {Object.keys(result.errors).length > 0 && <span style={{ color: Z.amber || "#f59e0b" }}> Not read: {Object.keys(result.errors).join(", ")}. Check the Contents sheet in the file.</span>}
        </div>
      )}
      {result && result.fatal && <div role="alert" style={{ marginTop: 12, fontSize: 12.5, color: Z.red || "#f87171", fontWeight: 700 }}>The backup failed: {result.fatal}</div>}
    </div>
  );
}

export { BackupPanel };
