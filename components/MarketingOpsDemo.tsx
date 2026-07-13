type FunnelMetrics = {
  reach: number;
  clicks: number;
  group_joins: number;
  messages_received: number;
  messages_replied: number;
  registrations: number;
  attendance: number;
  spend: number;
};

type CreativeReview = {
  creative_id: string;
  format: string;
  hook_text: string;
  caption: string;
  visual_description: string;
  first_3_seconds_description: string;
  performance_summary: string;
  possible_issue: string;
  ai_suggestion: string;
  next_action: string;
};

type AiOutputs = {
  weekly_report_draft: string[];
  ad_copy_ideas: string[];
  ppt_outline: string[];
  follow_up_suggestions: string[];
};

export type MarketingOpsData = {
  demo_name: string;
  audience_segments: string[];
  positioning: string;
  campaign_name: string;
  demo_boundaries: string[];
  funnel_metrics: FunnelMetrics;
  creative_analysis: CreativeReview[];
  ai_outputs: AiOutputs;
  risk_controls: string[];
};

const metricLabels: Array<[keyof FunnelMetrics, string]> = [
  ["reach", "Reach"],
  ["clicks", "Clicks"],
  ["group_joins", "Group joins"],
  ["messages_received", "Messages received"],
  ["messages_replied", "Messages replied"],
  ["registrations", "Registrations"],
  ["attendance", "Attendance"],
  ["spend", "Spend"],
];

