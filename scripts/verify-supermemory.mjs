import { Supermemory } from 'supermemory';
import { randomUUID } from 'node:crypto';

if (!process.env.SUPERMEMORY_API_KEY) throw new Error('SUPERMEMORY_API_KEY is required');
const client = new Supermemory({ timeoutInSeconds: 20, maxRetries: 1 });
const namespace = `vibe-probe-${randomUUID()}`;
const id = 'synthetic-preference';
const delay = () => new Promise(resolve => setTimeout(resolve, 2000));
async function waitForContent(expected) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const doc = await client.documents.get(namespace, id);
    if (doc.content === expected && doc.system.status === 'done') return;
    await delay();
  }
  throw new Error('Synthetic document processing did not finish within 90 seconds');
}
let failure;
try {
  const original = 'Synthetic test student prefers morning classes.';
  await client.add(namespace, { id, content: original, taskType: 'memory', dreaming: 'instant' });
  await waitForContent(original);
  console.log('PASS Supermemory document add and processing');
  const found = await client.search(namespace, { query: 'morning classes', searchMode: 'chunks', limit: 3 });
  if (!found.results.length) throw new Error('Synthetic document was not searchable');
  console.log('PASS namespace-scoped search');
  const replacement = 'Synthetic test student now prefers afternoon classes.';
  await client.documents.update(namespace, id, { content: replacement });
  await waitForContent(replacement);
  console.log('PASS explicit content replacement');
} catch (error) {
  failure = error;
} finally {
  const deadline = Date.now() + 90000;
  let deleted = false;
  do {
    const result = await client.documents.delete(namespace, { ids: [id] });
    if (!result.errors.length) { deleted = true; break; }
    console.log('INFO provider cleanup pending; retrying per-document failures');
    await delay();
  } while (Date.now() < deadline);
  if (!deleted) throw new Error(`Synthetic provider cleanup remains pending in ${namespace}`);
  await client.namespaces.delete(namespace);
  console.log('PASS document deletion and isolated namespace cleanup');
}
if (failure) throw failure;
