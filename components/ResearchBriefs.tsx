"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useLanguage } from "@/components/LanguageProvider";
import { formatDate, formatDateTime } from "@/lib/format";
import { CompanionApiError, requestCompanionJson } from "@/lib/companion-api";
import { buildResearchBrief, DEFAULT_RESEARCH_PROJECTS, hongKongDate, isResearchDateToday, summarizeResearchDate, type ResearchBriefDraft, type ResearchMaterial, type ResearchProjectCard, type ResearchRuntimeState } from "@/lib/research-runtime";
import { sourceLibraryArtifactId, type SourceLibraryEntry } from "@/lib/source-library";
import { importSourceLibraryEntries, listSourceLibraryEntries, saveResearchBriefHandoff, sourceLibraryEntryKey } from "@/lib/source-library-storage";
import { SourceHandoffWorkspace } from "@/components/SourceHandoffWorkspace";
import { IntelligenceRoutingPanel } from "@/components/IntelligenceRoutingPanel";
import { parseSourceLibraryBackup, serializeSourceLibraryBackup } from "@/lib/source-library-backup";
import { getCollectorSnapshotFreshness } from "@/lib/collector-snapshot-status";

function scopeLabel(scope: ResearchBriefDraft["source_scope"], copy: ReturnType<typeof useLanguage>["messages"]["research"]) {
  if (scope === "full_text") return copy.fullText;
  if (scope === "feed_content") return copy.feedContent;
  if (scope === "summary_only") return copy.summaryOnly;
  return copy.manual;
}

function statusLabel(status: ResearchMaterial["status"], copy: ReturnType<typeof useLanguage>["messages"]["research"]) {
  if (status === "capturing_body") return copy.capturing;
  if (status === "analysis_running") return copy.analyzing;
  if (status === "failed") return copy.failed;
  if (status === "analysis_pending") return copy.pending;
  if (status === "deferred") return copy.deferred;
  if (status === "needs_manual_input") return copy.manualInput;
  if (status === "captured") return copy.captured;
  return copy.discovered;
}

function dailyStatusLabel(status: ResearchRuntimeState["daily"]["status"], copy: ReturnType<typeof useLanguage>["messages"]["research"]) {
  if (status === "not_run") return copy.statusNotRun;
  if (status === "running") return copy.statusRunning;
  if (status === "completed") return copy.statusCompleted;
  if (status === "partial") return copy.statusPartial;
  return copy.statusFailed;
}

function researchDate(value: string) {
  return hongKongDate(new Date(value));
}

type CollectorInboxItem = {
  id: string;
  category: string;
  sourceId: string;
  title: string;
  url: string | null;
  summary: string;
  publishedAt: string | null;
  discoveredAt: string;
  reviewStatus: "needs_review";
};

type DisplayLimit = 5 | 10 | 20 | "all";

