const DSE_SECTIONS = [
  {
    id:"chair", title:"Chair & Seating", icon:"🪑",
    questions:[
      { id:"chair_height",   text:"Can you adjust your chair height so your feet are flat on the floor (or a footrest) with thighs roughly horizontal?", risk:"Incorrect seat height causes lower back strain and poor posture." },
      { id:"chair_back",     text:"Does your chair backrest provide adequate lumbar (lower back) support and can you adjust it?", risk:"Inadequate lumbar support is a leading cause of lower back pain during prolonged sitting." },
      { id:"chair_stable",   text:"Is your chair stable — does it have a 5-star base and move freely on its castors?", risk:"Unstable or non-mobile chairs increase fall risk and encourage awkward postures." },
      { id:"chair_arms",     text:"If your chair has armrests, can they be adjusted so your arms rest comfortably without raising your shoulders?", risk:"Fixed or incorrect armrests cause shoulder and neck tension." },
      { id:"chair_comfort",  text:"Can you sit comfortably with your back against the backrest without the edge of the seat pressing into the back of your knees?", risk:"Seat depth issues restrict circulation and increase lower limb discomfort." },
    ]
  },
  {
    id:"screen", title:"Screen & Display", icon:"🖥️",
    questions:[
      { id:"screen_height",  text:"Is the top of your screen at or slightly below eye level when you are sitting in your normal working position?", risk:"Screen too high or low causes neck flexion or extension leading to neck and shoulder pain." },
      { id:"screen_dist",    text:"Is your screen approximately an arm's length away (roughly 50–70cm)?", risk:"Screen too close causes eyestrain and headaches; too far causes squinting and neck strain." },
      { id:"screen_tilt",    text:"Can you tilt and swivel your screen to reduce glare and reflections?", risk:"Glare and reflections cause eye fatigue and encourage poor head postures." },
      { id:"screen_clean",   text:"Is your screen clean and free from flicker, with adequate brightness and contrast?", risk:"Dirty or flickering screens significantly increase visual fatigue and headaches." },
      { id:"screen_glare",   text:"Are there sources of glare (windows, overhead lights) that cause reflections on your screen that cannot be controlled?", risk:"Uncontrolled glare is a primary cause of DSE-related eye strain." },
    ]
  },
  {
    id:"keyboard", title:"Keyboard & Mouse", icon:"⌨️",
    questions:[
      { id:"kb_position",    text:"Is your keyboard positioned so that your forearms are roughly horizontal and wrists are straight when typing?", risk:"Raised wrists or bent arms during typing cause carpal tunnel syndrome and repetitive strain injury." },
      { id:"kb_space",       text:"Is there sufficient space in front of the keyboard to rest your wrists and hands when not typing?", risk:"No wrist rest space increases sustained muscle tension in forearms and hands." },
      { id:"kb_clean",       text:"Is your keyboard clean and are all keys legible and functioning correctly?", risk:"Stiff or dirty keys increase force required and repetitive strain risk." },
      { id:"mouse_pos",      text:"Is your mouse positioned close to the keyboard so you do not have to reach or stretch to use it?", risk:"Reaching for a mouse causes shoulder abduction and upper limb strain." },
      { id:"mouse_comfort",  text:"Can you use the mouse comfortably without excessive gripping, pinching, or wrist deviation?", risk:"Poor mouse grip and wrist deviation are significant risk factors for RSI and tendinitis." },
    ]
  },
  {
    id:"desk", title:"Desk & Workspace", icon:"🗃️",
    questions:[
      { id:"desk_space",     text:"Is there sufficient space on your desk to place documents and equipment without cluttering your work area?", risk:"A cluttered workspace forces awkward reaches and postures, increasing musculoskeletal strain." },
      { id:"desk_height",    text:"Is the desk at the correct height — approximately elbow height when seated in your working position?", risk:"Incorrect desk height forces compensatory postures affecting shoulders, neck, and back." },
      { id:"doc_holder",     text:"If you regularly work from paper documents, do you have a document holder positioned close to the screen?", risk:"Repeated head turning between documents and screen causes neck strain." },
      { id:"desk_lighting",  text:"Is the lighting at your workstation adequate for the tasks you perform, without causing glare on your screen?", risk:"Inadequate or incorrectly positioned lighting causes eyestrain and poor posture." },
      { id:"desk_cables",    text:"Are all cables and wires safely managed and not causing a trip hazard around your workstation?", risk:"Unsecured cables present a significant trip and fall risk." },
    ]
  },
  {
    id:"environment", title:"Working Environment", icon:"🌡️",
    questions:[
      { id:"env_temp",       text:"Is the temperature at your workstation comfortable for the type of work you do (generally 16–24°C for office work)?", risk:"Excessively hot or cold environments reduce concentration and increase musculoskeletal discomfort." },
      { id:"env_noise",      text:"Is the noise level in your working area at an acceptable level that allows you to concentrate without strain?", risk:"High noise levels cause stress, fatigue, and reduce ability to concentrate on tasks." },
      { id:"env_space",      text:"Do you have sufficient space around your workstation to change posture and move freely?", risk:"Restricted space forces sustained static postures — a major risk factor for MSDs." },
      { id:"env_ventilation",text:"Is ventilation adequate — is the air fresh without being draughty, and is the humidity comfortable (not excessively dry)?", risk:"Poor ventilation and low humidity cause dry eyes, throat irritation, and fatigue." },
      { id:"env_emergency",  text:"Do you know your fire evacuation procedure and is your workstation located so that escape routes are accessible?", risk:"Unclear evacuation procedures are a life safety risk." },
    ]
  },
  {
    id:"software", title:"Software & Work Organisation", icon:"💻",
    questions:[
      { id:"sw_suitable",    text:"Is the software you use suitable for the tasks you perform and easy to use without excessive complexity or error?", risk:"Poorly designed software increases cognitive load, frustration, and fatigue." },
      { id:"sw_pace",        text:"Are you able to control the pace and sequence of your own work, with adequate time to complete tasks without feeling rushed?", risk:"Work pressure and lack of control are key psychosocial risk factors for stress-related ill health." },
      { id:"sw_breaks",      text:"Do you take regular breaks from screen work — ideally a 5–10 minute break or change of activity every hour?", risk:"Sustained DSE use without breaks is directly linked to eyestrain, headaches, and upper limb disorders." },
      { id:"sw_training",    text:"Have you received adequate training on all the software and systems you are required to use?", risk:"Inadequate training leads to inefficient working postures and increased cognitive stress." },
      { id:"sw_feedback",    text:"Are you able to report problems with your equipment or software easily and do you receive a timely response?", risk:"Unresolved equipment problems lead to sustained compensatory postures and worsening conditions." },
    ]
  },
  {
    id:"health", title:"Personal Health & Symptoms", icon:"🏥",
    questions:[
      { id:"h_eyes",         flagOnYes:true,  text:"Do you experience eye strain, blurred vision, headaches, or tired eyes during or after DSE work?", risk:"Reported visual symptoms require a DSE eye test under the DSE Regulations 1992 — your employer must provide this." },
      { id:"h_back",         flagOnYes:true,  text:"Do you experience back pain (upper, mid, or lower) that you believe is related to your DSE work?", risk:"Work-related back pain requires immediate workstation re-assessment and referral to occupational health." },
      { id:"h_arms",         flagOnYes:true,  text:"Do you experience pain, aching, tingling, or numbness in your neck, shoulders, arms, wrists, or hands?", risk:"Upper limb symptoms may indicate early-stage RSI or carpal tunnel syndrome — early referral is critical." },
      { id:"h_stress",       flagOnYes:true,  text:"Do you feel that your DSE work causes you stress, anxiety, or mental fatigue on a regular basis?", risk:"Chronic work-related stress is a reportable occupational health condition and requires management review." },
      { id:"h_glasses",      flagOnYes:false, text:"If you wear glasses or contact lenses for DSE work, are your corrective lenses current and prescribed for the correct screen distance?", risk:"Incorrect prescription lenses for DSE work cause compensatory neck postures and increased eyestrain." },
    ]
  },
];


export { DSE_SECTIONS };
