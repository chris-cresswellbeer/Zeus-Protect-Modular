const INSP_TYPES = [
  { id:"annual_hs",             label:"Annual H&S Audit",                    icon:"📋", color:"#6366f1", bg:"rgba(99,102,241,0.12)",  maxScore:100, freq:"12 months" },
  { id:"fire_risk",             label:"Fire Risk Assessment",                icon:"🔥", color:"#ef4444", bg:"rgba(239,68,68,0.12)",   maxScore:100, freq:"12 months" },
  { id:"weekly_walk",           label:"Weekly Walk Around",                  icon:"🚶", color:"#10b981", bg:"rgba(16,185,129,0.12)",  maxScore:50,  freq:"7 days"    },
  { id:"fire_drill",            label:"Fire Drill",                          icon:"🔔", color:"#f59e0b", bg:"rgba(245,158,11,0.12)",  maxScore:30,  freq:"6 months"  },
  { id:"office_housekeeping",   label:"Office Housekeeping Inspection",      icon:"🏢", color:"#06b6d4", bg:"rgba(6,182,212,0.12)",   maxScore:30,  freq:"7 days"    },
  { id:"warehouse_housekeeping",label:"Warehouse Housekeeping Inspection",   icon:"🏭", color:"#a78bfa", bg:"rgba(167,139,250,0.12)", maxScore:30,  freq:"7 days"    },
];

