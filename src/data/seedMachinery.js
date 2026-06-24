import { getExpiryStatus } from "../lib/dates";

function isWarehouseWorker(user) {
  if (!user) return false;
  return user.isWarehouseWorker === true;
}

const MACHINERY_TYPES = [
  { id:"flt",      icon:"🏗",  label:"Counterbalance FLT",       category:"Forklift", licenceRequired:true,  renewalMonths:36, notes:"RTITB/ITSSAR licence required. Medical fitness check advised." },
  { id:"reach",    icon:"📦",  label:"Reach Truck",              category:"Forklift", licenceRequired:true,  renewalMonths:36, notes:"Separate licence from counterbalance. Aisle width and height restrictions apply." },
  { id:"hlp",      icon:"🔼",  label:"High Level Order Picker",  category:"Forklift", licenceRequired:true,  renewalMonths:36, notes:"Working at height competence required. Harness use mandatory above 2m." },
  { id:"vna",      icon:"🔀",  label:"VNA Truck",                category:"Forklift", licenceRequired:true,  renewalMonths:36, notes:"Wire-guided or rail-guided. Site-specific training required." },
  { id:"pump",     icon:"🛒",  label:"Pump Truck (Manual)",      category:"Handling", licenceRequired:false, renewalMonths:0,  notes:"Informal competency assessment. Safe working load must not be exceeded." },
  { id:"epump",    icon:"🔋",  label:"Electric Pallet Truck",    category:"Handling", licenceRequired:false, renewalMonths:24, notes:"Pedestrian-controlled or ride-on. Battery safety and charging awareness required." },
  { id:"baler",    icon:"📦",  label:"Baler / Compactor",        category:"Machinery",licenceRequired:false, renewalMonths:24, notes:"Lockout/tagout awareness. No manual insertion of material while running." },
  { id:"wrapper",  icon:"🌀",  label:"Pallet Wrapper",           category:"Machinery",licenceRequired:false, renewalMonths:0,  notes:"Trip hazard from film. Correct wrapping tension to prevent load shift." },
  { id:"conveyor", icon:"➡",   label:"Conveyor Systems",         category:"Machinery",licenceRequired:false, renewalMonths:24, notes:"Entrapment risks. Emergency stop locations must be known before operation." },
  { id:"docklevy", icon:"🚪",  label:"Dock Leveller",            category:"Handling", licenceRequired:false, renewalMonths:24, notes:"Bridging plate load limits. Vehicle restraint use where fitted." },
  { id:"tractor",  icon:"🚜",  label:"Yard Tractor",             category:"Handling", licenceRequired:true,  renewalMonths:36, notes:"Site yard tractor. Not licensed for road use unless otherwise specified." },
  { id:"scissor",  icon:"🪜",  label:"Scissor / Boom Lift (MEWP)",category:"Machinery",licenceRequired:true,  renewalMonths:36, notes:"IPAF PA1/PA3A or equivalent required. Working at height rules apply." },

];

const MACHINE_CATEGORIES = [...new Set(MACHINERY_TYPES.map(m=>m.category))];

const COMP_STATUS = {
  competent:   { label:"Competent",         color:"#10b981", bg:"rgba(16,185,129,0.12)", icon:"✅" },
  provisional: { label:"Provisional",        color:"#f59e0b", bg:"rgba(245,158,11,0.12)", icon:"⏳" },
  expired:     { label:"Renewal Required",   color:"#ef4444", bg:"rgba(239,68,68,0.12)",  icon:"⚠" },
  not_assessed:{ label:"Not Assessed",       color:"#64748b", bg:"rgba(100,116,139,0.12)",icon:"—"  },
};

function machineExpiryStatus(comp, types) {
  const list = types || MACHINERY_TYPES;
  const m = list.find(x=>x.id===comp.machineId);
  if (!m || !m.renewalMonths || !comp.assessmentDate) return null;
  return getExpiryStatus(comp.assessmentDate, m.renewalMonths);
}

