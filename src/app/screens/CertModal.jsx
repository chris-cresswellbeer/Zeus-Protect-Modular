/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/screens/CertModal.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * The certificate window (domains/training/CertificateModal.jsx), shown whenever `cert` is set:
 * in the staff portal and in the module player.
 *
 * Reads the app's shared state and actions with useApp() (app/AppContext.js). Moved out of
 * App.jsx in October 2026 without changing what it shows.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useApp } from "../AppContext";
import { CertificateModal } from "../lazyParts";

export function CertModal() {
  const {
    cert, font, setCert, T, user
  } = useApp();
  return cert ? <CertificateModal cert={cert} user={user} onClose={() => setCert(null)} T={T} font={font}/> : null;
}