const INSP_SECTIONS = {
  annual_hs: [
    { id:"s1", label:"Fire Safety & Emergency Procedures", questions:[
      { id:"q1_1", text:"Are fire exits clear and unobstructed?" },
      { id:"q1_2", text:"Are fire extinguishers in date and correctly positioned?" },
      { id:"q1_3", text:"Are fire evacuation plans displayed prominently?" },
      { id:"q1_4", text:"Has a fire drill been conducted in the last 6 months?" },
    ]},
    { id:"s2", label:"Manual Handling & Ergonomics", questions:[
      { id:"q2_1", text:"Are manual handling risk assessments in place for key tasks?" },
      { id:"q2_2", text:"Are mechanical aids available and in good condition?" },
      { id:"q2_3", text:"Is DSE equipment set up ergonomically for regular users?" },
    ]},
    { id:"s3", label:"Chemical & COSHH", questions:[
      { id:"q3_1", text:"Are COSHH assessments in place for all chemicals in use?" },
      { id:"q3_2", text:"Is chemical storage segregated correctly?" },
      { id:"q3_3", text:"Are SDS (Safety Data Sheets) available and up to date?" },
    ]},
    { id:"s4", label:"PPE & Welfare", questions:[
      { id:"q4_1", text:"Is adequate PPE available and in good condition?" },
      { id:"q4_2", text:"Are welfare facilities (toilets, rest area, drinking water) adequate?" },
      { id:"q4_3", text:"Is first aid provision adequate and first aiders trained?" },
    ]},
    { id:"s5", label:"Housekeeping & General Safety", questions:[
      { id:"q5_1", text:"Are walkways and aisles clear of obstructions?" },
      { id:"q5_2", text:"Is the workplace generally tidy and well maintained?" },
      { id:"q5_3", text:"Are electrical installations and equipment in safe condition?" },
      { id:"q5_4", text:"Are accident/near miss reporting procedures understood by staff?" },
    ]},
  ],
  fire_risk: [
    { id:"s1", label:"Ignition Sources", questions:[
      { id:"q1_1", text:"Are ignition sources (heaters, electrical equipment) properly managed?" },
      { id:"q1_2", text:"Is hot work controlled by permit?" },
      { id:"q1_3", text:"Are smoking areas clearly designated and controlled?" },
    ]},
    { id:"s2", label:"Fuel & Combustibles", questions:[
      { id:"q2_1", text:"Is flammable material storage minimised and correctly located?" },
      { id:"q2_2", text:"Is waste and combustible material removed regularly?" },
      { id:"q2_3", text:"Are electrical cables free from damage and not overloaded?" },
    ]},
    { id:"s3", label:"Detection & Warning", questions:[
      { id:"q3_1", text:"Are fire detectors/alarm systems tested and fully operational?" },
      { id:"q3_2", text:"Are manual call points clearly marked and accessible?" },
    ]},
    { id:"s4", label:"Means of Escape", questions:[
      { id:"q4_1", text:"Are all fire exits clearly signed and unobstructed?" },
      { id:"q4_2", text:"Are emergency lighting systems functional?" },
      { id:"q4_3", text:"Are escape routes free from combustible materials?" },
    ]},
    { id:"s5", label:"Fire Fighting", questions:[
      { id:"q5_1", text:"Are fire extinguishers correctly positioned and in date?" },
      { id:"q5_2", text:"Are hose reels in good working condition?" },
      { id:"q5_3", text:"Are sprinkler/suppression systems (if applicable) tested and operational?" },
    ]},
  ],
  weekly_walk: [
    { id:"s1", label:"Housekeeping", questions:[
      { id:"q1_1", text:"Walkways and aisles clear of obstructions?" },
      { id:"q1_2", text:"Spills cleaned up promptly?" },
      { id:"q1_3", text:"Waste bins not overflowing?" },
    ]},
    { id:"s2", label:"Fire Safety", questions:[
      { id:"q2_1", text:"Fire exits clear and not propped open?" },
      { id:"q2_2", text:"Fire extinguishers present and undamaged?" },
    ]},
    { id:"s3", label:"Equipment & Machinery", questions:[
      { id:"q3_1", text:"No obvious damage to machinery or guards?" },
      { id:"q3_2", text:"PPE available and correctly stored?" },
    ]},
    { id:"s4", label:"General Safety", questions:[
      { id:"q4_1", text:"No unsafe acts or conditions observed?" },
      { id:"q4_2", text:"Any new hazards identified since last walkround?" },
    ]},
  ],
  fire_drill: [
    { id:"s1", label:"Evacuation", questions:[
      { id:"q1_1", text:"Alarm heard throughout premises?" },
      { id:"q1_2", text:"All staff evacuated within target time?" },
      { id:"q1_3", text:"All fire exits used correctly?" },
    ]},
    { id:"s2", label:"Assembly Point", questions:[
      { id:"q2_1", text:"Assembly point used correctly by all staff?" },
      { id:"q2_2", text:"Roll call completed accurately?" },
    ]},
    { id:"s3", label:"Fire Wardens", questions:[
      { id:"q3_1", text:"Fire wardens carried out sweep checks?" },
      { id:"q3_2", text:"Fire wardens identifiable during evacuation?" },
    ]},
  ],
  dse_review: [],
  office_housekeeping: [
    { id:"s1", label:"Desks & Workstations", questions:[
      { id:"q1_1", text:"Desks clear of unnecessary clutter and personal items not obstructing workspace?" },
      { id:"q1_2", text:"Cables managed and not trailing across walkways or posing trip hazard?" },
      { id:"q1_3", text:"Computer equipment, monitors and peripherals free from dust build-up?" },
    ]},
    { id:"s2", label:"Common Areas & Meeting Rooms", questions:[
      { id:"q2_1", text:"Meeting rooms cleared and reset after use — furniture, whiteboards, waste?" },
      { id:"q2_2", text:"Kitchen/break room clean — surfaces wiped, crockery washed, bins emptied?" },
      { id:"q2_3", text:"Printers, copiers and shared equipment areas tidy and stocked?" },
    ]},
    { id:"s3", label:"Storage & Filing", questions:[
      { id:"q3_1", text:"Filing cabinets and storage cupboards closed and not overloaded?" },
      { id:"q3_2", text:"Confidential waste (paper) disposed of in correct locked bins?" },
      { id:"q3_3", text:"No items stored on top of cabinets above head height?" },
    ]},
    { id:"s4", label:"Welfare Facilities", questions:[
      { id:"q4_1", text:"Toilets and washrooms clean, soap/paper towels stocked, hand dryers functional?" },
      { id:"q4_2", text:"Drinking water available and fresh?" },
    ]},
    { id:"s5", label:"Walkways & Emergency Access", questions:[
      { id:"q5_1", text:"Office walkways and corridors clear — no boxes, bags or furniture blocking routes?" },
      { id:"q5_2", text:"Fire exits and emergency routes unobstructed and clearly signed?" },
    ]},
  ],
  warehouse_housekeeping: [
    { id:"s1", label:"Floor & Walkways", questions:[
      { id:"q1_1", text:"All pedestrian walkways, aisles and crossing points clear of obstructions?" },
      { id:"q1_2", text:"Floor surfaces clean, dry and free from spills, debris or slip hazards?" },
      { id:"q1_3", text:"Floor markings (bay lines, pedestrian lanes) visible and undamaged?" },
    ]},
    { id:"s2", label:"Waste & Refuse", questions:[
      { id:"q2_1", text:"Waste bins not overflowing — emptied and bag-lined?" },
      { id:"q2_2", text:"Cardboard, shrink wrap and packaging broken down and moved to baler/compound?" },
      { id:"q2_3", text:"Hazardous waste (COSHH, batteries, oils) segregated in designated containers?" },
    ]},
    { id:"s3", label:"Racking & Storage", questions:[
      { id:"q3_1", text:"Pallets and stock within racking bays — not protruding into aisles?" },
      { id:"q3_2", text:"No unauthorised floor storage outside designated floor-storage zones?" },
      { id:"q3_3", text:"Racking beams and uprights free from visible damage — no dents or deflection?" },
    ]},
    { id:"s4", label:"Loading Bay & Despatch", questions:[
      { id:"q4_1", text:"Loading bay apron and dock levellers clear of debris and trip hazards?" },
      { id:"q4_2", text:"Trailer wheel chocks and banksman equipment available and correctly stored?" },
    ]},
    { id:"s5", label:"Equipment & Chemicals", questions:[
      { id:"q5_1", text:"FLTs, pump trucks and MHE parked in designated areas and plugged in to charge?" },
      { id:"q5_2", text:"Cleaning chemicals stored in chemical store — no decanted containers left out?" },
    ]},
  ],
};