// Seed data — competence records for warehouse staff
const INIT_MACHINE_COMPS = {
  2: [  // James Okafor — Warehouse Operative
    { id:"mc201", machineId:"flt",     status:"competent",   trainerName:"Mark Davies",    trainerQual:"RTITB Instructor",  theoryDate:"2023-02-10", assessmentDate:"2023-02-14", observationDates:["2023-03-01","2023-06-15","2024-02-20"], licenceRef:"RTITB-2023-JO01", licenceExpiry:"2026-02-14", notes:"Passed first assessment. Excellent spatial awareness.", fileNames:[] },
    { id:"mc202", machineId:"reach",   status:"competent",   trainerName:"Mark Davies",    trainerQual:"RTITB Instructor",  theoryDate:"2023-04-05", assessmentDate:"2023-04-09", observationDates:["2023-05-10","2024-01-12"],               licenceRef:"RTITB-2023-JO02", licenceExpiry:"2026-04-09", notes:"",                                             fileNames:[] },
    { id:"mc203", machineId:"pump",    status:"competent",   trainerName:"Mark Davies",    trainerQual:"Warehouse Manager", theoryDate:"2022-09-01", assessmentDate:"2022-09-01", observationDates:["2023-01-10"],                            licenceRef:"",                licenceExpiry:"",           notes:"Manual pump truck. Informal assessment.",         fileNames:[] },
    { id:"mc204", machineId:"epump",   status:"competent",   trainerName:"Mark Davies",    trainerQual:"Warehouse Manager", theoryDate:"2023-02-14", assessmentDate:"2023-02-14", observationDates:["2023-07-20"],                            licenceRef:"",                licenceExpiry:"2025-02-14", notes:"",                                             fileNames:[] },
    { id:"mc205", machineId:"wrapper", status:"competent",   trainerName:"Mark Davies",    trainerQual:"Warehouse Manager", theoryDate:"2022-09-01", assessmentDate:"2022-09-01", observationDates:[],                                       licenceRef:"",                licenceExpiry:"",           notes:"",                                             fileNames:[] },
  ],
  5: [  // Tom Bradley — Warehouse Operative
    { id:"mc501", machineId:"flt",     status:"competent",   trainerName:"Mark Davies",    trainerQual:"RTITB Instructor",  theoryDate:"2022-06-12", assessmentDate:"2022-06-16", observationDates:["2022-09-01","2023-04-14","2024-06-01"], licenceRef:"RTITB-2022-TB01", licenceExpiry:"2025-06-16", notes:"Long-standing operator. Consistent safe operation.", fileNames:[] },
    { id:"mc502", machineId:"reach",   status:"expired",     trainerName:"Mark Davies",    trainerQual:"RTITB Instructor",  theoryDate:"2022-06-17", assessmentDate:"2022-06-20", observationDates:["2022-10-05"],                            licenceRef:"RTITB-2022-TB02", licenceExpiry:"2025-06-20", notes:"Renewal overdue — arrange refresher.",            fileNames:[] },
    { id:"mc503", machineId:"pump",    status:"competent",   trainerName:"Mark Davies",    trainerQual:"Warehouse Manager", theoryDate:"2021-03-01", assessmentDate:"2021-03-01", observationDates:[],                                       licenceRef:"",                licenceExpiry:"",           notes:"",                                             fileNames:[] },
    { id:"mc504", machineId:"baler",   status:"competent",   trainerName:"Daniel Okonkwo", trainerQual:"Maintenance Tech",  theoryDate:"2023-09-10", assessmentDate:"2023-09-12", observationDates:["2024-01-08"],                            licenceRef:"",                licenceExpiry:"2025-09-12", notes:"LOTO briefing completed. Observed clearing jam correctly.", fileNames:[] },
    { id:"mc505", machineId:"docklevy",status:"competent",   trainerName:"Mark Davies",    trainerQual:"Warehouse Manager", theoryDate:"2022-06-16", assessmentDate:"2022-06-16", observationDates:["2023-02-20"],                            licenceRef:"",                licenceExpiry:"2024-06-16", notes:"",                                             fileNames:[] },
  ],
  7: [  // Connor Walsh — Logistics Driver
    { id:"mc701", machineId:"flt",     status:"competent",   trainerName:"External RTITB", trainerQual:"RTITB Instructor",  theoryDate:"2021-11-08", assessmentDate:"2021-11-12", observationDates:["2022-05-01","2023-06-10"],               licenceRef:"RTITB-2021-CW01", licenceExpiry:"2024-11-12", notes:"Licence expired — renewal required urgently.",   fileNames:[] },
    { id:"mc702", machineId:"tractor", status:"competent",   trainerName:"Mark Davies",    trainerQual:"Warehouse Manager", theoryDate:"2022-03-14", assessmentDate:"2022-03-16", observationDates:["2022-08-22","2023-08-14"],               licenceRef:"ZEUS-YD-2022-01", licenceExpiry:"2025-03-16", notes:"Site yard tractor only. Not licensed for road use.", fileNames:[] },
    { id:"mc703", machineId:"epump",   status:"competent",   trainerName:"Mark Davies",    trainerQual:"Warehouse Manager", theoryDate:"2022-03-14", assessmentDate:"2022-03-14", observationDates:[],                                       licenceRef:"",                licenceExpiry:"2024-03-14", notes:"",                                             fileNames:[] },
  ],
  6: [  // Aisha Patel — Production Technician
    { id:"mc601", machineId:"conveyor",status:"competent",   trainerName:"Daniel Okonkwo", trainerQual:"Maintenance Tech",  theoryDate:"2023-01-10", assessmentDate:"2023-01-12", observationDates:["2023-06-01","2024-01-15"],               licenceRef:"",                licenceExpiry:"2026-01-12", notes:"E-stop locations tested. Induction on all sections.", fileNames:[] },
    { id:"mc602", machineId:"baler",   status:"provisional", trainerName:"Daniel Okonkwo", trainerQual:"Maintenance Tech",  theoryDate:"2025-03-20", assessmentDate:"",           observationDates:[],                                       licenceRef:"",                licenceExpiry:"",           notes:"Theory complete. Practical assessment pending.", fileNames:[] },
    { id:"mc603", machineId:"wrapper", status:"competent",   trainerName:"Liam Harrison",  trainerQual:"Shift Supervisor",  theoryDate:"2023-01-12", assessmentDate:"2023-01-12", observationDates:[],                                       licenceRef:"",                licenceExpiry:"",           notes:"",                                             fileNames:[] },
  ],
  9: [  // Daniel Okonkwo — Maintenance Technician
    { id:"mc901", machineId:"scissor", status:"competent",   trainerName:"External IPAF",  trainerQual:"IPAF Instructor",   theoryDate:"2023-05-08", assessmentDate:"2023-05-09", observationDates:["2023-09-12","2024-04-03"],               licenceRef:"IPAF-2023-DO01", licenceExpiry:"2026-05-09", notes:"PA1/PA3A. Boom and scissor platforms.",           fileNames:[] },
    { id:"mc902", machineId:"flt",     status:"competent",   trainerName:"External RTITB", trainerQual:"RTITB Instructor",  theoryDate:"2022-08-15", assessmentDate:"2022-08-18", observationDates:["2023-03-10"],                            licenceRef:"RTITB-2022-DO01", licenceExpiry:"2025-08-18", notes:"Counter-balance. Used for maintenance access only.", fileNames:[] },
    { id:"mc903", machineId:"conveyor",status:"competent",   trainerName:"Daniel Okonkwo", trainerQual:"Maintenance Tech",  theoryDate:"2022-01-10", assessmentDate:"2022-01-10", observationDates:["2023-01-10","2024-01-10"],               licenceRef:"",               licenceExpiry:"",           notes:"In-house competency. LOTO trained.",              fileNames:[] },
  ],
  11: [ // Liam Harrison — Shift Supervisor
    { id:"mc1101", machineId:"flt",     status:"competent",  trainerName:"External RTITB", trainerQual:"RTITB Instructor",  theoryDate:"2020-09-14", assessmentDate:"2020-09-17", observationDates:["2021-03-01","2022-09-01","2023-09-01"], licenceRef:"RTITB-2020-LH01", licenceExpiry:"2023-09-17", notes:"Expired — supervisor role, not regular operator. Reassess if to resume operation.", fileNames:[] },
    { id:"mc1102", machineId:"pump",    status:"competent",  trainerName:"Mark Davies",    trainerQual:"Warehouse Manager", theoryDate:"2020-09-17", assessmentDate:"2020-09-17", observationDates:[],                                       licenceRef:"",               licenceExpiry:"",           notes:"",                                             fileNames:[] },
    { id:"mc1103", machineId:"baler",   status:"competent",  trainerName:"Daniel Okonkwo", trainerQual:"Maintenance Tech",  theoryDate:"2021-11-01", assessmentDate:"2021-11-03", observationDates:["2022-11-03","2023-11-03"],               licenceRef:"",               licenceExpiry:"2023-11-03", notes:"Annual observation sign-off completed.",          fileNames:[] },
  ],
  13: [ // Ryan Fitzgerald — Warehouse Operative
    { id:"mc1301", machineId:"pump",    status:"competent",  trainerName:"Mark Davies",    trainerQual:"Warehouse Manager", theoryDate:"2024-01-15", assessmentDate:"2024-01-15", observationDates:[],                                       licenceRef:"",               licenceExpiry:"",           notes:"New starter assessment. Manual pump only.",      fileNames:[] },
    { id:"mc1302", machineId:"flt",     status:"provisional",trainerName:"Mark Davies",    trainerQual:"RTITB Instructor",  theoryDate:"2025-01-20", assessmentDate:"",           observationDates:[],                                       licenceRef:"",               licenceExpiry:"",           notes:"Theory passed. Awaiting practical assessment date.", fileNames:[] },
    { id:"mc1303", machineId:"wrapper", status:"competent",  trainerName:"Mark Davies",    trainerQual:"Warehouse Manager", theoryDate:"2024-01-15", assessmentDate:"2024-01-15", observationDates:[],                                       licenceRef:"",               licenceExpiry:"",           notes:"",                                             fileNames:[] },
  ],
};

// ─── Machinery Competence Tab (Staff) ─────────────────────────────────────────

export { isWarehouseWorker, MACHINERY_TYPES, MACHINE_CATEGORIES, COMP_STATUS, machineExpiryStatus, INIT_MACHINE_COMPS };