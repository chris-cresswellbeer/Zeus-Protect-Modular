/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/data/useMobileWrites.js — useMobileWrites(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * What the phone layout (src/mobile) reads and writes: mobilePermits and mobileDb, which save
 * through the same functions as the desktop portal. A hook (useMemo).
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import React from "react";
import { PERMIT_TYPES } from "../../data/seedPermits";
import { todayISO } from "../../lib/dates";
import { openFile } from "../../lib/fileAccess";
import { markSaved } from "../../lib/keyedSync";
import { PHOTO_BUCKET, uploadPhotos } from "../../lib/photos";
import { dbWrite, sb } from "../../lib/supabase";

export function useMobileWrites(app) {
  const {
    dbAcknowledgeDoc, dbCompleteAction, dbSaveCompletion, dbSaveDseReport, dbSaveIncident,
    dbSaveInvestigation, dbSavePermit, dbSaveTheme, docs, dseReports, incidents, investigations, markWrite,
    permits, regRef, setComps, setDocAcknowledgements, setDseReports, setIncidents, setInvestigations,
    setPermits, setPreviewDoc, setSiteInspections, user
  } = app;

  // ── Mobile permits view model ───────────────────────────────────────────────
  // PermitsTab keeps permits in its own authoring shape; the phone wants the
  // job in front of it, with this user's own sign-on state. Sign-ons live on
  // the permit record as { signOns: { [userId]: { at, date } }, signOffs: {…} }.
  const mobilePermits = React.useMemo(() => (permits || [])
    .filter(p => p.status === "active" || p.status === "closed")
    .map(p => {
      const pt = PERMIT_TYPES.find(t => t.id === p.type);
      const uid = String(user?.id);
      const on = (p.signOns || {})[uid];
      const off = (p.signOffs || {})[uid];
      const hazards = Object.keys(p.hazards || {}).filter(k => p.hazards[k]);
      const precautions = Object.keys(p.precautions || {}).filter(k => p.precautions[k]);
      return {
        id: p.id,
        ref: "PTW-" + String(p.id).replace(/\D/g, "").slice(-4),
        typeId: p.type,
        task: (p.description || (pt ? pt.label : "Permit")).split(/[.\n]/)[0].slice(0, 60),
        location: p.location,
        issuedBy: p.authorisedBy,
        issuedAt: (p.startDateTime || "").slice(11, 16),
        validUntil: (p.endDateTime || "").slice(11, 16),
        signedOnAt: on ? on.at : null,
        signedOffAt: off ? off.at : null,
        closed: p.status === "closed" || !!off,
        // undefined, not [], so the screen falls back to the permit type's list
        hazards: hazards.length ? hazards : undefined,
        precautions: precautions.length ? precautions : undefined,
        ppe: p.ppe || [],
      };
    }), [permits, user]);

  // useMemo recreates this object only when the listed dependencies change, so the
  // closures inside always see current state. If you add a function that reads
  // another piece of state, ADD THAT STATE TO THE DEPENDENCY LIST at the bottom.
  // ── Mobile write surface ────────────────────────────────────────────────────
  // Everything src/mobile is allowed to do to the database, in one object.
  // Real writes go to the existing db* functions; the optimistic* callbacks
  // update local state first so the UI never waits on a network round-trip.
  const mobileDb = React.useMemo(() => ({
    saveCompletion: (userId, moduleId, rec) => dbSaveCompletion(userId, moduleId, rec),
    acknowledgeDoc: (userId, docId, date)   => dbAcknowledgeDoc(userId, docId, date),
    saveIncident:   (rec)                   => dbSaveIncident(rec),
    saveTheme:      (userId, key)           => dbSaveTheme(userId, key),
    completeAction: (incidentId, actionId)  => dbCompleteAction(incidentId, actionId, user?.name),

    // dbSaveDseReport takes the whole array for a user, so append then save.
    saveDseReport: (userId, report) => {
      const next = [ ...(dseReports[userId] || []), report ];
      return dbSaveDseReport(userId, next);
    },

    optimisticCompletion: (userId, r) => setComps(p => ({
      ...p,
      [userId]: { ...(p[userId] || {}), [r.moduleId]: { score: r.score, date: r.date, certId: r.certId } },
    })),
    optimisticDocAck: (userId, docId, date) => (markWrite(`k:${userId}:${docId}`), setDocAcknowledgements(p => ({
      ...p,
      [userId]: { ...(p[userId] || {}), [docId]: { date, version: (docs.find(d => String(d.id) === String(docId)) || {}).version || 1 } },
    }))),
    optimisticIncident: (rec) => setIncidents(p => [rec, ...p]),
    optimisticDseReport: (userId, report) => setDseReports(p => ({
      ...p,
      [userId]: [ ...(p[userId] || []), report ],
    })),

    // Phone "Read": pictures, web pages and text show in the preview window (rendered
    // with MobileApp below). PDFs and Office files open in their own tab, where the
    // phone's viewer can show them — most phones can't display a PDF inside a page.
    previewDoc: (d) => {
      const ext = String((d.fileName ? d.fileName.split(".").pop() : d.ext) || "").toUpperCase();
      const inPage = ["PNG","JPG","JPEG","GIF","WEBP","SVG","HTML","TXT","CSV","MD"].includes(ext);
      if (!d.fileData || inPage) { setPreviewDoc({ ...d, ext }); return; }
      if (!openFile(d.fileData)) setPreviewDoc({ ...d, ext });   // tab blocked → show the preview window instead
    },
    resolveIncident: (id) => {
      setIncidents(p => p.map(i => i.id === id ? { ...i, closed: true, triaged: true } : i));
      const inc = incidents.find(i => i.id === id);
      if (inc) dbSaveIncident({ ...inc, closed: true, triaged: true });
    },

    // ── Inspections, permits, RIDDOR (mobile-only writes) ───────────────────
    // The record is saved here, directly, and the result returned (false = not saved), so the
    // phone's offline queue keeps it and tries again. It also goes into state (deduped by id,
    // because the queue may replay a write already applied), marked as saved so the
    // [siteInspections] effect doesn't write it a second time.
    saveInspection: async (record) => {
      // site_inspections stores the whole record as jsonb, so the photos have
      // to become URLs before the record goes into state.
      const ncs = await Promise.all((record.nonConformances || []).map(async (nc, i) => ({
        ...nc,
        photos: await uploadPhotos(PHOTO_BUCKET, `insp_${record.id}_${i}`, nc.photos),
      })));
      // evidence photos on checklist questions too ({ sectionId: { questionId: [photo] } })
      const qPhotos = {};
      for (const [sid, qs] of Object.entries(record.photos || {})) {
        for (const [qid, list] of Object.entries(qs || {})) (qPhotos[sid] = qPhotos[sid] || {})[qid] = await uploadPhotos(PHOTO_BUCKET, `inspq_${record.id}_${sid}_${qid}`, list);
      }
      const next = { ...record, nonConformances: ncs, ...(record.photos ? { photos: qPhotos } : {}) };
      const ok = await dbWrite(sb.from("site_inspections").upsert({ id: next.id, data: next }, { onConflict: "id" }), "site inspection");
      if (ok) markSaved(regRef.current.inspections, next);
      setSiteInspections(p => [next, ...p.filter(r => r.id !== next.id)]);
      return ok;
    },

    savePermitSignOn: (entry) => {
      const p = permits.find(x => x.id === entry.permitId);
      if (!p) return;
      const next = {
        ...p,
        signOns: { ...(p.signOns || {}), [String(entry.userId)]: { at: entry.signedOnAt, date: entry.date } },
      };
      setPermits(list => list.map(x => x.id === next.id ? next : x));
      return dbSavePermit(next);
    },

    savePermitSignOff: (entry) => {
      const p = permits.find(x => x.id === entry.permitId);
      if (!p) return;
      const next = {
        ...p,
        signOffs: { ...(p.signOffs || {}), [String(entry.userId)]: { at: entry.signedOffAt } },
      };
      setPermits(list => list.map(x => x.id === next.id ? next : x));
      return dbSavePermit(next);
    },

    markRiddorReported: (incidentId) => {
      const inc = incidents.find(i => i.id === incidentId);
      if (!inc) return;
      const next = {
        ...inc,
        riddorReported: true,
        riddorReportedDate: todayISO(),
        riddorReportedBy: user?.name || "",
      };
      setIncidents(list => list.map(i => i.id === next.id ? next : i));
      return dbSaveIncident(next);
    },

    // The chase button on the incident record — no notification service yet, so
    // this just flags the action as chased on its investigation.
    chaseAction: (a) => {
      const inv = investigations[a.investigationId];
      if (!inv) return;
      const next = {
        ...inv,
        actions: (inv.actions || []).map(x => x.id === a.id
          ? { ...x, chasedOn: todayISO(), chasedBy: user?.name || "" }
          : x),
      };
      setInvestigations(p => ({ ...p, [a.investigationId]: next }));
      return dbSaveInvestigation(a.investigationId, next);
    },
  }), [dseReports, incidents, permits, investigations, user]); // eslint-disable-line react-hooks/exhaustive-deps -- as before the move: rebuilt when these change

  return {
    mobilePermits, mobileDb
  };
}
