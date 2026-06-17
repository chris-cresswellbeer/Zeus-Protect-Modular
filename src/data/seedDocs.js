const HS_DOCS = [
  { id:"d1", title:"Zeus Health & Safety Policy Statement",      date:"2024-01-15", size:"245 KB", type:"Policy"         },
  { id:"d2", title:"Risk Assessment — Warehouse Operations",     date:"2024-03-02", size:"512 KB", type:"Risk Assessment" },
  { id:"d3", title:"Emergency Evacuation Procedures",            date:"2024-02-20", size:"189 KB", type:"Procedure"       },
  { id:"d4", title:"Accident & Near-Miss Reporting Form",        date:"2024-01-10", size:"98 KB",  type:"Form"            },
  { id:"d5", title:"PPE Requirements by Role",                   date:"2024-04-01", size:"320 KB", type:"Guidance"        },
];

const INIT_ASSIGN = {
  1:  ["m1","m2","m4","m5"],
  2:  ["m1","m2","m3","m5"],
  3:  ["m1","m4","m6"],
  5:  ["m1","m2","m3","m5"],
  6:  ["m1","m2","m3","m4","m5"],
  7:  ["m1","m2","m5"],
  8:  ["m1","m4","m5","m6"],
  9:  ["m1","m2","m3","m5"],
  10: ["m1","m4","m6"],
  11: ["m1","m2","m4","m5","m6"],
  12: ["m1","m4","m5"],
  13: ["m1","m2","m3"],
  14: ["m1","m4","m5"],
};

const INIT_COMPLETE = {
  1:  { m1:{score:92,date:"2024-05-10",certId:"ZSL-1M12A4B7"}, m2:{score:88,date:"2022-11-14",certId:"ZSL-1M23C8D1"}, m4:{score:75,date:"2024-06-01",certId:"ZSL-1M45E2F9"} },
  2:  { m1:{score:100,date:"2023-04-12",certId:"ZSL-2M16G3H5"}, m2:{score:80,date:"2023-05-18",certId:"ZSL-2M27I4J0"} },
  3:  { m1:{score:85,date:"2025-02-08",certId:"ZSL-3M18K5L2"} },
  5:  { m1:{score:70,date:"2023-06-02",certId:"ZSL-5M19M6N3"} },
  6:  { m1:{score:95,date:"2025-04-22",certId:"ZSL-6M1AO7P4"}, m2:{score:90,date:"2023-02-25",certId:"ZSL-6M2BQ8R5"}, m3:{score:78,date:"2025-05-01",certId:"ZSL-6M3CS9T6"}, m4:{score:82,date:"2024-05-10",certId:"ZSL-6M4DU0V7"}, m5:{score:88,date:"2023-05-20",certId:"ZSL-6M5EW1X8"} },
  7:  {},
  8:  { m1:{score:100,date:"2025-01-05",certId:"ZSL-8M1FY2Z9"}, m4:{score:91,date:"2024-05-12",certId:"ZSL-8M4GA3B0"}, m5:{score:76,date:"2022-09-28",certId:"ZSL-8M5HC4D1"}, m6:{score:83,date:"2024-06-03",certId:"ZSL-8M6IE5F2"} },
  9:  { m1:{score:65,date:"2024-06-10"}, m2:{score:72,date:"2024-06-12"} },
  10: { m1:{score:88,date:"2023-10-20",certId:"ZSL-A1M1JG6H3"}, m4:{score:79,date:"2024-05-27",certId:"ZSL-A1M4KH7I4"} },
  11: { m1:{score:95,date:"2025-03-15",certId:"ZSL-B1M1LI8J5"}, m2:{score:85,date:"2023-04-18",certId:"ZSL-B1M2MJ9K6"}, m4:{score:90,date:"2024-04-22",certId:"ZSL-B1M4NK0L7"} },
  12: { m1:{score:60,date:"2023-08-08"} },
  13: {},
  14: { m1:{score:100,date:"2024-11-30",certId:"ZSL-E1M1OM1N8"}, m4:{score:88,date:"2024-06-05",certId:"ZSL-E1M4PN2O9"}, m5:{score:94,date:"2023-01-10",certId:"ZSL-E1M5QO3P0"} },
};

export { HS_DOCS, INIT_ASSIGN, INIT_COMPLETE };
