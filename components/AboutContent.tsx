"use client";

import { useLanguage } from "./LanguageProvider";

export function AboutContent() {
  const { t } = useLanguage();

  const audience = [
    t("aboutAudienceOne"),
    t("aboutAudienceTwo"),
    t("aboutAudienceThree"),
  ];
  const principles = [
    t("aboutPrincipleOne"),
    t("aboutPrincipleTwo"),
    t("aboutPrincipleThree"),
    t("aboutPrincipleFour"),
    t("aboutPrincipleFive"),
  ];
  const workflowSteps = [
    {
      title: t("aboutWorkflowStepOneTitle"),
      body: t("aboutWorkflowStepOneBody"),
    },
    {
      title: t("aboutWorkflowStepTwoTitle"),
      body: t("aboutWorkflowStepTwoBody"),
    },
    {
      title: t("aboutWorkflowStepThreeTitle"),
      body: t("aboutWorkflowStepThreeBody"),
    },
    {
      title: t("aboutWorkflowStepFourTitle"),
      body: t("aboutWorkflowStepFourBody"),
    },
  ];
  const safetyItems = [
    t("aboutSafetyOne"),
    t("aboutSafetyTwo"),
    t("aboutSafetyThree"),
    t("aboutSafetyFour"),
  ];

  return (
    <main className="container section stack-xl">
      <section className="about-grid">
        <div className="stack-md">
          <p className="eyebrow">{t("aboutEyebrow")}</p>
          <h1>{t("aboutWhyTitle")}</h1>
          <p>{t("aboutIntroOne")}</p>
          <p>{t("aboutIntroTwo")}</p>
        </div>

        <div className="info-panel">
          <h2>{t("aboutBoundariesTitle")}</h2>
          <p>{t("aboutBoundariesBody")}</p>
        </div>
      </section>

      <section className="grid-two">
        <article className="info-panel">
          <h2>{t("aboutAudienceTitle")}</h2>
          <ul className="bullet-list">
            {audience.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="info-panel">
          <h2>{t("aboutPrinciplesTitle")}</h2>
          <ul className="bullet-list">
            {principles.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="info-panel">
        <h2>{t("aboutPortfolioTitle")}</h2>
        <p>{t("aboutPortfolioBody")}</p>
      </section>

      <section className="stack-lg">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t("staticDailyBrief")}</p>
            <h2>{t("aboutWorkflowTitle")}</h2>
          </div>
          <p className="section-note">{t("aboutWorkflowBody")}</p>
        </div>

        <div className="workflow-grid">
          {workflowSteps.map((step) => (
            <article key={step.title} className="workflow-card">
              <div className="workflow-card-head">
                <div className="card-head">
                  <h3>{step.title}</h3>
                </div>
              </div>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="info-panel">
        <h2>{t("aboutSafetyTitle")}</h2>
        <ul className="check-list">
          {safetyItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
