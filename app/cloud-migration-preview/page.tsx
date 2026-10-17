import type { Metadata } from "next";
import { CloudMigrationPreflight } from "@/components/CloudMigrationPreflight";

export const metadata: Metadata = {
  title: "AI PM Radar — Cloud Migration Dry Run",
  robots: { index: false, follow: false },
};

export default function CloudMigrationPreviewPage() {
  return <CloudMigrationPreflight />;
}
