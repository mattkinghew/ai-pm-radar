import fs from 'node:fs';
import path from 'node:path';

const [, , outDir = './output/threads-cleaned', ...inputFiles] = process.argv;

if (inputFiles.length === 0) {
  console.error('Usage: node scripts/clean-threads-archive.mjs <outDir> <file1.json> [file2.json ...]');
  process.exit(1);
}

const NOISE_KEYWORDS = [
  '招聘', '急聘', '兼職', '誠聘', '徵求', '徵才', '招募', '求賜教', '大賽正式開始',
  '蹲了三天监狱', '胰臟癌', '戒了90多天', '過臨時生活', '存款來到100萬', '徵求｜'
];

const LANE_RULES = [
  {
    lane: 'GITHUB_PROJECT',
    pattern: /(github\.com\/[\w.-]+\/[\w.-]+|npx\s+skills\s+add|開源|开源|顆星|颗星|倉庫|仓库|repo)/i,
    score: 85,
  },
  {
    lane: 'FREE_RESOURCE',
    pattern: /(免費|免费|白嫖|credits|算力補貼|算力平台|優惠|优惠|Token Lab|AWS-Quick|Editkin|補助|資助|基金)/i,
    score: 82,
  },
  {
    lane: 'AGENT_GOVERNANCE',
    pattern: /(資安|资安|漏洞|MCP|Skill|sandbox|NIST|codex-security|逆向|防蒸餾|權限|权限|第二大腦|第二大脑|LLM Wiki|守門人|隔離|隔离|合規|合规)/i,
    score: 84,
  },
  {
    lane: 'MONETIZATION_GAP',
    pattern: /(一人公司|副業|副业|變現|变现|搞錢|搞钱|訊息差|信息差|Gumroad|閒魚|闲鱼|接案|獨立開發|独立开发|出海|跨境|付費|付费|變現)/i,
    score: 82,
  },
  {
    lane: 'AI_LEARNING_PATH',
    pattern: /(學習路徑|学习路径|課程|课程|Claude Academy|System Design|教學|教学|教程|手冊|手册|讀書|读书|面試|面试|碩士|硕士)/i,
    score: 76,
  },
  {
    lane: 'CONTENT_WORKFLOW',
    pattern: /(剪輯|剪辑|短劇|短剧|漫劇|漫剧|Reels|分鏡|分镜|去\s*AI\s*味|文案|SEO|GEO|簡報|简报|電子報|电子报|提示詞|提示词|Prompt)/i,
    score: 78,
  },
  {
    lane: 'TECH_NEWS',
    pattern: /(發布|发布|推出|開源了|开源了|OpenAI|Anthropic|Google|Gemini|Claude|Codex|Cursor|Copilot|Manus|Grok|Qwen|DeepSeek|YC\b|報告|报告)/i,
    score: 72,
  },
  {
    lane: 'APPLY_NOW',
    pattern: /(工作流|Workflow|SOP|自動化|自动化|儀表板|仪表板|Agent|代理|原型|Prototype|實測|实测)/i,
    score: 74,
  },
];

function extractUrls(text) {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s<>"'）】\]，。！？]+/g) || [];
  return [...new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, '')))];
}

function classifyItem(item) {
  const text = (item.text || '').trim();
  const urls = extractUrls(text);
  const githubRepos = urls.filter((u) => /github\.com\/[^/]+\/[^/]+/i.test(u));

  if (text.length < 20 && urls.length === 0) {
    return {
      lane: 'OTHER',
      review_status: 'NEEDS_SOURCE_REVIEW',
      quarantined: true,
      quarantine_reason: text.length === 0 ? 'empty_text' : 'insufficient_context',
      pref_score: 10,
      urls,
      githubRepos,
    };
  }

  const hitNoise = NOISE_KEYWORDS.find((kw) => text.includes(kw));
  if (hitNoise) {
    return {
      lane: 'OTHER',
      review_status: 'QUARANTINED_NOISE',
      quarantined: true,
      quarantine_reason: `noise_keyword:${hitNoise}`,
      pref_score: 15,
      urls,
      githubRepos,
    };
  }

  for (const rule of LANE_RULES) {
    if (rule.pattern.test(text)) {
      return {
        lane: rule.lane,
        review_status: 'READY_FOR_INBOX',
        quarantined: false,
        quarantine_reason: null,
        pref_score: rule.score,
        urls,
        githubRepos,
      };
    }
  }

  return {
    lane: 'OTHER',
    review_status: 'READY_FOR_INBOX',
    quarantined: false,
    quarantine_reason: null,
    pref_score: 50,
    urls,
    githubRepos,
  };
}

