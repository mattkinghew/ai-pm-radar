import fs from 'node:fs';
import path from 'node:path';

const inputJson = process.argv[2] || './output/threads-cleaned/radar-threads-inbox.json';
const outDir = process.argv[3] || './output/threads-cleaned/radar-import';

const data = JSON.parse(fs.readFileSync(inputJson, 'utf8'));
const validItems = (data.items || []).filter((i) => !i.quarantined);

function sanitizeBody(text) {
  return String(text || '')
    .replace(/\r\n/gu, '\n')
    .replace(/^\s*-{3,}\s*$/gmu, '———')
    .trim();
}

function toNoteBlock(rec) {
  const title = String(rec.title || '未命名筆記').replace(/\s+/gu, ' ').slice(0, 180);
  const handleTag = rec.author_handle ? `#${rec.author_handle.replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
  const tagsLine = `#threads_saved #${rec.lane} ${handleTag}`.trim();
  const body = sanitizeBody(rec.raw_text);
  const reposLine = rec.github_repos?.length ? `GitHub: ${rec.github_repos.join(' ')}\n` : '';

  return [
    `# ${title}`,
    `來源：${rec.canonical_url}`,
    `發布時間：${(rec.published_at || 'unknown').slice(0, 10)} | 確定性評分：${rec.pref_score}`,
    reposLine ? reposLine.trim() : null,
    tagsLine,
    '',
    body,
  ]
    .filter((l) => l !== null)
    .join('\n')
    .slice(0, 7900);
}

fs.mkdirSync(outDir, { recursive: true });
const batchDir = path.join(outDir, 'kb-batches');
fs.mkdirSync(batchDir, { recursive: true });

// 1. 產出 10 筆 Pilot（5 筆 GITHUB_PROJECT + 5 筆 AGENT_GOVERNANCE，按分數與互動排序）
const sortFn = (a, b) => (b.pref_score - a.pref_score) || ((b.metrics?.shares || 0) - (a.metrics?.shares || 0));
const pilotGithub = validItems.filter((i) => i.lane === 'GITHUB_PROJECT').sort(sortFn).slice(0, 5);
const pilotGov = validItems.filter((i) => i.lane === 'AGENT_GOVERNANCE').sort(sortFn).slice(0, 5);
const pilotItems = [...pilotGithub, ...pilotGov];

fs.writeFileSync(
  path.join(outDir, 'pilot-10-kb.txt'),
  pilotItems.map(toNoteBlock).join('\n\n---\n\n'),
  'utf8'
);

// 2. 產出全量 493 筆分批檔（每批 <= 50 筆，配合 parseNotes 上限）
const BATCH_SIZE = 50;
let batchCount = 0;
for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
  batchCount += 1;
  const slice = validItems.slice(i, i + BATCH_SIZE);
  const batchName = `batch-${String(batchCount).padStart(2, '0')}.txt`;
  fs.writeFileSync(
    path.join(batchDir, batchName),
    slice.map(toNoteBlock).join('\n\n---\n\n'),
    'utf8'
  );
}

// 3. 抽出所有不重複 GitHub Repo URL 供 /api/source-imports/preview 使用
const githubUrls = [...new Set(
  validItems
    .flatMap((i) => i.github_repos || [])
    .map((u) => {
      const m = u.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
      return m ? `https://github.com/${m[1]}/${m[2].replace(/\.git$/i, '')}` : null;
    })
    .filter(Boolean)
)].sort();

fs.writeFileSync(
  path.join(outDir, 'github-sources.txt'),
  githubUrls.join('\n') + '\n',
  'utf8'
);

console.log(JSON.stringify({
  validItems: validItems.length,
  pilotCount: pilotItems.length,
  kbBatches: batchCount,
  uniqueGithubRepos: githubUrls.length,
  outDir,
}, null, 2));
