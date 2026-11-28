const NOISE_KEYWORDS = [
  '招聘', '急聘', '兼職', '誠聘', '徵求', '徵才', '招募', '求賜教', '大賽正式開始',
  '蹲了三天监狱', '胰臟癌', '戒了90多天', '過臨時生活', '存款來到100萬', '徵求｜'
];

const LANE_RULES = [
  ['GITHUB_PROJECT', /(github\.com\/[\w.-]+\/[\w.-]+|npx\s+skills\s+add|開源|开源|顆星|颗星|倉庫|仓库|repo)/i, 85],
  ['FREE_RESOURCE', /(免費|免费|白嫖|credits|算力補貼|算力平台|優惠|优惠|Token Lab|AWS-Quick|Editkin|補助|資助|基金)/i, 82],
  ['AGENT_GOVERNANCE', /(資安|资安|漏洞|MCP|Skill|sandbox|NIST|codex-security|逆向|防蒸餾|權限|权限|第二大腦|第二大脑|LLM Wiki|守門人|隔離|隔离|合規|合规)/i, 84],
  ['MONETIZATION_GAP', /(一人公司|副業|副业|變現|变现|搞錢|搞钱|訊息差|信息差|Gumroad|閒魚|闲鱼|接案|獨立開發|独立开发|出海|跨境|付費|付费|變現)/i, 82],
  ['AI_LEARNING_PATH', /(學習路徑|学习路径|課程|课程|Claude Academy|System Design|教學|教学|教程|手冊|手册|讀書|读书|面試|面试|碩士|硕士)/i, 76],
  ['CONTENT_WORKFLOW', /(剪輯|剪辑|短劇|短剧|漫劇|漫剧|Reels|分鏡|分镜|去\s*AI\s*味|文案|SEO|GEO|簡報|简报|電子報|电子报|提示詞|提示词|Prompt)/i, 78],
  ['TECH_NEWS', /(發布|发布|推出|開源了|开源了|OpenAI|Anthropic|Google|Gemini|Claude|Codex|Cursor|Copilot|Manus|Grok|Qwen|DeepSeek|YC\b|報告|报告)/i, 72],
  ['APPLY_NOW', /(工作流|Workflow|SOP|自動化|自动化|儀表板|仪表板|Agent|代理|原型|Prototype|實測|实测)/i, 74]
];

const urlMatches = (text) => String(text || '').match(/https?:\/\/[^\s<>"'）】\]，。！？]+/g) || [];
const trimUrl = (value) => String(value).replace(/[.,;:!?)]+$/u, '');

function canonicalUrl(value) {
  try {
    const url = new URL(trimUrl(value));
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/$/u, '') || '/';
    return url.toString().replace(/\/$/u, '');
  } catch { return ''; }
}

function findEntries(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return null;
  for (const key of ['threads', 'posts', 'items', 'records', 'data']) {
    if (Array.isArray(value[key]) && value[key].length) return value[key];
    const nested = findEntries(value[key]);
    if (nested?.length) return nested;
  }
  return null;
}

