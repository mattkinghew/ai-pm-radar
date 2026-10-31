import {cp,mkdir,rm,readFile,readdir,stat} from "node:fs/promises";
import {resolve,join} from "node:path";
const root=resolve(import.meta.dirname);
const nextOut=resolve(process.argv[2]||"/tmp/radar-build-20261013.HV41/out");
const htmlFile=join(nextOut,"pilot-source-inbox","index.html");
const html=await readFile(htmlFile,"utf8");
if(!html.includes("正在驗證雲端文章")||!html.includes("_next/static/chunks")){
 throw Error("Build does not contain client-only actual React Pilot Source Inbox");
}
const target=join(root,".phase14-assets");
await rm(target,{force:true,recursive:true});
await mkdir(join(target,"pilot-source-inbox"),{recursive:true});
await cp(htmlFile,join(target,"pilot-source-inbox","index.html"));
await cp(join(nextOut,"_next","static"),join(target,"_next","static"),{recursive:true});
let bytes=0,count=0;
async function countAssets(folder){
 for(const e of await readdir(folder,{withFileTypes:true})){
  const path=join(folder,e.name);
  if(e.isDirectory())await countAssets(path);
  else if(e.isFile()){bytes+=(await stat(path)).size;count++}
 }
}
await countAssets(target);
if(count<5||count>500||bytes>10_000_000)throw Error("Unexpected assets too large");
console.log(JSON.stringify({route:"/pilot-source-inbox/",assets:count,bytes,
  asset_binding:"ASSETS",required_run_worker_first:true,upload_enabled:false}));
