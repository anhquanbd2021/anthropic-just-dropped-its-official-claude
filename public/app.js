const $ = (sel, el = document) => el.querySelector(sel);
const state = { lab: null };

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function currentOptions() {
  const build = $('input[name="build"]:checked').value;
  const task = $('input[name="task"]:checked').value;
  return { build, task };
}

function createLab(build) {
  const lab = { seed: "certification-lab", staleCache: build === "seeded" };
  state.lab = lab;
  return lab;
}

function paintLamp(lab) {
  const dot = $("#lamp-dot");
  const text = $("#lamp-text");
  dot.className = "lamp-dot " + (lab.staleCache ? "stale" : "fresh");
  text.textContent = lab.staleCache ? "stale" : "fresh";
}

function paintVerdict(status, detail) {
  const node = $("#verdict");
  node.className = "verdict " + status;
  node.innerHTML = '<strong>' + detail.title + '</strong><span class="muted">' + detail.body + '</span>';
}

function paintEvidence(log, badge) {
  $("#evidence").textContent = log;
  const badgeNode = $("#evidence-badge");
  badgeNode.className = "badge " + (badge.status || "");
  badgeNode.textContent = badge.text;
}

async function postScenario(payload) {
  try {
    const res = await fetch("/api/scenario", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    await res.json();
  } catch {}
}

async function runLocalScenario() {
  const { build, task } = currentOptions();
  const lab = createLab(build);
  const tools = build === "seeded"
    ? {
        kind: "generic",
        tools: [
          {
            name: "search_docs",
            parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
          },
        ],
      }
    : {
        kind: "claude",
        tools: [
          {
            name: "search_docs",
            input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
          },
        ],
      };
  const prompt =
    task === "cache"
      ? "Assert cache-break behavior for a developer instruction block and a tool edit."
      : "Build a certified Claude tool call for search_docs that matches the Developer-track schema boundary.";
  paintLamp(lab);
  const labModule = await import("./lab.mjs");
  let result;
  if (task === "cache") {
    const assertResult = labModule.assertCacheBreak({ ...lab, toolSchema: tools });
    result = assertResult.pass
      ? { verdict: "pass", evidence: [assertResult.reason, "prompt=" + prompt] }
      : { verdict: "fail", evidence: [assertResult.reason, "prompt=" + prompt] };
  } else {
    result = await labModule.runDeveloperScenario(lab, { tools, prompt });
  }
  paintVerdict(result.verdict, { title: result.verdict === "pass" ? "Pass" : "Fail", body: result.evidence.join(" · ") });
  paintEvidence(result.evidence.join("\n"), { status: result.verdict === "pass" ? "pass" : "fail", text: result.verdict === "pass" ? "pass" : "fail" });
  await postScenario({ tools, prompt });
  return result;
}

function resetLab() {
  state.lab = null;
  paintLamp({ staleCache: true });
  paintVerdict("pending", { title: "Ready", body: "Choose a build and task, then run the scenario." });
  paintEvidence("No run yet.", { status: "", text: "—" });
}

for (const input of document.querySelectorAll('input[name="build"], input[name="task"]')) {
  input.addEventListener("change", resetLab);
}

$("#run-local").addEventListener("click", runLocalScenario);
$("#reset-lab").addEventListener("click", resetLab);
resetLab();
