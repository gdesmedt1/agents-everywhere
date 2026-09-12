import fs from 'node:fs';
import path from 'node:path';

const workerPath = path.resolve('.svelte-kit/cloudflare/_worker.js');
const marker = '/* assumption-alarm-do-exports */';
const header = `${marker}
export { ExtractorAgent, WatcherAgent, EvaluatorAgent, NotifierAgent } from '../../src/lib/server/agents/cloudflare-exports.ts';

`;

if (!fs.existsSync(workerPath)) {
	console.error(`Missing ${workerPath}. Run vite build first.`);
	process.exit(1);
}

const current = fs.readFileSync(workerPath, 'utf8');
if (current.includes(marker)) {
	console.log('Durable Object exports already present in _worker.js');
	process.exit(0);
}

fs.writeFileSync(workerPath, header + current);
console.log('Exported ExtractorAgent, WatcherAgent, EvaluatorAgent, NotifierAgent from _worker.js');
