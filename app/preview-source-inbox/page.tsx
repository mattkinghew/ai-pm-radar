"use client";

import dynamic from "next/dynamic";

// Client-only mount prevents synthetic records with runtime-generated
// fingerprints from causing static-export hydration mismatch on protected Preview.
const ActualWorkbench = dynamic(
  () => import("@/components/SourceInboxWorkbench")
    .then((module) => module.SourceInboxWorkbench),
  { ssr: false, loading: () => <main className="container section" role="status">正在啟動安全來源工作台…</main> },
);

export default function SyntheticActualSourceInboxPage() {
  return <ActualWorkbench syntheticPreview />;
}