export function MarketingOpsDemo({ demo }: { demo: MarketingOpsData }) {
  const derivedMetrics = [
    {
      label: "Group join rate",
      value: asPercent(demo.funnel_metrics.group_joins, demo.funnel_metrics.clicks),
    },
    {
      label: "Message reply rate",
      value: asPercent(
        demo.funnel_metrics.messages_replied,
        demo.funnel_metrics.messages_received,
      ),
    },
    {
      label: "Registration rate",
      value: asPercent(demo.funnel_metrics.registrations, demo.funnel_metrics.messages_received),
    },
    {
      label: "Attendance rate",
      value: asPercent(demo.funnel_metrics.attendance, demo.funnel_metrics.registrations),
    },
    {
      label: "Cost per lead",
      value: asCurrency(demo.funnel_metrics.spend, demo.funnel_metrics.registrations),
    },
    {
      label: "Cost per attendee",
      value: asCurrency(demo.funnel_metrics.spend, demo.funnel_metrics.attendance),
    },
  ];

  return (
    <div className="stack-xl">
      <section className="marketing-hero">
        <div className="marketing-hero-copy stack-md">
          <p className="eyebrow">Interview demo</p>
          <h1>{demo.demo_name}</h1>
          <p className="lead">{demo.positioning}</p>
          <div className="meta-row">
            <span className="category-pill">Static JSON dashboard</span>
            <span className="score-pill">Human review required</span>
            <span className="review-pill">No auto-publishing</span>
          </div>
        </div>

        <div className="info-panel stack-md marketing-summary-panel">
          <h2>{demo.campaign_name}</h2>
          <p>
            This page shows how AI PM Radar can be repositioned as an internal
            marketing operations dashboard for service businesses without adding a
            backend or exposing client data.
          </p>
          <div className="tag-row">
            {demo.audience_segments.map((segment) => (
              <span key={segment} className="tag">
                {segment}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid-two marketing-grid-wide">
        <article className="info-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Admin metrics</p>
              <h2>Campaign funnel snapshot</h2>
            </div>
            <p className="section-note">
              Lightweight operations metrics for admin follow-up, response quality,
              and attendance tracking.
            </p>
          </div>

          <div className="metrics-grid">
            {metricLabels.map(([key, label]) => (
              <div key={key} className="metric-card">
                <span className="metric-label">{label}</span>
                <strong className="metric-value">
                  {key === "spend"
                    ? formatMoney(demo.funnel_metrics[key])
                    : formatInteger(demo.funnel_metrics[key])}
                </strong>
              </div>
            ))}
          </div>
        </article>

        <article className="info-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Derived metrics</p>
              <h2>Operational health indicators</h2>
            </div>
            <p className="section-note">
              Interview-safe examples of the KPI layer a PM could define before any
              full system build-out.
            </p>
          </div>

          <div className="metrics-grid">
            {derivedMetrics.map((metric) => (
              <div key={metric.label} className="metric-card">
                <span className="metric-label">{metric.label}</span>
                <strong className="metric-value">{metric.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="info-panel stack-lg">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Flow view</p>
            <h2>Funnel handoff map</h2>
          </div>
          <p className="section-note">
            Clear enough for an interview demo, still honest about the static MVP
            boundary.
          </p>
        </div>

        <div className="funnel-flow" aria-label="Marketing funnel flow">
          {metricLabels.map(([key, label]) => (
            <div key={key} className="funnel-step">
              <span className="funnel-step-label">{label}</span>
              <strong className="funnel-step-value">
                {key === "spend"
                  ? formatMoney(demo.funnel_metrics[key])
                  : formatInteger(demo.funnel_metrics[key])}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="stack-lg">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Creative analysis</p>
            <h2>AI-assisted creative review board</h2>
          </div>
          <p className="section-note">
            Sample analysis only. Suggestions are drafted outputs that still require
            human approval before reuse.
          </p>
        </div>

        <div className="marketing-card-grid">
          {demo.creative_analysis.map((creative) => (
            <article key={creative.creative_id} className="workflow-card marketing-card">
              <div className="workflow-card-head">
                <div>
                  <h3>{creative.creative_id}</h3>
                  <p className="muted">{creative.format}</p>
                </div>
                <span className="category-pill">{creative.format}</span>
              </div>

              <div className="stack-md">
                <p>
                  <strong>Hook:</strong> {creative.hook_text}
                </p>
                <p>
                  <strong>Caption:</strong> {creative.caption}
                </p>
                <p>
                  <strong>Visual:</strong> {creative.visual_description}
                </p>
                <p>
                  <strong>First 3 seconds:</strong> {creative.first_3_seconds_description}
                </p>
                <p>
                  <strong>Performance summary:</strong> {creative.performance_summary}
                </p>
                <p>
                  <strong>Possible issue:</strong> {creative.possible_issue}
                </p>
                <p>
                  <strong>AI suggestion:</strong> {creative.ai_suggestion}
                </p>
                <p>
                  <strong>Next action:</strong> {creative.next_action}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid-two marketing-grid-wide">
        <article className="info-panel stack-md">
          <h2>AI output preview</h2>
          <OutputBlock
            title="Weekly report draft"
            items={demo.ai_outputs.weekly_report_draft}
          />
          <OutputBlock title="Ad copy ideas" items={demo.ai_outputs.ad_copy_ideas} />
        </article>

        <article className="info-panel stack-md">
          <h2>Deck and follow-up support</h2>
          <OutputBlock title="PPT outline" items={demo.ai_outputs.ppt_outline} />
          <OutputBlock
            title="Follow-up suggestions"
            items={demo.ai_outputs.follow_up_suggestions}
          />
        </article>
      </section>

      <section className="grid-two marketing-grid-wide">
        <article className="info-panel">
          <h2>Risk controls</h2>
          <ul className="check-list">
            {demo.risk_controls.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="info-panel">
          <h2>Demo boundaries</h2>
          <ul className="bullet-list">
            {demo.demo_boundaries.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}

function OutputBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="detail-panel">
      <h3>{title}</h3>
      <ul className="bullet-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function asPercent(value: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${((value / total) * 100).toFixed(1)}%`;
}

function asCurrency(value: number, total: number) {
  if (total <= 0) {
    return formatMoney(0);
  }

  return formatMoney(value / total);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}
