/**
 * data/seedInspections.js — inspection types, their checklists, and demo inspections.
 * INSP_TYPES / INSP_SECTIONS are REFERENCE DATA: INSP_SECTIONS[typeId] = [{ id, label,
 *   questions:[{ id, text }] }]. Answers are stored by section id + question id, so keep
 *   ids stable; add new questions with new ids. Used by desktop AND mobile inspections.
 * (The demo inspections moved to demo/seedInspections.js — test scripts only.) Was: e
 * (e.g. a brand-new install). Once real rows exist, edits here have NO effect.
 */
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

export { INSP_TYPES, INSP_SECTIONS };
