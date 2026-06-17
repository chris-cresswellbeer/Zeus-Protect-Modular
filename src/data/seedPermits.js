const PERMIT_TYPES = [
  { id:"hot_works",    label:"Hot Works",            icon:"🔥", color:"#ef4444",
    hazards:["Fire risk from sparks","Flammable materials nearby","Gas/fume ignition risk","Oxygen enrichment"],
    precautions:["Fire extinguisher on standby","Fire watch during and 60 mins after","Remove/protect flammable materials","Gas test completed","Area barricaded"] },
  { id:"confined_space", label:"Confined Space",     icon:"⚠️", color:"#f97316",
    hazards:["Oxygen deficiency","Toxic atmosphere","Engulfment risk","Restricted rescue access"],
    precautions:["Atmospheric gas test","Continuous monitoring","Rescue plan in place","Non-entry rescue equipment ready","Attendant stationed outside"] },
  { id:"height",       label:"Working at Height",    icon:"🏗", color:"#f59e0b",
    hazards:["Fall from height","Falling objects","Fragile surfaces","Unstable platform"],
    precautions:["Edge protection installed","Harness and lanyard","Hard hat zone below","Exclusion zone established","Equipment secured"] },
  { id:"electrical",   label:"Electrical Isolation", icon:"⚡", color:"#a78bfa",
    hazards:["Electric shock","Arc flash","Stored energy release","Unexpected re-energisation"],
    precautions:["LOTO applied","Isolation verified","Discharge stored energy","Warning notices posted","Competent person only"] },
  { id:"excavation",   label:"Excavation",           icon:"🚜", color:"#78716c",
    hazards:["Collapse of sides","Underground services","Flooding","Traffic/plant proximity"],
    precautions:["Services located/marked","Shoring installed","Barrier around excavation","Pumping equipment available","Banksman appointed"] },
  { id:"general",      label:"General Permit",       icon:"📋", color:"#64748b",
    hazards:["Slips, trips and falls","Manual handling","Dust/fume exposure","Noise exposure"],
    precautions:["Risk assessment reviewed","PPE available and worn","Area made safe","Supervisor notified"] },
];

const PPE_OPTIONS = ["Hard hat","Hi-vis vest","Safety boots","Gloves","Safety glasses","Respirator/FFP3","Ear defenders","Full face shield","Chemical suit","Harness"];

export { PERMIT_TYPES, PPE_OPTIONS };
