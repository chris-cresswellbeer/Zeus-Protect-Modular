const INIT_INVESTIGATIONS = {
  i2401: {
    investigator:"Linda Osei", investigationDate:"2024-01-11", status:"closed",
    summary:"Forklift operator reversed in Warehouse Bay 2 without checking nearside mirror. A pedestrian was crossing behind the vehicle and narrowly avoided contact. The driver was unaware the pedestrian was present. The incident occurred during a shift changeover when foot traffic in the bay was higher than normal.",
    rootCause:"Inadequate segregation of pedestrian and vehicle routes in Warehouse Bay 2. No physical barrier or clearly marked crossing point. The driver had not conducted a pre-operation mirror check as required by the site traffic management plan.",
    contributingFactors:"Shift changeover resulted in increased pedestrian activity in the bay. Bay 2 reversing mirrors were positioned poorly due to racking layout changes in Q4 2023. No visual warning system (flashing light/horn protocol) was in routine use.",
    immediateActions:"Vehicle stopped immediately and operator debriefed. Bay access restricted to essential personnel while assessment was carried out. All forklift operators reminded of mirror check procedure via toolbox talk.",
    recommendations:"Install physical pedestrian segregation barriers in Bay 2. Add audible reverse alarms to all counterbalance trucks not currently fitted. Introduce formal pre-start mirror check into daily vehicle inspection sheet.",
    photos:[],
    actions:[
      {id:"a001", description:"Install pedestrian barriers and dedicated crossing point in Warehouse Bay 2", owner:"Mark Davies", dueDate:"2024-02-09", priority:"high", status:"complete"},
      {id:"a002", description:"Fit audible reverse alarms to all counterbalance trucks lacking them — 3 vehicles identified", owner:"Daniel Okonkwo", dueDate:"2024-02-16", priority:"high", status:"complete"},
      {id:"a003", description:"Update pre-start vehicle inspection checklist to include nearside mirror check", owner:"Mark Davies", dueDate:"2024-01-26", priority:"medium", status:"complete"},
    ]
  },
  i2403: {
    investigator:"Linda Osei", investigationDate:"2024-02-07", status:"closed",
    summary:"Tom Bradley slipped on an icy step at the Loading Dock entrance at approximately 07:20 on 5 February 2024. Temperatures overnight had dropped to -3°C. The gritting rota had not been completed before the early shift started. Tom sustained a bruised knee and was assessed by the first aider. He returned to light duties the same day.",
    rootCause:"The site gritting rota did not assign responsibility for the dock entrance steps. Gritting was focused on the main car park and yard. The steps, which are in shadow and freeze earlier than surrounding areas, were not included in the gritting schedule.",
    contributingFactors:"Unusually cold snap forecast was not communicated to the facilities team. No anti-slip tape on dock steps. Steps are metal and particularly susceptible to ice. Early start workers arrive before facilities team completes morning grit round.",
    immediateActions:"Area gritted and salted immediately. Steps cordoned off until safe. Tom assessed by first aider — bruised knee, no hospital treatment required. Incident reported on accident register.",
    recommendations:"Update gritting rota to include dock entrance steps as a priority zone. Apply anti-slip tape to all dock step nosings. Introduce a winter weather trigger protocol: when forecast < 2°C, out-of-hours grit to be completed before first shift.",
    photos:[],
    actions:[
      {id:"a004", description:"Apply anti-slip GRP nosing covers to all 4 dock entrance steps", owner:"Daniel Okonkwo", dueDate:"2024-02-21", priority:"high", status:"complete"},
      {id:"a005", description:"Revise gritting rota to include dock steps as Zone 1 priority", owner:"Linda Osei", dueDate:"2024-02-14", priority:"high", status:"complete"},
      {id:"a006", description:"Issue winter trigger protocol to facilities team — grit below 2°C forecast", owner:"Linda Osei", dueDate:"2024-02-14", priority:"medium", status:"complete"},
    ]
  },
  i2402: {
    investigator:"Sarah Mitchell", investigationDate:"2024-01-19", status:"closed",
    summary:"Priya Sharma reported a leaking pipe under the sink in Staff Toilets Block B on 17 January 2024. Standing water had accumulated on the tile floor, creating a slip risk. The leak had been present for an estimated 24 hours before being reported — staff had noticed it but not formally logged it, unsure whether it warranted an incident report or a facilities request.",
    rootCause:"No clear protocol distinguishing between a safety-reportable unsafe condition and a routine facilities request. Staff perceived the incident reporting system as being for serious accidents only, which delayed reporting.",
    contributingFactors:"Incident reporting culture did not extend to minor defects. Block B toilets were not on the daily facilities walkround route. The leak had been visible to multiple staff members before formal escalation.",
    immediateActions:"Area cordoned off with wet floor signs. Facilities contacted — pipe repaired within 3 hours. Floor dried and signs removed. Staff reminded that standing water is a reportable unsafe condition.",
    recommendations:"Issue guidance clarifying what constitutes a reportable unsafe condition. Add Block B toilets to the daily facilities walkround. Run a brief awareness session on the incident reporting system.",
    photos:[],
    actions:[
      {id:"a091", description:"Issue guidance note defining reportable unsafe conditions — circulate to all staff", owner:"Linda Osei", dueDate:"2024-02-02", priority:"medium", status:"complete"},
      {id:"a092", description:"Add Staff Toilets Block B to daily facilities walkround route", owner:"Sarah Mitchell", dueDate:"2024-01-26", priority:"low", status:"complete"},
    ]
  },
  i2407: {
    investigator:"Sarah Mitchell", investigationDate:"2024-03-15", status:"closed",
    summary:"Sophie Clarke reported that Fire Exit C had been wedged open with a pallet on 13 March 2024. Staff had propped the exit to allow a two-person carrying task without repeatedly opening the door. This created a dual risk: breach of fire compartmentation and a potential obstruction to the escape route.",
    rootCause:"Staff were using fire exits as convenient thoroughfares for carrying tasks rather than using the designated service doors, which required a 40-metre detour. No awareness of the legal consequences of propping fire exits.",
    contributingFactors:"Service door routing was inconvenient for cross-building carries. No clear prohibition signage on fire exits. Previous fire door toolbox talk was 18 months prior.",
    immediateActions:"Pallet removed immediately. Exit confirmed clear. Staff member involved briefed. Fire warden inspection completed — no other propped exits found.",
    recommendations:"Install 'Do Not Prop Open' signage on all fire exits. Assess feasibility of a closer service access point near Fire Exit C. Include fire door briefing in annual staff training calendar.",
    photos:[],
    actions:[
      {id:"a093", description:"Install prohibition signage on all 8 fire exit doors — 'Do Not Prop Open — Fire Safety Law'", owner:"Daniel Okonkwo", dueDate:"2024-03-29", priority:"high", status:"complete"},
      {id:"a094", description:"Assess feasibility of closer service access point near Fire Exit C — report to H&S Manager", owner:"Mark Davies", dueDate:"2024-04-12", priority:"medium", status:"complete"},
    ]
  },
  i2411: {
    investigator:"Sarah Mitchell", investigationDate:"2024-04-20", status:"closed",
    summary:"Daniel Okonkwo reported that a heavy spanner had been dropped from the raised working platform in the Maintenance Workshop on 18 April 2024. A colleague was working below and was narrowly missed. The tool fell approximately 3 metres. No exclusion zone had been established beneath the platform.",
    rootCause:"The workshop at-height risk assessment focused on fall prevention for the operative but did not address falling object risk to personnel below. No formal procedure required an exclusion zone under elevated work.",
    contributingFactors:"No tool tethering or tool bag used on the platform. No barriers or signage below platform during elevated work. Workshop at-height risk assessment last reviewed 2021.",
    immediateActions:"All elevated work stopped. Area below platform cordoned off. Team briefed on exclusion zone requirements. Tool account confirmed all items present.",
    recommendations:"Update workshop at-height risk assessment to include falling object controls. Mandate exclusion zone below any elevated work. Provide tool tethering lanyards for all workshop at-height tasks.",
    photos:[],
    actions:[
      {id:"a095", description:"Update workshop at-height risk assessment to include falling object controls and exclusion zone requirement", owner:"Linda Osei", dueDate:"2024-05-10", priority:"high", status:"complete"},
      {id:"a096", description:"Procure tool tethering lanyards for workshop elevated work — minimum 6 sets", owner:"Daniel Okonkwo", dueDate:"2024-05-03", priority:"high", status:"complete"},
      {id:"a097", description:"Paint exclusion zone markings on workshop floor below the elevated platform", owner:"Daniel Okonkwo", dueDate:"2024-05-03", priority:"medium", status:"complete"},
    ]
  },
  i2417: {
    investigator:"Linda Osei", investigationDate:"2024-06-22", status:"closed",
    summary:"James Okafor was operating a counterbalance truck in Warehouse Bay 5 when Ryan Fitzgerald stepped from a racking aisle directly into the vehicle path. James braked and stopped within 0.5 metres. This was the second forklift/pedestrian near-miss in Bay 5 in 6 months. Convex mirrors recommended after i2401 had not been installed at Bay 5.",
    rootCause:"The racking aisle opening in Bay 5 had no convex mirror or visual warning. Pedestrians stepping out had no ability to see oncoming trucks. The traffic management plan showed a segregated pedestrian route, but no physical barrier enforced it.",
    contributingFactors:"Second near-miss at this specific location in 6 months. Corrective action (mirrors) from i2401 was incomplete — Bay 5 not covered. Pedestrian route marking existed but was not enforced.",
    immediateActions:"Operations paused. Both individuals spoken to. Emergency briefing on pedestrian/vehicle separation. Physical crossing point at Bay 5 blocked with temporary barriers pending permanent solution.",
    recommendations:"Install convex safety mirrors at all racking aisle ends opening onto vehicle routes. Install physical pedestrian barriers and dedicated crossing point at Bay 5.",
    photos:[],
    actions:[
      {id:"a098", description:"Install convex safety mirrors at all racking aisle ends onto vehicle routes — 12 mirrors required", owner:"Daniel Okonkwo", dueDate:"2024-07-12", priority:"high", status:"complete"},
      {id:"a099", description:"Install physical pedestrian barriers and dedicated crossing point at Bay 5", owner:"Mark Davies", dueDate:"2024-07-19", priority:"high", status:"complete"},
    ]
  },
  i2422: {
    investigator:"Linda Osei", investigationDate:"2024-08-16", status:"closed",
    summary:"Daniel Okonkwo accessed the roof via the plant room hatch on 14 August 2024 without a harness or work-at-height permit, spending 25 minutes on the roof investigating a leak. He believed a brief inspection did not require formal controls. A contractor observed the activity and reported it to the H&S team.",
    rootCause:"The work-at-height policy referred to 'work' at height without clarifying that visual inspections were included. Daniel had informal access to the roof hatch key without a permit process.",
    contributingFactors:"Policy ambiguity on what constitutes work at height. Previous roof inspections had been carried out informally without incident. Fall arrest kit was stored in a locked maintenance office cabinet rather than at the hatch.",
    immediateActions:"Daniel called down immediately. Briefed on fall arrest requirements. Roof hatch key returned to H&S office. Roof inspection completed subsequently by external contractor with full fall arrest.",
    recommendations:"Update work-at-height policy — roof access for any purpose requires permit and fall arrest. Restrict roof hatch key to H&S Manager issue only. Relocate fall arrest kit to adjacent to roof hatch.",
    photos:[],
    actions:[
      {id:"a100", description:"Update work-at-height policy — roof access for any purpose requires permit and fall arrest, no exceptions", owner:"Linda Osei", dueDate:"2024-08-30", priority:"high", status:"complete"},
      {id:"a101", description:"Restrict roof hatch key — issue against signed permit by H&S Manager only", owner:"Linda Osei", dueDate:"2024-08-23", priority:"high", status:"complete"},
      {id:"a102", description:"Relocate fall arrest kit to lockable cabinet directly adjacent to roof access hatch", owner:"Daniel Okonkwo", dueDate:"2024-08-23", priority:"medium", status:"complete"},
    ]
  },
  i2430: {
    investigator:"Sarah Mitchell", investigationDate:"2024-11-07", status:"closed",
    summary:"Connor Walsh slipped on moss-covered yard surface near the pedestrian gate on 5 November 2024 in wet conditions — bruised knee. The moss growth was concentrated in a shaded yard section. The area had been noted as slippery in October's facilities report but no action had been taken and no owner or timeline had been assigned.",
    rootCause:"Facilities report items for outdoor surface defects had no priority classification, no owner assignment, and no completion timeline. The moss hazard was not treated as safety-critical.",
    contributingFactors:"No outdoor surface defect priority matrix. Shaded yard section excluded from cleaning rota. Facilities report item not escalated.",
    immediateActions:"Area cordoned off. Anti-slip grit applied immediately. Connor assessed by first aider. Facilities instructed to arrange jet-wash and anti-slip treatment.",
    recommendations:"Introduce a facilities defect priority matrix — outdoor surface slip risks classified as high priority, resolution within 14 days. Add shaded yard section to quarterly jet-wash and anti-slip treatment rota.",
    photos:[],
    actions:[
      {id:"a103", description:"Introduce facilities defect priority matrix — outdoor slip risks to be resolved within 14 days with named owner", owner:"Sarah Mitchell", dueDate:"2024-11-22", priority:"medium", status:"complete"},
      {id:"a104", description:"Add shaded yard section to quarterly jet-wash and anti-slip surface treatment rota", owner:"Daniel Okonkwo", dueDate:"2024-11-22", priority:"medium", status:"complete"},
    ]
  },
  i2432: {
    investigator:"Linda Osei", investigationDate:"2024-11-23", status:"closed",
    summary:"A new operative in the Packaging Hall walked into a moving conveyor on 21 November 2024 — the light curtain triggered and the machine halted before contact. The operative had received a general site induction but no area-specific induction for the Packaging Hall before being deployed there.",
    rootCause:"The area-specific induction for the Packaging Hall had not been completed before deployment. The general induction did not cover the specific machine hazards and pedestrian routes in the hall. No formal record of area inductions existed.",
    contributingFactors:"Area induction system was informal and reliant on line manager memory. Production pressure resulted in early deployment to the production area. New starter sign-off sheet did not track area inductions.",
    immediateActions:"Operative removed from Packaging Hall. Area induction conducted immediately. All Packaging Hall staff reminded of pedestrian routes.",
    recommendations:"Introduce formal area induction checklists for all restricted production areas. No new starter to work in a production area without signed-off area induction. Update new starter sign-off sheet to track area inductions by location.",
    photos:[],
    actions:[
      {id:"a105", description:"Create formal area induction checklists for Packaging Hall, Assembly Area, and Packing Line", owner:"Linda Osei", dueDate:"2024-12-13", priority:"high", status:"complete"},
      {id:"a106", description:"Update new starter sign-off sheet to track area inductions — line manager signature required per area", owner:"Linda Osei", dueDate:"2024-12-06", priority:"medium", status:"complete"},
    ]
  },
  i2501: {
    investigator:"Linda Osei", investigationDate:"2025-01-10", status:"closed",
    summary:"James Okafor failed to check his nearside mirror before reversing in Warehouse Bay 3 on 8 January 2025, narrowly missing a pedestrian. This was the third forklift/pedestrian near-miss involving James in 12 months. His forklift licence renewal was found to be 4 months overdue.",
    rootCause:"Despite physical improvements and toolbox talks from previous incidents, James continued to reverse without mirror checks. His forklift licence renewal was overdue and competence had not been formally re-assessed.",
    contributingFactors:"No system alert for overdue forklift licence renewals. Physical controls had reduced but not eliminated the risk. Three near-misses in 12 months for the same operator indicated a competence and attitude issue.",
    immediateActions:"James removed from forklift duties immediately. Forklift licence records for all operators reviewed. All operators with overdue renewals identified.",
    recommendations:"Introduce forklift licence renewal tracking with 60-day advance alert. Operators with overdue renewals to be suspended from duties. Formal competence re-assessment for James before return to duties.",
    photos:[],
    actions:[
      {id:"a107", description:"Implement forklift licence renewal tracking — alert at 60 days, suspend from duties if overdue", owner:"Linda Osei", dueDate:"2025-01-31", priority:"critical", status:"complete"},
      {id:"a108", description:"Formal forklift competence re-assessment for James Okafor before returning to forklift duties", owner:"Mark Davies", dueDate:"2025-01-24", priority:"critical", status:"complete"},
      {id:"a109", description:"Audit licence renewal status for all 6 forklift operators — confirm all current", owner:"Linda Osei", dueDate:"2025-01-17", priority:"high", status:"complete"},
    ]
  },
  i2502: {
    investigator:"Sarah Mitchell", investigationDate:"2025-01-18", status:"closed",
    summary:"Tom Bradley slipped on the wet Loading Dock floor on 16 January 2025 — no wet floor sign had been placed. The floor was wet from a delivery in rain conditions. Tom sustained a sprained ankle and was absent for 3 days.",
    rootCause:"No procedure existed to automatically deploy wet floor signs during wet weather deliveries. Signs were used reactively after spills or cleaning, not proactively before rain-condition deliveries.",
    contributingFactors:"Wet weather delivery protocol not established. Loading Dock floor drainage was slow — water pooled centrally. No non-slip matting at dock threshold to capture tracked-in water.",
    immediateActions:"Tom given first aid. Wet floor signs deployed. Floor dried. Facilities instructed to inspect dock drainage.",
    recommendations:"Introduce wet weather delivery protocol — deploy wet floor signs before any delivery in rain. Install non-slip entrance matting at dock threshold. Inspect and clear Loading Dock drainage.",
    photos:[],
    actions:[
      {id:"a110", description:"Introduce wet weather delivery protocol — wet floor signs deployed before deliveries in rain conditions", owner:"Mark Davies", dueDate:"2025-02-01", priority:"high", status:"complete"},
      {id:"a111", description:"Install non-slip entrance matting at Loading Dock threshold", owner:"Daniel Okonkwo", dueDate:"2025-01-31", priority:"high", status:"complete"},
      {id:"a112", description:"Inspect and clear Loading Dock drainage — report blockage if found", owner:"Daniel Okonkwo", dueDate:"2025-01-24", priority:"medium", status:"complete"},
    ]
  },
  i2506: {
    investigator:"Sarah Mitchell", investigationDate:"2025-02-21", status:"closed",
    summary:"Ryan Fitzgerald was again observed climbing racking in the Racking Aisle on 19 February 2025 — the second racking climbing incident for Ryan in 12 months (see i2410). He had received a verbal warning after i2410 and had attended the toolbox talk. Despite this, the underlying physical environment remained unchanged.",
    rootCause:"Step ladders continued to be stored centrally rather than at the point of need. The unsafe behaviour remained the path of least resistance because the corrective action from i2410 (install aisle-end brackets) had not been implemented.",
    contributingFactors:"Second racking climb for Ryan in 12 months. No formal written warning issued after i2410. Physical environment unchanged. Corrective action from previous investigation not completed.",
    immediateActions:"Ryan challenged. Step ladder retrieved. Formal written warning issued — first written warning.",
    recommendations:"Install step ladder brackets at racking aisle ends — escalated from i2410. Issue formal written warning to Ryan.",
    photos:[],
    actions:[
      {id:"a113", description:"Install step ladder parking brackets at racking aisle ends — 6 required (escalated from i2410)", owner:"Daniel Okonkwo", dueDate:"2025-03-07", priority:"high", status:"complete"},
      {id:"a114", description:"HR to issue first formal written warning to Ryan Fitzgerald — repeat racking climbing incident", owner:"Linda Osei", dueDate:"2025-02-28", priority:"high", status:"complete"},
    ]
  },
  i2511: {
    investigator:"Sarah Mitchell", investigationDate:"2025-04-16", status:"closed",
    summary:"The N Wing fire exit door was found propped open with a cardboard box on 14 April 2025 — the same door as a previous propping incident (i2407). Investigation confirmed the same pattern: operatives using the fire exit as a short cut for cross-building carrying tasks despite signage installed after i2407.",
    rootCause:"The signage installed after i2407 was insufficient to change behaviour because no practical alternative route for cross-building carries had been provided. Operatives continued to use the fire exit as the most direct path.",
    contributingFactors:"Second fire exit propping at the same door. Physical environment unchanged since i2407. Signage alone was not effective. No dedicated carrying route between N Wing and Packing Hall.",
    immediateActions:"Box removed. Exit confirmed clear. All N Wing staff briefed. All other fire exits checked — none propped.",
    recommendations:"Assess feasibility of dedicated service corridor between N Wing and Packing Hall. Install door-held-open alarm on N Wing fire exit.",
    photos:[],
    actions:[
      {id:"a115", description:"Feasibility study for dedicated service access route between N Wing and Packing Hall", owner:"Mark Davies", dueDate:"2025-05-09", priority:"medium", status:"complete"},
      {id:"a116", description:"Install door-held-open alarm on N Wing fire exit — alerts if held open >60 seconds", owner:"Daniel Okonkwo", dueDate:"2025-05-02", priority:"high", status:"complete"},
    ]
  },
  i2527: {
    investigator:"Sarah Mitchell", investigationDate:"2025-09-24", status:"closed",
    summary:"A platform truck rolled unattended approximately 3 metres toward the dock edge in the Loading Bay on 22 September 2025, coming to rest against a kerb barrier. Connor Walsh had left it without applying the parking brake while he stepped away to answer his radio.",
    rootCause:"Connor did not apply the parking brake. The Loading Bay has a 1.5° gradient toward the dock edge — sufficient to allow unbraked movement. The safe use briefing at induction had not emphasised the braking requirement when leaving a truck on any gradient.",
    contributingFactors:"Briefing was delivered verbally at induction with no written summary or competence check. Brake was fully functional — this was a behavioural failure.",
    immediateActions:"Truck secured. Connor briefed. Dock edge barrier checked — no damage. All Loading Bay staff reminded of braking requirement.",
    recommendations:"Update platform truck safe use briefing — explicit requirement to apply brake whenever leaving truck unattended. Apply visual reminder sticker to all trucks.",
    photos:[],
    actions:[
      {id:"a117", description:"Update platform truck safe use briefing — emphasise brake-on whenever unattended, written reminder issued to operators", owner:"Mark Davies", dueDate:"2025-10-10", priority:"medium", status:"complete"},
      {id:"a118", description:"Apply 'Apply Brake Before Leaving' reminder sticker to all 8 platform trucks", owner:"Daniel Okonkwo", dueDate:"2025-10-03", priority:"low", status:"complete"},
    ]
  },
  i2533: {
    investigator:"Sarah Mitchell", investigationDate:"2025-11-24", status:"closed",
    summary:"James Okafor was observed crossing the Internal Road at an informal point on 21 November 2025, stepping into the path of a site vehicle. The vehicle braked in time. The designated crossing was 25 metres away and required a detour — a well-worn desire line at this location indicated multiple staff routinely used the informal crossing.",
    rootCause:"The designated pedestrian crossing was positioned to suit traffic flow rather than pedestrian desire lines, creating a persistent incentive to cross informally. No physical barrier prevented crossing at the informal point.",
    contributingFactors:"Multiple staff used the informal crossing — systemic issue, not just James. Vehicle speeds on the Internal Road routinely exceeded the 10 mph limit.",
    immediateActions:"James challenged. All site staff emailed on road crossing safety. Vehicle speed reviewed.",
    recommendations:"Install additional pedestrian crossing at the desire-line point with give-way markings. Install speed cushions on the Internal Road. Consider physical barrier preventing crossing at informal points.",
    photos:[],
    actions:[
      {id:"a119", description:"Install additional pedestrian crossing at desire-line point — marked with give-way markings for vehicles", owner:"Mark Davies", dueDate:"2025-12-12", priority:"high", status:"complete"},
      {id:"a120", description:"Install speed cushions on Internal Road at crossing area — reduce vehicle speed to ≤10 mph", owner:"Mark Davies", dueDate:"2025-12-19", priority:"medium", status:"complete"},
    ]
  },
  i2406: {
    investigator:"Linda Osei", investigationDate:"2024-03-08", status:"closed",
    summary:"Daniel Okonkwo strained his lower back while manually handling a heavy hydraulic motor assembly (estimated 38 kg) in Goods-In on 6 March 2024. The component had arrived without adequate lifting provision. Daniel attempted to move it to a staging area without mechanical assistance. He reported immediate lower back pain and was referred to occupational health.",
    rootCause:"No mechanical handling aid was available at the Goods-In area at the time of the incident. The lift was assessed as a two-person lift in the manual handling risk assessment, but Daniel was working alone at the time. The COSHH/RAMS for the job did not specify mandatory use of a pallet truck for components above 25 kg.",
    contributingFactors:"Goods-In was short-staffed. Pallet truck was in use in an adjacent bay and not immediately available. The component arrived without advance notification, meaning no pre-planning for handling occurred. Daniel had received manual handling training in 2022 but refresher was overdue.",
    immediateActions:"Work stopped immediately. Occupational health referral made same day. Area reviewed and pallet truck allocated to Goods-In bay. Incident reported to HSE under RIDDOR — over-3-day injury.",
    recommendations:"Purchase an additional powered pallet truck for permanent deployment at Goods-In. Update Goods-In RAMS to mandate mechanical aid for components over 25 kg. Schedule Daniel's manual handling refresher training. Brief all Goods-In staff on two-person lift requirements.",
    photos:[],
    actions:[
      {id:"a007", description:"Procure additional powered pallet truck for Goods-In area — get 3 quotes", owner:"Mark Davies", dueDate:"2024-04-06", priority:"critical", status:"complete"},
      {id:"a008", description:"Update Goods-In RAMS to mandate mechanical aid for components > 25 kg", owner:"Linda Osei", dueDate:"2024-03-22", priority:"high", status:"complete"},
      {id:"a009", description:"Arrange manual handling refresher for Daniel Okonkwo", owner:"Linda Osei", dueDate:"2024-03-29", priority:"medium", status:"complete"},
      {id:"a010", description:"Brief all Goods-In staff on two-person lift rules via toolbox talk", owner:"Mark Davies", dueDate:"2024-03-22", priority:"high", status:"complete"},
    ]
  },
  i2409: {
    investigator:"Linda Osei", investigationDate:"2024-04-04", status:"closed",
    summary:"Aisha Patel sustained lacerations to two fingers of her right hand when her hand made contact with an unguarded nip point on Packaging Line 2 during a maintenance check on 2 April 2024. The machine guard had been removed earlier in the shift for a planned adjustment and had not been refitted before the machine was returned to operation. First aid was administered and Aisha was taken to A&E where two fingers were sutured.",
    rootCause:"Machine guard on Packaging Line 2 nip point was not refitted after maintenance intervention. There was no formal lock-out/tag-out (LOTO) procedure enforced before the machine was restarted. The permit-to-work system was not used for this intervention.",
    contributingFactors:"Production pressure resulted in the machine being restarted before the post-maintenance checklist was completed. The LOTO station was located at the far end of the line, which staff found inconvenient. No visual indication that the guard was missing when the machine was powered up.",
    immediateActions:"Machine isolated immediately. Aisha given first aid on site and taken to A&E — sutured and signed off for one week. Machine taken out of service pending guard reinstatement and LOTO review. RIDDOR report submitted to HSE.",
    recommendations:"Implement formal LOTO procedure on all packaging lines. Relocate LOTO station to within 2 metres of each machine. Install guard presence sensor that prevents machine starting if guard is not in place. Retrain all production staff on LOTO. Review permit-to-work system.",
    photos:[],
    actions:[
      {id:"a011", description:"Install guard presence interlock sensors on Packaging Lines 1, 2 and 3", owner:"Daniel Okonkwo", dueDate:"2024-05-03", priority:"critical", status:"complete"},
      {id:"a012", description:"Implement full LOTO procedure and provide LOTO stations at each machine", owner:"Mark Davies", dueDate:"2024-04-19", priority:"critical", status:"complete"},
      {id:"a013", description:"Retrain all production staff on LOTO procedure — record completion", owner:"Linda Osei", dueDate:"2024-05-10", priority:"high", status:"complete"},
      {id:"a014", description:"Revise permit-to-work to include mandatory post-maintenance guard check sign-off", owner:"Linda Osei", dueDate:"2024-04-19", priority:"high", status:"complete"},
    ]
  },
  i2415: {
    investigator:"Sarah Mitchell", investigationDate:"2024-06-06", status:"closed",
    summary:"Liam Harrison (Shift Supervisor) tripped over a trailing power cable in Stairwell A on 4 June 2024, bracing his fall and sustaining a wrist sprain. The cable had been run from a temporary power outlet on the ground floor by a contractor conducting fire alarm sensor testing. The cable was not secured or sign-posted.",
    rootCause:"Contractor did not follow the site cable management requirements for temporary supplies. No cable cover or warning signage was placed over the trailing cable. The contractor's method statement did not adequately cover cable routing in communal circulation routes.",
    contributingFactors:"The contractor induction process did not specifically cover the requirement to cover cables in stairwells and circulation routes. Liam was descending the stairs at normal pace and did not see the cable, which was dark-coloured against the stair tread.",
    immediateActions:"Cable secured immediately using cable ramps sourced from site stores. Liam assessed by first aider — wrist sprain, no fracture confirmed. Contractor notified and reminded of site requirements.",
    recommendations:"Update contractor induction to include specific requirements for cable routing and coverage in stairwells. Purchase additional cable ramp sets and store at reception for contractor use. Add cable management requirements to contractor permit-to-work.",
    photos:[],
    actions:[
      {id:"a015", description:"Update contractor induction to include stairwell cable management rules", owner:"Linda Osei", dueDate:"2024-06-21", priority:"high", status:"complete"},
      {id:"a016", description:"Purchase 6 additional cable cover ramps — store at reception for contractor issue", owner:"Sarah Mitchell", dueDate:"2024-06-21", priority:"medium", status:"complete"},
    ]
  },
  i2416: {
    investigator:"Linda Osei", investigationDate:"2024-06-14", status:"closed",
    summary:"On 12 June 2024, Sarah Mitchell reported observing a safety interlock on the main sorting conveyor in the Conveyor Control Room being bypassed using a cable tie by an unnamed operative. The bypass allowed the machine to run at increased speed without the thermal protection engaging. This was confirmed by CCTV review. The individual was identified as Liam Harrison.",
    rootCause:"Liam had bypassed the interlock to compensate for falling behind on a production target. The safety culture around interlocks was insufficiently robust — there was no formal disciplinary example of this type of behaviour being sanctioned, and operatives perceived production targets as more important than safety procedures.",
    contributingFactors:"Production targets were set without adequate consideration of machine safe operating speed. No formal awareness communication had been issued about the specific risks of interlock bypass on conveyor systems. The cable tie used was stored in the control room.",
    immediateActions:"Interlock reinstated immediately. Liam removed from role pending disciplinary process. Machine inspected by engineering — no damage found. All shift supervisors briefed.",
    recommendations:"Introduce anti-tamper covers on all interlock mechanisms. Issue formal safety communication on interlock tampering consequences. Review production targets. Brief all staff on zero-tolerance policy for safety device bypass.",
    photos:[],
    actions:[
      {id:"a017", description:"Install anti-tamper covers on all conveyor interlock switches — 8 identified", owner:"Daniel Okonkwo", dueDate:"2024-07-05", priority:"critical", status:"complete"},
      {id:"a018", description:"Issue all-staff notice on zero-tolerance interlock tamper policy with disciplinary consequences", owner:"Linda Osei", dueDate:"2024-06-21", priority:"high", status:"complete"},
      {id:"a019", description:"Review production targets with operations to ensure they are achievable within safe machine operating limits", owner:"Mark Davies", dueDate:"2024-07-12", priority:"high", status:"complete"},
    ]
  },
  i2421: {
    investigator:"Sarah Mitchell", investigationDate:"2024-08-08", status:"closed",
    summary:"Ryan Fitzgerald and a colleague were attempting to move an oversized cardboard box (approx. 35 kg, 1.2m × 0.8m × 0.9m) in the main warehouse without a pallet truck. Ryan reported lower back pain during the lift. Investigation found the box had been left in an aisle rather than placed on a pallet, and the team were trying to clear the aisle quickly before a forklift run.",
    rootCause:"The oversized box had been left in an aisle without being placed on a pallet by the Goods-In team. Manual handling of this item was not planned. No mechanical aid was sought before attempting the lift.",
    contributingFactors:"Time pressure — forklift run was imminent. Lack of immediately available pallet trucks in the area. Manual handling awareness training for Ryan had not been refreshed since induction.",
    immediateActions:"Ryan stood down and assessed — no hospital treatment required. Box moved to correct location using pallet truck. Aisle cleared. Toolbox talk delivered to Goods-In and warehouse teams on palletising all incoming goods.",
    recommendations:"Issue Goods-In instruction: all items over 20 kg must be placed on pallets on arrival. Ensure pallet trucks are available within the warehouse at all times. Schedule manual handling refresher for Ryan.",
    photos:[],
    actions:[
      {id:"a020", description:"Issue written instruction to Goods-In: all items >20 kg to be palletised on arrival", owner:"Mark Davies", dueDate:"2024-08-23", priority:"high", status:"complete"},
      {id:"a021", description:"Schedule manual handling refresher training for Ryan Fitzgerald", owner:"Linda Osei", dueDate:"2024-09-06", priority:"medium", status:"complete"},
    ]
  },
  i2428: {
    investigator:"Linda Osei", investigationDate:"2024-10-17", status:"closed",
    summary:"Daniel Okonkwo observed a visiting contractor from Electro-Tech Services conducting live electrical testing in the Electrical Workshop on 15 October 2024 without having isolated the supply. The contractor was testing a control panel that remained energised. Daniel challenged the contractor and the supply was isolated. A RIDDOR dangerous occurrence report was submitted.",
    rootCause:"Electro-Tech Services did not follow the site permit-to-work (PTW) procedure for live electrical work. The contractor's own safe system of work permitted live testing under certain conditions, but this conflicted with Zeus site rules. The Zeus PTW had been issued but the contractor had not read the isolation requirement.",
    contributingFactors:"The contractor's site induction did not adequately cover the Zeus absolute rule regarding electrical isolation. The PTW issuer did not verbally confirm isolation requirements with the contractor before work commenced. No Zeus supervisor was present during the testing.",
    immediateActions:"Work stopped, supply isolated, area made safe. Contractor's site access suspended pending review. RIDDOR dangerous occurrence submitted to HSE. Electro-Tech Services formally notified.",
    recommendations:"Add live electrical work prohibition to contractor induction — verbal confirmation required. Update PTW process to include mandatory pre-work briefing with contractor confirming understanding of isolation rules. Restrict Electro-Tech from site pending review of their SSOW.",
    photos:[],
    actions:[
      {id:"a022", description:"Update contractor induction — add explicit prohibition of live electrical work without PTW isolation sign-off", owner:"Linda Osei", dueDate:"2024-11-01", priority:"critical", status:"complete"},
      {id:"a023", description:"Review and update PTW process to include mandatory pre-work verbal briefing for electrical work", owner:"Linda Osei", dueDate:"2024-10-31", priority:"critical", status:"complete"},
      {id:"a024", description:"Conduct formal review of Electro-Tech Services SSOW before re-admitting to site", owner:"Linda Osei", dueDate:"2024-11-15", priority:"high", status:"complete"},
    ]
  },
  i2433: {
    investigator:"Sarah Mitchell", investigationDate:"2024-12-05", status:"closed",
    summary:"Daniel Okonkwo attempted to manually move a 45 kg hydraulic component from a delivery pallet to a staging shelf in Goods-In on 3 December 2024. He worked alone and reported shoulder strain following the lift. No mechanical aid was used despite a pallet truck being available within the bay. This was the third manual handling back/shoulder injury in Goods-In in 2024.",
    rootCause:"Persistent pattern of manual handling of heavy components without mechanical aids despite previous incidents and toolbox talks. Investigation found that although pallet trucks were available, the staging shelf layout required a lift-and-carry of 3 metres that the pallet truck could not facilitate. The staging area had not been designed with mechanical handling in mind.",
    contributingFactors:"Staging shelf layout incompatible with pallet truck use. Previous interventions (toolbox talks) had not addressed root layout issue. Third manual handling injury in Goods-In in 12 months — systemic issue identified.",
    immediateActions:"Daniel stood down and assessed — no hospital treatment required, returned to light duties. Goods-In supervisor reminded of mechanical handling requirements. Review meeting of Goods-In layout initiated.",
    recommendations:"Redesign Goods-In staging area to allow pallet truck access to all shelf positions. Install cantilever racking at accessible heights for components >20 kg. Conduct formal DSE/manual handling review of all Goods-In workstations.",
    photos:[],
    actions:[
      {id:"a025", description:"Commission Goods-In staging area redesign — use of cantilever racking or accessible shelf heights for heavy items", owner:"Mark Davies", dueDate:"2025-01-31", priority:"critical", status:"complete"},
      {id:"a026", description:"Conduct formal manual handling review of all Goods-In workstations with ergonomics specialist", owner:"Linda Osei", dueDate:"2025-01-10", priority:"high", status:"complete"},
      {id:"a027", description:"Re-brief all Goods-In staff on the importance of seeking assistance for heavy lifts", owner:"Mark Davies", dueDate:"2024-12-13", priority:"medium", status:"complete"},
    ]
  },
  i2435: {
    investigator:"Linda Osei", investigationDate:"2024-12-20", status:"closed",
    summary:"On 18 December 2024, the hydraulic press ram in the Workshop descended unexpectedly during a tool change operation while Daniel Okonkwo was working on the lower tooling. The ram motion was stopped by the physical tooling before contact with Daniel's hands. Investigation confirmed the ram had not been mechanically locked out — only isolated electrically. RIDDOR dangerous occurrence submitted.",
    rootCause:"The site LOTO procedure for the hydraulic press required both electrical isolation AND mechanical lock of the ram, but Daniel had only applied electrical isolation. He was unaware that gravity could cause the ram to descend even with power removed if the hydraulic holding valve was not engaged. The procedure was unclear on this point.",
    contributingFactors:"LOTO procedure document was ambiguous about the requirement for mechanical lock-out in addition to electrical isolation. The mechanical lock bar was stored in the workshop cabinet rather than on the machine. No secondary check was required by the procedure before entering the danger zone.",
    immediateActions:"Work stopped immediately. All hydraulic press operations suspended. Ram locked mechanically. RIDDOR dangerous occurrence submitted. All workshop staff stood down for emergency LOTO briefing.",
    recommendations:"Revise LOTO procedure for hydraulic press to explicitly require both electrical AND mechanical lock-out. Mount mechanical lock bar on the machine itself. Introduce buddy-check requirement before any work in the ram danger zone. Retrain all maintenance staff.",
    photos:[],
    actions:[
      {id:"a028", description:"Revise hydraulic press LOTO procedure — mandate electrical AND mechanical lock-out", owner:"Linda Osei", dueDate:"2025-01-10", priority:"critical", status:"complete"},
      {id:"a029", description:"Mount mechanical lock bar permanently on press frame with 'MUST BE USED' label", owner:"Daniel Okonkwo", dueDate:"2025-01-10", priority:"critical", status:"complete"},
      {id:"a030", description:"Retrain all maintenance staff on revised hydraulic press LOTO — record completion", owner:"Linda Osei", dueDate:"2025-01-17", priority:"high", status:"complete"},
    ]
  },
  i2504: {
    investigator:"Linda Osei", investigationDate:"2025-02-05", status:"closed",
    summary:"Daniel Okonkwo strained his lower back for a second time in 12 months, this time in the Goods-In Area on 3 February 2025. Investigation noted that despite the Goods-In redesign commissioned after the December 2024 incident, the new cantilever racking had not yet been installed. The root cause was essentially unchanged from i2433.",
    rootCause:"The corrective action from the December 2024 investigation (Goods-In staging area redesign) had not been completed on schedule. The component involved was 42 kg and no pallet truck access was available to the interim staging position. RIDDOR three-day injury reported.",
    contributingFactors:"Corrective action from previous investigation was delayed due to supplier lead time. No interim control was put in place while the permanent solution was pending. Daniel was again working alone in the bay.",
    immediateActions:"Daniel stood down, referred to occupational health. RIDDOR three-day injury submitted. Goods-In staging area closed for heavy components pending rack installation. Temporary safe-lift protocol issued.",
    recommendations:"Expedite Goods-In racking installation — escalate as critical. Introduce interim two-person rule for all lifts >25 kg until permanent solution in place. Conduct occupational health review for Daniel given recurrence.",
    photos:[],
    actions:[
      {id:"a031", description:"Expedite cantilever racking installation in Goods-In — contractor to attend within 2 weeks", owner:"Mark Davies", dueDate:"2025-02-21", priority:"critical", status:"complete"},
      {id:"a032", description:"Interim rule: two-person lift mandatory for all components >25 kg in Goods-In until racking installed", owner:"Mark Davies", dueDate:"2025-02-07", priority:"critical", status:"complete"},
      {id:"a033", description:"Arrange occupational health review for Daniel Okonkwo — second back injury in 12 months", owner:"Linda Osei", dueDate:"2025-02-14", priority:"high", status:"complete"},
    ]
  },
  i2509: {
    investigator:"Linda Osei", investigationDate:"2025-03-24", status:"closed",
    summary:"Aisha Patel's hand was caught in the packaging machine on the main Packaging Line on 21 March 2025 while conducting a running check of product positioning. The guard was in place but a small access aperture used for in-running adjustments was unprotected. Aisha sustained lacerations to three fingers. RIDDOR three-day injury reported. This was the second packaging line hand injury in 12 months (see also i2409).",
    rootCause:"The in-running adjustment aperture on the packaging machine was not identified as a residual risk in the machine risk assessment. It had been introduced as a modification to enable product alignment checks without stopping the machine — a decision made without a formal change risk assessment.",
    contributingFactors:"Machine modification had been made without following the management of change procedure. The residual aperture risk was not communicated to operators. Production pressure had established a practice of checking product alignment with the machine running rather than stopping it.",
    immediateActions:"Machine isolated and taken out of service. Aisha given first aid and taken to hospital — sutured. RIDDOR submitted. Machine modification reviewed by engineering. Practice of in-running checks stopped immediately.",
    recommendations:"Complete formal risk assessment of all machine modifications made without management of change process. Block or guard the adjustment aperture. Introduce strict stop-before-you-check rule on all packaging lines. Review management of change procedure.",
    photos:[],
    actions:[
      {id:"a034", description:"Audit all packaging machine modifications against management of change records — identify unassessed changes", owner:"Daniel Okonkwo", dueDate:"2025-04-11", priority:"critical", status:"complete"},
      {id:"a035", description:"Guard or block the in-running adjustment aperture on the packaging machine", owner:"Daniel Okonkwo", dueDate:"2025-03-28", priority:"critical", status:"complete"},
      {id:"a036", description:"Issue all-staff notice — stop-before-you-check rule on all packaging lines, no exceptions", owner:"Mark Davies", dueDate:"2025-03-28", priority:"high", status:"complete"},
      {id:"a037", description:"Revise management of change procedure to require formal risk assessment for any machine modification", owner:"Linda Osei", dueDate:"2025-04-18", priority:"high", status:"complete"},
    ]
  },
  i2514: {
    investigator:"Linda Osei", investigationDate:"2025-05-08", status:"closed",
    summary:"On 6 May 2025, Sarah Mitchell reported that an operative (subsequently identified as James Okafor) had bypassed the safety interlock on the warehouse conveyor in the Warehouse Office area to speed up a backlog sort. This was the second interlock bypass incident in 12 months. James had received the all-staff notice issued after i2416.",
    rootCause:"Despite the previous investigation and all-staff notice, the anti-tamper covers installed after i2416 had not been fitted to this conveyor as it was not on the original eight-unit list. The bypass was achieved by shorting the interlock with a piece of wire from the workshop.",
    contributingFactors:"The corrective action from i2416 was incomplete — the warehouse office conveyor was not included. Production backlog culture remained a pressure. James had not attended the LOTO retraining session scheduled after i2416.",
    immediateActions:"Work stopped, interlock reinstated. James removed from role pending disciplinary. Machine inspected — no damage. Anti-tamper cover fitted immediately. All conveyor interlocks audited.",
    recommendations:"Complete full audit of all conveyor interlocks to ensure anti-tamper covers are fitted. Review and update training records to confirm all staff have attended LOTO briefings. Escalate disciplinary for second interlock bypass.",
    photos:[],
    actions:[
      {id:"a038", description:"Full audit of all site conveyor and machine interlocks — confirm anti-tamper cover fitted on every unit", owner:"Daniel Okonkwo", dueDate:"2025-05-23", priority:"critical", status:"complete"},
      {id:"a039", description:"Confirm LOTO briefing attendance for all production and warehouse staff — chase outstanding completions", owner:"Linda Osei", dueDate:"2025-05-16", priority:"high", status:"complete"},
    ]
  },
  i2516: {
    investigator:"Sarah Mitchell", investigationDate:"2025-06-05", status:"closed",
    summary:"Aisha Patel reported shoulder pain at the end of her shift in Assembly Hall on 3 June 2025. She had been performing a repetitive overhead bolt tightening task for approximately 6 hours. The task had been introduced as part of a new assembly process without a manual handling/ergonomic assessment being carried out.",
    rootCause:"New assembly process introduced without an ergonomic risk assessment. The task required sustained overhead working in excess of HSE guidelines for repetitive upper limb work. No rotation schedule had been established to limit exposure.",
    contributingFactors:"New process was introduced under production pressure with a short implementation timeline. The H&S team was not consulted before the new task was deployed. Aisha had flagged discomfort to her line manager mid-shift but was not stood down.",
    immediateActions:"Aisha referred to occupational health. Task suspended pending ergonomic review. All assembly operatives performing the task stood down and assessed.",
    recommendations:"Require H&S sign-off before any new repetitive task is introduced. Commission ergonomic assessment of overhead bolt tightening task. Introduce task rotation to limit overhead exposure to 2 hours per worker per shift. Raise reporting culture — operatives must be stood down if they report discomfort.",
    photos:[],
    actions:[
      {id:"a040", description:"Commission ergonomic assessment of overhead bolt tightening task by occupational health specialist", owner:"Linda Osei", dueDate:"2025-06-27", priority:"high", status:"complete"},
      {id:"a041", description:"Introduce task rotation schedule — max 2hrs overhead work per operator per shift", owner:"Mark Davies", dueDate:"2025-06-13", priority:"high", status:"complete"},
      {id:"a042", description:"Update new process introduction procedure to require H&S sign-off before deployment", owner:"Linda Osei", dueDate:"2025-06-27", priority:"medium", status:"complete"},
    ]
  },
  i2519: {
    investigator:"Sarah Mitchell", investigationDate:"2025-07-09", status:"closed",
    summary:"Tom Bradley slipped at the Cold Store entrance threshold on 7 July 2025. Ice had built up on the rubber entrance mat during the night shift. Tom sustained a bruised hip. This was the third slip/trip incident linked to wet or icy floor conditions in 2025.",
    rootCause:"The rubber entrance mat at the Cold Store threshold had a buckled edge where it abutted the drainage channel, creating a pocket where meltwater from Cold Store operatives' boots pooled and refroze overnight. The mat had not been included in the nightly floor safety check.",
    contributingFactors:"Third slip/trip on site in 2025. Cold Store entrance was not on the daily floor safety inspection route. The mat had been flagged as worn in a previous facilities report but not replaced. No anti-slip matting had been assessed for suitability in freeze/thaw conditions.",
    immediateActions:"Mat removed, area gritted. Tom assessed by first aider. Cold Store entrance closed until new mat installed. All other entrance mats inspected.",
    recommendations:"Replace all Cold Store entrance mats with freeze-rated anti-slip matting. Add Cold Store threshold to nightly floor check route. Review all mat replacements flagged in facilities reports and action within 14 days.",
    photos:[],
    actions:[
      {id:"a043", description:"Replace Cold Store entrance mat with freeze-rated anti-slip matting — source within 1 week", owner:"Daniel Okonkwo", dueDate:"2025-07-18", priority:"high", status:"complete"},
      {id:"a044", description:"Add Cold Store entrance to nightly floor safety inspection route", owner:"Mark Davies", dueDate:"2025-07-11", priority:"high", status:"complete"},
      {id:"a045", description:"Review all outstanding mat replacement items from facilities reports — action within 14 days", owner:"Sarah Mitchell", dueDate:"2025-07-25", priority:"medium", status:"complete"},
    ]
  },
  i2522: {
    investigator:"Sarah Mitchell", investigationDate:"2025-08-07", status:"closed",
    summary:"Mei Chen (Finance Administrator) reported lower back pain after moving a large multifunction printer from its trolley to a shelf in the Print Room on 5 August 2025. The printer weighed approximately 32 kg. Mei had moved it alone after the IT technician who was due to assist cancelled with short notice.",
    rootCause:"Mei was not aware of the 25 kg single-person lift limit. The task was planned as a two-person lift but when her co-worker cancelled, no alternative assistance was sought before Mei proceeded alone. Office staff had not received manual handling training adequate for heavy equipment moves.",
    contributingFactors:"Office staff manual handling training focused on DSE/posture rather than heavy equipment moves. No system existed to pause the task and seek help when the second person cancelled. Mei felt under pressure to complete the task before the IT changeover window closed.",
    immediateActions:"Mei assessed by first aider — no hospital treatment required, referred to occupational health as a precaution. Printer secured safely. IT team briefed that equipment moves >20 kg require two people.",
    recommendations:"Extend manual handling training for office staff to include heavy equipment moves. Introduce 'stop and seek help' protocol for planned two-person tasks where one person drops out. Attach weight labels to all heavy office equipment.",
    photos:[],
    actions:[
      {id:"a046", description:"Update office staff manual handling training to include heavy equipment moves and stop-and-seek-help protocol", owner:"Linda Osei", dueDate:"2025-09-05", priority:"medium", status:"complete"},
      {id:"a047", description:"Attach weight labels to all heavy office equipment (printers, servers, monitors) — identify items >20 kg", owner:"Sarah Mitchell", dueDate:"2025-08-22", priority:"low", status:"complete"},
    ]
  },
  i2526: {
    investigator:"Linda Osei", investigationDate:"2025-09-12", status:"closed",
    summary:"On 10 September 2025, Daniel Okonkwo discovered that the main sprinkler supply valve in the Sprinkler Tank Room had been closed by an unknown individual. CCTV review identified a contractor who had closed the valve while accessing the room for an unrelated drainage task and failed to reopen it. The sprinkler system was rendered inactive for an estimated 4 hours. RIDDOR dangerous occurrence submitted.",
    rootCause:"The sprinkler tank room was accessible to contractors with a general site access pass without the need for a specific PTW. The contractor was unaware that the valve controlled the sprinkler supply and closed it to prevent water ingress to his working area.",
    contributingFactors:"No lockable valve guard or warning notice on the sprinkler isolation valve. Sprinkler Tank Room not identified as a restricted zone requiring a specific access authorisation. Contractor induction did not cover prohibited actions in plant rooms.",
    immediateActions:"Valve reopened and sprinkler system checked by fire contractor — no damage. RIDDOR dangerous occurrence submitted. Sprinkler Tank Room access restricted. All contractors on site briefed immediately.",
    recommendations:"Install locked valve guard on sprinkler isolation valve — key held by H&S Manager only. Designate Sprinkler Tank Room as restricted zone — specific PTW required. Update contractor induction to cover plant room prohibited actions.",
    photos:[],
    actions:[
      {id:"a048", description:"Install locked guard on sprinkler isolation valve — procure and fit within 1 week", owner:"Daniel Okonkwo", dueDate:"2025-09-19", priority:"critical", status:"complete"},
      {id:"a049", description:"Designate Sprinkler Tank Room as restricted zone — update site access map and signage", owner:"Linda Osei", dueDate:"2025-09-19", priority:"critical", status:"complete"},
      {id:"a050", description:"Update contractor induction — add plant room prohibited actions section", owner:"Linda Osei", dueDate:"2025-09-26", priority:"high", status:"complete"},
    ]
  },
  i2532: {
    investigator:"Linda Osei", investigationDate:"2025-11-14", status:"closed",
    summary:"On 12 November 2025, Aisha Patel's line manager observed her removing the guard from a packaging machine in the Packing Hall to clear a jam without isolating the machine. She reached into the machine while it was still powered. Investigation confirmed the LOTO station was 15 metres from the machine and Aisha had not completed the company's LOTO retraining following the i2509 incident.",
    rootCause:"Aisha had not attended the LOTO retraining session scheduled after the March 2025 incident (i2509). The record-keeping system showed her as 'pending'. The LOTO station distance made the procedure feel disproportionate for a quick jam clearance. Cultural normalisation of taking shortcuts under time pressure.",
    contributingFactors:"Fourth packaging-related safety incident involving Aisha in 18 months. LOTO retraining completion was not enforced — staff could remain in role despite being marked as pending. Jam clearance was a frequent task and the stop-isolate-clear procedure was perceived as slow.",
    immediateActions:"Work stopped. Aisha removed pending disciplinary. Machine isolated. Line manager debriefed. Emergency all-staff LOTO reminder issued. Training records audited immediately.",
    recommendations:"Make LOTO training completion mandatory before return to role — no exceptions. Install LOTO station directly at each packaging machine. Conduct root cause review of jam frequency to reduce need for manual clearance. Formal capability review for Aisha.",
    photos:[],
    actions:[
      {id:"a051", description:"Mandatory LOTO completion — bar access to production floor for staff with outstanding LOTO training", owner:"Linda Osei", dueDate:"2025-11-21", priority:"critical", status:"complete"},
      {id:"a052", description:"Relocate LOTO stations to within 2m of each packaging machine", owner:"Daniel Okonkwo", dueDate:"2025-11-28", priority:"critical", status:"complete"},
      {id:"a053", description:"Engineering review of jam frequency on Packing Hall machines — identify root cause and fix", owner:"Daniel Okonkwo", dueDate:"2025-12-12", priority:"high", status:"complete"},
    ]
  },
  i2534: {
    investigator:"Sarah Mitchell", investigationDate:"2025-12-04", status:"closed",
    summary:"Mei Chen attempted to move a 27-inch monitor alone in the Print Room on 2 December 2025. The monitor weighed approximately 14 kg in its box but was bulky and awkward. Mei reported lower back pain. This was Mei's second manual handling injury in 4 months (see also i2522).",
    rootCause:"Persistent failure to apply two-person lift protocol for bulky office equipment. Despite weight labelling introduced after i2522, the monitor box did not carry a weight label as it had not been on the inventory at the time of labelling. Mei again felt under pressure to complete the task without waiting for assistance.",
    contributingFactors:"Second manual handling injury for Mei in 4 months — pattern identified. Weight labelling programme incomplete. Culture of task completion without seeking help persists in office environment. Occupational health referral from i2522 had not been completed.",
    immediateActions:"Mei stood down and referred to occupational health — mandatory this time. Monitor repositioned by two staff members. All Print Room staff briefed.",
    recommendations:"Complete occupational health review for Mei — identify any underlying susceptibility. Extend weight labelling to all equipment not yet covered. Consider lightweight workstation furniture assessment for the Print Room. Enforce stop-and-seek-help with line manager notification if assistance refused.",
    photos:[],
    actions:[
      {id:"a054", description:"Mandatory occupational health assessment for Mei Chen — second MH injury in 4 months", owner:"Linda Osei", dueDate:"2025-12-12", priority:"high", status:"complete"},
      {id:"a055", description:"Complete weight labelling programme — cover all office equipment not yet labelled", owner:"Sarah Mitchell", dueDate:"2025-12-19", priority:"medium", status:"complete"},
    ]
  },
  i2536: {
    investigator:"Linda Osei", investigationDate:"2025-12-20", status:"closed",
    summary:"Daniel Okonkwo detected the smell of gas near the boiler in the Boiler Room on 18 December 2025. The gas engineer on site confirmed a minor leak on a compression fitting on the low-pressure gas supply to the boiler. The area was evacuated, ventilated and the leak repaired within 2 hours. No injuries. RIDDOR dangerous occurrence submitted due to potential for ignition.",
    rootCause:"A compression fitting on the low-pressure gas line had worked loose due to vibration from the boiler over an extended period. The fitting was not included in the annual boiler service inspection checklist, which focused on burner and heat exchanger components.",
    contributingFactors:"Boiler room inspection did not include a systematic check of all gas fittings. Vibration-resistant fittings had been specified for the burner manifold but not for the entire low-pressure supply run. Last annual service was 11 months ago.",
    immediateActions:"Gas isolated, area evacuated and ventilated. Gas engineer contacted — attended within 45 mins. Fitting replaced. Gas reinstated after safe re-light check. RIDDOR submitted. All staff notified of gas isolation procedure.",
    recommendations:"Add systematic check of all gas supply fittings to annual service scope. Replace standard compression fittings on boiler supply line with vibration-resistant equivalents. Introduce 6-monthly visual inspection of gas pipework in Boiler Room.",
    photos:[],
    actions:[
      {id:"a056", description:"Update annual boiler service specification — add systematic check of all supply line fittings", owner:"Daniel Okonkwo", dueDate:"2026-01-16", priority:"high", status:"complete"},
      {id:"a057", description:"Replace standard compression fittings on boiler supply run with vibration-resistant equivalents", owner:"Daniel Okonkwo", dueDate:"2026-01-09", priority:"high", status:"complete"},
      {id:"a058", description:"Introduce 6-monthly visual boiler room gas pipework inspection — add to H&S calendar", owner:"Linda Osei", dueDate:"2026-01-09", priority:"medium", status:"complete"},
    ]
  },
  i2601: {
    investigator:"Linda Osei", investigationDate:"2026-01-06", status:"closed",
    summary:"Daniel Okonkwo sustained his third lower back injury in 24 months — this time in the Goods-In Area on 3 January 2026. He was moving a 40 kg pump assembly. The cantilever racking installed after the February 2025 incident was in use, but the pump assembly had been placed on the floor behind the racking by the delivery driver and Daniel lifted it manually to position it onto the rack.",
    rootCause:"Delivery driver placed the component on the floor in a position not accessible by pallet truck, and Daniel lifted manually rather than repositioning the pallet truck and resetting the delivery. Daniel's risk perception for manual lifting appears normalised despite his injury history.",
    contributingFactors:"Third MH back injury for Daniel in 24 months — chronic risk pattern. Occupational health involvement had not resulted in a restriction notice or capability review. Delivery drivers are not always aware of Goods-In manual handling requirements. RIDDOR three-day injury.",
    immediateActions:"Daniel stood down immediately — mandatory OH referral. RIDDOR submitted. Goods-In layout review initiated. Formal capability conversation with Daniel. All delivery drivers to be briefed on Goods-In placement requirements.",
    recommendations:"Issue formal OH restriction notice for Daniel — no solo lifting > 10 kg pending full review. Add component placement instructions to delivery driver briefing pack. Install floor-level marking in Goods-In designating the only acceptable drop zone for mechanical handling. Conduct formal capability review.",
    photos:[],
    actions:[
      {id:"a059", description:"Issue OH restriction notice for Daniel Okonkwo — no solo lifting >10 kg pending formal review", owner:"Linda Osei", dueDate:"2026-01-10", priority:"critical", status:"complete"},
      {id:"a060", description:"Add Goods-In placement requirements to delivery driver briefing and driver pass system", owner:"Mark Davies", dueDate:"2026-01-24", priority:"high", status:"complete"},
      {id:"a061", description:"Install floor markings in Goods-In designating the only acceptable drop zone for mechanical handling access", owner:"Daniel Okonkwo", dueDate:"2026-01-24", priority:"high", status:"complete"},
    ]
  },
  i2602: {
    investigator:"Sarah Mitchell", investigationDate:"2026-01-13", status:"closed",
    summary:"Aisha Patel began using an angle grinder on the Production Floor on 11 January 2026 without a face shield. The PPE station had run out of face shields. This was the second angle grinder / face shield near-miss in 24 months on the Production Floor (see also i2405 and i2505). Investigation noted a persistent PPE stock management failure.",
    rootCause:"No minimum stock level had been set for face shields at the Production Floor PPE station. Replenishment was reactive rather than triggered by a minimum level. The PPE stores team had not been notified that shields were depleted before Aisha started the task.",
    contributingFactors:"Third grinding/face shield incident in 24 months. PPE station restocking was informal — no formal check schedule. Aisha proceeded without a face shield rather than stopping the task, suggesting normalisation. No 'PPE unavailable — stop task' procedure in place.",
    immediateActions:"Task stopped immediately. Aisha reminded of stop-task rule when PPE unavailable. Face shields sourced from main stores. PPE station restocked. All Production Floor staff briefed.",
    recommendations:"Set minimum stock levels for all PPE items at Production Floor station — auto-trigger reorder at minimum level. Introduce weekly PPE station check rota. Issue formal stop-task procedure — no PPE available = no task. Conduct PPE culture review across the production floor.",
    photos:[],
    actions:[
      {id:"a062", description:"Set minimum stock levels for all PPE at Production Floor station and introduce auto-reorder at minimum", owner:"Sarah Mitchell", dueDate:"2026-01-30", priority:"high", status:"complete"},
      {id:"a063", description:"Introduce weekly PPE station check and restock rota — assign responsibility", owner:"Mark Davies", dueDate:"2026-01-23", priority:"high", status:"complete"},
      {id:"a064", description:"Issue formal stop-task procedure poster at all PPE stations — 'No PPE = No Task'", owner:"Linda Osei", dueDate:"2026-01-23", priority:"medium", status:"complete"},
    ]
  },
  i2603: {
    investigator:"Sarah Mitchell", investigationDate:"2026-01-22", status:"in_progress",
    summary:"Ryan Fitzgerald was observed climbing the racking in Warehouse Racking Aisle on 19 January 2026 to retrieve a box from the top shelf rather than collecting an approved step ladder from the adjacent bay. This is a repeat unsafe act — climbing racking has been the subject of two previous incident reports (i2410 and i2506) and three toolbox talks.",
    rootCause:"Step ladders are stored in a bay adjacent to the racking area but the round trip to retrieve and return them takes approximately 4 minutes. Operatives perceive this as disproportionate for a quick pick. No physical control prevents access to the racking frame. The behaviour has not been effectively deterred by toolbox talks alone.",
    contributingFactors:"Third racking-climbing incident in 24 months. Previous interventions have been solely behavioural (toolbox talks, verbal warnings). No physical control has been implemented. Ryan had received all previous briefings. Pattern suggests systemic rather than individual failure.",
    immediateActions:"Ryan challenged and stood down from task. Step ladder retrieved and used for the remainder of the task. Shift supervisor briefed. Ryan given formal written warning.",
    recommendations:"Install step ladder parking brackets immediately adjacent to each racking aisle so ladders are always within 5 metres. Consider anti-climb racking upright guards. Review disciplinary approach — third incident may warrant a higher-level response.",
    photos:[],
    actions:[
      {id:"a065", description:"Install step ladder parking hooks at the end of each racking aisle — 6 hooks required", owner:"Daniel Okonkwo", dueDate:"2026-02-13", priority:"high", status:"open"},
      {id:"a066", description:"Source and price anti-climb racking upright guards — present options to H&S Manager", owner:"Daniel Okonkwo", dueDate:"2026-02-13", priority:"medium", status:"open"},
      {id:"a067", description:"HR to review disciplinary approach for repeat racking climbing incidents — consider escalated action", owner:"Linda Osei", dueDate:"2026-02-06", priority:"high", status:"complete"},
    ]
  },
  i2607: {
    investigator:"Linda Osei", investigationDate:"2026-02-24", status:"closed",
    summary:"Aisha Patel's hand was caught in the packaging machine on the main Packaging Line on 21 February 2026 — her fourth injury/near-miss involving packaging machinery in 24 months (see i2409, i2509, i2532). She sustained lacerations to two fingers of her left hand. RIDDOR three-day injury submitted. The incident occurred during a running product check.",
    rootCause:"Despite repeated investigations and corrective actions, in-running product checks on the Packaging Line continue to result in hand contact incidents. The fundamental issue is that the task design allows hands to be near the danger zone while the machine is running. Engineering controls introduced following i2509 had been partially defeated by a further undocumented machine modification.",
    contributingFactors:"Fourth packaging hand incident. Undocumented machine modification had removed a secondary finger guard fitted after i2509. Management of change process was still not being consistently applied. Aisha's fitness to remain on packaging line duties requires formal review given the frequency of incidents.",
    immediateActions:"Machine isolated and taken out of service. Aisha given first aid and taken to hospital — sutured. RIDDOR submitted. Machine inspected by engineering. Packaging Line shut down pending full safety review.",
    recommendations:"Full engineering review of Packaging Line — produce safe operating envelope. Remove in-running product check task entirely — introduce automated vision system. Formal capability/role review for Aisha with OH involvement. Management of change process to be enforced with engineering sign-off.",
    photos:[],
    actions:[
      {id:"a068", description:"Commission full engineering safety review of Packaging Line — produce safe operating envelope document", owner:"Daniel Okonkwo", dueDate:"2026-03-21", priority:"critical", status:"complete"},
      {id:"a069", description:"Procure automated vision inspection system to replace in-running manual product checks — get 3 quotes", owner:"Mark Davies", dueDate:"2026-03-21", priority:"critical", status:"open"},
      {id:"a070", description:"Formal OH and capability review for Aisha Patel — fourth packaging incident", owner:"Linda Osei", dueDate:"2026-03-07", priority:"critical", status:"complete"},
      {id:"a071", description:"Enforce management of change — engineering sign-off required for any machine modification, enforced via PTW", owner:"Linda Osei", dueDate:"2026-03-07", priority:"high", status:"complete"},
    ]
  },
  i2610: {
    investigator:"Linda Osei", investigationDate:"2026-03-28", status:"in_progress",
    summary:"On 25 March 2026, Daniel Okonkwo was observed in the Electrical Panel Room with the panel door open and live conductors exposed, reaching inside without having isolated the supply. When challenged, Daniel explained he was performing a visual diagnostic check and believed the panel cover gave sufficient isolation. This is particularly concerning given Daniel's history of manual handling injuries and suggests a broader pattern of risk underestimation.",
    rootCause:"Daniel was not following the site electrical safety rules, which prohibit any work or inspection within 300mm of live conductors without isolation. He had been trained on electrical safety but appeared to have developed a personal risk threshold that was inconsistent with the rules.",
    contributingFactors:"Daniel has been involved in five reported incidents in 24 months across different risk categories — manual handling and electrical. This pattern suggests a systemic issue with his risk perception. No formal safety culture review had been triggered by the accumulation of incidents.",
    immediateActions:"Work stopped. Daniel challenged and removed from electrical area. Incident documented. Panel door secured. Immediate review of Daniel's recent activities initiated.",
    recommendations:"Formal performance and safety culture review for Daniel Okonkwo — five incidents in 24 months. Consider enhanced supervision or role modification. Mandatory refresher on electrical safety rules. Broader review of whether training alone is sufficient to change risk behaviour.",
    photos:[],
    actions:[
      {id:"a072", description:"Arrange formal safety performance review meeting for Daniel Okonkwo with H&S Manager and line manager", owner:"Linda Osei", dueDate:"2026-04-11", priority:"critical", status:"complete"},
      {id:"a073", description:"Mandatory electrical safety rules refresher for Daniel — confirm understanding in writing", owner:"Linda Osei", dueDate:"2026-04-04", priority:"critical", status:"complete"},
      {id:"a074", description:"Review Daniel's supervision level — consider enhanced monitoring for 3-month period", owner:"Mark Davies", dueDate:"2026-04-11", priority:"high", status:"open"},
      {id:"a075", description:"Engage occupational health to assess whether underlying factors are contributing to Daniel's risk behaviour", owner:"Linda Osei", dueDate:"2026-04-18", priority:"high", status:"open"},
    ]
  },
  i2611: {
    investigator:"Sarah Mitchell", investigationDate:"2026-04-05", status:"closed",
    summary:"Liam Harrison tripped over a trailing IT network cable in Stairwell B on 3 April 2026 — an almost identical incident to i2415 in June 2024. On this occasion the cable had been run by an internal IT technician rather than a contractor. Liam sustained bruised knee and wrist. The same stairwell was the scene of the previous trip.",
    rootCause:"Despite the contractor induction update and cable ramp purchase following i2415, the requirement to cover cables in stairwells was not communicated to internal IT staff. The internal maintenance procedure for cable runs did not include a step to cover cables in circulation routes.",
    contributingFactors:"Second trip on trailing cable in Stairwell B. The corrective action from i2415 addressed contractors only — internal staff were not included. Cable ramps purchased after i2415 were stored at reception for contractor use and were not accessible to internal IT staff during out-of-hours work.",
    immediateActions:"Cable secured immediately using ramps from main stores. Liam assessed by first aider. IT team briefed. Cable ramps added to IT team equipment kit.",
    recommendations:"Extend cable management rules to all internal staff undertaking cable runs — update IT maintenance procedure. Issue cable ramps to IT team for internal use. Add Stairwell B cable check to end-of-day walkround.",
    photos:[],
    actions:[
      {id:"a076", description:"Update IT maintenance procedure — include cable cover requirement for all stairwells and circulation routes", owner:"Sarah Mitchell", dueDate:"2026-04-18", priority:"high", status:"complete"},
      {id:"a077", description:"Issue cable ramp set to IT team for permanent use during internal cable runs", owner:"Sarah Mitchell", dueDate:"2026-04-11", priority:"medium", status:"complete"},
    ]
  },
  i2613: {
    investigator:"Linda Osei", investigationDate:"2026-04-21", status:"in_progress",
    summary:"On 18 April 2026, Sarah Mitchell observed James Okafor bypassing the safety interlock on the warehouse sorting conveyor in the Warehouse Office. A cable tie had been used to hold the interlock closed — the same method used in i2514. This is the third interlock bypass incident in 24 months and the second involving James specifically.",
    rootCause:"Despite anti-tamper covers being installed after previous incidents and disciplinary action against James following i2514, James has again bypassed an interlock. Investigation found that the anti-tamper cover on this specific conveyor unit had cracked and was not providing effective deterrence. The interlock also had a known fault that caused intermittent false trips — which James used to justify the bypass.",
    contributingFactors:"Third site interlock bypass. Second involving James. Anti-tamper cover failure not identified during routine checks. Ongoing interlock fault had not been escalated for repair. Production culture continues to incentivise workarounds over stoppages.",
    immediateActions:"Interlock reinstated. James suspended from site pending disciplinary — potential gross misconduct. Machine inspected. Anti-tamper cover replaced. Known interlock fault escalated for immediate repair.",
    recommendations:"Repair conveyor interlock fault as matter of urgency. Introduce monthly anti-tamper cover inspection. Implement engineering solution to prevent bypass even if cover is damaged. Formal disciplinary process for James — consider gross misconduct given repeat behaviour.",
    photos:[],
    actions:[
      {id:"a078", description:"Repair known fault on warehouse office conveyor interlock — within 48 hours", owner:"Daniel Okonkwo", dueDate:"2026-04-23", priority:"critical", status:"complete"},
      {id:"a079", description:"Introduce monthly anti-tamper cover inspection schedule — include in monthly H&S check", owner:"Linda Osei", dueDate:"2026-05-02", priority:"high", status:"open"},
      {id:"a080", description:"Engineering review — identify design solution to prevent interlock bypass even if cover is missing or damaged", owner:"Daniel Okonkwo", dueDate:"2026-05-16", priority:"high", status:"open"},
      {id:"a081", description:"HR to progress formal disciplinary for James Okafor — second interlock bypass, potential gross misconduct", owner:"Linda Osei", dueDate:"2026-04-28", priority:"critical", status:"complete"},
    ]
  },
  i2614: {
    investigator:"Rachel Nguyen", investigationDate:"2026-04-28", status:"in_progress",
    summary:"During a routine internal audit on 25 April 2026, Rachel Nguyen identified that two chemical products in the Chemical Store were stored in adjacent bays in contravention of the COSHH segregation plan. This is the third such finding in 24 months (see also i2414 and i2515). One product was an oxidising agent and the other a flammable solvent — a serious fire and chemical reaction risk.",
    rootCause:"The Chemical Store segregation plan was last reviewed in 2022. Since then, new products have been introduced that were not added to the segregation plan. Goods-In staff placing new chemicals in the store do not have access to the current segregation plan and use available space rather than the designated bays.",
    contributingFactors:"Third chemical segregation incident in 24 months. Segregation plan is not posted in the store. New products are introduced without a COSHH assessment being completed before first use. Goods-In and Chemical Store responsibilities are not clearly delineated.",
    immediateActions:"Products immediately separated and relocated to correct segregation bays. Area ventilated. All Chemical Store users briefed on the segregation plan. Store supervisor identified and briefed.",
    recommendations:"Update and post segregation plan in the Chemical Store. Introduce a new product introduction procedure requiring COSHH assessment and segregation plan update before first use. Assign a Chemical Store Responsible Person with monthly inspection duties.",
    photos:[],
    actions:[
      {id:"a082", description:"Update COSHH segregation plan and post laminated copy inside Chemical Store entrance", owner:"Rachel Nguyen", dueDate:"2026-05-09", priority:"high", status:"open"},
      {id:"a083", description:"Introduce new product introduction procedure — COSHH assessment and segregation plan update required before first use", owner:"Linda Osei", dueDate:"2026-05-16", priority:"high", status:"open"},
      {id:"a084", description:"Assign a Chemical Store Responsible Person — monthly inspection with sign-off record", owner:"Mark Davies", dueDate:"2026-05-09", priority:"medium", status:"open"},
    ]
  },
  i2615: {
    investigator:"Sarah Mitchell", investigationDate:"2026-05-06", status:"in_progress",
    summary:"Tom Bradley reported on 2 May 2026 that the handrail on the Loading Bay Ramp was loose. Investigation confirmed the lower mounting bracket had corroded and the handrail had 40mm of play. This is the second handrail defect report in 24 months — a loose handrail was reported at the same location in July 2024 (i2419) and repaired, but the repair used a like-for-like standard bracket which was not adequate for the marine-environment loading bay.",
    rootCause:"The repair following i2419 used a standard mild steel bracket without a hot-dip galvanised or stainless finish. The loading bay is exposed to weather, salt, and vehicle wash-down, creating an accelerated corrosion environment. The specified repair standard was inadequate.",
    contributingFactors:"Second handrail defect at the same location. Repair specification was not reviewed against the environmental conditions. No scheduled inspection of the repaired handrail was put in place following the first repair.",
    immediateActions:"Handrail taped off and access restricted to one-person-at-a-time with the adjacent handrail used. Urgent repair commissioned.",
    recommendations:"Replace handrail bracket with marine-grade stainless steel. Include loading bay handrails in 3-monthly corrosion inspection. Issue repair specification guidance — corrosion-prone environments require marine-grade fixings.",
    photos:[],
    actions:[
      {id:"a085", description:"Replace loading bay ramp handrail bracket with marine-grade stainless steel — urgent", owner:"Daniel Okonkwo", dueDate:"2026-05-16", priority:"critical", status:"open"},
      {id:"a086", description:"Add loading bay handrails to 3-monthly corrosion inspection schedule", owner:"Sarah Mitchell", dueDate:"2026-05-23", priority:"medium", status:"open"},
      {id:"a087", description:"Issue repair specification note — marine-grade fixings required for all external and loading bay repairs", owner:"Linda Osei", dueDate:"2026-05-23", priority:"low", status:"open"},
    ]
  },
  i2616: {
    investigator:"Linda Osei", investigationDate:"2026-05-09", status:"in_progress",
    summary:"Sarah Mitchell (Operations Coordinator) cut her hand on an exposed metal edge on a damaged machine guard in the Packing Area on 7 May 2026. The guard had been damaged when struck by a pallet truck 3 weeks earlier. It had been flagged on the weekly walkround but categorised as 'amber — monitor' rather than 'red — remove from service'. Sarah was unaware of the defect when she reached past the guard.",
    rootCause:"The machine guard had a known damage defect that was categorised as amber on the weekly walkround report. The amber category did not trigger an immediate out-of-service decision. The damaged edge was sharp and presented a laceration risk that should have been assessed as red.",
    contributingFactors:"The walkround risk categorisation criteria did not include guidance on when a damaged guard edge constitutes a red (remove from service) item. The walkround was not shared with all people working in the area. Sarah was not aware of the known defect when she approached the machine.",
    immediateActions:"Machine taken out of service. Guard removed pending replacement. Sarah assessed by first aider — minor laceration, no hospital treatment. Defect communicated to all Packing Area staff.",
    recommendations:"Update walkround criteria — damaged guard edge = automatic red. Introduce area defect notice board — known defects visible to all staff. Review all current amber-rated guard defects for immediate reassessment.",
    photos:[],
    actions:[
      {id:"a088", description:"Update walkround criteria — any damaged guard edge = automatic red, out-of-service immediately", owner:"Linda Osei", dueDate:"2026-05-20", priority:"high", status:"open"},
      {id:"a089", description:"Install area defect notice board in Packing Area — all known defects visible to staff entering area", owner:"Mark Davies", dueDate:"2026-05-20", priority:"medium", status:"open"},
      {id:"a090", description:"Reassess all current amber-rated guard defects across site — upgrade to red where appropriate", owner:"Sarah Mitchell", dueDate:"2026-05-16", priority:"high", status:"open"},
    ]
  },
};


export { INIT_INVESTIGATIONS };
