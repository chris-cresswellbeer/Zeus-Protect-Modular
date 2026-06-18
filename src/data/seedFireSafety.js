const INIT_FIRE_WARDENS = [
  { id:"fw001", staffId:3,  name:"Sarah Mitchell",    zone:"Office Block A",          qualDate:"2023-09-12", renewalMonths:36 },
  { id:"fw002", staffId:7,  name:"Daniel Okonkwo",    zone:"Warehouse & Loading Dock", qualDate:"2022-11-05", renewalMonths:36 },
  { id:"fw003", staffId:11, name:"Connor Walsh",      zone:"Packaging Hall",           qualDate:"2024-02-20", renewalMonths:36 },
  { id:"fw004", staffId:14, name:"Linda Osei",        zone:"Canteen & Welfare Areas",  qualDate:"2023-06-01", renewalMonths:36 },
];

const INIT_FIRE_DRILLS = [
  { id:"fd001", date:"2024-03-14", time:"10:30", zone:"Full Site",       evacuTime:"4:12", headcountOk:true,  conductedBy:"Linda Osei",     issues:"North fire door stiff — reported to facilities. All staff accounted for in 4:12.",  weather:"Dry" },
  { id:"fd002", date:"2024-09-18", time:"14:15", zone:"Full Site",       evacuTime:"3:58", headcountOk:true,  conductedBy:"Linda Osei",     issues:"Visitor not briefed on assembly point — update visitor induction. Evacuation time improved vs March drill.", weather:"Dry" },
  { id:"fd003", date:"2025-03-06", time:"09:45", zone:"Full Site",       evacuTime:"4:45", headcountOk:false, conductedBy:"Sarah Mitchell", issues:"Two warehouse staff unaccounted for initially — found in cold store (door muffled alarm). Cold store to be added to sweep route.", weather:"Wet" },
  { id:"fd004", date:"2025-10-09", time:"11:00", zone:"Full Site",       evacuTime:"4:03", headcountOk:true,  conductedBy:"Linda Osei",     issues:"No issues. Cold store door check incorporated into sweep — effective.", weather:"Dry" },
];

const INIT_ALARM_TESTS = [
  { id:"at001", date:"2026-06-02", callPoint:"MCP-01 — Main Entrance",       testedBy:"Daniel Okonkwo", result:"pass", notes:"" },
  { id:"at002", date:"2026-05-26", callPoint:"MCP-02 — Warehouse East",      testedBy:"Daniel Okonkwo", result:"pass", notes:"" },
  { id:"at003", date:"2026-05-19", callPoint:"MCP-03 — Loading Dock",        testedBy:"Daniel Okonkwo", result:"pass", notes:"" },
  { id:"at004", date:"2026-05-12", callPoint:"MCP-04 — Packaging Hall",      testedBy:"Connor Walsh",   result:"pass", notes:"" },
  { id:"at005", date:"2026-05-05", callPoint:"MCP-05 — Office Block A",      testedBy:"Daniel Okonkwo", result:"pass", notes:"" },
  { id:"at006", date:"2026-04-28", callPoint:"MCP-06 — Canteen",             testedBy:"Daniel Okonkwo", result:"fault", notes:"Panel showed fault on MCP-06 — engineer called. Repaired 30/04/2026." },
  { id:"at007", date:"2026-04-21", callPoint:"MCP-07 — Cold Store",          testedBy:"Connor Walsh",   result:"pass", notes:"" },
  { id:"at008", date:"2026-04-14", callPoint:"MCP-08 — Maintenance Workshop",testedBy:"Daniel Okonkwo", result:"pass", notes:"" },
];