const dedupMap = new Map();
let totalRawCount = 0;

for (const filePath of inputFiles) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(raw)) continue;
  for (const entry of raw) {
    totalRawCount += 1;
    const key = String(entry.id || entry.url);
    if (!dedupMap.has(key)) dedupMap.set(key, entry);
  }
}

const cleanedRecords = [];
const stats = { totalRawCount, uniqueCount: dedupMap.size, quarantined: 0, byLane: {} };

for (const item of dedupMap.values()) {
  const meta = classifyItem(item);
  if (meta.quarantined) stats.quarantined += 1;
  stats.byLane[meta.lane] = (stats.byLane[meta.lane] || 0) + 1;

  const titleLine = (item.text || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0) || `[Threads ${item.author?.handle || item.id}]`;

  cleanedRecords.push({
    source_id: `threads:${item.id}`,
    source_type: 'threads_saved_json',
    canonical_url: item.url,
    title: titleLine.slice(0, 100),
    title_provenance: 'extracted_first_line',
    author_handle: item.author?.handle || null,
    author_name: item.author?.name || null,
    published_at: item.takenAt || null,
    captured_at: item.capturedAt || null,
    lane: meta.lane,
    pref_score: meta.pref_score,
    review_status: meta.review_status,
    quarantined: meta.quarantined,
    quarantine_reason: meta.quarantine_reason,
    extracted_urls: meta.urls,
    github_repos: meta.githubRepos,
    has_expiring_media: Array.isArray(item.media) && item.media.length > 0,
    media_count: Array.isArray(item.media) ? item.media.length : 0,
    metrics: {
      likes: item.likeCount ?? 0,
      replies: item.replyCount ?? 0,
      reposts: item.repostCount ?? 0,
      shares: item.shareCount ?? 0,
    },
    raw_text: item.text || '',
  });
}

fs.mkdirSync(outDir, { recursive: true });
const mdRoot = path.join(outDir, 'kb-markdown');
fs.mkdirSync(mdRoot, { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'radar-threads-inbox.json'),
  JSON.stringify({ generated_at: new Date().toISOString(), stats, items: cleanedRecords }, null, 2),
  'utf8'
);

for (const rec of cleanedRecords) {
  if (rec.quarantined) continue;
  const laneDir = path.join(mdRoot, rec.lane);
  fs.mkdirSync(laneDir, { recursive: true });
  const datePrefix = (rec.published_at || 'unknown-date').slice(0, 10);
  const safeHandle = (rec.author_handle || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '');
  const mdPath = path.join(laneDir, `${datePrefix}_${safeHandle}_${rec.source_id.split(':')[1]}.md`);

  const mdContent = [
    '---',
    `source_id: "${rec.source_id}"`,
    `source_type: "${rec.source_type}"`,
    `canonical_url: "${rec.canonical_url}"`,
    `author: "${rec.author_handle || ''}"`,
    `published_at: "${rec.published_at || ''}"`,
    `lane: "${rec.lane}"`,
    `pref_score: ${rec.pref_score}`,
    `review_status: "${rec.review_status}"`,
    `github_repos: ${JSON.stringify(rec.github_repos)}`,
    '---',
    '',
    `# ${rec.title}`,
    '',
    `- **來源連結**：${rec.canonical_url}`,
    `- **作者**：${rec.author_name || ''} (${rec.author_handle || ''})`,
    `- **研究軌道**：\`${rec.lane}\`（確定性評分：${rec.pref_score}）`,
    rec.github_repos.length ? `- **提取 GitHub 專案**：${rec.github_repos.join(', ')}` : null,
    '',
    '## 原文內容',
    '',
    rec.raw_text,
    '',
  ]
    .filter((line) => line !== null)
    .join('\n');

  fs.writeFileSync(mdPath, mdContent, 'utf8');
}

console.log('清洗與歸檔完成：', JSON.stringify(stats, null, 2));