function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ResearchBriefs() {
  const { locale, messages } = useLanguage();
  const copy = messages.research;
  const sourceCopy = messages.sourceInbox;
  const [state, setState] = useState<ResearchRuntimeState | null>(null);
  const [collectorItems, setCollectorItems] = useState<CollectorInboxItem[]>([]);
  const [collectorSnapshotUpdatedAt, setCollectorSnapshotUpdatedAt] = useState<string | null>(null);
  const [collectorUnavailable, setCollectorUnavailable] = useState(false);
  const [displayLimit, setDisplayLimit] = useState<DisplayLimit>(5);
  const [projects, setProjects] = useState<ResearchProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<"access" | "service" | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [feedback, setFeedback] = useState<Record<string, { value: "useful" | "skipped" | "adopted"; note: string; adoption: ResearchBriefDraft["adoption"] }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [libraryEntries, setLibraryEntries] = useState<SourceLibraryEntry[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryUnavailable, setLibraryUnavailable] = useState(false);
  const [creatingBriefFor, setCreatingBriefFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextState, status] = await Promise.all([
        requestCompanionJson<ResearchRuntimeState>("/automation/state"),
        requestCompanionJson<{ projects?: ResearchProjectCard[] }>("/automation/status"),
      ]);
      let nextCollectorItems: CollectorInboxItem[] = [];
      let collectorReadFailed = false;
      try {
        const inbox = await requestCompanionJson<{ items?: CollectorInboxItem[]; updatedAt?: string | null }>("/automation/collector-inbox");
        nextCollectorItems = Array.isArray(inbox.items) ? inbox.items : [];
        setCollectorSnapshotUpdatedAt(typeof inbox.updatedAt === "string" ? inbox.updatedAt : null);
      } catch (error) {
        setCollectorSnapshotUpdatedAt(null);
        collectorReadFailed = !(error instanceof CompanionApiError && error.code === "collector_inbox_not_created");
      }
      setState(nextState);
      setProjects(status.projects ?? []);
      setCollectorItems(nextCollectorItems);
      setCollectorUnavailable(collectorReadFailed);
      setSelectedDate((current) => current || [...nextCollectorItems.map((item) => researchDate(item.discoveredAt)), nextState.daily.date].sort().at(-1) || nextState.daily.date);
      setUnavailable(null);
    } catch (error) {
      setUnavailable(error instanceof CompanionApiError && error.code === "access_session_expired" ? "access" : "service");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      setLibraryEntries(await listSourceLibraryEntries());
      setLibraryUnavailable(false);
    } catch {
      setLibraryUnavailable(true);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  const createBriefFromApprovedSource = async (entry: SourceLibraryEntry) => {
    const artifactId = sourceLibraryArtifactId(entry);
    if (entry.research_briefs.some((item) => item.artifact_id === artifactId)) {
      setMessage(copy.libraryBriefCreated);
      return;
    }
    setCreatingBriefFor(artifactId);
    const createdAt = new Date().toISOString();
    try {
      const brief = buildResearchBrief(
        entry.source_record,
        artifactId,
        createdAt,
        projects.length > 0 ? projects : DEFAULT_RESEARCH_PROJECTS,
      );
      const updated = await saveResearchBriefHandoff(sourceLibraryEntryKey(entry), artifactId, createdAt, brief);
      setLibraryEntries((current) => current.map((item) => sourceLibraryEntryKey(item) === sourceLibraryEntryKey(updated) ? updated : item));
      setMessage(copy.libraryBriefCreated);
    } catch {
      setMessage(copy.libraryBriefFailed);
    } finally {
      setCreatingBriefFor(null);
    }
  };

  const saveFeedback = async (material: ResearchMaterial) => {
    const draft = material.brief;
    if (!draft) return;
    const current = feedback[material.material_id] ?? { value: draft.feedback ?? "useful", note: draft.feedback_note, adoption: draft.adoption };
    try {
      await requestCompanionJson("/automation/feedback", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ material_id: material.material_id, feedback: current.value, adoption: current.adoption, note: current.note }),
      });
      setMessage(copy.feedbackSaved);
      await load();
    } catch (error) {
      setMessage(error instanceof CompanionApiError && error.code === "access_session_expired" ? copy.accessSessionExpired : copy.feedbackFailed);
    }
  };

  const updateFeedback = (material: ResearchMaterial, patch: Partial<{ value: "useful" | "skipped" | "adopted"; note: string; adoption: ResearchBriefDraft["adoption"] }>) => {
    const draft = material.brief;
    if (!draft) return;
    setFeedback((current) => ({
      ...current,
      [material.material_id]: {
        value: current[material.material_id]?.value ?? draft.feedback ?? "useful",
        note: current[material.material_id]?.note ?? draft.feedback_note,
        adoption: current[material.material_id]?.adoption ?? draft.adoption,
        ...patch,
      },
    }));
  };

  const downloadBackup = async () => {
    try {
      const payload = await requestCompanionJson("/automation/export");
      downloadText("ai-pm-radar-research-backup.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
      setMessage(copy.backupDownloaded);
    } catch (error) {
      setMessage(error instanceof CompanionApiError && error.code === "access_session_expired" ? copy.accessSessionExpired : copy.backupUnavailable);
    }
  };

  const exportLibraryBackup = () => {
    try {
      downloadText("ai-pm-radar-source-library-backup.json", serializeSourceLibraryBackup(libraryEntries), "application/json;charset=utf-8");
      setMessage(copy.libraryBackupReady);
    } catch {
      setMessage(copy.libraryBackupFailed);
    }
  };

  const importLibraryBackup = async (file: File) => {
    try {
      const backup = parseSourceLibraryBackup(await file.text());
      await importSourceLibraryEntries(backup.entries);
      setLibraryEntries(await listSourceLibraryEntries());
      setMessage(copy.libraryBackupImported);
    } catch {
      setMessage(copy.libraryBackupFailed);
    }
  };

  const retryFailed = async () => {
    try {
      await requestCompanionJson("/automation/run", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ retry_failed: true }),
      });
      setMessage(copy.retryAccepted);
      window.setTimeout(() => void load(), 1500);
    } catch (error) {
      setMessage(error instanceof CompanionApiError && error.code === "access_session_expired" ? copy.accessSessionExpired : copy.retryFailedError);
    }
  };

  const effectiveDate = selectedDate || state?.daily.date || "";
  const availableDates = state
    ? [...new Set([
      state.daily.date,
      ...state.runs.map((run) => run.date),
      ...state.materials.filter((material) => material.brief).map((material) => researchDate(material.brief?.generated_at ?? material.updated_at)),
      ...collectorItems.map((item) => researchDate(item.discoveredAt)),
    ])].sort((left, right) => right.localeCompare(left))
    : [];
  const daySummary = state ? summarizeResearchDate(state, effectiveDate) : null;
  const materials = daySummary && state
    ? daySummary.selected_material_ids.map((id) => state.materials.find((material) => material.material_id === id)).filter((material): material is ResearchMaterial => Boolean(material)).slice(0, displayLimit === "all" ? undefined : displayLimit)
    : [];
  const collectorCandidates = collectorItems
    .filter((item) => researchDate(item.discoveredAt) === effectiveDate)
    .sort((left, right) => right.discoveredAt.localeCompare(left.discoveredAt));
  const visibleCollectorCandidates = displayLimit === "all" ? collectorCandidates : collectorCandidates.slice(0, displayLimit);
  const collectorSnapshotFreshness = getCollectorSnapshotFreshness(collectorSnapshotUpdatedAt);
  const unresolved = state?.materials.filter((material) => !material.brief
    && ["failed", "needs_manual_input", "deferred"].includes(material.status)
    && researchDate(material.status === "needs_manual_input" ? material.created_at : material.updated_at) === effectiveDate) ?? [];

  const exportJson = () => {
    if (!materials.length) {
      setMessage(copy.exportUnavailable);
      return;
    }
    downloadText(`research-brief-${effectiveDate}.json`, JSON.stringify({ version: 1, date: effectiveDate, materials }, null, 2), "application/json;charset=utf-8");
  };

  const exportMarkdown = () => {
    if (!materials.length) {
      setMessage(copy.exportUnavailable);
      return;
    }
    const markdown = [`# ${copy.title}`, `\n${formatDate(effectiveDate, locale)}\n`]
      .concat(materials.map((material) => {
        const brief = material.brief;
        if (!brief) return `## ${material.feed_item.title}\n\n${statusLabel(material.status, copy)}`;
        const claims = brief.key_claims.flatMap((claim) => claim.evidence.map((evidence) => `- ${claim.claim} — “${evidence.text_reference}” (${evidence.source}${evidence.timestamp ? `, ${evidence.timestamp}` : ""})`));
        return [`## ${material.source_record.title ?? material.feed_item.title}`, `\n${brief.summary}`, `\n### ${copy.sourceFacts}`, ...material.source_record.analysis.source_facts.map((fact) => `- ${fact}`), `\n### ${copy.evidenceNote}`, ...(claims.length ? claims : [`- ${copy.noEvidence}`])].join("\n");
      })).join("\n\n");
    downloadText(`research-brief-${effectiveDate}.md`, markdown, "text/markdown;charset=utf-8");
  };

  return <main className="container section stack-lg">
    <section className="workbench-intro">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{copy.title}</h1>
      <p className="lead">{copy.intro}</p>
      <p className="workbench-notice">{copy.draftBoundary}</p>
    </section>
    <section className="workbench-section approved-source-library" aria-labelledby="approved-source-library-title">
      <div className="workbench-section-heading"><h2 id="approved-source-library-title">{copy.approvedLibraryTitle}</h2><p>{copy.approvedLibraryHint}</p></div>
      <div className="action-row library-backup-actions">
        <button type="button" className="secondary-button" onClick={exportLibraryBackup} disabled={libraryLoading || libraryUnavailable}>{copy.libraryBackupExport}</button>
        <label className="secondary-button file-button">{copy.libraryBackupImport}<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importLibraryBackup(file); event.currentTarget.value = ""; }} /></label>
      </div>
      {libraryLoading ? <p className="field-hint">{copy.loading}</p> : null}
      {libraryUnavailable ? <p className="blocked-message" role="status">{copy.unavailable}</p> : null}
      {!libraryLoading && !libraryUnavailable && libraryEntries.length === 0 ? <div className="empty-state"><p>{copy.noApprovedLibrary}</p></div> : null}
      <div className="research-card-grid">{libraryEntries.map((entry) => <ApprovedSourceLibraryCard
        key={sourceLibraryEntryKey(entry)}
        entry={entry}
        copy={copy}
        creating={creatingBriefFor === sourceLibraryArtifactId(entry)}
        onCreate={() => void createBriefFromApprovedSource(entry)}
        onEntryUpdated={(updated) => setLibraryEntries((current) => current.map((item) => sourceLibraryEntryKey(item) === sourceLibraryEntryKey(updated) ? updated : item))}
        onDownload={() => downloadText(`source-record-${entry.source_record.id}.json`, JSON.stringify(entry.source_record, null, 2), "application/json;charset=utf-8")}
      />)}</div>
    </section>
    <div className="action-row"><button type="button" className="secondary-button" onClick={() => void load()}>{copy.refresh}</button><Link href="/source-inbox" className="primary-button">{copy.runNow}</Link></div>
    {state && availableDates.length > 0 ? <div className="action-row research-toolbar">
      <label className="field"><span>{copy.datePicker}</span><select value={effectiveDate} onChange={(event) => setSelectedDate(event.target.value)}>{availableDates.map((date) => <option value={date} key={date}>{isResearchDateToday(date) ? `${copy.today} · ${formatDate(date, locale)}` : formatDate(date, locale)}</option>)}</select></label>
      <label className="field"><span>{copy.displayLimit}</span><select value={displayLimit} onChange={(event) => setDisplayLimit(event.target.value === "all" ? "all" : Number(event.target.value) as 5 | 10 | 20)}><option value="5">5</option><option value="10">10</option><option value="20">20</option><option value="all">{copy.allItems}</option></select></label>
      <button type="button" className="secondary-button" onClick={exportJson}>{copy.exportJson}</button>
      <button type="button" className="secondary-button" onClick={exportMarkdown}>{copy.exportMarkdown}</button>
      <button type="button" className="secondary-button" onClick={() => void downloadBackup()}>{copy.exportBackup}</button>
    </div> : null}
    {loading ? <p className="field-hint">{copy.loading}</p> : null}
    {unavailable ? <div className="blocked-message" role="status">{unavailable === "access" ? copy.accessSessionExpired : copy.unavailable}</div> : null}
    {message ? <p className="workbench-notice" role="status">{message}</p> : null}
    {state && daySummary ? <section className="research-status-panel"><strong>{copy.status}</strong><p>{formatDate(effectiveDate, locale)} · {dailyStatusLabel(daySummary.status, copy)} · {copy.currentTime} {new Intl.DateTimeFormat("zh-HK", { timeZone: "Asia/Hong_Kong", dateStyle: "short", timeStyle: "short" }).format(new Date())}</p><p>{copy.counts}：{copy.countNew} {daySummary.new_items} · {copy.countDuplicate} {daySummary.duplicate_items} · {copy.countAnalyzed} {daySummary.analyzed_items} · {copy.countSkipped} {daySummary.skipped_items} · {copy.countFailed} {daySummary.failed_items} · {copy.countPending} {daySummary.pending_analysis} · {copy.countManualInput} {daySummary.needs_manual_input}</p>{effectiveDate === state.daily.date ? <p>{copy.quota}：{copy.quotaSources} {state.daily.quota.source_attempts}/12 · {copy.quotaBodies} {state.daily.quota.body_attempts}/10 · {copy.quotaAi} {state.daily.quota.analysis_attempts}/10 · {copy.quotaBriefs} {state.daily.quota.briefs_created}/5 · {copy.quotaActions} {state.daily.quota.actions_suggested}/1</p> : null}<p>{effectiveDate === state.daily.date ? state.daily.note : copy.historicalSummary}</p>{state.materials.some((material) => material.status === "failed") ? <button type="button" className="secondary-button" onClick={() => void retryFailed()}>{copy.retryFailed}</button> : null}</section> : null}
    <section className="workbench-section" aria-labelledby="collector-inbox-title">
      <div className="workbench-section-heading"><h2 id="collector-inbox-title">{copy.collectorInboxTitle}</h2><p>{copy.collectorInboxHint}</p></div>
      {collectorUnavailable ? <p className="field-hint" role="status">{copy.collectorInboxUnavailable}</p> : null}
      {!collectorUnavailable ? <p className="field-hint" role="status" data-testid="collector-snapshot-freshness">
        {collectorSnapshotFreshness.status === "stale" ? copy.collectorSnapshotStale : collectorSnapshotFreshness.status === "fresh" ? copy.collectorSnapshotSaved : copy.collectorSnapshotUnknown}
        {collectorSnapshotFreshness.updatedAt ? ` · ${formatDateTime(collectorSnapshotFreshness.updatedAt, locale)}` : ""}
      </p> : null}
      {!collectorUnavailable && collectorCandidates.length > 0 ? <p className="field-hint">{copy.collectorCount}: {collectorCandidates.length} · {copy.collectorDisplayed}: {visibleCollectorCandidates.length}</p> : null}
      {!collectorUnavailable && visibleCollectorCandidates.length === 0 ? <p className="field-hint">{copy.noCollectorCandidates}</p> : null}
      <div className="research-card-grid">{visibleCollectorCandidates.map((item) => <article className="research-card" key={item.id}>
        <div className="material-card-heading"><h3>{item.title}</h3><span className="status-pill">{copy.needsReview}</span></div>
        <p>{copy.collectorSource}: {item.sourceId} · {formatDateTime(item.discoveredAt, locale)}</p>
        {item.summary ? <p>{item.summary}</p> : <p className="field-hint">{copy.collectorNoSummary}</p>}
        {item.url ? <p><a href={item.url} target="_blank" rel="noreferrer noopener">{item.url}</a></p> : null}
      </article>)}</div>
    </section>
    {daySummary?.recommended_action ? <section className="research-action-card"><h2>{copy.suggestedAction}</h2><strong>{daySummary.recommended_action.title}</strong><p>{daySummary.recommended_action.deliverable}</p><p>{daySummary.recommended_action.minutes} {copy.minutes} · {daySummary.recommended_action.affects_wip}</p><p>{daySummary.recommended_action.reason}</p></section> : state && <p className="field-hint">{copy.noAction}</p>}
    {!loading && !unavailable && materials.length === 0 ? <div className="empty-state"><h2>{daySummary && (daySummary.pending_analysis > 0 || daySummary.needs_manual_input > 0) ? copy.pendingMaterials : copy.noDrafts}</h2>{daySummary && (daySummary.pending_analysis > 0 || daySummary.needs_manual_input > 0) ? <Link href="/source-inbox/" className="secondary-button">{copy.openPendingMaterials}</Link> : null}</div> : null}
    {unresolved.length > 0 ? <section className="workbench-section"><h2>{copy.unresolvedMaterials}</h2><div className="research-card-grid">{unresolved.map((material) => <article className="research-card" key={material.material_id}><div className="material-card-heading"><h3>{material.source_record.title ?? material.feed_item.title}</h3><span className="status-pill status-failed">{statusLabel(material.status, copy)}</span></div><p>{material.feed_item.article_url ?? material.feed_item.feed_url}</p>{material.error ? <details><summary>{copy.errorDetails}</summary><p>{material.error.code}</p><p>{material.error.message}</p></details> : null}<Link href={`/source-inbox/?research_material=${encodeURIComponent(material.material_id)}`} className="secondary-button">{copy.openSource}</Link></article>)}</div></section> : null}
    <div className="research-card-grid">{materials.map((material) => <ResearchCard key={material.material_id} material={material} projects={projects} copy={copy} sourceCopy={sourceCopy} locale={locale} feedback={feedback[material.material_id]} onFeedback={(patch) => updateFeedback(material, patch)} onSave={() => void saveFeedback(material)} />)}</div>
  </main>;
}

