import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createOpencodeClient } from "@opencode-ai/sdk";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT = 60_000;
const MODEL = { providerID: "fixture", modelID: "qa" };
export const unsupportedCapabilities = {
    nativeBackground: { status: "not-adopted", reason: "No released public background-task contract verified in the official SDK, agents, plugins or tools documentation." },
};

export function requiredExecutable(env = process.env) {
    assert.ok(env.OCO_QA_EXECUTABLE, "Set OCO_QA_EXECUTABLE to the installed released OpenCode executable.");
    return env.OCO_QA_EXECUTABLE;
}

async function executableVersion(context) {
    let output = "";
    const child = spawn(context.executable, ["--version"], {
        cwd: context.cwd, env: context.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    context.child = child;
    let failure;
    child.once("error", (error) => { failure = error; });
    child.stdout.on("data", (data) => { output = (output + data).slice(-4096); });
    child.stderr.resume();
    await waitFor(() => { if (failure) throw failure; return child.exitCode !== null; }, "host version");
    assert.equal(child.exitCode, 0, "OpenCode --version must exit successfully");
    const version = output.match(/\b\d+\.\d+\.\d+\b/)?.[0];
    assert.ok(version, "OpenCode --version must report a release version");
    return version;
}

export function isolatedEnvironment(root, inherited = process.env) {
    const env = {};
    for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT"])
        if (inherited[key]) env[key] = inherited[key];
    for (const key of ["HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME", "XDG_RUNTIME_DIR", "TEMP", "TMP"])
        env[key] = path.join(root, key.toLowerCase());
    return { ...env, CI: "true", NO_COLOR: "1" };
}

function configuration(port) {
    return {
        $schema: "https://opencode.ai/config.json", model: "fixture/qa", small_model: "fixture/qa",
        enabled_providers: ["fixture"], share: "disabled", autoupdate: false,
        permission: { "*": "deny", task: "allow", webfetch: "allow", delegate_task: "allow" },
        provider: { fixture: { npm: "@ai-sdk/openai-compatible", name: "Local QA fixture",
            options: { baseURL: `http://127.0.0.1:${port}/v1`, apiKey: "fixture-only" },
            models: { qa: { name: "QA", tool_call: true, limit: { context: 128000, output: 4096 } } } } },
    };
}

function reply(response, body, delta) {
    const base = { id: "chatcmpl-qa", created: 1, model: "qa" };
    const finish = delta.tool_calls ? "tool_calls" : "stop";
    if (!body.stream) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ...base, object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", ...delta }, finish_reason: finish }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }));
        return;
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    const chunk = (value, reason) => `data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: value, finish_reason: reason }] })}\n\n`;
    response.write(chunk({ role: "assistant", ...delta }, null));
    response.end(`${chunk({}, finish)}data: [DONE]\n\n`);
}

function fixtureDelta(body) {
    const messages = body.messages ?? [];
    const last = messages.findLast((message) => message.role === "user");
    const text = JSON.stringify(last?.content ?? "");
    const lastIndex = messages.lastIndexOf(last);
    const completed = messages.slice(lastIndex + 1).some((message) => message.role === "tool");
    if (text.includes("QA_PLUGIN_TASK") && !completed) {
        const resume = text.match(/QA_RESUME:(ses_[a-zA-Z0-9]+)/)?.[1];
        return { tool_calls: [{ index: 0, id: "call_qa_plugin", type: "function", function: {
            name: "delegate_task", arguments: JSON.stringify({ agent: "Worker", description: "QA plugin child",
                prompt: "QA_CHILD_RESPONSE", background: false, ...(resume ? { resume } : {}) }),
        } }] };
    }
    if (text.includes("QA_NATIVE_WEB") && !completed) {
        const url = text.match(/http:\/\/127\.0\.0\.1:\d+\/document/)?.[0];
        return { tool_calls: [{ index: 0, id: "call_qa_web", type: "function", function: {
            name: "webfetch", arguments: JSON.stringify({ url, format: "text" }),
        } }] };
    }
    if (text.includes("QA_NATIVE_TASK") && !completed) {
        const resume = text.match(/QA_RESUME:(ses_[a-zA-Z0-9]+)/)?.[1];
        return { tool_calls: [{ index: 0, id: "call_qa_task", type: "function", function: { name: "task", arguments: JSON.stringify({ description: "QA child", prompt: "QA_CHILD_RESPONSE", subagent_type: "general", ...(resume ? { task_id: resume } : {}) }) } }] };
    }
    return { content: "QA fixture completed." };
}

async function startFixture() {
    const state = { requests: 0, held: 0 };
    const server = createServer(async (request, response) => {
        if (request.method === "GET" && request.url === "/document") {
            response.writeHead(200, { "content-type": "text/plain" });
            response.end("QA_NATIVE_DOCUMENT");
            return;
        }
        try {
            let text = "";
            for await (const chunk of request) text += chunk;
            const body = JSON.parse(text);
            state.requests++;
            if (JSON.stringify(body.messages?.at(-1)).includes("QA_HOLD")) { state.held++; return; }
            reply(response, body, fixtureDelta(body));
        } catch { response.writeHead(400); response.end(); }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return { server, state, port: server.address().port };
}

async function waitFor(predicate, label) {
    const end = Date.now() + TIMEOUT;
    while (Date.now() < end) {
        if (await predicate()) return;
        await delay(100);
    }
    throw new Error(`Timed out: ${label}`);
}

async function stopHost(child) {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === "win32") {
        await new Promise((resolve) => {
            const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
            const timer = setTimeout(() => { killer.kill(); child.kill(); resolve(); }, 5000);
            const done = () => { clearTimeout(timer); resolve(); };
            killer.once("error", done); killer.once("exit", done);
        });
    } else child.kill("SIGTERM");
    await waitFor(() => child.exitCode !== null || child.signalCode !== null, "owned host exit");
}

async function startHost(context) {
    let output = "";
    const child = spawn(context.executable, ["serve", "--hostname", "127.0.0.1", "--port", "0"], {
        cwd: context.cwd, env: context.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
    context.child = child;
    child.stdout.on("data", (data) => { output = (output + data).slice(-16_384); });
    child.stderr.on("data", (data) => { output = (output + data).slice(-16_384); });
    let failure;
    child.once("error", (error) => { failure = error; });
    await waitFor(() => {
        if (failure) throw failure;
        if (child.exitCode !== null) throw new Error(`Host exited ${child.exitCode}: ${output.slice(-1500)}`);
        return /http:\/\/127\.0\.0\.1:\d+/.test(output);
    }, "host startup");
    const baseUrl = output.match(/http:\/\/127\.0\.0\.1:\d+/)[0];
    return createOpencodeClient({ baseUrl, directory: context.cwd, throwOnError: true,
        fetch: (request) => fetch(request, { signal: AbortSignal.timeout(TIMEOUT) }) });
}

async function check(report, name, action) {
    try { await action(); report.checks[name] = { status: "pass" }; }
    catch (error) { report.checks[name] = { status: "fail", reason: String(error.message).slice(0, 1500) }; }
    console.log(`${name}: ${report.checks[name].status}`);
}

function prompt(client, id, text, extras = {}) {
    return client.session.prompt({ path: { id }, body: { model: MODEL, parts: [{ type: "text", text }], ...extras } });
}

async function basicChecks(context, report) {
    const { client, fixture } = context;
    await check(report, "hostStorageIsolation", async () => {
        const paths = (await client.path.get()).data;
        for (const key of ["state", "config", "directory"]) {
            const relative = path.relative(context.root, paths[key]);
            assert.ok(!relative.startsWith("..") && !path.isAbsolute(relative));
        }
        assert.equal(path.resolve(paths.directory), path.resolve(context.cwd));
    });
    const parent = (await client.session.create({ body: { title: "Native QA" } })).data;
    context.sessionID = parent.id;
    const route = { path: { id: parent.id } };
    await check(report, "sessionCreateStatusMessagesChildren", async () => {
        assert.ok(parent.id);
        assert.equal(typeof (await client.session.status()).data, "object");
        assert.deepEqual((await client.session.messages(route)).data, []);
        const child = (await client.session.create({ body: { parentID: parent.id, title: "SDK child" } })).data;
        assert.ok((await client.session.children(route)).data.some((item) => item.id === child.id));
    });
    await check(report, "contextOnlyPrompt", async () => {
        const before = fixture.state.requests;
        const result = await prompt(client, parent.id, "QA_CONTEXT_ONLY", { noReply: true });
        assert.equal(result.data.info.role, "user");
        assert.equal(fixture.state.requests, before);
        assert.ok((await client.session.messages(route)).data.some((item) => item.parts.some((part) => part.text === "QA_CONTEXT_ONLY")));
    });
    await check(report, "providerPrompt", async () => {
        const result = await prompt(client, parent.id, "QA_HELLO");
        assert.equal(result.data.info.error, undefined);
        assert.ok(result.data.parts.some((part) => part.text === "QA fixture completed."));
    });
}

async function taskChecks(context, report) {
    const { client } = context;
    const parent = (await client.session.create({ body: { title: "Task QA" } })).data;
    let childID;
    await check(report, "nativeForegroundTask", async () => {
        const result = await prompt(client, parent.id, "QA_NATIVE_TASK");
        const tool = result.data.parts.find((part) => part.type === "tool" && part.tool === "task");
        const messages = (await client.session.messages({ path: { id: parent.id } })).data;
        const task = tool ?? messages.flatMap((item) => item.parts).find((part) => part.type === "tool" && part.tool === "task");
        assert.equal(task?.state.status, "completed");
        const children = (await client.session.children({ path: { id: parent.id } })).data;
        assert.equal(children.length, 1);
        childID = children[0].id;
        assert.ok((await client.session.messages({ path: { id: childID } })).data.some((item) => item.info.role === "assistant"));
    });
    await check(report, "nativeTaskResume", async () => {
        assert.ok(childID, "Foreground task must create a child before resume can be tested");
        const before = (await client.session.messages({ path: { id: childID } })).data.length;
        await prompt(client, parent.id, `QA_NATIVE_TASK QA_RESUME:${childID}`);
        const messages = (await client.session.messages({ path: { id: parent.id } })).data;
        const task = messages.flatMap((item) => item.parts).findLast((part) => part.type === "tool" && part.tool === "task");
        assert.equal(task?.state.status, "completed");
        assert.equal((await client.session.children({ path: { id: parent.id } })).data.length, 1);
        assert.ok((await client.session.messages({ path: { id: childID } })).data.length > before);
    });
}

async function lifecycleChecks(context, report) {
    const { client, sessionID, fixture } = context;
    await check(report, "abortRunningSession", async () => {
        const session = (await client.session.create({ body: { title: "Abort QA" } })).data;
        const heldBefore = fixture.state.held;
        const pending = prompt(client, session.id, "QA_HOLD").catch(() => undefined);
        await waitFor(() => fixture.state.held > heldBefore, "provider request in flight");
        assert.equal((await client.session.abort({ path: { id: session.id } })).data, true);
        await pending;
        const statuses = (await client.session.status()).data;
        assert.ok(!statuses[session.id] || statuses[session.id].type === "idle");
    });
    await check(report, "compaction", async () => {
        assert.equal((await client.session.summarize({ path: { id: sessionID }, body: MODEL })).data, true);
        const messages = (await client.session.messages({ path: { id: sessionID } })).data;
        assert.ok(messages.some((item) => item.parts.some((part) => part.type === "compaction")));
        assert.ok(messages.some((item) => item.info.role === "assistant" && item.info.summary && item.info.time.completed && !item.info.error));
        if (context.pluginMarker) await waitFor(async () => {
            const marker = JSON.parse(await readFile(context.pluginMarker, "utf8"));
            return marker.compactedSessionIDs?.includes(sessionID);
        }, "built plugin session.compacted completion event");
    });
    await check(report, "restartPersistence", async () => {
        const before = (await client.session.messages({ path: { id: sessionID } })).data.length;
        await stopHost(context.child);
        context.client = await startHost(context);
        assert.equal((await context.client.session.get({ path: { id: sessionID } })).data.id, sessionID);
        assert.equal((await context.client.session.messages({ path: { id: sessionID } })).data.length, before);
    });
}

async function webCheck(context, report) {
    await check(report, "nativeWebfetch", async () => {
        const { client, fixture } = context;
        const session = (await client.session.create({ body: { title: "Web QA" } })).data;
        await prompt(client, session.id, `QA_NATIVE_WEB http://127.0.0.1:${fixture.port}/document`);
        const messages = (await client.session.messages({ path: { id: session.id } })).data;
        const task = messages.flatMap((item) => item.parts).find((part) => part.type === "tool" && part.tool === "webfetch");
        assert.equal(task?.state.status, "completed");
        assert.ok(task.state.output.includes("QA_NATIVE_DOCUMENT"));
    });
}

async function delegatedPluginChecks(context, report) {
    if (!report.plugin.enabled) return;
    const { client } = context;
    const parent = (await client.session.create({ body: { title: "Plugin delegation QA" } })).data;
    let childID;
    for (const resume of [false, true]) {
        await check(report, resume ? "pluginDelegationResume" : "pluginDelegationCompletion", async () => {
            if (resume) assert.ok(childID, "A completed plugin task is required before resume");
            const before = resume ? (await client.session.messages({ path: { id: childID } })).data.length : 0;
            await prompt(client, parent.id, `QA_PLUGIN_TASK${resume ? ` QA_RESUME:${childID}` : ""}`);
            const messages = (await client.session.messages({ path: { id: parent.id } })).data;
            const task = messages.flatMap((item) => item.parts).findLast((part) => part.type === "tool" && part.tool === "delegate_task");
            assert.equal(task?.state.status, "completed");
            const output = task.state.output;
            assert.ok(output.includes(resume ? "[RESUMED & DONE]" : "[DONE]"), output);
            assert.ok(output.includes("QA fixture completed."));
            const observed = output.match(/Session: `([^`]+)`/)?.[1];
            assert.ok(observed, "Completed task must expose its native session ID");
            if (resume) assert.equal(observed, childID);
            childID = observed;
            assert.ok((await client.session.messages({ path: { id: childID } })).data.length > before);
        });
    }
}

async function missionCommandCheck(context, report) {
    if (!report.plugin.enabled) return;
    await check(report, "pluginMissionCommand", async () => {
        const session = (await context.client.session.create({ body: { title: "Mission command QA" } })).data;
        const statePath = path.join(context.cwd, ".opencode", "loop-state.json");
        await context.client.session.command({ path: { id: session.id },
            body: { command: "task", arguments: "QA mission objective", model: "fixture/qa", agent: "Commander" } });
        const state = JSON.parse(await readFile(statePath, "utf8"));
        assert.equal(state.sessionID, session.id);
        assert.equal(state.active, true);
        assert.equal(state.objective, "QA mission objective");
        await prompt(context.client, session.id, "/stop", { agent: "Commander" });
        const stopped = await readFile(statePath, "utf8").then(JSON.parse, (error) => {
            if (error.code === "ENOENT") return null;
            throw error;
        });
        assert.ok(!stopped?.active, "Stop must persist before another continuation can run");
    });
}

async function prepare(context) {
    context.env = isolatedEnvironment(context.root);
    context.cwd = path.join(context.root, "project");
    await Promise.all([...new Set([context.cwd, ...Object.values(context.env).filter((value) => value.startsWith(context.root))])].map((dir) => mkdir(dir, { recursive: true })));
    context.fixture = await startFixture();
    await writeFile(path.join(context.cwd, "opencode.json"), JSON.stringify(configuration(context.fixture.port)));
    if (process.env.OCO_QA_PLUGIN) {
        const directory = path.join(context.cwd, ".opencode", "plugins");
        context.pluginMarker = path.join(context.root, "plugin-hooks.json");
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, "oco.js"), pluginWrapper(process.env.OCO_QA_PLUGIN, context.pluginMarker));
    }
}

function pluginWrapper(plugin, marker) {
    return `import plugin from ${JSON.stringify(pathToFileURL(path.resolve(plugin)).href)};
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const marker = ${JSON.stringify(marker)};
const counts = existsSync(marker) ? JSON.parse(readFileSync(marker, "utf8")) : {};
function record(name, input) {
    counts[name] = (counts[name] ?? 0) + 1;
    if (name === "event" && input?.event?.type === "session.compacted") {
        counts["session.compacted"] = (counts["session.compacted"] ?? 0) + 1;
        counts.compactedSessionIDs = [...new Set([...(counts.compactedSessionIDs ?? []), input.event.properties.sessionID])];
    }
    writeFileSync(marker, JSON.stringify(counts));
}
export default async function(input, options) {
    const hooks = await plugin(input, options);
    record("initialization");
    for (const name of ["config", "event", "experimental.session.compacting"]) {
        const original = hooks[name];
        if (typeof original !== "function") continue;
        hooks[name] = async (...args) => { const result = await original(...args); record(name, args[0]); return result; };
    }
    return hooks;
}\n`;
}

async function pluginChecks(context, report) {
    if (!report.plugin.enabled) return;
    await check(report, "builtPluginHooks", async () => {
        const counts = JSON.parse(await readFile(context.pluginMarker, "utf8"));
        const { compactedSessionIDs, ...hookCounts } = counts;
        report.plugin.hookCounts = hookCounts;
        for (const name of ["initialization", "config", "event", "experimental.session.compacting", "session.compacted"])
            assert.ok(counts[name] > 0, `Built plugin hook not observed: ${name}`);
        assert.ok(compactedSessionIDs.includes(context.sessionID), "Built plugin must receive the tested session's completed compaction event");
    });
}

async function cleanup(context, report) {
    try { await stopHost(context.child); }
    catch { report.checks.cleanup = { status: "fail", reason: "Owned host did not exit within timeout; temporary files retained." }; }
    context.fixture?.server.closeAllConnections();
    await new Promise((resolve) => context.fixture ? context.fixture.server.close(resolve) : resolve());
    if (report.checks.cleanup) return;
    const target = path.resolve(context.root);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith("oco-native-qa-"));
    try { await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
    catch { report.checks.cleanup = { status: "fail", reason: "Owned temporary directory could not be removed." }; }
}

export async function runNativeHostQa() {
    const report = { generatedAt: new Date().toISOString(), sdk: null, host: null, plugin: { enabled: Boolean(process.env.OCO_QA_PLUGIN) },
        evidence: ["https://opencode.ai/docs/sdk/", "https://opencode.ai/docs/plugins/", "https://opencode.ai/docs/agents/", "https://opencode.ai/docs/tools/", "https://opencode.ai/docs/providers/"],
        isolation: "temporary home, XDG, cwd; allowlisted environment; loopback fixture; no real provider credentials", capabilities: unsupportedCapabilities, checks: {} };
    const context = { root: await mkdtemp(path.join(os.tmpdir(), "oco-native-qa-")) };
    try {
        context.executable = requiredExecutable();
        report.sdk = JSON.parse(await readFile(path.join(ROOT, "node_modules/@opencode-ai/sdk/package.json"), "utf8")).version;
        await prepare(context);
        report.host = await executableVersion(context);
        context.client = await startHost(context);
        await basicChecks(context, report);
        await taskChecks(context, report);
        await webCheck(context, report);
        await delegatedPluginChecks(context, report);
        await missionCommandCheck(context, report);
        await lifecycleChecks(context, report);
        await pluginChecks(context, report);
    } catch (error) { report.checks.infrastructure = { status: "fail", reason: String(error.message).slice(0, 1500) }; }
    finally {
        await cleanup(context, report);
        await mkdir(path.join(ROOT, ".opencode/qa"), { recursive: true });
        await writeFile(path.join(ROOT, ".opencode/qa/native-host.json"), JSON.stringify(report, null, 2) + "\n");
    }
    console.log(JSON.stringify(report, null, 2));
    return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const report = await runNativeHostQa();
    process.exitCode = Object.values(report.checks).some((check) => check.status === "fail") ? 1 : 0;
}
