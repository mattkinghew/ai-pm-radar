import { Header } from "@/components/Header";
import {
  IPWorkflowTracker,
  type ProjectData,
} from "@/components/IPWorkflowTracker";
import project from "@/data/ip-projects/sample-instructor.json";

export default function IPWorkflowPage() {
  return (
    <>
      <Header currentPath="/ip-workflow" />
      <main className="container section">
        <IPWorkflowTracker project={project as ProjectData} />
      </main>
    </>
  );
}
