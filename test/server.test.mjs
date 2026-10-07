import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaticServer } from '../app/server.js';
import { once } from 'node:events';

async function withServer(fn) {
  const server = createStaticServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

test('/health, /version, static routes, and scenario verdicts behave correctly', async () => {
  await withServer(async base => {
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal(await health.text(), 'ok');

    const version = await fetch(`${base}/version`);
    assert.equal(version.status, 200);
    assert.equal((await version.json()).name, 'anthropic-just-dropped-its-official-claude-demo');

    const index = await fetch(`${base}/`);
    assert.equal(index.status, 200);
    const indexText = await index.text();
    assert.match(indexText, /Certification Desk Lamp/);
    assert.match(indexText, /Lab/);
    assert.match(indexText, /Guide/);
    assert.match(indexText, /Source/);

    for (const path of ['/styles.css', '/app.js', '/demo.mjs', '/lab.mjs', '/guide.html']) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 200, path);
    }

    const generic = await fetch(`${base}/api/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tools: { kind: 'generic', tools: [{ name: 'search_docs', parameters: { type: 'object' } }] },
        prompt: 'schema checkpoint',
        staleCache: false,
      }),
    });
    assert.equal(generic.status, 200);
    const genericBody = await generic.json();
    assert.equal(genericBody.toolKind, 'generic');
    assert.equal(genericBody.result.verdict, 'fail');
    assert.equal(genericBody.result.failureMode.id, 'generic-tool-schema');

    const claude = await fetch(`${base}/api/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tools: { kind: 'claude', tools: [{ name: 'search_docs', input_schema: { type: 'object' } }] },
        prompt: 'schema checkpoint',
        staleCache: false,
      }),
    });
    assert.equal(claude.status, 200);
    const claudeBody = await claude.json();
    assert.equal(claudeBody.toolKind, 'claude');
    assert.equal(claudeBody.result.verdict, 'pass');
    assert.equal(claudeBody.result.failureMode, null);

    const bad = await fetch(`${base}/api/scenario`, { method: 'POST', body: 'not-json' });
    assert.equal(bad.status, 400);
  });
});

test('unknown paths and traversal return 404; HEAD works', async () => {
  await withServer(async base => {
    assert.equal((await fetch(`${base}/../package.json`)).status, 404);
    assert.equal((await fetch(`${base}/nope`)).status, 404);
    assert.equal((await fetch(`${base}/app/server.js`)).status, 404);
    const head = await fetch(`${base}/`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  });
});