function ApprovedSourceLibraryCard({ entry, copy, creating, onCreate, onEntryUpdated, onDownload }: {
  entry: SourceLibraryEntry;
  copy: ReturnType<typeof useLanguage>["messages"]["research"];
  creating: boolean;
  onCreate: () => void;
  onEntryUpdated: (entry: SourceLibraryEntry) => void;
  onDownload: () => void;
}) {
  const record = entry.source_record;
  const artifactId = sourceLibraryArtifactId(entry);
  const brief = entry.research_briefs.find((item) => item.artifact_id === artifactId)?.brief;
  return <article className="research-card approved-source-card">
    <div className="material-card-heading"><h3>{record.title ?? copy.unknown}</h3><span className="status-pill status-reviewed">{record.review_status} · {record.approval_status}</span></div>
    <p>{record.source_url_final ?? record.source_url_original ?? record.source_url ?? copy.unknown}</p>
    <p>{copy.creator}：{record.creator ?? copy.unknown} · {copy.publishedAt}：{record.published_at ? formatDateTime(record.published_at, "zh-Hant") : copy.unknown}</p>
    <p>{copy.libraryApprovedAt}：{formatDateTime(entry.approved_at, "zh-Hant")} · SourceRecord ID：<code>{record.id}</code></p>
    <details><summary>{copy.sourceFacts}</summary><p>{record.raw_text || record.transcript || copy.noEvidence}</p><p>Original URL: {record.source_url_original ?? copy.unknown}</p><p>Final URL: {record.source_url_final ?? copy.unknown}</p></details>
    <IntelligenceRoutingPanel entry={entry} onEntryUpdated={onEntryUpdated} />
    <div className="action-row"><button type="button" className="primary-button" onClick={onCreate} disabled={creating || Boolean(brief)}>{creating ? copy.loading : brief ? copy.libraryBriefCreated : copy.createBriefFromSource}</button><button type="button" className="secondary-button" onClick={onDownload}>{copy.sourceRecordBackup}</button></div>
    {brief ? <section className="workbench-subsection library-brief-result">
      <h3>{brief.summary}</h3>
      <p className="field-hint">{copy.libraryBriefBoundary}</p>
      <p>Research Brief ID: <code>{brief.material_id}</code> · SourceRecord ID: <code>{brief.source_record_id}</code></p>
      <h4>{copy.sourceFacts}</h4><ul>{record.analysis.source_facts.map((fact, index) => <li key={`${record.id}-fact-${index}`}>{fact}</li>)}</ul>
      <h4>{copy.evidenceNote}</h4>{brief.key_claims.map((claim, index) => <div key={`${record.id}-claim-${index}`}><strong>{claim.claim}</strong>{claim.evidence.map((evidence, evidenceIndex) => <blockquote key={`${index}-${evidenceIndex}`}>{evidence.text_reference}<footer>{evidence.source}{evidence.timestamp ? ` · ${evidence.timestamp}` : ""}</footer></blockquote>)}</div>)}
      <h4>{copy.businessImplication}</h4><p>{brief.business_implication ?? copy.unknown}</p>
      <h4>{copy.aiPmImplication}</h4><p>{brief.ai_pm_implication ?? copy.unknown}</p>
      <h4>{copy.uncertainty}</h4><ul>{brief.uncertainties.map((item, index) => <li key={`${record.id}-uncertainty-${index}`}>{item}</li>)}</ul>
    </section> : null}
    {entry.handoffs.length > 0 ? <p className="field-hint">Research Brief reuse recorded: {entry.handoffs.map((handoff) => `${handoff.artifact_id} (${formatDateTime(handoff.created_at, "zh-Hant")})`).join("; ")}</p> : null}
    <SourceHandoffWorkspace entry={entry} onEntryUpdated={onEntryUpdated} />
  </article>;
}