const INIT_EXTINGUISHERS = [
  { id:"ex001", location:"Main Entrance — Lobby",         type:"CO2",        serialNo:"CO2-001", lastService:"2025-11-10", nextServiceDue:"2026-11-10", lastVisualDate:"2026-06-02", visualOk:true,  notes:"" },
  { id:"ex002", location:"Office Block A — Corridor",     type:"CO2",        serialNo:"CO2-002", lastService:"2025-11-10", nextServiceDue:"2026-11-10", lastVisualDate:"2026-06-02", visualOk:true,  notes:"" },
  { id:"ex003", location:"Warehouse — Bay 1",             type:"Powder",     serialNo:"PD-001",  lastService:"2025-11-10", nextServiceDue:"2026-11-10", lastVisualDate:"2026-06-02", visualOk:true,  notes:"" },
  { id:"ex004", location:"Warehouse — Bay 2",             type:"Powder",     serialNo:"PD-002",  lastService:"2025-11-10", nextServiceDue:"2026-11-10", lastVisualDate:"2026-05-19", visualOk:true,  notes:"" },
  { id:"ex005", location:"Loading Dock",                  type:"Powder",     serialNo:"PD-003",  lastService:"2025-11-10", nextServiceDue:"2026-11-10", lastVisualDate:"2026-06-02", visualOk:true,  notes:"" },
  { id:"ex006", location:"Packaging Hall — East Wall",    type:"Water",      serialNo:"WA-001",  lastService:"2025-11-10", nextServiceDue:"2026-11-10", lastVisualDate:"2026-06-02", visualOk:true,  notes:"" },
  { id:"ex007", location:"Packaging Hall — West Wall",    type:"Water",      serialNo:"WA-002",  lastService:"2025-11-10", nextServiceDue:"2026-11-10", lastVisualDate:"2026-05-05", visualOk:false, notes:"Safety pin missing — replaced 06/05/2026." },
  { id:"ex008", location:"Canteen",                       type:"Wet Chemical",serialNo:"WC-001", lastService:"2025-11-10", nextServiceDue:"2026-11-10", lastVisualDate:"2026-06-02", visualOk:true,  notes:"" },
  { id:"ex009", location:"Maintenance Workshop",          type:"CO2",        serialNo:"CO2-003", lastService:"2025-11-10", nextServiceDue:"2026-11-10", lastVisualDate:"2026-06-02", visualOk:true,  notes:"" },
  { id:"ex010", location:"Server Room",                   type:"CO2",        serialNo:"CO2-004", lastService:"2025-11-10", nextServiceDue:"2026-11-10", lastVisualDate:"2026-06-02", visualOk:true,  notes:"" },
];

const INIT_EMERG_LIGHTING = [
  { id:"el001", date:"2026-05-01", testType:"monthly",  zone:"Main Entrance & Lobby",    testedBy:"Daniel Okonkwo", result:"pass", notes:"" },
  { id:"el002", date:"2026-05-01", testType:"monthly",  zone:"Office Block A",           testedBy:"Daniel Okonkwo", result:"pass", notes:"" },
  { id:"el003", date:"2026-05-01", testType:"monthly",  zone:"Warehouse",                testedBy:"Daniel Okonkwo", result:"pass", notes:"Luminaire WH-04 slow to illuminate — flagged for annual test." },
  { id:"el004", date:"2026-05-01", testType:"monthly",  zone:"Packaging Hall",           testedBy:"Connor Walsh",   result:"pass", notes:"" },
  { id:"el005", date:"2026-05-01", testType:"monthly",  zone:"Canteen & Welfare",        testedBy:"Connor Walsh",   result:"pass", notes:"" },
  { id:"el006", date:"2025-11-15", testType:"annual",   zone:"Full Site — All Luminaires",testedBy:"Contracted Engineer (Elec-Safe Ltd)", result:"pass", notes:"3-hour discharge test completed. All luminaires passed. Certificate issued." },
];

const INIT_FRA_REVIEWS = [
  { id:"fr001", date:"2024-01-15", reviewedBy:"Linda Osei",    trigger:"Annual review",                    changes:"Updated evacuation routes following office reconfiguration. Cold store sweep added to warden checklist.", nextReviewDue:"2025-01-15" },
  { id:"fr002", date:"2024-10-02", reviewedBy:"Linda Osei",    trigger:"Post-incident (near miss — cold store, 06/09/2024)", changes:"Cold store alarm audibility assessed. Additional sounder installed. Warden sweep route updated.", nextReviewDue:"2025-10-02" },
  { id:"fr003", date:"2025-01-20", reviewedBy:"Linda Osei",    trigger:"Annual review",                    changes:"Hot work controls reviewed — Permit to Work system implemented. Maintenance workshop extraction upgrade noted.", nextReviewDue:"2026-01-20" },
  { id:"fr004", date:"2025-10-10", reviewedBy:"Linda Osei",    trigger:"Annual review",                    changes:"No significant changes. Extinguisher locations reviewed — additional CO2 added to server room.", nextReviewDue:"2026-10-10" },
];

export { INIT_FIRE_WARDENS, INIT_FIRE_DRILLS, INIT_ALARM_TESTS, INIT_EXTINGUISHERS, INIT_EMERG_LIGHTING, INIT_FRA_REVIEWS };
