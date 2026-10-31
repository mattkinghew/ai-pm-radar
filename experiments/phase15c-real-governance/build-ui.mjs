import {readFileSync,writeFileSync} from "node:fs";
const root="experiments/phase15c-real-governance/";
const html=readFileSync(root+"pilot-ui/index.html","utf8");
const script=readFileSync(root+"pilot-ui/app.js","utf8");
const engine=readFileSync(root+"engine.mjs","utf8");
if(!html.includes("Real-source Sync Governance")||!script.includes("cloud_write_authorized")||!engine.includes("LOCAL_GOVERNANCE_REVIEWED"))
 throw Error("Wrong governance UI assets");
writeFileSync(root+"pilot-ui/embedded.mjs",
 "export const GOVERNANCE_HTML="+JSON.stringify(html)+";\n"+
 "export const GOVERNANCE_JS="+JSON.stringify(script)+";\n"+
 "export const GOVERNANCE_ENGINE="+JSON.stringify(engine)+";\n");
console.log("Protected governance assets packaged (not source article bytes)",html.length,script.length,engine.length);