function ResearchCard({ material, projects, copy, sourceCopy, locale, feedback, onFeedback, onSave }: {
  material: ResearchMaterial;
  projects: ResearchProjectCard[];
  copy: ReturnType<typeof useLanguage>["messages"]["research"];
  sourceCopy: ReturnType<typeof useLanguage>["messages"]["sourceInbox"];
  locale: ReturnType<typeof useLanguage>["locale"];
  feedback?: { value: "useful" | "skipped" | "adopted"; note: string; adoption: ResearchBriefDraft["adoption"] };
  onFeedback: (patch: Partial<{ value: "useful" | "skipped" | "adopted"; note: string; adoption: ResearchBriefDraft["adoption"] }>) => void;
  onSave: () => void;
}) {
  const draft = material.brief;
  if (!draft) return <article className="research-card"><h2>{material.feed_item.title}</h2><p>{statusLabel(material.status, copy)}</p></article>;
  const current = feedback ?? { value: draft.feedback ?? "useful", note: draft.feedback_note, adoption: draft.adoption };
  return <article className="research-card">
    <div className="material-card-heading"><h2>{material.source_record.title ?? material.feed_item.title}</h2><span className="status-pill status-captured">{scopeLabel(draft.source_scope, copy)}</span></div>
    <p className="field-hint">{copy.provider}：{draft.provider} {draft.model ?? ""} · {copy.generatedAt}：{formatDateTime(draft.generated_at, locale)}</p>
    <p className="field-hint">{copy.sourceDate}：{copy.publishedAt} {draft.source_dates.published_at ? formatDateTime(draft.source_dates.published_at, locale) : copy.unknown} · {copy.updatedAt} {draft.source_dates.updated_at ? formatDateTime(draft.source_dates.updated_at, locale) : copy.unknown} · {copy.discoveredAt} {formatDateTime(draft.source_dates.discovered_at, locale)}</p>
    <p className="field-hint">{copy.creator}：{material.source_record.creator ?? copy.unknown}</p>
    <section><h3>{copy.selectionReasons}</h3><ul>{draft.selection_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></section>
    <p>{draft.summary}</p>
    <section><h3>{copy.sourceFacts}</h3><ul>{material.source_record.analysis.source_facts.map((fact) => <li key={fact}>{fact}</li>)}</ul></section>
    <section><h3>{copy.keyPoints}</h3><ul>{draft.key_points.map((point) => <li key={point}>{point}</li>)}</ul>{draft.method_or_teaching_points.length > 0 ? <><h3>{copy.methodPoints}</h3><ul>{draft.method_or_teaching_points.map((point) => <li key={point}>{point}</li>)}</ul></> : null}</section>
    <section><h3>{copy.applicability}</h3><ul>{draft.applicability.map((item) => <li key={item}>{item}</li>)}</ul></section>
    <section><h3>{copy.businessImplication}</h3><p>{draft.business_implication || "—"}</p><h3>{copy.aiPmImplication}</h3><p>{draft.ai_pm_implication || "—"}</p><h3>{copy.adoptionRecommendation}</h3><p>{draft.recommendation_reason || "—"}</p></section>
    <section><h3>{copy.uncertainty}</h3><ul>{draft.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul></section>
    <section><h3>{copy.projects}</h3>{draft.project_recommendations.map((project) => { const currentProject = projects.find((candidate) => candidate.id === project.project_id); const stale = Boolean(currentProject && currentProject.updated_at !== project.project_updated_at); return <p key={`${project.project_id ?? "none"}-${project.project_name}`}><strong>{project.project_name}</strong>{stale ? <span className="status-pill status-failed"> {copy.projectMatchStale}</span> : null}：{project.reason}<br /><small>{project.basis}</small></p>; })}</section>
    <section><h3>{copy.evidenceNote}</h3>{draft.key_claims.map((claim) => <div key={claim.claim}><strong>{claim.claim}</strong>{claim.evidence.map((evidence) => <blockquote key={`${claim.claim}-${evidence.text_reference}`}>{evidence.text_reference}<footer>{evidence.source}{evidence.timestamp ? ` · ${evidence.timestamp}` : ""}</footer></blockquote>)}</div>)}{draft.key_claims.length === 0 ? <p>{copy.noEvidence}</p> : null}</section>
    <p className="status-boundary">{sourceCopy.notReviewed} · {sourceCopy.notApproved}</p>
    {draft.usage ? <p className="field-hint">{copy.tokenUsage}：{copy.inputTokens} {draft.usage.input_tokens} · {copy.outputTokens} {draft.usage.output_tokens} · {copy.totalTokens} {draft.usage.total_tokens}</p> : null}
    <div className="action-row"><Link href={`/source-inbox/?research_material=${encodeURIComponent(material.material_id)}`} className="secondary-button">{copy.openSource}</Link><select aria-label={copy.adoption} value={current.adoption} onChange={(event) => onFeedback({ adoption: event.target.value as ResearchBriefDraft["adoption"] })}><option value="undecided">{copy.undecided}</option><option value="adopt">{copy.adopt}</option><option value="timeboxed_experiment">{copy.timeboxedExperiment}</option><option value="backlog">{copy.backlog}</option><option value="skip">{copy.skip}</option></select></div>
    <label className="form-field"><span>{copy.feedbackNote}</span><textarea value={current.note} onChange={(event) => onFeedback({ note: event.target.value })} rows={2} /></label>
    <div className="action-row"><button type="button" className="secondary-button" onClick={() => onFeedback({ value: "useful" })}>{copy.useful}</button><button type="button" className="secondary-button" onClick={() => onFeedback({ value: "skipped" })}>{copy.skipped}</button><button type="button" className="secondary-button" onClick={() => onFeedback({ value: "adopted" })}>{copy.adopted}</button><button type="button" className="primary-button" onClick={onSave}>{copy.saveFeedback}</button></div>
  </article>;
}
