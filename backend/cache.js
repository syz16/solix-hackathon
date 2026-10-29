const fs = require('fs');
const path = require('path');

// Saved analyses so the demo survives flaky venue wifi or rate limits.
const DIR = path.join(__dirname, 'cache');

function fileFor(input) {
  const slug = [input.drug, input.disease, input.mechanism]
    .map((s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .join('__');
  return path.join(DIR, `${slug}.json`);
}

function readCache(input) {
  try {
    return JSON.parse(fs.readFileSync(fileFor(input), 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(input, analysis) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(fileFor(input), JSON.stringify(analysis, null, 2));
  } catch (error) {
    console.error('Cache write failed:', error.message);
  }
}

module.exports = { readCache, writeCache };
