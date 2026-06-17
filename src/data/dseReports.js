import { DSE_SECTIONS } from "./seedDse";

function makeDseReport(userId, userName, answers, comments, date) {
  const issues = [];
  DSE_SECTIONS.forEach(sec => {
    sec.questions.forEach(q => {
      const isIssue = q.flagOnYes ? answers[q.id] === true : answers[q.id] === false;
      if (isIssue) {
        issues.push({
          section: sec.title,
          sectionIcon: sec.icon,
          question: q.text,
          risk: q.risk,
          comment: comments[q.id] || "",
        });
      }
    });
  });
  const totalQuestions = DSE_SECTIONS.reduce((s,sec)=>s+sec.questions.length,0);
  return [{ userId, userName, date, answers, issues, issueCount: issues.length, totalQuestions }];
}

const INIT_DSE_REPORTS = {
  // 1. Sarah Mitchell — screen glare, eye strain
  1: makeDseReport(1, "Sarah Mitchell", {
    chair_height:true, chair_back:true, chair_stable:true, chair_arms:true, chair_comfort:true,
    screen_height:true, screen_dist:true, screen_tilt:true, screen_clean:true, screen_glare:false,
    kb_position:true, kb_space:true, kb_clean:true, mouse_pos:true, mouse_comfort:true,
    desk_space:true, desk_height:true, doc_holder:true, desk_lighting:true, desk_cables:true,
    env_temp:true, env_noise:true, env_space:true, env_ventilation:true, env_emergency:true,
    sw_suitable:true, sw_pace:true, sw_breaks:true, sw_training:true, sw_feedback:true,
    h_eyes:true, h_back:false, h_arms:false, h_stress:false, h_glasses:true,
  }, {
    screen_glare: "Large window directly to my left causes significant afternoon glare. The blind is broken and cannot be adjusted.",
    h_eyes: "Afternoon headaches, especially on days with heavy report writing. Haven't had an eye test in a while and think I may need glasses for screen work.",
  }, "2024-11-15"),

  // 2. James Okafor — no doc holder, back pain from warehouse to desk transitions
  2: makeDseReport(2, "James Okafor", {
    chair_height:true, chair_back:false, chair_stable:true, chair_arms:false, chair_comfort:true,
    screen_height:false, screen_dist:true, screen_tilt:true, screen_clean:true, screen_glare:true,
    kb_position:true, kb_space:true, kb_clean:true, mouse_pos:true, mouse_comfort:true,
    desk_space:false, desk_height:true, doc_holder:false, desk_lighting:true, desk_cables:false,
    env_temp:true, env_noise:true, env_space:true, env_ventilation:true, env_emergency:true,
    sw_suitable:true, sw_pace:true, sw_breaks:true, sw_training:true, sw_feedback:true,
    h_eyes:false, h_back:true, h_arms:false, h_stress:false, h_glasses:true,
  }, {
    chair_back: "The backrest on my chair doesn't lock in position — it reclines too easily. I end up leaning forward most of the time.",
    chair_arms: "No armrests on my chair. My shoulders ache after long periods at the desk.",
    screen_height: "My screen sits flat on the desk with no riser. I have to look down at it which causes neck ache by the afternoon.",
    desk_space: "My desk is very cluttered — shared with another colleague and there isn't enough room for all our equipment.",
    doc_holder: "No document holder available. I frequently cross-reference paper documents with the screen.",
    desk_cables: "Cable management is poor under my desk — I've tripped on a loose cable twice.",
    h_back: "Regular lower back pain, particularly after days when I've also been doing warehouse work. Think the combination of lifting and then sitting is causing issues.",
  }, "2024-11-18"),

  // 3. Priya Sharma — mostly fine, software/pace concern
  3: makeDseReport(3, "Priya Sharma", {
    chair_height:true, chair_back:true, chair_stable:true, chair_arms:true, chair_comfort:true,
    screen_height:true, screen_dist:true, screen_tilt:true, screen_clean:true, screen_glare:true,
    kb_position:true, kb_space:true, kb_clean:true, mouse_pos:true, mouse_comfort:true,
    desk_space:true, desk_height:true, doc_holder:true, desk_lighting:true, desk_cables:true,
    env_temp:true, env_noise:true, env_space:true, env_ventilation:true, env_emergency:true,
    sw_suitable:false, sw_pace:false, sw_breaks:true, sw_training:true, sw_feedback:true,
    h_eyes:false, h_back:false, h_arms:false, h_stress:true, h_glasses:true,
  }, {
    sw_suitable: "The HR system we use is very outdated and crashes regularly. Simple tasks take much longer than they should which is very frustrating.",
    sw_pace: "Month-end reporting deadlines are extremely pressurised — I regularly work through lunch for the last week of each month.",
    h_stress: "The combination of system issues and month-end pressure is becoming a regular source of stress. I've started to dread the last week of the month.",
  }, "2024-12-03"),

  // 5. Tom Bradley — chair issues, keyboard position, back pain, stress
  5: makeDseReport(5, "Tom Bradley", {
    chair_height:false, chair_back:false, chair_stable:true, chair_arms:true, chair_comfort:true,
    screen_height:true, screen_dist:true, screen_tilt:true, screen_clean:true, screen_glare:true,
    kb_position:false, kb_space:true, kb_clean:true, mouse_pos:true, mouse_comfort:true,
    desk_space:true, desk_height:true, doc_holder:true, desk_lighting:true, desk_cables:true,
    env_temp:true, env_noise:true, env_space:true, env_ventilation:true, env_emergency:true,
    sw_suitable:true, sw_pace:true, sw_breaks:true, sw_training:true, sw_feedback:true,
    h_eyes:false, h_back:true, h_arms:false, h_stress:true, h_glasses:true,
  }, {
    chair_height: "Chair won't go high enough — I'm 6'3 and even at maximum height my knees are above hip level. Raised this before with no action taken.",
    chair_back: "Lumbar adjustment is broken. Backrest just flops backwards. Have been using a rolled-up jacket as support for months.",
    kb_position: "Keyboard sits on a fixed, non-removable drawer which forces me to reach forward and upward. Causes significant shoulder ache.",
    h_back: "Lower back ache by mid-afternoon on most days. Certain it's related to the chair height — can't get into a proper seated position.",
    h_stress: "Workload has been very high with the new project. Not sleeping well and struggling to switch off evenings and weekends.",
  }, "2024-12-02"),

  // 6. Aisha Patel — all clear
  6: makeDseReport(6, "Aisha Patel", {
    chair_height:true, chair_back:true, chair_stable:true, chair_arms:true, chair_comfort:true,
    screen_height:true, screen_dist:true, screen_tilt:true, screen_clean:true, screen_glare:true,
    kb_position:true, kb_space:true, kb_clean:true, mouse_pos:true, mouse_comfort:true,
    desk_space:true, desk_height:true, doc_holder:true, desk_lighting:true, desk_cables:true,
    env_temp:true, env_noise:true, env_space:true, env_ventilation:true, env_emergency:true,
    sw_suitable:true, sw_pace:true, sw_breaks:true, sw_training:true, sw_feedback:true,
    h_eyes:false, h_back:false, h_arms:false, h_stress:false, h_glasses:true,
  }, {}, "2024-11-20"),

  // 7. Connor Walsh — no fixed workstation, mobile worker using laptops
  7: makeDseReport(7, "Connor Walsh", {
    chair_height:false, chair_back:false, chair_stable:false, chair_arms:false, chair_comfort:false,
    screen_height:false, screen_dist:true, screen_tilt:false, screen_clean:true, screen_glare:false,
    kb_position:false, kb_space:false, kb_clean:true, mouse_pos:false, mouse_comfort:false,
    desk_space:false, desk_height:false, doc_holder:false, desk_lighting:false, desk_cables:true,
    env_temp:false, env_noise:false, env_space:false, env_ventilation:true, env_emergency:true,
    sw_suitable:true, sw_pace:true, sw_breaks:true, sw_training:true, sw_feedback:true,
    h_eyes:false, h_back:true, h_arms:true, h_stress:false, h_glasses:true,
  }, {
    chair_height: "As a driver I don't have a fixed desk workstation — when I do office paperwork I use whatever chair is available in the back office.",
    chair_back: "The back-office chairs have no lumbar support at all. Very uncomfortable for any extended time.",
    chair_stable: "One of the back-office chairs wobbles — has done for months.",
    chair_arms: "No armrests on any of the available chairs in the back office.",
    chair_comfort: "The available seating in the back office is clearly not designed for prolonged use.",
    screen_height: "When doing admin on a laptop in the back office there's no riser or docking station — screen is always too low.",
    screen_tilt: "Can't tilt the laptop screen adequately — it's at a fixed angle and reflects the overhead lights.",
    kb_position: "Using a laptop keyboard flat on the desk means my wrists are bent upward which is uncomfortable.",
    kb_space: "No space to rest wrists — desk in the back office is too small.",
    mouse_pos: "No mouse provided — using trackpad only which is uncomfortable for extended work.",
    mouse_comfort: "Trackpad use causes my wrist to ache after 30 minutes.",
    desk_space: "Back office desk is shared and always cluttered.",
    desk_height: "Desk is too low for me — I'm quite tall and have to hunch forward.",
    doc_holder: "No document holder — not even a flat space to put documents next to the laptop.",
    desk_lighting: "Back office has one overhead strip light that flickers occasionally.",
    env_temp: "Back office is poorly ventilated and gets very warm in summer.",
    env_noise: "Back office is next to the vehicle bay — constant engine noise when vehicles are being loaded.",
    env_space: "Very cramped — often 3-4 people trying to use the space at once.",
    h_back: "Back ache is a regular issue — I think the combination of driving and then using poor seating makes it worse.",
    h_arms: "Wrist and forearm ache after paperwork sessions, particularly from trackpad use.",
  }, "2024-12-08"),

  // 8. Rachel Nguyen — noise, ventilation, wrist pain, outdated glasses
  8: makeDseReport(8, "Rachel Nguyen", {
    chair_height:true, chair_back:true, chair_stable:true, chair_arms:true, chair_comfort:true,
    screen_height:true, screen_dist:true, screen_tilt:true, screen_clean:true, screen_glare:true,
    kb_position:true, kb_space:false, kb_clean:true, mouse_pos:true, mouse_comfort:true,
    desk_space:true, desk_height:true, doc_holder:true, desk_lighting:true, desk_cables:true,
    env_temp:true, env_noise:false, env_space:true, env_ventilation:false, env_emergency:true,
    sw_suitable:true, sw_pace:true, sw_breaks:true, sw_training:true, sw_feedback:true,
    h_eyes:false, h_back:false, h_arms:true, h_stress:false, h_glasses:false,
  }, {
    kb_space: "No space in front of keyboard to rest wrists. Desk is too small for all my equipment — monitors, keyboard, mouse, and reference materials.",
    env_noise: "Open plan gets very loud in the afternoons when the sales team are on calls. I often can't concentrate and have started getting tension headaches from the noise.",
    env_ventilation: "Air con in my area is too cold all day. My eyes are very dry by end of day and I get a sore throat regularly.",
    h_arms: "Tingling and numbness in my right wrist and fingers, especially in the mornings. Has been getting progressively worse over the last 3 months.",
    h_glasses: "Glasses are 4 years old. Struggling to read small text clearly and think my prescription has changed — particularly for screen distance.",
  }, "2024-12-10"),

  // 9. Daniel Okonkwo — maintenance tech, temperature and lighting issues
  9: makeDseReport(9, "Daniel Okonkwo", {
    chair_height:true, chair_back:true, chair_stable:true, chair_arms:true, chair_comfort:true,
    screen_height:true, screen_dist:true, screen_tilt:true, screen_clean:false, screen_glare:true,
    kb_position:true, kb_space:true, kb_clean:false, mouse_pos:true, mouse_comfort:true,
    desk_space:false, desk_height:true, doc_holder:false, desk_lighting:false, desk_cables:false,
    env_temp:false, env_noise:true, env_space:true, env_ventilation:true, env_emergency:true,
    sw_suitable:true, sw_pace:true, sw_breaks:true, sw_training:true, sw_feedback:false,
    h_eyes:false, h_back:false, h_arms:false, h_stress:false, h_glasses:true,
  }, {
    screen_clean: "Screen is very dusty and has some marks on it I can't remove. Affects visibility.",
    kb_clean: "Keyboard has debris in the keys — some keys are stiff or miss inputs occasionally. Requested a replacement 6 weeks ago.",
    desk_space: "My maintenance desk is used as a general drop-off area for parts and paperwork by the whole team. Never enough clear space to work.",
    doc_holder: "No document holder — I work from technical manuals and schematics regularly.",
    desk_lighting: "The overhead light above my desk has been flickering for 3 weeks. I've logged it with facilities but no repair yet.",
    desk_cables: "Multiple extension leads and cables under my desk from various equipment — a trip hazard. Not secured or managed.",
    env_temp: "Workshop is very cold in winter — the heating doesn't reach my area. I often work in a coat which restricts my movement.",
    sw_feedback: "Reporting equipment faults via the current system is slow and responses are inconsistent — sometimes nothing happens for weeks.",
  }, "2024-11-25"),

  // 10. Sophie Clarke — doc holder, minor
  10: makeDseReport(10, "Sophie Clarke", {
    chair_height:true, chair_back:true, chair_stable:true, chair_arms:true, chair_comfort:true,
    screen_height:true, screen_dist:true, screen_tilt:true, screen_clean:true, screen_glare:true,
    kb_position:true, kb_space:true, kb_clean:true, mouse_pos:true, mouse_comfort:true,
    desk_space:true, desk_height:true, doc_holder:false, desk_lighting:true, desk_cables:true,
    env_temp:true, env_noise:true, env_space:true, env_ventilation:true, env_emergency:true,
    sw_suitable:true, sw_pace:true, sw_breaks:true, sw_training:true, sw_feedback:true,
    h_eyes:false, h_back:false, h_arms:false, h_stress:false, h_glasses:true,
  }, {
    doc_holder: "I work from printed HR documents and policies frequently but have no document holder. Constant neck movement between desk documents and screen causes stiffness by end of day.",
  }, "2024-11-28"),

  // 11. Liam Harrison — supervisor pressure, skips breaks, stress
  11: makeDseReport(11, "Liam Harrison", {
    chair_height:true, chair_back:true, chair_stable:true, chair_arms:true, chair_comfort:true,
    screen_height:true, screen_dist:true, screen_tilt:true, screen_clean:true, screen_glare:true,
    kb_position:true, kb_space:true, kb_clean:true, mouse_pos:true, mouse_comfort:true,
    desk_space:true, desk_height:true, doc_holder:true, desk_lighting:true, desk_cables:true,
    env_temp:true, env_noise:true, env_space:true, env_ventilation:true, env_emergency:true,
    sw_suitable:true, sw_pace:false, sw_breaks:false, sw_training:true, sw_feedback:true,
    h_eyes:false, h_back:false, h_arms:false, h_stress:true, h_glasses:true,
  }, {
    sw_pace: "As shift supervisor I'm constantly dealing with operational issues. I rarely control my own pace of work — I react to problems all day.",
    sw_breaks: "I very rarely take a proper break. Usually eat lunch at my desk while answering messages or I skip it entirely. Same with screen breaks.",
    h_stress: "The responsibility of the role weighs on me, especially when we're short-staffed. I haven't felt able to raise this as I don't want to seem like I'm not coping. Have been getting tension headaches and disturbed sleep.",
  }, "2024-12-05"),

  // 12. Fatima Al-Hassan — screen distance, poor lighting, mild eye strain
  12: makeDseReport(12, "Fatima Al-Hassan", {
    chair_height:true, chair_back:true, chair_stable:true, chair_arms:true, chair_comfort:true,
    screen_height:true, screen_dist:false, screen_tilt:true, screen_clean:true, screen_glare:false,
    kb_position:true, kb_space:true, kb_clean:true, mouse_pos:true, mouse_comfort:true,
    desk_space:true, desk_height:true, doc_holder:true, desk_lighting:false, desk_cables:true,
    env_temp:true, env_noise:false, env_space:true, env_ventilation:true, env_emergency:true,
    sw_suitable:false, sw_pace:true, sw_breaks:true, sw_training:false, sw_feedback:true,
    h_eyes:true, h_back:false, h_arms:false, h_stress:false, h_glasses:false,
  }, {
    screen_dist: "My screen feels too close — it's on a shallow desk with not much depth. I find myself leaning back in my chair to get more distance.",
    screen_glare: "The window behind my screen means I often have a glare or halo effect around text when it's bright outside.",
    desk_lighting: "The overhead light in my area was replaced recently and the new one is much harsher and brighter. At the end of the day my eyes are very sore.",
    env_noise: "The customer services area is quite noisy — calls, notifications, and conversations overlap constantly. I use headphones but not ideal.",
    sw_suitable: "The CRM system we use crashes at least once a day and loses work. Extremely frustrating and time-consuming.",
    sw_training: "I never received formal training on the new CRM — had to figure it out myself. Still not confident I'm using it correctly.",
    h_eyes: "Eyes are red and sore most evenings. Headaches starting in the afternoon. I think the lighting change and screen proximity are both contributing.",
  }, "2024-12-11"),

  // 13. Ryan Fitzgerald — warehouse operative, same issues as Connor
  13: makeDseReport(13, "Ryan Fitzgerald", {
    chair_height:false, chair_back:false, chair_stable:true, chair_arms:false, chair_comfort:false,
    screen_height:false, screen_dist:true, screen_tilt:true, screen_clean:true, screen_glare:true,
    kb_position:false, kb_space:true, kb_clean:true, mouse_pos:true, mouse_comfort:true,
    desk_space:false, desk_height:false, doc_holder:false, desk_lighting:true, desk_cables:false,
    env_temp:true, env_noise:false, env_space:false, env_ventilation:true, env_emergency:true,
    sw_suitable:true, sw_pace:true, sw_breaks:true, sw_training:true, sw_feedback:false,
    h_eyes:false, h_back:true, h_arms:false, h_stress:false, h_glasses:true,
  }, {
    chair_height: "The only available chair in the warehouse office doesn't go high enough for my height. Feet flat on floor but thighs are angled down uncomfortably.",
    chair_back: "Chair backrest gives no lumbar support — just a flat plastic back.",
    chair_arms: "No armrests on the warehouse office chair.",
    chair_comfort: "The warehouse office chair is clearly designed for occasional short-term use, not for extended admin sessions.",
    screen_height: "Screen on warehouse PC sits directly on the desk with no riser. Have to look down constantly.",
    kb_position: "The keyboard position on the warehouse PC feels too low and slightly too far away — I end up hunching forward.",
    desk_space: "The warehouse office desk is extremely cluttered with order sheets, clipboards and equipment. Very little clear space.",
    desk_height: "Desk is quite low — combined with a non-adjustable chair makes it difficult to sit correctly.",
    doc_holder: "No document holder in the warehouse office.",
    desk_cables: "Cables behind the warehouse PC are tangled and a trip hazard — have seen people catch their foot on them.",
    env_noise: "The warehouse office has a thin partition from the loading bay — extremely noisy when vehicles are being loaded. Makes phone calls very difficult.",
    env_space: "Warehouse office is very small for the number of people who need to use it. Often 4-5 people in a tiny room.",
    sw_feedback: "Reporting IT problems in the warehouse takes forever — low priority apparently. The PC has been running slowly for months.",
    h_back: "My back is regularly stiff and sore — especially on days when I've been both warehouse picking and doing office admin. The different physical demands don't help each other.",
  }, "2024-12-09"),

  // 14. Mei Chen — all clear
  14: makeDseReport(14, "Mei Chen", {
    chair_height:true, chair_back:true, chair_stable:true, chair_arms:true, chair_comfort:true,
    screen_height:true, screen_dist:true, screen_tilt:true, screen_clean:true, screen_glare:true,
    kb_position:true, kb_space:true, kb_clean:true, mouse_pos:true, mouse_comfort:true,
    desk_space:true, desk_height:true, doc_holder:true, desk_lighting:true, desk_cables:true,
    env_temp:true, env_noise:true, env_space:true, env_ventilation:true, env_emergency:true,
    sw_suitable:true, sw_pace:true, sw_breaks:true, sw_training:true, sw_feedback:true,
    h_eyes:false, h_back:false, h_arms:false, h_stress:false, h_glasses:true,
  }, {}, "2024-12-01"),
};

export { makeDseReport, INIT_DSE_REPORTS };
