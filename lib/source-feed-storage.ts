import type { FeedItem, PersistedSourceFeeds, SourceSubscription } from "./source-feed.ts";
import { parseSourceFeeds, serializeSourceFeeds } from "./source-feed.ts";

export { parseSourceFeeds, serializeSourceFeeds };
export type { FeedItem, PersistedSourceFeeds, SourceSubscription };

export function emptySourceFeedState() {
  return { subscriptions: [] as SourceSubscription[], items: [] as FeedItem[] };
}
