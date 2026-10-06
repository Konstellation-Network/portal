#!/usr/bin/env node
// Scans every commit reachable from HEAD for credentials that must never be
// committed: Pouch and Decane keys, private keys, Google API keys and service
// account JSON, 32-byte hex secrets. CI checks out full history for this.
import { execFileSync } from 'node:child_process';

const patterns = [
  ['Pouch secret key', /\bsk_(?:live|test)_[A-Za-z0-9]{16,}/],
  ['Decane API key', /\bdck_(?:live|test)_[A-Za-z0-9]{16,}/],
  ['PEM private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['GCP service account', /"type":\s*"service_account"/],
  ['32-byte hex secret', /\b0x[0-9a-fA-F]{64}\b/],
];

const log = execFileSync('git', ['log', '-p', '--no-color', '--format=commit %H', 'HEAD'], {
  encoding: 'utf8',
  maxBuffer: 512 * 1024 * 1024,
});

let commit = '';
let file = '';
const hits = [];
for (const line of log.split('\n')) {
  if (line.startsWith('commit ')) commit = line.slice(7, 19);
  else if (line.startsWith('+++ b/')) file = line.slice(6);
  else if (line.startsWith('+') && !line.startsWith('+++') && file !== 'scripts/secret-scan.mjs') {
    for (const [name, re] of patterns) {
      if (re.test(line)) hits.push(`${commit} ${file}: ${name}`);
    }
  }
}

if (hits.length > 0) {
  console.error(`secret scan: ${hits.length} finding(s)\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('secret scan: clean');
