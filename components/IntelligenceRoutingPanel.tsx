"use client";

import { useState } from "react";

import { useLanguage } from "@/components/LanguageProvider";
import { buildResearchBrief, DEFAULT_RESEARCH_PROJECTS } from "@/lib/research-runtime";
import { createHandoffDraft, type HandoffType } from "@/lib/downstream-handoff";
import { createIntelligenceAssessment, decideIntelligenceRoute, INTELLIGENCE_ROUTES, markIntelligenceRouteCreated, type IntelligenceAssessment, type IntelligenceRoute } from "@/lib/intelligence-routing";
import { formatIntelligenceSignal } from "@/lib/i18n";
import { saveDownstreamHandoff, saveIntelligenceAssessment, saveResearchBriefHandoff, sourceLibraryEntryKey } from "@/lib/source-library-storage";
import type { SourceLibraryEntry } from "@/lib/source-library";

const HANDOFF_BY_ROUTE: Partial<Record<IntelligenceRoute, HandoffType>> = {
  learning_pack: "learning_pack",
  content_candidate: "content_candidate",
  creative_reference: "creative_reference",
  case_reference: "case_reference",
};

export function IntelligenceRoutingPanel({ entry, onEntryUpdated }: {
  entry: SourceLibraryEntry;
  onEntryUpdated: (entry: SourceLibraryEntry) => void;
}) {
  const { locale, messages } = useLanguage();
  const copy = messages.research.intelligence;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, IntelligenceRoute>>({});
  const assessment = entry.intelligence_assessments.at(-1) ?? null;

  const persist = async (next: IntelligenceAssessment) => {
    const updated = await saveIntelligenceAssessment(sourceLibraryEntryKey(entry), next);
    onEntryUpdated(updated);
  };

  const assess = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await persist(createIntelligenceAssessment(entry));
    } catch {
      setMessage(copy.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (routeId: string, action: "accept" | "reject" | "override") => {
    if (!assessment) return;
    const reason = reasons[routeId] ?? "";
    setBusy(true);
    setMessage(null);
    try {
      const input = action === "accept" ? { action } as const
        : action === "reject" ? { action, reason } as const
          : { action, route: overrides[routeId] ?? INTELLIGENCE_ROUTES.find((route) => route !== assessment.routeRecommendations.find((item) => item.id === routeId)?.route)!, reason } as const;
      await persist(decideIntelligenceRoute(assessment, routeId, input));
    } catch {
      setMessage(copy.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const createRouteDraft = async (recommendationId: string) => {
    if (!assessment) return;
    const recommendation = assessment.routeRecommendations.find((item) => item.id === recommendationId);
    const route = recommendation?.decision.selectedRoute;
    if (!recommendation || !route || !["accepted", "overridden"].includes(recommendation.decision.status)) {
      setMessage(copy.acceptedRequired);
      return;
    }
    if (recommendation.decision.createdArtifactId) {
      setMessage(copy.draftExists);
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      let updatedEntry = entry;
      let artifactId: string;
      if (route === "research_brief") {
        artifactId = `research-brief-${assessment.id}`;
        const existing = entry.research_briefs.find((brief) => brief.artifact_id === artifactId);
        if (!existing) {
          const brief = buildResearchBrief(entry.source_record, artifactId, assessment.createdAt, DEFAULT_RESEARCH_PROJECTS);
          updatedEntry = await saveResearchBriefHandoff(sourceLibraryEntryKey(entry), artifactId, assessment.createdAt, brief);
        }
      } else {
        const handoffType = HANDOFF_BY_ROUTE[route];
        if (!handoffType) throw new Error("No existing handoff contract matches this route.");
        const timestamp = new Date(Date.parse(assessment.createdAt) + INTELLIGENCE_ROUTES.indexOf(route)).toISOString();
        const handoff = createHandoffDraft(entry, handoffType, timestamp);
        artifactId = handoff.id;
        const existing = entry.downstream_handoffs.some((item) => item.id === artifactId);
        if (!existing) updatedEntry = await saveDownstreamHandoff(sourceLibraryEntryKey(entry), handoff);
      }
      const nextAssessment = markIntelligenceRouteCreated(assessment, recommendationId, artifactId);
      updatedEntry = await saveIntelligenceAssessment(sourceLibraryEntryKey(updatedEntry), nextAssessment);
      onEntryUpdated(updatedEntry);
      setMessage(copy.draftCreated);
    } catch {
      setMessage(copy.draftFailed);
    } finally {
      setBusy(false);
    }
  };

  return <section className="workbench-subsection intelligence-routing" aria-labelledby={`intelligence-routing-${entry.source_record.id}`}>
    <div>
      <h3 id={`intelligence-routing-${entry.source_record.id}`}>{copy.title}</h3>
      <p className="field-hint">{copy.hint}</p>
    </div>
    <button type="button" className="secondary-button" onClick={() => void assess()} disabled={busy}>
      {busy ? copy.running : copy.run}
    </button>
    {!assessment ? <p className="field-hint">{copy.noAssessment}</p> : <>
      <p className="field-hint">{copy.assessmentExplanation} · {copy.confidence}: {Math.round(assessment.confidence * 100)}% · {copy.method}: {assessment.method.version}</p>
      <p className="field-hint">{copy.scoreNote}</p>
      <div className="intelligence-dimensions">
        {Object.entries(assessment.dimensions).map(([name, item]) => <article className="intelligence-dimension" key={name}>
          <strong>{copy.dimensions[name as keyof typeof copy.dimensions]} · {item.score}/100</strong>
          <p>{copy.dimensionExplanations[name as keyof typeof copy.dimensionExplanations]}</p>
          {item.signals.length ? <small>{item.signals.map((signal) => formatIntelligenceSignal(signal, locale, name === "relevance")).join(" · ")}</small> : <small>{copy.noSignals}</small>}
        </article>)}
      </div>
      <h4>{copy.title} · {copy.assessmentStatus[assessment.status]}</h4>
      <div className="intelligence-routes">
        {assessment.routeRecommendations.map((recommendation) => {
          const decision = recommendation.decision;
          const alternative = INTELLIGENCE_ROUTES.find((route) => route !== recommendation.route) ?? recommendation.route;
          return <article className="intelligence-route" key={`${assessment.id}-${recommendation.id}`}>
            <div className="material-card-heading">
              <strong>{copy.routes[recommendation.route]}</strong>
              <span className="status-pill">{recommendation.score}/100 · {copy.decisionStatus[decision.status]}</span>
            </div>
            {recommendation.signals.length ? <p>{recommendation.signals.map((signal) => formatIntelligenceSignal(signal, locale)).join(copy.signals.routeSignalSeparator)}</p> : <p>{copy.noSignals}</p>}
            {decision.status === "pending" ? <>
              <label className="field"><span>{copy.reason}</span><textarea rows={2} value={reasons[recommendation.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [recommendation.id]: event.target.value }))} /></label>
              <div className="action-row">
                <button type="button" className="secondary-button" disabled={busy} onClick={() => void decide(recommendation.id, "accept")}>{copy.accept}</button>
                <button type="button" className="secondary-button" disabled={busy || !(reasons[recommendation.id] ?? "").trim()} onClick={() => void decide(recommendation.id, "reject")}>{copy.reject}</button>
              </div>
              <label className="field"><span>{copy.routeSelect}</span><select value={overrides[recommendation.id] ?? alternative} onChange={(event) => setOverrides((current) => ({ ...current, [recommendation.id]: event.target.value as IntelligenceRoute }))}>
                {INTELLIGENCE_ROUTES.filter((route) => route !== recommendation.route).map((route) => <option value={route} key={route}>{copy.routes[route]}</option>)}
              </select></label>
              <button type="button" className="secondary-button" disabled={busy || !(reasons[recommendation.id] ?? "").trim()} onClick={() => void decide(recommendation.id, "override")}>{copy.override}</button>
            </> : <>
              {decision.reason ? <p className="field-hint">{decision.reason}</p> : null}
              {decision.selectedRoute ? <>
                <p><strong>{copy.routes[decision.selectedRoute]}</strong>{decision.createdArtifactId ? <> · {copy.draftExists}: <code>{decision.createdArtifactId}</code></> : null}</p>
                <button type="button" className="secondary-button" disabled={busy || Boolean(decision.createdArtifactId)} onClick={() => void createRouteDraft(recommendation.id)}>{decision.createdArtifactId ? copy.draftExists : copy.createDraft}</button>
              </> : null}
            </>}
          </article>;
        })}
      </div>
    </>}
    {message ? <p className="workbench-notice" role="status">{message}</p> : null}
  </section>;
}
