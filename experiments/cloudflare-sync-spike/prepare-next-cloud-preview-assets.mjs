import {cp,mkdir,rm,readFile,readdir,stat,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
const root=resolve(import.meta.dirname);
const stage=resolve(process.argv[2]||"/tmp/radar-build-20261013.HV41/out");
const output=resolve(process.argv[3]||join(root,".phase12c3-assets"));
const html=join(stage,"preview-source-inbox","index.html");
if(!(await stat(html)).isFile())throw Error("Isolated compiled Next.js source inbox must exist.");
const content=await readFile(html,"utf8");
if(!content.includes("正在啟動安全來源工作台")||!content.includes("_next/static/chunks")){
 throw Error("Build does not contain synthetic React workbench and Next.js CSS/JS assets.");
}
await rm(output,{recursive:true,force:true});
await mkdir(join(output,"preview-source-inbox"),{recursive:true});
await cp(html,join(output,"preview-source-inbox","index.html"));
await cp(join(stage,"_next","static"),join(output,"_next","static"),{recursive:true});
let files=0,bytes=0;
async function tally(dir){
 for(const dirent of await readdir(dir,{withFileTypes:true})){
  const target=join(dir,dirent.name);
  if(dirent.isDirectory())await tally(target);
  else if(dirent.isFile()){files++;bytes+=(await stat(target)).size}
 }
}
await tally(output);
if(files<5||files>500||bytes>10_000_000)throw Error("Unexpected static assets size.");
console.log(JSON.stringify({files,bytes,route:"/preview-source-inbox/",run_worker_first:true}));
