import { USERS } from '../../src/data/seedUsers.js';
const firsts = ["Maya","Owen","Priya","Tom","Grace","Leo","Hannah","Sam","Nadia","Ben","Ellie","Kai","Ruth","Dev","Isla","Joe","Amira","Finn","Zara","Callum","Ivy","Rhys","Tara","Noah","Esme","Ravi","Lena","Jude","Mia","Arlo"];
const lasts = ["Holt","Barnes","Okafor","Reid","Lang","Mercer","Doyle","Patel","Frost","Quinn","Hale","Brennan","Walsh","Ashby","Kerr","Lowe","Sutton","Vance","Pike","Rowe","Marsh","Dunn","Gill","Tate","Shaw"];
const names = new Set(); USERS.forEach(u => { names.add(u.name); if (u.manager) names.add(u.manager); });
const pairs = [...names].filter(Boolean).sort((a,b)=>b.length-a.length).map((n,i) => [n, firsts[i%firsts.length]+' '+lasts[(i*7)%lasts.length]]);
pairs.push(['Admin User','Admin User']);
process.stdout.write(JSON.stringify(pairs));