function classify(text) {
  const urls = [...new Set(urlMatches(text).map(trimUrl))];
  const githubRepos = [...new Set(urls.map((value) => {
    const match = value.match(/^https?:\/\/github\.com\/([^/\s?#]+)\/([^/\s?#]+)/iu);
    return match ? `https://github.com/${match[1].toLowerCase()}/${match[2].replace(/\.git$/iu, '').toLowerCase()}` : null;
  }).filter(Boolean))];
  if (text.length < 20 && urls.length === 0) return { lane: 'OTHER', pref_score: 10, quarantined: true, quarantine_reason: text.length ? 'insufficient_context' : 'empty_text', urls, github_repos: githubRepos };
  const noise = NOISE_KEYWORDS.find((keyword) => text.includes(keyword));
  if (noise) return { lane: 'OTHER', pref_score: 15, quarantined: true, quarantine_reason: `noise_keyword:${noise}`, urls, github_repos: githubRepos };
  const rule = LANE_RULES.find(([, pattern]) => pattern.test(text));
  return { lane: rule?.[0] || 'OTHER', pref_score: rule?.[2] || 50, quarantined: false, quarantine_reason: null, urls, github_repos: githubRepos };
}

function normalizeItem(item) {
  const text = typeof item.text === 'string' ? item.text : typeof item.content === 'string' ? item.content : typeof item.caption === 'string' ? item.caption : '';
  const author = item.author && typeof item.author === 'object' ? item.author : {};
  const url = canonicalUrl(item.url || item.permalink || item.link || '');
  return {
    id: String(item.id || item.post_id || item.postId || '').trim(),
    canonical_url: url,
    text: text.trim(),
    author_handle: String(author.handle || author.username || item.author_handle || '').replace(/^@/u, '').trim(),
    published_at: String(item.takenAt || item.published_at || item.timestamp || '').trim()
  };
}

function sanitizeBody(text) {
  return String(text || '').replace(/\r\n/gu, '\n').replace(/^\s*-{3,}\s*$/gmu, '———').trim();
}

function noteBlock(record) {
  const title = (record.title || '未命名筆記').replace(/\s+/gu, ' ').slice(0, 180);
  const handleTag = record.author_handle ? `#${record.author_handle.replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
  const tags = `#threads_saved #${record.lane} ${handleTag}`.trim();
  const repos = record.github_repos.length ? `GitHub: ${record.github_repos.join(' ')}\n` : '';
  return [`# ${title}`, `來源：${record.canonical_url || ''}`, `發布時間：${(record.published_at || 'unknown').slice(0, 10)} | 確定性評分：${record.pref_score}`, repos.trim() || null, tags, '', sanitizeBody(record.raw_text)]
    .filter((line) => line !== null).join('\n').slice(0, 7900);
}

export function cleanThreadsExport(input) {
  let parsed;
  try { parsed = typeof input === 'string' ? JSON.parse(input) : input; }
  catch { throw new Error('JSON 格式無效，請選擇有效的 Threads 匯出檔。'); }
  const entries = findEntries(parsed);
  if (!entries?.length) throw new Error('JSON 內沒有可處理的貼文資料。');

  const ids = new Set(), urls = new Set(), unique = [];
  for (const raw of entries) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const item = normalizeItem(raw);
    const idKey = item.id ? `id:${item.id}` : '';
    const urlKey = item.canonical_url ? `url:${item.canonical_url}` : '';
    if ((idKey && ids.has(idKey)) || (urlKey && urls.has(urlKey))) continue;
    if (idKey) ids.add(idKey);
    if (urlKey) urls.add(urlKey);
    unique.push(item);
  }
  if (!unique.length) throw new Error('JSON 內沒有可辨識的貼文項目。');

  const items = unique.map((item) => {
    const meta = classify(item.text);
    const title = item.text.split('\n').map((line) => line.trim()).find(Boolean) || `[Threads ${item.author_handle || item.id || 'post'}]`;
    const githubRepos = [...new Set([...meta.github_repos, ...meta.urls.map((url) => {
      const match = url.match(/^https?:\/\/github\.com\/([^/\s?#]+)\/([^/\s?#]+)/iu);
      return match ? `https://github.com/${match[1].toLowerCase()}/${match[2].replace(/\.git$/iu, '').toLowerCase()}` : null;
    }).filter(Boolean)])];
    return { ...meta, external_id: item.id, github_repos: githubRepos, title: title.slice(0, 100), canonical_url: item.canonical_url, author_handle: item.author_handle, published_at: item.published_at, raw_text: item.text };
  });
  const validItems = items.filter((item) => !item.quarantined);
  const byLane = Object.fromEntries(items.reduce((counts, item) => counts.set(item.lane, (counts.get(item.lane) || 0) + 1), new Map()));
  const githubRepos = [...new Set(validItems.flatMap((item) => item.github_repos))].sort();
  const batches = [];
  for (let i = 0; i < validItems.length; i += 50) {
    const batchItems = validItems.slice(i, i + 50);
    batches.push({ items: batchItems, text: batchItems.map(noteBlock).join('\n\n---\n\n') });
  }
  return { rawCount: entries.length, uniqueCount: items.length, items, validItems, quarantinedItems: items.filter((item) => item.quarantined), byLane, githubRepos, batches };
}
