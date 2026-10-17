import { Header } from "@/components/Header";
import { SourceInboxWorkbench } from "@/components/SourceInboxWorkbench";

export default function SourceInboxPage() {
  return (
    <>
      <Header currentPath="/source-inbox" />
      <SourceInboxWorkbench />
    </>
  );
}
