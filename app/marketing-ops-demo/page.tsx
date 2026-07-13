import { Header } from "@/components/Header";
import {
  MarketingOpsDemo,
  type MarketingOpsData,
} from "@/components/MarketingOpsDemo";
import demo from "@/data/marketing-ops/sample-campaign.json";

export default function MarketingOpsDemoPage() {
  return (
    <>
      <Header currentPath="/marketing-ops-demo" />
      <main className="container section">
        <MarketingOpsDemo demo={demo as MarketingOpsData} />
      </main>
    </>
  );
}
