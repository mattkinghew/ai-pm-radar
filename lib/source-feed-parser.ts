import { XMLParser, XMLValidator } from "fast-xml-parser";

import {
  SOURCE_FEED_ITEM_LIMIT,
  type FeedContentKind,
  type FeedItem,
  normaliseArticleUrl,
  stableFeedId,
} from "./source-feed.ts";

export type ParsedFeed = {
  format: "rss" | "atom";
  title: string | null;
  home_url: string | null;
  updated_at: string | null;
  items: FeedItem[];
};

function asArray(value: unknown) {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function textValue(value: unknown): string {
  if (Array.isArray(value)) return textValue(value[0]);
  if (typeof value === "string" || typeof value === "number") return decodeBasicEntities(String(value).trim());
  if (!value || typeof value !== "object") return "";
  const candidate = value as Record<string, unknown>;
  return decodeBasicEntities(String(candidate["#text"] ?? candidate["#cdata"] ?? "").trim());
}

function firstText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = textValue(record[key]);
    if (value) return value;
  }
  return null;
}

function contentToText(value: string | null) {
  if (!value) return null;
  return value
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function atomLink(record: Record<string, unknown>, baseUrl: string) {
  for (const link of asArray(record.link)) {
    if (typeof link === "string") return normaliseArticleUrl(link, baseUrl);
    if (link && typeof link === "object") {
      const value = link as Record<string, unknown>;
      const href = typeof value["@_href"] === "string" ? value["@_href"] : null;
      const rel = typeof value["@_rel"] === "string" ? value["@_rel"] : "alternate";
      if (href && (rel === "alternate" || rel === "related")) return normaliseArticleUrl(href, baseUrl);
    }
  }
  return null;
}

function validDate(value: string | null) {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function makeItem({
  feedUrl,
  sourceId,
  itemId,
  articleUrl,
  title,
  creator,
  publishedAt,
  updatedAt,
  summary,
  content,
  contentKind,
  discoveredAt,
}: {
  feedUrl: string;
  sourceId: string;
  itemId: string;
  articleUrl: string | null;
  title: string;
  creator: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  summary: string | null;
  content: string | null;
  contentKind: FeedContentKind;
  discoveredAt: string;
}): FeedItem {
  return {
    id: stableFeedId(`${feedUrl}|${itemId || articleUrl || title}`),
    feed_url: feedUrl,
    source_id: sourceId,
    item_id: itemId || articleUrl || title,
    article_url: articleUrl,
    title: title || "Untitled feed item",
    creator: creator || null,
    published_at: validDate(publishedAt),
    updated_at: validDate(updatedAt),
    summary: summary || null,
    content: content || null,
    content_kind: contentKind,
    discovered_at: discoveredAt,
    source_refs: [{ source_id: sourceId, feed_url: feedUrl, item_id: itemId || articleUrl || title }],
  };
}

export function parseFeedXml(xml: string, feedUrl: string, sourceId: string, discoveredAt = new Date().toISOString()): ParsedFeed {
  if (typeof xml !== "string" || !xml.trim()) throw new Error("Feed response is empty.");
  if (/<!DOCTYPE\b/i.test(xml) || /<!ENTITY\b/i.test(xml)) throw new Error("Feed DTD and entities are not accepted.");
  const validation = XMLValidator.validate(xml);
  if (validation !== true) throw new Error("Feed XML is malformed.");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    cdataPropName: "#cdata",
    processEntities: false,
    trimValues: true,
    isArray: (name) => ["item", "entry", "link", "category", "author"].includes(name),
  });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const atom = parsed.feed as Record<string, unknown> | undefined;
  const format = channel ? "rss" : atom ? "atom" : null;
  if (!format) throw new Error("Feed root must be RSS or Atom.");
  const container = channel ?? atom as Record<string, unknown>;
  const entries = asArray(container[format === "rss" ? "item" : "entry"]) as Record<string, unknown>[];
  if (entries.length === 0) throw new Error("Feed contains no entries.");
  const title = firstText(container, ["title"]);
  const homeUrl = format === "rss"
    ? normaliseArticleUrl(firstText(container, ["link"]), feedUrl)
    : atomLink(container, feedUrl);
  const updatedAt = validDate(firstText(container, ["updated", "lastBuildDate", "pubDate"]));
  const items = entries.slice(0, SOURCE_FEED_ITEM_LIMIT).flatMap((entry) => {
    const titleValue = firstText(entry, ["title"]);
    const articleUrl = format === "rss"
      ? normaliseArticleUrl(firstText(entry, ["link"]), feedUrl)
      : atomLink(entry, feedUrl);
    const itemId = firstText(entry, format === "rss" ? ["guid", "id", "link"] : ["id", "link"]) ?? "";
    const creator = firstText(entry, ["dc:creator", "author", "creator"])
      ?? (entry.author && typeof entry.author === "object" ? firstText(entry.author as Record<string, unknown>, ["name"]) : null);
    const publishedAt = firstText(entry, ["pubDate", "published", "date"]);
    const entryUpdated = firstText(entry, ["updated", "modified"]);
    const content = contentToText(firstText(entry, format === "rss" ? ["content:encoded", "content"] : ["content"]));
    const summary = contentToText(firstText(entry, format === "rss" ? ["description", "summary"] : ["summary", "description"]));
    const contentKind: FeedContentKind = content ? "feed_content" : summary ? "summary" : "metadata";
    const item = makeItem({ feedUrl, sourceId, itemId, articleUrl, title: titleValue ?? "", creator, publishedAt, updatedAt: entryUpdated, summary, content, contentKind, discoveredAt });
    return item.article_url || item.title !== "Untitled feed item" ? [item] : [];
  });
  return { format, title, home_url: homeUrl, updated_at: updatedAt, items };
}
