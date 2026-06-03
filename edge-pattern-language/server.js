const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const REPO = process.env.GITHUB_REPO || 'davidwhitehill-beep/davidwhitehill-beep.github.io';
const PATTERN_FILE = process.env.PATTERN_FILE || 'edge-pattern-language/patterns.json';
const TOKEN = process.env.GITHUB_TOKEN;
const BRANCH = process.env.GITHUB_BRANCH || 'main';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => res.redirect('/public.html'));
app.get('/healthz', (_req, res) => res.json({ ok: true }));

function apiUrl() {
  return `https://api.github.com/repos/${REPO}/contents/${PATTERN_FILE}?ref=${BRANCH}`;
}

function headers() {
  const h = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'edge-pattern-language'
  };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

function encodeBase64Utf8(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

function decodeBase64Utf8(text) {
  return Buffer.from(text, 'base64').toString('utf8');
}

async function fetchPatternFile() {
  const response = await fetch(apiUrl(), { headers: headers() });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub read failed: ${response.status} ${detail}`);
  }
  const data = await response.json();
  const content = data.content ? decodeBase64Utf8(data.content.replace(/\n/g, '')) : '[]';
  return { patterns: JSON.parse(content || '[]'), sha: data.sha };
}

async function savePatternFile(patterns, sha, message) {
  if (!TOKEN) throw new Error('Missing GITHUB_TOKEN environment variable.');
  const response = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATTERN_FILE}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: encodeBase64Utf8(JSON.stringify(patterns, null, 2) + '\n'),
      sha,
      branch: BRANCH
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub write failed: ${response.status} ${detail}`);
  }
  return response.json();
}

app.get('/api/patterns', async (_req, res) => {
  try {
    const { patterns } = await fetchPatternFile();
    res.json(patterns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/patterns', async (req, res) => {
  try {
    const { patterns, sha } = await fetchPatternFile();
    const pattern = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...req.body
    };
    patterns.push(pattern);
    await savePatternFile(patterns, sha, `Add pattern: ${pattern.title || pattern.id}`);
    res.json(pattern);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/patterns/:id', async (req, res) => {
  try {
    const { patterns, sha } = await fetchPatternFile();
    const next = patterns.filter(pattern => pattern.id !== req.params.id);
    await savePatternFile(next, sha, `Delete pattern: ${req.params.id}`);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Edge Pattern Language running on port ${PORT}`));
