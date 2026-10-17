"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type { Messages } from "@/lib/i18n";
import {
  SOURCE_FEED_SOURCE_LIMIT,
  mergeFeedItems,
  mergeRuntimeSubscriptionMetadata,
  normaliseFeedUrl,
  stableFeedId,
  type FeedItem,
  type FeedSyncSummary,
  type SourceSubscription,
} from "@/lib/source-feed";
import { parseSourceFeeds, serializeSourceFeeds } from "@/lib/source-feed-storage";
import { DEFAULT_RESEARCH_PROJECTS, type ResearchProjectCard } from "@/lib/research-runtime";
import { CompanionApiError, requestCompanionJson } from "@/lib/companion-api";

const DB_NAME = "ai-pm-radar-source-inbox";
const DB_VERSION = 3;
const SUBSCRIPTIONS_STORE = "subscriptions";
const ITEMS_STORE = "feed-items";

type Props = {
  copy: Messages["sourceInbox"];
  onItemsImported: (items: FeedItem[]) => void;
};

type SubscriptionDraft = Pick<SourceSubscription, "name" | "feed_url" | "expert_name" | "reason" | "topic_tags" | "priority" | "enabled">;

const EMPTY_DRAFT: SubscriptionDraft = {
  name: "",
  feed_url: "",
  expert_name: "",
  reason: "",
  topic_tags: [],
  priority: "medium",
  enabled: true,
};

type AutomationStatus = {
  configured?: boolean;
  current_date?: string;
  collection_enabled?: boolean;
  analysis_enabled?: boolean;
  schedule?: { enabled?: boolean };
  child_running?: boolean;
  last_run?: { status?: string; date?: string } | null;
  failed_material_count?: number;
  projects?: ResearchProjectCard[];
  subscriptions?: SourceSubscription[];
  provider?: string;
  model?: string | null;
  model_configured?: boolean;
  limits?: { maxSources?: number; maxBodyAttemptsPerDay?: number; maxAnalysisAttemptsPerDay?: number; maxBriefsPerDay?: number; maxActionsPerDay?: number };
};

function openFeedDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("workbench")) request.result.createObjectStore("workbench");
      if (!request.result.objectStoreNames.contains(SUBSCRIPTIONS_STORE)) request.result.createObjectStore(SUBSCRIPTIONS_STORE);
      if (!request.result.objectStoreNames.contains(ITEMS_STORE)) request.result.createObjectStore(ITEMS_STORE);
      if (!request.result.objectStoreNames.contains("source-library")) request.result.createObjectStore("source-library");
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
    request.onblocked = () => reject(new Error("Close another Radar tab to finish local storage upgrade."));
  });
}

async function readStore<T>(storeName: string) {
  const database = await openFeedDatabase();
  return new Promise<T[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error("Local source data could not be read."));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

async function writeFeedState(subscriptions: SourceSubscription[], items: FeedItem[]) {
  const database = await openFeedDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([SUBSCRIPTIONS_STORE, ITEMS_STORE], "readwrite");
    const subscriptionStore = transaction.objectStore(SUBSCRIPTIONS_STORE);
    const itemStore = transaction.objectStore(ITEMS_STORE);
    subscriptionStore.clear();
    itemStore.clear();
    subscriptions.forEach((subscription) => subscriptionStore.put(subscription, subscription.id));
    items.forEach((item) => itemStore.put(item, item.id));
    transaction.onerror = () => reject(transaction.error ?? new Error("Local source data could not be saved."));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

function makeSubscription(draft: SubscriptionDraft): SourceSubscription {
  const now = new Date().toISOString();
  return {
    id: stableFeedId(`subscription|${draft.feed_url}`),
    name: draft.name.trim(),
    feed_url: normaliseFeedUrl(draft.feed_url),
    expert_name: draft.expert_name.trim(),
    reason: draft.reason.trim(),
    topic_tags: draft.topic_tags.map((tag) => tag.trim()).filter(Boolean),
    priority: draft.priority,
    enabled: draft.enabled,
    last_attempted_at: null,
    last_successful_at: null,
    etag: null,
    last_modified: null,
    recent_runs: [],
  };
}

function runWithLimit<T>(values: T[], limit: number, task: (value: T) => Promise<void>) {
  let cursor = 0;
  return Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const value = values[cursor++];
      await task(value);
    }
  }));
}

