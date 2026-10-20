/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/data/useLoadAll.js — useLoadAll(app)
 * ═══════════════════════════════════════════════════════════════════════════
 * Loading: loadAll() reads every table once the person has signed in (login() calls it through
 * loadAllRef, because the database only answers once it knows who is asking). Also turns each
 * risk assessment into a document for the Documents library.
 *
 * ADDING A NEW TABLE: add the query to the Promise.allSettled batch, a variable in the same
 * position in the destructuring list, the error log, then convert rows → state.
 *
 * Part of the app's shared state (src/app/README.md). Moved out of App.jsx in October 2026
 * without changing what it does.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useEffect } from "react";
import { mapBundleRows } from "../../domains/documents/bundles";
import { generateRAHtml } from "../../domains/riskAssessments/generateRAHtml";
import { mapDueRows } from "../../lib/dueDates";
import { mapTranslationRows } from "../../lib/moduleTranslate";
import { loadSiteLists } from "../../lib/siteLists";
import { sb } from "../../lib/supabase";
import { TRACKED, idsKey, mapAckRows, mapAssignRows, mapCompRows, mapDocAssignRows, mapIncidentRow, sharedTracker } from "../records";

export function useLoadAll(app) {
  const {
    dbReady, fireLoadOkRef, historyIdsRef, historyReadyRef, loadAllRef, ras, setAdminResponses, setAllUsers,
    setAssigns, setCompHistory, setComps, setContractorCerts, setContractorInductions, setContractors,
    setContractorVisits, setCoshhAssessments, setCustomChemicals, setCustomMachineTypes, setCustomModules,
    setDashboardLayouts, setDbReady, setDocAckHistory, setDocAcknowledgements, setDocAssignments,
    setDocBundles, setDocs, setDseReports, setDueDates, setEquipment, setExtCerts, setFireSafety,
    setFirstAidData, setIncidents, setInvestigations, setLastLoginMap, setMachineComps, setModuleTrans,
    setModuleVersions, setMsdsFiles, setPermits, setProfilesTick, setQuizFailures, setRas,
    setSiteInspections
  } = app;
  useEffect(() => {
    async function loadAll() {
      loadSiteLists();          // site-specific lists (Site Settings)
      try {
        // Fire all 35 independent reads concurrently instead of one at a
        // time. None of these queries depends on another's result, so
        // there's no correctness reason to wait for each to finish before
        // starting the next — doing so was adding the sum of every
        // round-trip's latency to every single login. allSettled (not
        // Promise.all) is used deliberately: if one table fails to load
        // (network blip, permissions issue, etc.) the other 34 should
        // still populate rather than the whole load silently aborting.
        // signatures first: what we're about to read counts as "seen" by the refresh (lib/changes.js)
        const pre = await sharedTracker.check(TRACKED.filter(t => t !== "training_completion_history"));
        const [
          aRes, cRes, iRes, invRes, ackRes, daRes, docRes, dseRes, resRes,
          llRes, usersRes, upRes, ecRes, qfRes, conRes, conIndRes,
          conCertRes, conVisitRes, permitRes, raRes, cmRes, mcRes, eqRes,
          siRes, msdsRes, ccRes, fwRes, fdRes, fatRes, fexRes, felRes,
          ffrRes, faRes, cmtRes, dlRes, caRes, dahRes, chRes, mvRes, bdRes, mtRes,
        ] = await Promise.allSettled([
          sb.from("training_assigns").select("*"),
          sb.from("training_completions").select("*"),
          sb.from("incidents").select("*"),
          sb.from("investigations").select("*"),
          sb.from("doc_acknowledgements").select("*"),
          sb.from("doc_assignments").select("*"),
          sb.from("documents").select("*"),
          sb.from("dse_reports").select("*"),
          sb.from("dse_admin_responses").select("*"),
          sb.from("last_logins").select("*"),
          sb.from("users").select("*"),
          sb.from("user_profiles").select("*"),
          sb.from("ext_certs").select("*"),
          sb.from("quiz_failures").select("*"),
          sb.from("contractors").select("*"),
          sb.from("contractor_inductions").select("*"),
          sb.from("contractor_certs").select("*"),
          sb.from("contractor_visits").select("*"),
          sb.from("permits").select("*"),
          sb.from("risk_assessments").select("*"),
          sb.from("custom_modules").select("*"),
          sb.from("machine_completions").select("*"),
          sb.from("equipment").select("*"),
          sb.from("site_inspections").select("*"),
          sb.from("msds_files").select("*"),
          sb.from("custom_chemicals").select("*"),
          sb.from("fire_wardens").select("*"),
          sb.from("fire_drills").select("*"),
          sb.from("fire_alarm_tests").select("*"),
          sb.from("fire_extinguishers").select("*"),
          sb.from("fire_emerg_lighting").select("*"),
          sb.from("fire_fra_reviews").select("*"),
          sb.from("first_aid_register").select("*").eq("id","singleton"),
          sb.from("custom_machine_types").select("*"),
          sb.from("dashboard_layout").select("*"),
          sb.from("coshh_assessments").select("*"),
          // history tables load just AFTER the first screen (loadHistory below) — they grow fastest
          Promise.resolve({ data: null, error: null }),
          Promise.resolve({ data: null, error: null }),
          Promise.resolve({ data: null, error: null }),
          sb.from("doc_bundles").select("*"),
          sb.from("module_translations").select("*"),   // module_translations.sql (none yet = everything in English)
        ]);

        // Small helper: allSettled wraps each result in {status, value} or
        // {status, reason}. Treat a rejected/failed query the same as "no
        // rows" (data: null) rather than letting it throw and abort
        // everything else's processing below.
        const rows = (res) => (res.status === "fulfilled" ? (res.value?.data ?? null) : null);
        const readOk = res => res.status === "fulfilled" && res.value && !res.value.error && Array.isArray(res.value.data);
        Object.entries({ training_assigns: aRes, training_completions: cRes, incidents: iRes, investigations: invRes, doc_acknowledgements: ackRes,
          doc_assignments: daRes, custom_modules: cmRes, equipment: eqRes, site_inspections: siRes, fire_wardens: fwRes, fire_drills: fdRes,
          fire_alarm_tests: fatRes, fire_extinguishers: fexRes, fire_emerg_lighting: felRes, fire_fra_reviews: ffrRes, first_aid_register: faRes,
          custom_machine_types: cmtRes, doc_bundles: bdRes, contractors: conRes }).forEach(([t, r]) => { if (readOk(r)) pre.mark(t); });
        if (usersRes.status === "rejected") console.error("Supabase load error (users):", usersRes.reason);
        [aRes,cRes,iRes,invRes,ackRes,daRes,docRes,dseRes,resRes,llRes,upRes,ecRes,qfRes,conRes,conIndRes,conCertRes,conVisitRes,permitRes,raRes,cmRes,mcRes,eqRes,siRes,msdsRes,ccRes,fwRes,fdRes,fatRes,fexRes,felRes,ffrRes,faRes,cmtRes,dlRes,caRes,dahRes,chRes,mvRes,bdRes]
          .forEach(r => { if (r.status === "rejected") console.error("Supabase load error:", r.reason); });

        // Pattern used below: rows(x) → null/[] means "nothing stored".
        // Training assigns
        const aRows = rows(aRes);
        if (aRows && aRows.length) {
          setAssigns(mapAssignRows(aRows));
          setDueDates(mapDueRows(aRows));
        } else {
          setAssigns({});
        }

        // Training completions
        const cRows = rows(cRes);
        if (cRows && cRows.length) {
          setComps(mapCompRows(cRows));
        }

        // Incidents
        const iRows = rows(iRes);
        if (iRows && iRows.length) {
          setIncidents(iRows.map(mapIncidentRow));
        }

        // Investigations
        const invRows = rows(invRes);
        if (invRows && invRows.length) {
          const map = {};
          invRows.forEach(r => { map[r.incident_id] = r.data; });
          setInvestigations(map);
        }

        // Doc acknowledgements
        const ackRows = rows(ackRes);
        if (ackRows && ackRows.length) {
          setDocAcknowledgements(mapAckRows(ackRows));
        }

        // Doc assignments
        const daRows = rows(daRes);
        if (daRows && daRows.length) {
          setDocAssignments(mapDocAssignRows(daRows));
        }

        // Document bundles (doc_bundles_table.sql — until it has been run this read fails and there are none)
        const bdRows = rows(bdRes);
        if (bdRows) setDocBundles(mapBundleRows(bdRows));

        // Documents (uploaded by admin)
        const docRows = rows(docRes);
        if (docRows && docRows.length) {
          setDocs(prev => {
            const existingIds = new Set(docRows.map(r => r.id));
            const kept = prev.filter(d => !existingIds.has(d.id));
            return [...kept, ...docRows.map(r => ({
              id: r.id, title: r.title, date: r.date, size: r.size,
              type: r.type, ext: r.ext, fileName: r.file_name, fileData: r.file_url || null, fileUrl: r.file_url || null, version: r.version || 1, reviewDate: r.review_date || null,
              description: r.description || null,
              history: Array.isArray(r.history) ? r.history : [],
            }))];
          });
        }

        // DSE reports
        const dseRows = rows(dseRes);
        if (dseRows && dseRows.length) {
          const map = {};
          dseRows.forEach(r => { const duid=String(r.user_id); map[duid] = map[duid] || []; map[duid][r.report_idx] = r.data; });
          setDseReports(map);
        }

        // Admin DSE responses
        const resRows = rows(resRes);
        if (resRows && resRows.length) {
          const map = {};
          resRows.forEach(r => {
            const ar_uid=String(r.user_id); map[ar_uid] = map[ar_uid] || {};
            map[ar_uid][`${r.report_idx}_${r.issue_idx}`] = { comment: r.comment, resolved: r.resolved, ...(r.signed_off_by ? { signedOffBy: r.signed_off_by, signedOffAt: r.signed_off_at } : {}) };
          });
          setAdminResponses(map);
        }

        // Last logins
        const llRows = rows(llRes);
        if (llRows && llRows.length) {
          const map = {};
          llRows.forEach(r => { map[String(r.user_id)] = r.last_login; });
          setLastLoginMap(map);
        }


        // The users table stores the whole user object in a JSON `data` column.
        // Users — the database is the only source (a new site starts with new_site_first_admin.sql)
        const usersRows = rows(usersRes);
        if (usersRows && usersRows.length) {
          setAllUsers(usersRows.map(r => r.data));
        }

        // Stored on `window` (a global) rather than state so login() and dbSaveTheme()
        // can read the latest copy without a re-render. Treat as a private cache.
        // User profiles (theme, emojiMode preferences — separate from user records)
        const upRows = rows(upRes);
        // Store profile rows for theme restoration at login
        window.__userProfiles = Array.isArray(upRows) ? upRows : [];
        setProfilesTick(n => n + 1);   // their language may be in there

        // Training translations (French / Polish / Romanian)
        const mtRows = rows(mtRes);
        if (mtRows) setModuleTrans(mapTranslationRows(mtRows));

        // External certificates
        const ecRows = rows(ecRes);
        if (ecRows && ecRows.length) {
          const map = {};
          ecRows.forEach(r => {
            const ec_uid=String(r.user_id); map[ec_uid] = map[ec_uid] || {};
            map[ec_uid][r.cert_type] = r.data;
          });
          setExtCerts(map);
        }

        // Quiz failures
        const qfRows = rows(qfRes);
        if (qfRows && qfRows.length) {
          setQuizFailures(qfRows.map(r => ({ ...r.data, _rowId: r.id })));   // _rowId: fallback key for "Mark reviewed"
        }

        // Contractors
        const conRows = rows(conRes);
        if (conRows?.length) setContractors(conRows.map(r=>r.data));
        const conIndRows = rows(conIndRes);
        if (conIndRows?.length) { const m={}; conIndRows.forEach(r=>{m[r.contractor_id]=r.data;}); setContractorInductions(m); }
        const conCertRows = rows(conCertRes);
        if (conCertRows?.length) { const m={}; conCertRows.forEach(r=>{m[r.contractor_id]=r.data;}); setContractorCerts(m); }
        const conVisitRows = rows(conVisitRes);
        if (conVisitRows?.length) { const m={}; conVisitRows.forEach(r=>{m[r.contractor_id]=r.data;}); setContractorVisits(m); }

        // Permits
        const permitRows = rows(permitRes);
        if (permitRows?.length) setPermits(permitRows.map(r=>r.data));

        // Same override idea as modules: DB rows are merged ON TOP of seed RAs with the same id.
        // Risk assessments (all from the database)
        const raRows = rows(raRes);
        if (raRows && raRows.length) {
          setRas(prev => {
            // Merge saved data into existing seed RAs
            const merged = prev.map(r => {
              const saved = raRows.find(x => x.id === r.id);
              return saved ? { ...r, ...saved.data } : r;
            });
            // Append any RAs created by admin that aren't in the seed list
            const existingIds = new Set(prev.map(r => r.id));
            const newRas = raRows
              .filter(x => !existingIds.has(x.id) && x.data)
              .map(x => x.data);
            return [...merged, ...newRas];
          });
        }

        // Custom modules
        const cmRows = rows(cmRes);
        if (cmRows && cmRows.length) {
          setCustomModules(cmRows.map(r => r.data));
        }

        // Custom machinery types (admin-added equipment categories)
        const cmtRows = rows(cmtRes);
        if (cmtRows && cmtRows.length) {
          setCustomMachineTypes(cmtRows.map(r => r.data));
        }

        // Dashboard stat-card order (per admin)
        const dlRows = rows(dlRes);
        if (dlRows && dlRows.length) {
          const map = {};
          dlRows.forEach(r => { map[String(r.user_id)] = r.card_order || []; });
          setDashboardLayouts(map);
        }

        // Machine completions
        const mcRows = rows(mcRes);
        if (mcRows && mcRows.length) {
          const map = {};
          mcRows.forEach(r => { const mcuid=String(r.user_id); map[mcuid] = map[mcuid] || {}; map[mcuid][r.machine_id] = { ...(r.data || {}), id: (r.data && r.data.id) || r.machine_id }; });
          setMachineComps(map);
        }

        // Equipment
        const eqRows = rows(eqRes);
        if (eqRows && eqRows.length) {
          setEquipment(eqRows.map(r => r.data));
        }

        // Site inspections
        const siRows = rows(siRes);
        if (siRows && siRows.length) {
          setSiteInspections(siRows.map(r => r.data));
        }

        // MSDS files
        const msdsRows = rows(msdsRes);
        if (msdsRows && msdsRows.length) {
          const map = {};
          msdsRows.forEach(r => { map[r.code] = { fileName: r.file_name, fileData: r.file_url, fileUrl: r.file_url, uploadedAt: r.uploaded_at }; });
          setMsdsFiles(map);
        }

        // Custom chemicals
        // Versioning history: loaded by loadHistory() once the first screen is showing.
        void dahRes; void chRes; void mvRes;

        // COSHH assessments (one per substance code)
        const caRows = rows(caRes);
        if (caRows && caRows.length) {
          const map = {};
          caRows.forEach(r => { if (r && r.code != null) map[String(r.code)] = r.data; });
          setCoshhAssessments(map);
        }

        const ccRows = rows(ccRes);
        if (ccRows && ccRows.length) {
          setCustomChemicals(ccRows.map(r => r.data));
        }

        // Fire Safety
        fireLoadOkRef.current = [fwRes, fdRes, fatRes, fexRes, felRes, ffrRes]
          .every(r => r.status === "fulfilled" && !r.value?.error);
        const fwRows  = rows(fwRes);
        const fdRows  = rows(fdRes);
        const fatRows = rows(fatRes);
        const fexRows = rows(fexRes);
        const felRows = rows(felRes);
        const ffrRows = rows(ffrRes);
        // Only override each sub-array if the DB returned rows for it.
        // If none of the tables have any rows yet (fresh install), keep seed data.
        
        setFireSafety({
          wardens:      fwRows  && fwRows.length  ? fwRows.map(r=>r.data)  : [],
          drills:       fdRows  && fdRows.length  ? fdRows.map(r=>r.data)  : [],
          alarmTests:   fatRows && fatRows.length ? fatRows.map(r=>r.data) : [],
          extinguishers:fexRows && fexRows.length ? fexRows.map(r=>r.data) : [],
          emergLighting:felRows && felRows.length ? felRows.map(r=>r.data) : [],
          fraReviews:   ffrRows && ffrRows.length ? ffrRows.map(r=>r.data) : [],
        });

        // The first aid register is a single JSON document stored in one row with id "singleton".
        // First Aid Register
        const faRow = rows(faRes);
        if (faRow && faRow.length) setFirstAidData(faRow[0].data);
      } catch (e) {
        console.error("Supabase load error:", e);
      } finally {
        setDbReady(true);
        loadHistory();   // not awaited: the portal is usable while this arrives
      }
    }
    // Stage 2: the history tables (every quiz result and every "I've read this", and old
    // module versions). They only grow, aren't needed for the first screen, and on a busy
    // site are the biggest tables. Anything added in this browser meanwhile is kept.
    async function loadHistory() {
      const pre = await sharedTracker.check(["training_completion_history"]);
      const [dah, ch, mv] = await Promise.all([
        sb.from("doc_ack_history").select("*"), sb.from("training_completion_history").select("*"), sb.from("module_versions").select("*"),
      ]);
      const ok = r => r && !r.error && Array.isArray(r.data);
      const keep = (fresh, cur, key) => { const have = new Set(fresh.map(key)); return [...fresh, ...cur.filter(x => !have.has(key(x)))]; };
      if (ok(dah)) setDocAckHistory(cur => keep(dah.data, cur, h => `${h.user_id}|${h.doc_id}|${h.version}|${h.date}`));
      if (ok(ch)) { setCompHistory(cur => keep(ch.data, cur, h => `${h.user_id}|${h.module_id}|${h.date}|${h.score}`)); historyIdsRef.current = idsKey(ch.data); pre.mark("training_completion_history"); }
      if (ok(mv)) setModuleVersions(cur => keep(mv.data, cur, v => String(v.id)));
      historyReadyRef.current = true;
    }
    // Nothing is read before sign-in: the database only answers once it knows who is
    // asking, so login() calls this with the person's token.
    loadAllRef.current = loadAll;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- defines loadAll once; it only uses setters and refs, which never change

  // Every risk assessment (seed RAs and admin-created ones, as loaded from
  // risk_assessments) is turned into an HTML "document" (base64 data URL) so it
  // appears in the Documents library. These are generated in the browser once the
  // data has loaded and are NOT saved to the documents table — regenerating them
  // from `ras` is what stops a published RA vanishing from Documents on reload.
  // The id "d_<raId>" is stable, so document assignments/acknowledgements match
  // across reloads (RiskAssessmentTab.finalise uses the same id).
  useEffect(() => {
    if (!dbReady) return;
    setDocs(prevDocs => {
      const raDocs = ras.map(ra => {
        const html = generateRAHtml(ra);
        const b64 = "data:text/html;base64," + btoa(unescape(encodeURIComponent(html)));
        return {
          id: "d_" + ra.id,
          title: ra.title || "Untitled Risk Assessment",
          date: ra.date,
          size: Math.round(html.length / 1024) + " KB",
          type: "Risk Assessment",
          fileData: b64,
          fileName: (ra.title || "risk-assessment").toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"") + ".html",
          ext: "HTML",
          raId: ra.id,
        };
      });
      const raIds = new Set(raDocs.map(d => d.raId));
      return [...prevDocs.filter(d => !(d.raId && raIds.has(d.raId))), ...raDocs];
    });
  }, [dbReady]); // eslint-disable-line
}
