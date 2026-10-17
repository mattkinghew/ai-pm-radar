export const SOURCE_FEED_STORAGE_VERSION = 1 as const;
export const SOURCE_FEED_ITEM_LIMIT = 20;
export const SOURCE_FEED_SOURCE_LIMIT = 12;

export type FeedContentKind = "metadata" | "summary" | "feed_content";

export type SourceCollectionProvenance = {
  version: 1;
  feed_url: string;
  source_id: string;
  item_id: string;
  content_kind: FeedContentKind;
  discovered_at: string;
  feed_updated_at: string | null;
};

export type FeedItem = {
  id: string;
  feed_url: string;
  source_id: string;
  item_id: string;
  article_url: string | null;
  title: string;
  creator: string | null;
  published_at: string | null;
  updated_at: string | null;
  summary: string | null;
  content: string | null;
  content_kind: FeedContentKind;
  discovered_at: string;
  source_refs: Array<{ source_id: string; feed_url: string; item_id: string }>;
};

export type SourceSubscription = {
  id: string;
  name: string;
  feed_url: string;
  expert_name: string;
  reason: string;
  topic_tags: string[];
  priority: "high" | "medium" | "low";
  enabled: boolean;
  last_attempted_at: string | null;
  last_successful_at: string | null;
  etag: string | null;
  last_modified: string | null;
  recent_runs: FeedSyncSummary[];
};

export type FeedSyncSummary = {
  attempted_at: string;
  status: "success" | "not_modified" | "failed";
  added: number;
  duplicates: number;
  updates: number;
  skipped: number;
  reason: string | null;
  duration_ms: number;
};

export type PersistedSourceFeeds = {
  version: typeof SOURCE_FEED_STORAGE_VERSION;
  saved_at: string;
  subscriptions: SourceSubscription[];
  items: FeedItem[];
};

export function mergeRuntimeSubscriptionMetadata(
  local: SourceSubscription[],
  runtime: SourceSubscription[],
) {
  const runtimeById = new Map(runtime.map((subscription) => [subscription.id, subscription]));
  let changed = false;
  const merged = local.map((subscription) => {
    const incoming = runtimeById.get(subscription.id);
    if (!incoming || incoming.feed_url !== subscription.feed_url) return subscription;
    const next = {
      ...subscription,
      last_attempted_at: incoming.last_attempted_at,
      last_successful_at: incoming.last_successful_at,
      etag: incoming.etag,
      last_modified: incoming.last_modified,
      recent_runs: incoming.recent_runs,
    };
    if (JSON.stringify(next) === JSON.stringify(subscription)) return subscription;
    changed = true;
    return next;
  });
  return changed ? merged : local;
}

export function stableFeedId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `feed_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function normaliseFeedUrl(value: string) {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Feed URL must use http or https.");
  if (parsed.username || parsed.password) throw new Error("Feed URL credentials are not allowed.");
  parsed.hash = "";
  return parsed.toString();
}

export function normaliseArticleUrl(value: string | null, baseUrl: string) {
  if (!value?.trim()) return null;
  try {
    const parsed = new URL(value.trim(), baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_[a-z0-9_]+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function feedItemDeduplicationKey(item: Pick<FeedItem, "feed_url" | "item_id" | "article_url">) {
  if (item.item_id.trim()) return `${normaliseFeedUrl(item.feed_url)}|id:${item.item_id.trim()}`;
  if (item.article_url) return `url:${item.article_url}`;
  return `${normaliseFeedUrl(item.feed_url)}|unknown`;
}

export function mergeFeedItems(existing: FeedItem[], incoming: FeedItem[]) {
  const byKey = new Map(existing.map((item) => [feedItemDeduplicationKey(item), item]));
  const byUrl = new Map(existing.filter((item) => item.article_url).map((item) => [item.article_url as string, item]));
  const additions: FeedItem[] = [];
  const duplicates: FeedItem[] = [];
  const updates: FeedItem[] = [];
  for (const item of incoming) {
    const key = feedItemDeduplicationKey(item);
    const previous = byKey.get(key) ?? (item.article_url ? byUrl.get(item.article_url) : undefined);
    if (!previous) {
      byKey.set(key, item);
      if (item.article_url) byUrl.set(item.article_url, item);
      additions.push(item);
      continue;
    }
    const sourceRef = item.source_refs?.[0];
    const previousRefs = previous.source_refs ?? [];
    if (sourceRef && !previousRefs.some((ref) => ref.source_id === sourceRef.source_id && ref.item_id === sourceRef.item_id)) {
      previous.source_refs = [...previousRefs, sourceRef];
    }
    if (item.updated_at && item.updated_at !== previous.updated_at) updates.push(item);
    duplicates.push(previous);
  }
  return { items: [...byKey.values()], additions, duplicates, updates };
}

export function serializeSourceFeeds(value: Omit<PersistedSourceFeeds, "version" | "saved_at">, savedAt = new Date().toISOString()) {
  return JSON.stringify({ version: SOURCE_FEED_STORAGE_VERSION, saved_at: savedAt, ...value });
}

export function parseSourceFeeds(value: string): PersistedSourceFeeds {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") throw new Error("Source feed backup must be a JSON object.");
  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== SOURCE_FEED_STORAGE_VERSION) throw new Error("Unsupported source feed backup version.");
  if (!Array.isArray(candidate.subscriptions) || !Array.isArray(candidate.items)) throw new Error("Source feed backup collections are invalid.");
  if (typeof candidate.saved_at !== "string" || Number.isNaN(Date.parse(candidate.saved_at))) throw new Error("Source feed backup saved_at must be an ISO date.");
  return {
    ...(candidate as unknown as PersistedSourceFeeds),
    subscriptions: candidate.subscriptions.map((value) => {
      const subscription = value as SourceSubscription;
      return {
        ...subscription,
        priority: subscription.priority === "high" || subscription.priority === "low" ? subscription.priority : "medium",
      };
    }),
  };
}
