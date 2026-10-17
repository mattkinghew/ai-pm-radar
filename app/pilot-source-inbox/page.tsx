"use client";
import dynamic from "next/dynamic";

const RealPilotWorkbench=dynamic(
  ()=>import("@/components/SourceInboxWorkbench").then(m=>m.SourceInboxWorkbench),
  {ssr:false,loading:()=> <main className="container section" role="status">正在驗證雲端文章並載入獨立 Source Inbox…</main>}
);
export default function PilotSourceInboxPage(){
  return <RealPilotWorkbench realPilotPreview/>;
}
