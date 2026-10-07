export const TRACKS = {
  associate: { id: 'associate', label: 'Associate', focus: 'Claude fundamentals' },
  developer: { id: 'developer', label: 'Developer', focus: 'API, MCP, and tool boundaries' },
  architect: { id: 'architect', label: 'Architect', focus: 'Production agentic systems' },
};

export const FAILURE_MODES = [
  { id: 'generic-tool-schema', label: 'Generic tool schema', severity: 'exam-fail' },
  { id: 'mcp-boundary-confusion', label: 'MCP boundary confusion', severity: 'exam-fail' },
  { id: 'cache-break-mismatch', label: 'Cache-break mismatch', severity: 'pass-fail-toggle' },
];

export const SEEDED_TOOL_SCHEMA = {
  kind: 'generic',
  tools: [
    {
      name: 'search_docs',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  ],
};

export const CLAUDE_TOOL_SCHEMA = {
  kind: 'claude',
  tools: [
    {
      name: 'search_docs',
      input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  ],
};

export function createClaudeLab({ track = 'developer', seed = 'certification-lab', staleCache = true } = {}) {
  if (!TRACKS[track]) throw new Error(`Unknown track: ${track}`);
  return {
    track: TRACKS[track],
    seed,
    staleCache,
    toolSchema: staleCache ? SEEDED_TOOL_SCHEMA : CLAUDE_TOOL_SCHEMA,
    systemPromptVersion: staleCache ? 'legacy-generic-note-v1' : 'claude-specific-cert-v2',
    cacheControlMarkers: staleCache ? ['system-before-tools'] : ['system-before-tools', 'tools-after-system'],
    updatedAt: new Date().toISOString(),
  };
}

export function assertToolSchemaMatch(actual, expected) {
  if (!actual || !Array.isArray(actual.tools)) {
    return { pass: false, actual, expected, reason: 'Claude tool schemas require a `tools` array.' };
  }
  const mismatch = actual.tools.findIndex(tool => !('input_schema' in tool) || 'parameters' in tool);
  if (mismatch >= 0) {
    return { pass: false, actual, expected, reason: `tools[${mismatch}] still uses the generic parameters shape.` };
  }
  return { pass: true, actual, expected, reason: 'Every tool uses `tools[].input_schema`.' };
}

export function assertCacheBreak(lab, { toolDescription = 'original developer note' } = {}) {
  if (lab.staleCache) {
    return { pass: false, broken: true, reason: 'Cache key is stale — a system or tool edit must break the cached block before the prompt can be trusted.' };
  }
  return { pass: true, broken: false, reason: 'Cache key is fresh; `search_docs` uses the fresh tool boundary.' };
}

export async function runDeveloperScenario(lab, { tools, prompt = 'Build a certified Claude tool call for search_docs.' } = {}) {
  if (!tools) throw new Error('Provide the tool schema under test.');
  const schemaResult = assertToolSchemaMatch(tools, lab.toolSchema);
  if (!schemaResult.pass) {
    return {
      verdict: 'fail',
      track: lab.track.id,
      failureMode: FAILURE_MODES[0],
      evidence: [schemaResult.reason, `prompt=${prompt}`],
    };
  }
  const cacheResult = assertCacheBreak({ ...lab, toolSchema: tools });
  if (!cacheResult.pass) {
    return {
      verdict: cacheResult.broken ? 'fail' : 'fail',
      track: lab.track.id,
      failureMode: FAILURE_MODES[2],
      evidence: [cacheResult.reason, `prompt=${prompt}`],
    };
  }
  return {
    verdict: 'pass',
    track: lab.track.id,
    failureMode: null,
    evidence: [`schema=${tools.kind}`, `cache=${lab.systemPromptVersion}`, `prompt=${prompt}`],
  };
}
