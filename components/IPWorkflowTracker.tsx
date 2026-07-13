export type WorkflowItem = {
  stage: string;
  status: "not_started" | "in_progress" | "blocked" | "done";
  owner: string;
  deliverable: string;
  deadline?: string;
  risk: string;
  next_action: string;
  acceptance_check?: string;
};

export type ContentPillar = {
  name: string;
  focus: string;
};

export type ProjectData = {
  project_name: string;
  client_type: string;
  business_goal: string;
  target_audience: string[];
  positioning: {
    summary: string;
    differentiation: string;
    proof_angle: string;
  };
  main_offer: {
    name: string;
    format: string;
    outcome: string;
  };
  workflow: WorkflowItem[];
  content_pillars: ContentPillar[];
  risk_controls: string[];
  success_metrics: string[];
};

const statusLabelMap: Record<WorkflowItem["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export function IPWorkflowTracker({ project }: { project: ProjectData }) {
  return (
    <div className="stack-xl">
      <section className="about-grid">
        <div className="stack-md">
          <p className="eyebrow">Portfolio demo</p>
          <h1>{project.project_name}</h1>
          <p className="lead">{project.business_goal}</p>
          <div className="meta-row">
            <span className="category-pill">Client: {project.client_type}</span>
            <span className="score-pill">Static JSON workflow</span>
            <span className="review-pill">Human review required</span>
          </div>
        </div>

        <div className="info-panel stack-md">
          <h2>Main offer</h2>
          <p>
            <strong>{project.main_offer.name}</strong>
          </p>
          <p>{project.main_offer.format}</p>
          <p>{project.main_offer.outcome}</p>
        </div>
      </section>

      <section className="grid-two">
        <article className="info-panel">
          <h2>Positioning</h2>
          <div className="stack-md">
            <p>{project.positioning.summary}</p>
            <p>
              <strong>Differentiation:</strong> {project.positioning.differentiation}
            </p>
            <p>
              <strong>Proof angle:</strong> {project.positioning.proof_angle}
            </p>
          </div>
        </article>

        <article className="info-panel">
          <h2>Target audience</h2>
          <ul className="bullet-list">
            {project.target_audience.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="stack-lg">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Workflow stages</p>
            <h2>Project tracking snapshot</h2>
          </div>
          <p className="section-note">
            This page demonstrates workflow checking, AI-assisted drafting, and
            approval gates using static portfolio data only.
          </p>
        </div>

        <div className="workflow-grid">
          {project.workflow.map((item) => (
            <article key={item.stage} className="workflow-card">
              <div className="workflow-card-head">
                <h3>{item.stage}</h3>
                <span className={`status-pill status-${item.status}`}>
                  {statusLabelMap[item.status]}
                </span>
              </div>

              <div className="stack-md">
                <p>
                  <strong>Owner:</strong> {item.owner}
                </p>
                {item.deadline ? (
                  <p>
                    <strong>Deadline:</strong> {item.deadline}
                  </p>
                ) : null}
                <p>
                  <strong>Deliverable:</strong> {item.deliverable}
                </p>
                <p>
                  <strong>Risk:</strong> {item.risk}
                </p>
                <p>
                  <strong>Next action:</strong> {item.next_action}
                </p>
                {item.acceptance_check ? (
                  <p>
                    <strong>Acceptance check:</strong> {item.acceptance_check}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid-two">
        <article className="info-panel">
          <h2>Content pillars</h2>
          <div className="stack-md">
            {project.content_pillars.map((pillar) => (
              <div key={pillar.name} className="detail-panel">
                <h3>{pillar.name}</h3>
                <p>{pillar.focus}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="info-panel">
          <h2>Success metrics</h2>
          <ul className="bullet-list">
            {project.success_metrics.map((metric) => (
              <li key={metric}>{metric}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid-two">
        <article className="info-panel">
          <h2>Risk controls</h2>
          <ul className="bullet-list">
            {project.risk_controls.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="info-panel">
          <h2>Demo boundaries</h2>
          <ul className="bullet-list">
            <li>Portfolio demo only, not a production SaaS workflow platform.</li>
            <li>Uses static local JSON instead of backend storage or live client data.</li>
            <li>Human review remains required before publishing or using sensitive examples.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
