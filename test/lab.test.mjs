import test from 'node:test';
import assert from 'node:assert/strict';
import { createClaudeLab, assertToolSchemaMatch, assertCacheBreak, runDeveloperScenario, TRACKS, FAILURE_MODES, SEEDED_TOOL_SCHEMA, CLAUDE_TOOL_SCHEMA } from '../public/lab.mjs';

test('domain model exposes the certification tracks and seeded failure mode', () => {
  assert.deepEqual(Object.keys(TRACKS), ['associate', 'developer', 'architect']);
  assert.equal(TRACKS.developer.focus, 'API, MCP, and tool boundaries');
  assert.equal(FAILURE_MODES[0].id, 'generic-tool-schema');
});

test('domain model seeds the generic wrapper and stale cache by default', () => {
  assert.equal(SEEDED_TOOL_SCHEMA.kind, 'generic');
  assert.ok(SEEDED_TOOL_SCHEMA.tools[0].parameters);
  assert.ok(!('input_schema' in SEEDED_TOOL_SCHEMA.tools[0]));
  assert.equal(CLAUDE_TOOL_SCHEMA.kind, 'claude');
  assert.ok('input_schema' in CLAUDE_TOOL_SCHEMA.tools[0]);

  const lab = createClaudeLab();
  assert.equal(lab.track.id, 'developer');
  assert.equal(lab.staleCache, true);
  assert.equal(lab.toolSchema.kind, 'generic');
});

test('createClaudeLab validates track input', () => {
  assert.throws(() => createClaudeLab({ track: 'recruiter' }), /Unknown track/);
});

test('assertToolSchemaMatch rejects every generic-wrapper failure', () => {
  assert.equal(assertToolSchemaMatch({}, SEEDED_TOOL_SCHEMA).pass, false);
  assert.ok(assertToolSchemaMatch({}, SEEDED_TOOL_SCHEMA).reason.includes('tools'));
  assert.equal(assertToolSchemaMatch(SEEDED_TOOL_SCHEMA, SEEDED_TOOL_SCHEMA).pass, false);
  assert.ok(assertToolSchemaMatch(SEEDED_TOOL_SCHEMA, SEEDED_TOOL_SCHEMA).reason.includes('parameters'));
  assert.equal(assertToolSchemaMatch(CLAUDE_TOOL_SCHEMA, CLAUDE_TOOL_SCHEMA).pass, true);
});

test('assertCacheBreak reflects stale versus fresh cache state', () => {
  const stale = assertCacheBreak(createClaudeLab());
  assert.equal(stale.pass, false);
  assert.equal(stale.broken, true);
  assert.ok(stale.reason.includes('stale'));

  const fresh = assertCacheBreak({ ...createClaudeLab({ staleCache: false }), toolSchema: CLAUDE_TOOL_SCHEMA });
  assert.equal(fresh.pass, true);
  assert.equal(fresh.broken, false);
});

test('runDeveloperScenario reproduces the exact seeded failure mode', async () => {
  const seededResult = await runDeveloperScenario(createClaudeLab(), { tools: SEEDED_TOOL_SCHEMA, prompt: 'Build a certified tool call.' });
  assert.equal(seededResult.verdict, 'fail');
  assert.equal(seededResult.failureMode.id, 'generic-tool-schema');
  assert.ok(seededResult.evidence[0].includes('parameters'));

  const freshResult = await runDeveloperScenario(createClaudeLab({ staleCache: false }), { tools: CLAUDE_TOOL_SCHEMA, prompt: 'Build a certified tool call.' });
  assert.equal(freshResult.verdict, 'pass', freshResult.evidence.join(' | '));
  assert.equal(freshResult.failureMode, null);
  assert.ok(freshResult.evidence.join(' ').includes('schema=claude'));
});

test('runDeveloperScenario fails the cache assertion on the stale seeded build', async () => {
  const result = await runDeveloperScenario(createClaudeLab(), { tools: CLAUDE_TOOL_SCHEMA, prompt: 'Check cache behavior.' });
  assert.equal(result.verdict, 'fail');
  assert.equal(result.failureMode.id, 'cache-break-mismatch');
  assert.ok(result.evidence[0].includes('Cache'));
});

test('runDeveloperScenario passes the cache assertion when cache state is fresh', async () => {
  const result = await runDeveloperScenario(createClaudeLab({ staleCache: false }), { tools: CLAUDE_TOOL_SCHEMA, prompt: 'Check cache behavior.' });
  assert.equal(result.verdict, 'pass', result.evidence.join(' | '));
  assert.equal(result.failureMode, null);
  assert.ok(result.evidence.join(' ').includes('cache=claude-specific-cert-v2'));
});
