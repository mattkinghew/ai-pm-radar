import {readFileSync,writeFileSync} from "node:fs";
const base="experiments/phase15-source-sync/pilot-ui/";
const html=readFileSync(base+"index.html","utf8"),js=readFileSync(base+"app.js","utf8");
if(!html.includes("PHASE 1.5B")||!html.includes("Cloudflare Access")||!js.includes("DELETE_THIS_SOURCE"))
 throw Error("Wrong or incomplete Phase1.5B frontend");
writeFileSync(base+"embedded.mjs",
 "export const MULTI_SOURCE_HTML="+JSON.stringify(html)+";\n"+
 "export const MULTI_SOURCE_JS="+JSON.stringify(js)+";\n");
console.log("Phase15B inline protected assets packed",html.length,js.length);