const INIT_SITE_INSPECTIONS = [
  {
    id:"si001", type:"annual_hs", date:"2024-03-15", inspector:"Linda Osei", location:"Zeus HQ — Full Site",
    status:"closed", overallScore:30, maxScore:34,
    sections:{ s1:{q1_1:2,q1_2:2,q1_3:2,q1_4:1}, s2:{q2_1:2,q2_2:2,q2_3:1}, s3:{q3_1:2,q3_2:1,q3_3:2}, s4:{q4_1:2,q4_2:2,q4_3:2}, s5:{q5_1:2,q5_2:2,q5_3:2,q5_4:1} },
    nonConformances:[
      { id:"nc001", section:"Fire Safety & Emergency Procedures", finding:"Fire drill not completed in last 6 months — last drill was 8 months ago", severity:"major", photos:[], actionOwner:"Mark Davies", actionDue:"2024-04-12", actionStatus:"complete", actionNote:"Fire drill completed 9 April 2024. All staff evacuated in 3m 42s." },
      { id:"nc002", section:"Manual Handling & Ergonomics", finding:"3 DSE workstations not ergonomically assessed — Finance department", severity:"minor", photos:[], actionOwner:"Linda Osei", actionDue:"2024-04-19", actionStatus:"complete", actionNote:"DSE assessments completed for all Finance staff." },
      { id:"nc003", section:"Chemical & COSHH", finding:"Chemical segregation plan not posted inside Chemical Store", severity:"minor", photos:[], actionOwner:"Linda Osei", actionDue:"2024-03-29", actionStatus:"complete", actionNote:"Laminated segregation plan posted." },
      { id:"nc004", section:"Housekeeping & General Safety", finding:"Accident reporting procedure not understood by 2 new starters in warehouse", severity:"minor", photos:[], actionOwner:"Mark Davies", actionDue:"2024-04-05", actionStatus:"complete", actionNote:"Toolbox talk delivered. New starter induction updated." },
    ],
    summary:"Generally good standard of H&S management across site. Key actions required around fire drill frequency and DSE assessment programme. Chemical segregation to be addressed immediately.",
    nextDue:"2025-03-15",
  },
  {
    id:"si002", type:"fire_risk", date:"2024-06-20", inspector:"Linda Osei", location:"Zeus HQ — Full Site",
    status:"closed", overallScore:26, maxScore:28,
    sections:{ s1:{q1_1:2,q1_2:2,q1_3:2}, s2:{q2_1:2,q2_2:2,q2_3:1}, s3:{q3_1:2,q3_2:2}, s4:{q4_1:2,q4_2:1,q4_3:2}, s5:{q5_1:2,q5_2:2,q5_3:2} },
    nonConformances:[
      { id:"nc005", section:"Fuel & Combustibles", finding:"One damaged cable run identified in Electrical Workshop — potential overheating risk", severity:"major", photos:[], actionOwner:"Daniel Okonkwo", actionDue:"2024-07-04", actionStatus:"complete", actionNote:"Cable replaced and insulation tested. Signed off by electrical contractor." },
      { id:"nc006", section:"Means of Escape", finding:"Emergency lighting unit in Stairwell B not functioning — bulb failure", severity:"minor", photos:[], actionOwner:"Daniel Okonkwo", actionDue:"2024-06-28", actionStatus:"complete", actionNote:"Bulb replaced and unit tested. Recorded in maintenance log." },
    ],
    summary:"Fire risk assessment demonstrates good compliance overall. Damaged cable in Electrical Workshop requires urgent remediation. Emergency lighting programme to be reviewed.",
    nextDue:"2025-06-20",
  },
  {
    id:"si003", type:"weekly_walk", date:"2025-01-06", inspector:"Sarah Mitchell", location:"Warehouse & Loading Bay",
    status:"closed", overallScore:16, maxScore:18,
    sections:{ s1:{q1_1:2,q1_2:2,q1_3:2}, s2:{q2_1:2,q2_2:2}, s3:{q3_1:2,q3_2:2}, s4:{q4_1:1,q4_2:1} },
    nonConformances:[
      { id:"nc007", section:"General Safety", finding:"New potential slip hazard identified — dock entrance mat edge buckled", severity:"minor", photos:[], actionOwner:"Daniel Okonkwo", actionDue:"2025-01-13", actionStatus:"complete", actionNote:"Mat replaced with freeze-rated anti-slip matting." },
      { id:"nc008", section:"General Safety", finding:"Racking climb observed — Ryan Fitzgerald. Verbal warning issued", severity:"major", photos:[], actionOwner:"Mark Davies", actionDue:"2025-01-10", actionStatus:"complete", actionNote:"Written warning issued. Step ladder brackets ordered." },
    ],
    summary:"Generally satisfactory walkround. Two items for action — dock mat and racking climb observed.",
    nextDue:"2025-01-13",
  },
  {
    id:"si004", type:"weekly_walk", date:"2025-01-13", inspector:"Sarah Mitchell", location:"Warehouse & Loading Bay",
    status:"closed", overallScore:17, maxScore:18,
    sections:{ s1:{q1_1:2,q1_2:2,q1_3:2}, s2:{q2_1:2,q2_2:2}, s3:{q3_1:2,q3_2:2}, s4:{q4_1:2,q4_2:1} },
    nonConformances:[
      { id:"nc009", section:"General Safety", finding:"Platform truck found unattended on Loading Bay slope without brake applied", severity:"minor", photos:[], actionOwner:"Mark Davies", actionDue:"2025-01-20", actionStatus:"complete", actionNote:"Toolbox talk delivered. 'Apply Brake' stickers ordered." },
    ],
    summary:"Improvement on previous week. Dock mat replaced satisfactorily. Platform truck braking issue noted.",
    nextDue:"2025-01-20",
  },
  {
    id:"si005", type:"fire_drill", date:"2025-04-09", inspector:"Linda Osei", location:"Zeus HQ — Full Site",
    status:"closed", overallScore:12, maxScore:14,
    sections:{ s1:{q1_1:2,q1_2:2,q1_3:2}, s2:{q2_1:2,q2_2:1}, s3:{q3_1:2,q3_2:1} },
    nonConformances:[
      { id:"nc010", section:"Assembly Point", finding:"Roll call took 4m 20s — target is 3m. Two staff not identified quickly", severity:"minor", photos:[], actionOwner:"Mark Davies", actionDue:"2025-04-23", actionStatus:"complete", actionNote:"Roll call procedure updated. Fire wardens briefed on name-check protocol." },
      { id:"nc011", section:"Fire Wardens", finding:"One fire warden not visibly identifiable during evacuation — no hi-vis bib worn", severity:"minor", photos:[], actionOwner:"Linda Osei", actionDue:"2025-04-16", actionStatus:"complete", actionNote:"Hi-vis bibs issued to all fire wardens." },
    ],
    summary:"Evacuation completed in 3m 58s — within acceptable range but above 3m target. Roll call procedure needs tightening. Hi-vis identification for wardens to be resolved.",
    nextDue:"2025-10-09",
  },
  {
    id:"si006", type:"annual_hs", date:"2025-03-18", inspector:"Linda Osei", location:"Zeus HQ — Full Site",
    status:"closed", overallScore:32, maxScore:34,
    sections:{ s1:{q1_1:2,q1_2:2,q1_3:2,q1_4:2}, s2:{q2_1:2,q2_2:2,q2_3:2}, s3:{q3_1:2,q3_2:1,q3_3:2}, s4:{q4_1:2,q4_2:2,q4_3:2}, s5:{q5_1:2,q5_2:2,q5_3:2,q5_4:1} },
    nonConformances:[
      { id:"nc012", section:"Chemical & COSHH", finding:"Two new chemicals introduced without COSHH assessment — identified in Chemical Store", severity:"major", photos:[], actionOwner:"Linda Osei", actionDue:"2025-04-04", actionStatus:"complete", actionNote:"COSHH assessments completed. New product introduction procedure updated." },
      { id:"nc013", section:"Housekeeping & General Safety", finding:"Two new warehouse starters unclear on near miss reporting procedure", severity:"minor", photos:[], actionOwner:"Mark Davies", dueDate:"2025-04-04", actionStatus:"complete", actionNote:"Near miss reporting included in updated warehouse induction." },
    ],
    summary:"Significant improvement on 2024 audit — score up 6 points. COSHH management remains a focus area. Reporting culture continues to develop well.",
    nextDue:"2026-03-18",
  },
  {
    id:"si007", type:"fire_risk", date:"2025-06-25", inspector:"Linda Osei", location:"Zeus HQ — Full Site",
    status:"open", overallScore:27, maxScore:28,
    sections:{ s1:{q1_1:2,q1_2:2,q1_3:2}, s2:{q2_1:2,q2_2:2,q2_3:2}, s3:{q3_1:2,q3_2:2}, s4:{q4_1:2,q4_2:2,q4_3:2}, s5:{q5_1:2,q5_2:2,q5_3:1} },
    nonConformances:[
      { id:"nc014", section:"Fire Fighting", finding:"Sprinkler supply isolation valve not protected — accessible to unauthorised persons", severity:"major", photos:[], actionOwner:"Daniel Okonkwo", actionDue:"2025-07-09", actionStatus:"complete", actionNote:"Locked valve guard fitted. Key held by H&S Manager." },
    ],
    summary:"Best fire risk assessment score to date. Single major finding around sprinkler valve access — addressed quickly. Maintenance of this standard required going forward.",
    nextDue:"2026-06-25",
  },
  {
    id:"si008", type:"weekly_walk", date:"2025-05-05", inspector:"Sarah Mitchell", location:"Production Floor & Packing Hall",
    status:"closed", overallScore:16, maxScore:18,
    sections:{ s1:{q1_1:2,q1_2:2,q1_3:2}, s2:{q2_1:2,q2_2:2}, s3:{q3_1:1,q3_2:2}, s4:{q4_1:1,q4_2:2} },
    nonConformances:[
      { id:"nc015", section:"Equipment & Machinery", finding:"Damaged machine guard observed on Packaging Line 2 — edge sharp and potentially laceration risk", severity:"major", photos:[], actionOwner:"Daniel Okonkwo", actionDue:"2025-05-09", actionStatus:"complete", actionNote:"Machine taken out of service. Guard replaced." },
      { id:"nc016", section:"General Safety", finding:"Angle grinder in use without face shield — PPE station depleted", severity:"major", photos:[], actionOwner:"Sarah Mitchell", actionDue:"2025-05-09", actionStatus:"complete", actionNote:"Stop-task instruction issued. PPE station restocked. Minimum stock levels set." },
    ],
    summary:"Two significant safety observations on Production Floor. Machine guard and PPE station issues both require immediate action.",
    nextDue:"2025-05-12",
  },
  {
    id:"si009", type:"weekly_walk", date:"2026-05-05", inspector:"Sarah Mitchell", location:"Full Site",
    status:"open", overallScore:17, maxScore:18,
    sections:{ s1:{q1_1:2,q1_2:2,q1_3:2}, s2:{q2_1:2,q2_2:2}, s3:{q3_1:2,q3_2:2}, s4:{q4_1:2,q4_2:1} },
    nonConformances:[
      { id:"nc017", section:"General Safety", finding:"Loading bay handrail loose — mounting bracket corroded. Access restricted to single person with adjacent rail used", severity:"major", photos:[], actionOwner:"Daniel Okonkwo", actionDue:"2026-05-16", actionStatus:"open", actionNote:"" },
    ],
    summary:"Good general standard. Loading bay handrail corrosion issue requires urgent attention — marine-grade replacement to be fitted.",
    nextDue:"2026-05-12",
  },
  {
    id:"si010", type:"office_housekeeping", date:"2026-05-05", inspector:"Sarah Mitchell", location:"Office Block — All Floors",
    status:"closed", overallScore:22, maxScore:26,
    sections:{ s1:{q1_1:2,q1_2:2,q1_3:2}, s2:{q2_1:2,q2_2:1,q2_3:2}, s3:{q3_1:2,q3_2:2,q3_3:2}, s4:{q4_1:2,q4_2:1}, s5:{q5_1:2,q5_2:2} },
    nonConformances:[
      { id:"nc018", section:"Common Areas & Meeting Rooms", finding:"Kitchen surfaces on 2nd floor not wiped down — food debris and used crockery left overnight", severity:"minor", photos:[], actionOwner:"Sarah Mitchell", actionDue:"2026-05-06", actionStatus:"complete", actionNote:"Kitchen cleaned and daily cleaning schedule reissued to all office staff." },
      { id:"nc019", section:"Welfare Facilities", finding:"Paper towels depleted in ground floor toilets — dispenser empty", severity:"minor", photos:[], actionOwner:"Sarah Mitchell", actionDue:"2026-05-05", actionStatus:"complete", actionNote:"Restocked immediately. Facilities checklist updated to include dispenser check." },
    ],
    summary:"Generally good office standard. Kitchen discipline on 2nd floor needs reinforcing. Welfare consumable checks to be included in daily facilities sweep.",
    nextDue:"2026-05-12",
  },
  {
    id:"si011", type:"warehouse_housekeeping", date:"2026-05-12", inspector:"Sarah Mitchell", location:"Warehouse, Goods-In & Loading Bay",
    status:"open", overallScore:24, maxScore:26,
    sections:{ s1:{q1_1:2,q1_2:2,q1_3:2}, s2:{q2_1:2,q2_2:2,q2_3:2}, s3:{q3_1:2,q3_2:2,q3_3:1}, s4:{q4_1:2,q4_2:2}, s5:{q5_1:2,q5_2:1} },
    nonConformances:[
      { id:"nc020", section:"Racking & Storage", finding:"Two pallets in Racking Row D positioned outside bay markings — protruding into forklift aisle", severity:"major", photos:[], actionOwner:"Mark Davies", actionDue:"2026-05-13", actionStatus:"open", actionNote:"" },
    ],
    summary:"Good warehouse standard overall. Racking bay discipline in Row D requires same-day action — forklift aisle clearance is safety critical.",
    nextDue:"2026-05-19",
  },
];


export { INSP_TYPES, INSP_SECTIONS, INIT_SITE_INSPECTIONS };