export function SourceSubscriptions({ copy, onItemsImported }: Props) {
  const [subscriptions, setSubscriptions] = useState<SourceSubscription[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [draft, setDraft] = useState<SubscriptionDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [syncingIds, setSyncingIds] = useState<string[]>([]);
  const [storage, setStorage] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const [hydrated, setHydrated] = useState(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const writeSerial = useRef(0);
  const [message, setMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<ResearchProjectCard[]>(DEFAULT_RESEARCH_PROJECTS);
  const [automation, setAutomation] = useState({ collectionEnabled: false, analysisEnabled: false });
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [automationBusy, setAutomationBusy] = useState(false);

  useEffect(() => {
    Promise.all([readStore<SourceSubscription>(SUBSCRIPTIONS_STORE), readStore<FeedItem>(ITEMS_STORE)])
      .then(([savedSubscriptions, savedItems]) => {
        setSubscriptions(savedSubscriptions.map((subscription) => ({ ...subscription, priority: subscription.priority ?? "medium" })));
        setItems(savedItems);
        setStorage("saved");
        setHydrated(true);
      })
      .catch(() => setStorage("error"));
  }, []);

  const readAutomationStatus = async () => {
    try {
      const status = await requestCompanionJson<AutomationStatus>("/automation/status");
      setAutomationStatus(status);
      if (status.projects?.length) setProjects(status.projects);
      if (status.subscriptions) setSubscriptions((current) => mergeRuntimeSubscriptionMetadata(current, status.subscriptions ?? []));
      setAutomation((current) => ({
        collectionEnabled: status.collection_enabled ?? current.collectionEnabled,
        analysisEnabled: status.analysis_enabled ?? current.analysisEnabled,
      }));
    } catch (error) {
      setAutomationStatus(null);
      if (error instanceof CompanionApiError && error.code === "access_session_expired") {
        setMessage(copy.accessSessionExpired);
      }
    }
  };

  // Read runtime metadata once after hydration: save completion must not re-fetch and re-save forever.
  useEffect(() => {
    if (hydrated) void readAutomationStatus();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const serial = ++writeSerial.current;
    setStorage("saving");
    const timer = window.setTimeout(() => {
      const queued = writeQueue.current.catch(() => undefined).then(() => writeFeedState(subscriptions, items));
      writeQueue.current = queued.catch(() => undefined);
      void queued.then(() => {
        if (serial === writeSerial.current) setStorage("saved");
      }).catch(() => {
        if (serial === writeSerial.current) setStorage("error");
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [subscriptions, items, hydrated]);

  const saveSubscription = () => {
    try {
      if (!draft.name.trim()) throw new Error(copy.subscriptionNameRequired);
      const feedUrl = normaliseFeedUrl(draft.feed_url);
      if (!editingId && subscriptions.some((subscription) => subscription.feed_url === feedUrl)) throw new Error(copy.subscriptionDuplicate);
      const next = editingId
        ? subscriptions.map((subscription) => subscription.id === editingId ? { ...subscription, ...draft, name: draft.name.trim(), feed_url: feedUrl, expert_name: draft.expert_name.trim(), reason: draft.reason.trim(), topic_tags: draft.topic_tags.map((tag) => tag.trim()).filter(Boolean) } : subscription)
        : [...subscriptions, makeSubscription({ ...draft, feed_url: feedUrl })];
      setSubscriptions(next);
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
      setIsOpen(false);
      setMessage(copy.subscriptionSaved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.subscriptionInvalid);
    }
  };

  const editSubscription = (subscription: SourceSubscription) => {
    setEditingId(subscription.id);
    setDraft({ name: subscription.name, feed_url: subscription.feed_url, expert_name: subscription.expert_name, reason: subscription.reason, topic_tags: subscription.topic_tags, priority: subscription.priority ?? "medium", enabled: subscription.enabled });
    setIsOpen(true);
  };

  const removeSubscription = (subscription: SourceSubscription) => {
    if (!window.confirm(copy.removeSubscriptionConfirm)) return;
    setSubscriptions((current) => current.filter((item) => item.id !== subscription.id));
    setMessage(copy.subscriptionRemoved);
  };

  const syncSubscriptions = async (selected: SourceSubscription[]) => {
    const candidates = selected.slice(0, SOURCE_FEED_SOURCE_LIMIT);
    setSyncingIds(candidates.map((subscription) => subscription.id));
    setMessage(null);
    const results: Array<{ subscription: SourceSubscription; incoming: FeedItem[]; summary: FeedSyncSummary; etag: string | null; lastModified: string | null } | { subscription: SourceSubscription; error: string; summary: FeedSyncSummary }> = [];
    const startedAt = new Map(candidates.map((subscription) => [subscription.id, Date.now()]));
    await runWithLimit(candidates, 2, async (subscription) => {
      const attemptedAt = new Date().toISOString();
      try {
        const payload = await requestCompanionJson<{ not_modified?: boolean; etag?: string | null; last_modified?: string | null; items?: FeedItem[] }>("/feed", {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ url: subscription.feed_url, source_id: subscription.id, etag: subscription.etag, last_modified: subscription.last_modified }),
        });
        const incoming = (payload.items ?? []).map((item) => ({ ...item, source_id: subscription.id, source_refs: item.source_refs ?? [{ source_id: subscription.id, feed_url: subscription.feed_url, item_id: item.item_id }] }));
        results.push({ subscription, incoming, summary: { attempted_at: attemptedAt, status: payload.not_modified ? "not_modified" : "success", added: 0, duplicates: 0, updates: 0, skipped: 0, reason: null, duration_ms: Date.now() - (startedAt.get(subscription.id) ?? Date.now()) }, etag: payload.etag ?? subscription.etag, lastModified: payload.last_modified ?? subscription.last_modified });
      } catch (error) {
        const reason = error instanceof CompanionApiError ? error.code : error instanceof Error ? error.message : "feed_fetch_failed";
        results.push({ subscription, error: reason, summary: { attempted_at: attemptedAt, status: "failed", added: 0, duplicates: 0, updates: 0, skipped: 0, reason, duration_ms: Date.now() - (startedAt.get(subscription.id) ?? Date.now()) } });
      }
    });
    let mergedItems = items;
    const addedItems: FeedItem[] = [];
    const nextSubscriptions = subscriptions.map((subscription) => {
      const result = results.find((candidate) => candidate.subscription.id === subscription.id);
      if (!result) return subscription;
      if ("error" in result) return { ...subscription, last_attempted_at: result.summary.attempted_at, recent_runs: [result.summary, ...subscription.recent_runs].slice(0, 20) };
      const merged = mergeFeedItems(mergedItems, result.incoming);
      mergedItems = merged.items;
      addedItems.push(...merged.additions);
      const summary = { ...result.summary, added: merged.additions.length, duplicates: merged.duplicates.length, updates: merged.updates.length };
      return { ...subscription, etag: result.etag, last_modified: result.lastModified, last_attempted_at: summary.attempted_at, last_successful_at: summary.attempted_at, recent_runs: [summary, ...subscription.recent_runs].slice(0, 20) };
    });
    setItems(mergedItems);
    setSubscriptions(nextSubscriptions);
    onItemsImported(addedItems);
    setSyncingIds([]);
    const failed = results.filter((result) => "error" in result).length;
    const accessExpired = results.some((result) => "error" in result && result.error === "access_session_expired");
    setMessage(accessExpired ? copy.accessSessionExpired : failed ? copy.syncPartialFailure : copy.syncComplete);
  };

  const syncOne = (subscription: SourceSubscription) => void syncSubscriptions([subscription]);
  const syncAll = () => void syncSubscriptions(subscriptions.filter((subscription) => subscription.enabled));

  const exportSources = () => {
    const blob = new Blob([serializeSourceFeeds({ subscriptions, items })], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `source-subscriptions-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importSources = async (file: File) => {
    try {
      const parsed = parseSourceFeeds(await file.text());
      setSubscriptions(parsed.subscriptions);
      setItems(parsed.items);
      setMessage(copy.subscriptionBackupImported);
    } catch {
      setMessage(copy.subscriptionBackupInvalid);
    }
  };

  const handoffToRunner = async () => {
    if (subscriptions.filter((subscription) => subscription.enabled).length > SOURCE_FEED_SOURCE_LIMIT) {
      setMessage(copy.sourceLimitReached);
      return false;
    }
    setAutomationBusy(true);
    try {
      await requestCompanionJson("/automation/config", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({
          version: 1,
          collection_enabled: automation.collectionEnabled,
          analysis_enabled: automation.analysisEnabled,
          schedule: { enabled: automationStatus?.schedule?.enabled === true, timezone: "Asia/Hong_Kong", hour: 8, minute: 0 },
          subscriptions,
          projects,
        }),
      });
      setMessage(copy.automationSaved);
      await readAutomationStatus();
      return true;
    } catch (error) {
      setMessage(error instanceof CompanionApiError && error.code === "access_session_expired"
        ? copy.accessSessionExpired
        : error instanceof CompanionApiError && error.code === "automation_config_locked"
          ? copy.automationConfigBusy
          : error instanceof Error ? error.message : copy.automationUnavailable);
      return false;
    } finally {
      setAutomationBusy(false);
    }
  };

  const runAutomationNow = async () => {
    if (!await handoffToRunner()) return;
    setAutomationBusy(true);
    try {
      await requestCompanionJson("/automation/run", { method: "POST" });
      setMessage(copy.automationRunAccepted);
      setAutomationStatus((current) => ({ ...current, child_running: true }));
    } catch (error) {
      setMessage(error instanceof CompanionApiError && error.code === "access_session_expired"
        ? copy.accessSessionExpired
        : error instanceof Error ? error.message : copy.automationUnavailable);
    } finally {
      setAutomationBusy(false);
    }
  };

  const updateProject = (projectId: string, patch: Partial<ResearchProjectCard>) => {
    setProjects((current) => current.map((project) => project.id === projectId
      ? { ...project, ...patch, updated_at: new Date().toISOString() }
      : project));
  };

  return <section className="workbench-section subscriptions-panel">
    <div className="workbench-section-heading">
      <div><h2>{copy.subscriptionsTitle}</h2><p>{copy.subscriptionsHint}</p></div>
      <div className="action-row">
        <button type="button" className="secondary-button" onClick={() => { setEditingId(null); setDraft(EMPTY_DRAFT); setIsOpen(true); }}>{copy.addSubscription}</button>
        <button type="button" className="secondary-button" onClick={syncAll} disabled={syncingIds.length > 0 || subscriptions.filter((subscription) => subscription.enabled).length === 0}>{syncingIds.length > 0 ? copy.syncing : copy.syncAll}</button>
      </div>
    </div>
    <p className="field-hint" role="status">{storage === "saved" ? copy.subscriptionSavedLocally : storage === "error" ? copy.subscriptionStorageFailed : copy.subscriptionSaving}</p>
    {message ? <p className="workbench-notice" role="status">{message}</p> : null}
    {isOpen ? <div className="subscription-editor">
      <TextField label={copy.subscriptionName} value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
      <TextField label={copy.feedUrl} value={draft.feed_url} onChange={(value) => setDraft({ ...draft, feed_url: value })} placeholder="https://example.com/feed.xml" />
      <TextField label={copy.expertName} optionalLabel={copy.optional} value={draft.expert_name} onChange={(value) => setDraft({ ...draft, expert_name: value })} />
      <TextField label={copy.followReason} optionalLabel={copy.optional} value={draft.reason} onChange={(value) => setDraft({ ...draft, reason: value })} />
      <TextField label={copy.topicTags} optionalLabel={copy.optional} value={draft.topic_tags.join(", ")} onChange={(value) => setDraft({ ...draft, topic_tags: value.split(",") })} />
      <label className="field"><span>{copy.sourcePriority}</span><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as SubscriptionDraft["priority"] })}><option value="high">high</option><option value="medium">medium</option><option value="low">low</option></select></label>
      <label className="checkbox-field"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />{copy.subscriptionEnabled}</label>
      <div className="action-row"><button type="button" className="primary-button" onClick={saveSubscription}>{copy.saveSubscription}</button><button type="button" className="secondary-button" onClick={() => setIsOpen(false)}>{copy.cancelSubscription}</button></div>
    </div> : null}
    <div className="subscription-list">
      {subscriptions.length === 0 ? <p className="field-hint">{copy.noSubscriptions}</p> : subscriptions.map((subscription) => {
        const syncing = syncingIds.includes(subscription.id);
        const latest = subscription.recent_runs[0];
        return <article className="subscription-card" key={subscription.id}>
          <div className="material-card-heading"><strong>{subscription.name}</strong><span className={`status-pill status-${subscription.enabled ? "captured" : "failed"}`}>{subscription.enabled ? copy.subscriptionEnabled : copy.subscriptionDisabled}</span></div>
          <p>{subscription.feed_url}</p>
          {subscription.expert_name ? <p className="field-hint">{copy.expertName}：{subscription.expert_name}</p> : null}
          {latest ? <p className="field-hint">{latest.status === "failed" ? `${copy.syncFailed}：${(latest.reason === "feed_parse_failed" ? copy.feedNotRss : latest.reason ?? "")}` : `${copy.lastSync}：${latest.added} ${copy.addedItems}，${latest.duplicates} ${copy.duplicateItems}`}</p> : <p className="field-hint">{copy.notSynced}</p>}
          <div className="action-row"><button type="button" className="secondary-button" onClick={() => syncOne(subscription)} disabled={syncingIds.length > 0}>{syncing ? copy.syncing : copy.syncNow}</button><button type="button" className="secondary-button" onClick={() => editSubscription(subscription)}>{copy.editSubscription}</button><button type="button" className="secondary-button" onClick={() => setSubscriptions((current) => current.map((item) => item.id === subscription.id ? { ...item, enabled: !item.enabled } : item))}>{subscription.enabled ? copy.disableSubscription : copy.enableSubscription}</button><button type="button" className="secondary-button" onClick={() => removeSubscription(subscription)}>{copy.removeSubscription}</button></div>
        </article>;
      })}
    </div>
    <div className="action-row"><button type="button" className="secondary-button" onClick={exportSources}>{copy.exportSubscriptions}</button><label className="secondary-button file-button">{copy.importSubscriptions}<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSources(file); event.currentTarget.value = ""; }} /></label></div>
    <section className="automation-panel">
      <div className="workbench-section-heading"><div><h3>{copy.automationTitle}</h3><p>{copy.automationHint}</p></div><Link href="/research" className="secondary-button">{copy.researchPage}</Link></div>
      <label className="checkbox-field"><input type="checkbox" checked={automation.collectionEnabled} onChange={(event) => setAutomation({ ...automation, collectionEnabled: event.target.checked })} />{copy.collectionEnabled}</label>
      <label className="checkbox-field"><input type="checkbox" checked={automation.analysisEnabled} onChange={(event) => setAutomation({ ...automation, analysisEnabled: event.target.checked })} />{copy.analysisEnabled}</label>
      <p className="field-hint">{copy.automationAnalysisScope}</p>
      <p className="field-hint">{copy.automationProvider}：{automationStatus?.provider ?? "—"} · {automationStatus?.model ?? "—"} · {automationStatus?.model_configured ? copy.automationConfigured : copy.automationNotConfigured}</p>
      <p className="field-hint">{copy.automationLimits}：{automationStatus?.limits?.maxSources ?? 12} {copy.quotaSources} · {automationStatus?.limits?.maxBodyAttemptsPerDay ?? 10} {copy.quotaBodies} · {automationStatus?.limits?.maxAnalysisAttemptsPerDay ?? 10} {copy.quotaAi} · {automationStatus?.limits?.maxBriefsPerDay ?? 5} {copy.quotaBriefs} · {automationStatus?.limits?.maxActionsPerDay ?? 1} {copy.quotaActions}</p>
      <p className="field-hint">{copy.automationSchedule}</p>
      {automationStatus ? <p className="field-hint">{copy.automationStatus}：{automationStatus.current_date ?? "—"} · {automationStatus.child_running ? copy.automationRunning : automationStatus.last_run?.status ?? copy.automationNotRun} · {copy.automationFailures} {automationStatus.failed_material_count ?? 0}</p> : <p className="field-hint">{copy.automationUnavailable}</p>}
      <div className="action-row"><button type="button" className="secondary-button" onClick={() => void handoffToRunner()} disabled={automationBusy}>{copy.handoffToRunner}</button><button type="button" className="primary-button" onClick={() => void runAutomationNow()} disabled={automationBusy || (!automation.collectionEnabled && !automation.analysisEnabled) || (automation.collectionEnabled && subscriptions.filter((subscription) => subscription.enabled).length === 0)}>{automationBusy ? copy.automationRunning : copy.automationRun}</button></div>
      <details className="workbench-details"><summary>{copy.projectCards}</summary><p className="field-hint">{copy.projectCardsHint}</p>{projects.map((project) => <article className="project-card" key={project.id}><strong>{project.name}</strong>{project.updated_at ? <p className="field-hint">{copy.projectUpdatedAt}：{project.updated_at}</p> : null}<TextField label={copy.projectGoal} value={project.goal} onChange={(value) => updateProject(project.id, { goal: value })} /><TextField label={copy.projectStage} value={project.stage} onChange={(value) => updateProject(project.id, { stage: value })} /><TextField label={copy.projectBlocker} value={project.blocker} onChange={(value) => updateProject(project.id, { blocker: value })} /><TextField label={copy.projectNonGoal} value={project.non_goal} onChange={(value) => updateProject(project.id, { non_goal: value })} /><label className="field"><span>{copy.projectPriority}</span><select value={project.priority} onChange={(event) => updateProject(project.id, { priority: event.target.value as ResearchProjectCard["priority"] })}><option value="high">high</option><option value="medium">medium</option><option value="low">low</option></select></label></article>)}</details>
    </section>
  </section>;
}

function TextField({ label, value, onChange, placeholder, optionalLabel }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; optionalLabel?: string }) {
  return <label className="field"><span>{label}{optionalLabel ? `（${optionalLabel}）` : ""}</span><input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}
