import { watchFile, unwatchFile } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const DEFAULT_LINES = 50;
const logFile = path.resolve(process.env.OCO_LOG_FILE || path.join(tmpdir(), "opencode-orchestrator.log"));

function parseArguments(arguments_) {
  let lines = DEFAULT_LINES;
  let once = false;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--once") {
      once = true;
      continue;
    }
    if (argument === "--lines") {
      const value = Number(arguments_[index + 1]);
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error("--lines must be a positive integer");
      }
      lines = value;
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      process.stdout.write("Usage: npm run log -- [--lines COUNT] [--once]\n");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return { lines, once };
}

function trailingLines(data, lineCount) {
  const text = data.toString("utf8");
  const hasTrailingNewline = text.endsWith("\n");
  const lines = text.split("\n");
  if (hasTrailingNewline) lines.pop();
  const tail = lines.slice(-lineCount).join("\n");
  return hasTrailingNewline && tail ? `${tail}\n` : tail;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  let data;

  try {
    data = await readFile(logFile);
  } catch (error) {
    if (error?.code !== "ENOENT" || options.once) throw error;
    process.stderr.write(`Waiting for log file: ${logFile}\n`);
    data = Buffer.alloc(0);
  }

  if (data.length > 0) process.stdout.write(trailingLines(data, options.lines));
  if (options.once) return;

  let offset = data.length;
  let pending = Promise.resolve();

  const readAppendedContent = async () => {
    let next;
    try {
      next = await readFile(logFile);
    } catch (error) {
      if (error?.code === "ENOENT") {
        offset = 0;
        return;
      }
      throw error;
    }

    if (next.length < offset) offset = 0;
    if (next.length > offset) process.stdout.write(next.subarray(offset));
    offset = next.length;
  };

  watchFile(logFile, { interval: 250 }, () => {
    pending = pending.then(readAppendedContent).catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
  });

  const stop = () => {
    unwatchFile(logFile);
    process.exit();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
