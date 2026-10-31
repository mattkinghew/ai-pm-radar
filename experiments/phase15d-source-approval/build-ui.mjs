import {readFileSync,writeFileSync} from "node:fs";
const root="experiments/phase15d-source-approval/";
const html=readFileSync(root+"pilot-ui/index.html","utf8");
const app=readFileSync(root+"pilot-ui/app.js","utf8");
const engine=readFileSync(root+"engine.mjs","utf8").replace(
 'from "../phase15c-real-governance/engine.mjs";',
 'from "/real-source-readiness/engine.js";');
if(!html.includes("Per-source Approval")||!engine.includes('from "/real-source-readiness/engine.js";')
  ||!app.includes("assessBoundFiles")||app.includes("fetch("))
 throw Error("Shadow approval UI is incomplete or introduces network fetch");
writeFileSync(root+"pilot-ui/embedded.mjs",
 "export const SHADOW_HTML="+JSON.stringify(html)+";\n"+
 "export const SHADOW_JS="+JSON.stringify(app)+";\n"+
 "export const SHADOW_ENGINE="+JSON.stringify(engine)+";\n");
console.log("Shadow approval static UI source packed; no article bytes",html.length,app.length,engine.length);
