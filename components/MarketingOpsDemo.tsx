"use client";

import { useLanguage } from "./LanguageProvider";

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

export function MarketingOpsDemo({ demo }: { demo: MarketingOpsData }) {
  const { language, t } = useLanguage();
  const metricLabels: Array<[keyof FunnelMetrics, string]> = [
    ["reach", t("marketingMetricReach")],
    ["clicks", t("marketingMetricClicks")],
    ["group_joins", t("marketingMetricGroupJoins")],
    ["messages_received", t("marketingMetricMessagesReceived")],
    ["messages_replied", t("marketingMetricMessagesReplied")],
    ["registrations", t("marketingMetricRegistrations")],
    ["attendance", t("marketingMetricAttendance")],
    ["spend", t("marketingMetricSpend")],
  ];
  const derivedMetrics = [
    {
      label: t("marketingDerivedGroupJoinRate"),
      value: asPercent(demo.funnel_metrics.group_joins, demo.funnel_metrics.clicks),
    },
    {
      label: t("marketingDerivedMessageReplyRate"),
      value: asPercent(
        demo.funnel_metrics.messages_replied,
        demo.funnel_metrics.messages_received,
      ),
    },
    {
      label: t("marketingDerivedRegistrationRate"),
      value: asPercent(demo.funnel_metrics.registrations, demo.funnel_metrics.messages_received),
    },
    {
      label: t("marketingDerivedAttendanceRate"),
      value: asPercent(demo.funnel_metrics.attendance, demo.funnel_metrics.registrations),
    },
    {
      label: t("marketingDerivedCostPerLead"),
      value: asCurrency(demo.funnel_metrics.spend, demo.funnel_metrics.registrations, language),
    },
    {
      label: t("marketingDerivedCostPerAttendee"),
      value: asCurrency(demo.funnel_metrics.spend, demo.funnel_metrics.attendance, language),
    },
  ];
  const audienceSegments =
    language === "zh-HK"
      ? ["課程導師", "髮型屋", "形象顧問", "教練與服務專業人士"]
      : demo.audience_segments;
  const riskControls =
    language === "zh-HK"
      ? [
          "任何文案發布或發送前都必須先經人手審核。",
          "此示範不儲存敏感個人資料。",
          "未啟用自動發布或自動發送動作。",
          "所有示範資料均已匿名化，適合面試展示。",
          "API key 不會提交到儲存庫。",
          "若重建為正式產品，建議加入角色權限管理。",
        ]
      : demo.risk_controls;
  const demoBoundaries =
    language === "zh-HK"
      ? [
          "僅為作品集示範，不是正式 SaaS 平台。",
          "使用儲存在本地 JSON 的匿名化示範資料。",
          "不含後端、登入、即時客戶資料或自動發布。",
        ]
      : demo.demo_boundaries;

  return (
    <div className="stack-xl">
      <section className="marketing-hero">
        <div className="marketing-hero-copy stack-md">
          <p className="eyebrow">{t("marketingEyebrow")}</p>
          <h1>{t("marketingHeroTitle")}</h1>
          <p className="lead">{t("marketingHeroBody")}</p>
          <div className="meta-row">
            <span className="category-pill">{t("marketingStaticBadge")}</span>
            <span className="score-pill">{t("marketingHumanReviewBadge")}</span>
            <span className="review-pill">{t("marketingNoAutoPublishingBadge")}</span>
          </div>
        </div>

        <div className="info-panel stack-md marketing-summary-panel">
          <p className="eyebrow">{t("marketingSummaryTitle")}</p>
          <h2>{t("marketingCampaignName")}</h2>
          <p>{t("marketingSummaryBody")}</p>
          <p className="section-note">{t("marketingClientType")}</p>
          <div className="tag-row">
            {audienceSegments.map((segment) => (
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
              <p className="eyebrow">{t("marketingFunnelEyebrow")}</p>
              <h2>{t("marketingFunnelTitle")}</h2>
            </div>
            <p className="section-note">{t("marketingFunnelNote")}</p>
          </div>

          <div className="metrics-grid">
            {metricLabels.map(([key, label]) => (
              <div key={key} className="metric-card">
                <span className="metric-label">{label}</span>
                <strong className="metric-value">
                  {key === "spend"
                    ? formatMoney(demo.funnel_metrics[key], language)
                    : formatInteger(demo.funnel_metrics[key], language)}
                </strong>
              </div>
            ))}
          </div>
        </article>

        <article className="info-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("marketingDerivedEyebrow")}</p>
              <h2>{t("marketingDerivedTitle")}</h2>
            </div>
            <p className="section-note">{t("marketingDerivedNote")}</p>
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
            <p className="eyebrow">{t("marketingFlowEyebrow")}</p>
            <h2>{t("marketingFlowTitle")}</h2>
          </div>
          <p className="section-note">{t("marketingFlowNote")}</p>
        </div>

        <div className="funnel-flow" aria-label="Marketing funnel flow">
          {metricLabels.map(([key, label]) => (
            <div key={key} className="funnel-step">
              <span className="funnel-step-label">{label}</span>
              <strong className="funnel-step-value">
                {key === "spend"
                  ? formatMoney(demo.funnel_metrics[key], language)
                  : formatInteger(demo.funnel_metrics[key], language)}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="stack-lg">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("marketingCreativeEyebrow")}</p>
            <h2>{t("marketingCreativeTitle")}</h2>
          </div>
          <p className="section-note">{t("marketingCreativeNote")}</p>
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
                  <strong>{t("marketingCreativeHook")}:</strong> {creative.hook_text}
                </p>
                <p>
                  <strong>{t("marketingCreativeCaption")}:</strong> {creative.caption}
                </p>
                <p>
                  <strong>{t("marketingCreativeVisual")}:</strong> {creative.visual_description}
                </p>
                <p>
                  <strong>{t("marketingCreativeFirstThreeSeconds")}:</strong>{" "}
                  {creative.first_3_seconds_description}
                </p>
                <p>
                  <strong>{t("marketingCreativePerformanceSummary")}:</strong>{" "}
                  {creative.performance_summary}
                </p>
                <p>
                  <strong>{t("marketingCreativePossibleIssue")}:</strong> {creative.possible_issue}
                </p>
                <p>
                  <strong>{t("marketingCreativeAiSuggestion")}:</strong> {creative.ai_suggestion}
                </p>
                <p>
                  <strong>{t("marketingCreativeNextAction")}:</strong> {creative.next_action}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid-two marketing-grid-wide">
        <article className="info-panel stack-md">
          <h2>{t("marketingOutputTitle")}</h2>
          <OutputBlock
            title={t("marketingWeeklyReport")}
            items={demo.ai_outputs.weekly_report_draft}
          />
          <OutputBlock title={t("marketingAdCopyIdeas")} items={demo.ai_outputs.ad_copy_ideas} />
        </article>

        <article className="info-panel stack-md">
          <h2>{t("marketingDeckTitle")}</h2>
          <OutputBlock title={t("marketingPptOutline")} items={demo.ai_outputs.ppt_outline} />
          <OutputBlock
            title={t("marketingFollowUpSuggestions")}
            items={demo.ai_outputs.follow_up_suggestions}
          />
        </article>
      </section>

      <section className="grid-two marketing-grid-wide">
        <article className="info-panel">
          <h2>{t("marketingRiskControlsTitle")}</h2>
          <ul className="check-list">
            {riskControls.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="info-panel">
          <h2>{t("marketingDemoBoundariesTitle")}</h2>
          <ul className="bullet-list">
            {demoBoundaries.map((item) => (
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

function asCurrency(value: number, total: number, language: "en" | "zh-HK") {
  if (total <= 0) {
    return formatMoney(0, language);
  }

  return formatMoney(value / total, language);
}

function getNumberLocale(language: "en" | "zh-HK") {
  return language === "zh-HK" ? "zh-HK" : "en-US";
}

function formatMoney(value: number, language: "en" | "zh-HK") {
  return new Intl.NumberFormat(getNumberLocale(language), {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatInteger(value: number, language: "en" | "zh-HK") {
  return new Intl.NumberFormat(getNumberLocale(language), {
    maximumFractionDigits: 0,
  }).format(value);
}
