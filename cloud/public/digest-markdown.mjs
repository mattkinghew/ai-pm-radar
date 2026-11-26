const line = (value) => String(value ?? "").replace(/[\s\u0000-\u001f\u007f]+/gu, " ").trim();
const text = (value) => line(value).replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/[\\`*_[\]{}()!|#~]/gu, "\\$&");
const array = (value) => Array.isArray(value) ? value : [];
const link = (item) => {
  const title = text(item.title) || "未命名訊號";
  try {
    const url = new URL(line(item.url));
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return title;
    return `[${title}](${url.href.replace(/[()]/gu, (c) => c === "(" ? "%28" : "%29")})`;
  } catch { return title; }
};

export function formatDigestMarkdown(digestPayload) {
  const d = digestPayload || {}, lanes = array(d.lanes), highlights = array(d.top_highlights).slice(0, 3);
  const weekly = d.window === "weekly", date = line(d.date_label) || "日期未提供";
  const output = [weekly ? `# AI PM Radar 每週精選週報（${date}）` : `# AI PM Radar 今日晨報（${date} HKT）`, "",
    `共 ${Number(d.total_items) || 0} 則訊號｜涵蓋 ${lanes.length} 個 Research Lane`, ""];
  if (!lanes.some((l) => array(l.items).length)) return [...output, "暫無已批准的可分享訊號。", ""].join("\n");
  output.push("## Top 3 重點快覽", "");
  for (const item of highlights) output.push(`- **${link(item)}**（Score: ${text(item.score ?? "–")}）— ${text(item.summary || array(item.key_points)[0] || "暫無摘要")}`);
  for (const lane of lanes) {
    output.push("", `## ${text(lane.lane)}`, "");
    for (const item of array(lane.items)) {
      output.push(`- **${link(item)}**（Score: ${text(item.score ?? "–")}｜${text(item.source || "來源未提供")}）`);
      if (item.summary) output.push(`  ${text(item.summary)}`);
      for (const point of array(item.key_points)) output.push(`  - ${text(point)}`);
    }
  }
  return output.join("\n") + "\n";
}
