/**
 * ═══════════════════════════════════════════════════════════════════════════
 * app/screens/DseScreen.jsx
 * ═══════════════════════════════════════════════════════════════════════════
 * The DSE self-assessment, full screen (domains/dse/DSEAssessment.jsx).
 *
 * Reads the app's shared state and actions with useApp() (app/AppContext.js). Moved out of
 * App.jsx in October 2026 without changing what it shows.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useApp } from "../AppContext";
import { DSEAssessment } from "../lazyParts";

// Full-screen DSE wizard (domains/dse/DSEAssessment.jsx). Closing it resets the draft answers.
export function DseScreen() {
  const {
    adminResponses, darkMode, dseAnswers, dseComments, dseReports, dseSection, dseSubmitted, font,
    saveDseProgress, setDseActive, setDseAnswers, setDseComments, setDseReports, setDseSection,
    setDseSubmitted, T, user
  } = useApp();
  return <DSEAssessment
    user={user}
    dseAnswers={dseAnswers} setDseAnswers={setDseAnswers}
    dseComments={dseComments} setDseComments={setDseComments}
    dseSection={dseSection} setDseSection={setDseSection}
    dseSubmitted={dseSubmitted} setDseSubmitted={setDseSubmitted}
    dseReports={dseReports} setDseReports={setDseReports}
    adminResponses={adminResponses}
    darkMode={darkMode}
    onClose={()=>{ setDseActive(false); setDseAnswers({}); setDseComments({}); setDseSection(0); setDseSubmitted(false); }}
    onSaveProgress={saveDseProgress}
    Z={T} font={font}
  />;
}
