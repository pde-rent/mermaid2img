#!/usr/bin/env bun

import { chromium, type Browser, type Page } from "playwright";
import { readFile, writeFile, mkdir, readdir, stat } from "fs/promises";
import { join, dirname, basename, extname, resolve } from "path";
import { existsSync } from "fs";
import { parseArgs } from "util";

const VERSION = "1.0.2";
const BANNER = `
                                    _     ___  _
   _ __  ___ _ _ _ __  __ _(_)__| |__ )|(_)_ __  __ _
  | '  \\/ -_) '_| '  \\/ _\` | / _|  _/ /| | '  \\/ _\` |
  |_|_|_\\___|_| |_|_|_\\__,_|_\\__|_|/_/ |_|_|_|_\\__, |
                     diagrams to images          |___/
`;
const MERMAID_CDN =
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
const MERMAID_RE = /^```mermaid[^\n]*\n([\s\S]*?)^```\s*$/gm;

function help(): void {
  console.log(`mermaid2img v${VERSION} — render mermaid diagrams in markdown

Usage: mermaid2img --md <path> [options]

Options:
  --md <path>     Markdown file or folder to process (required)
  --svg           Inline SVG in markdown
  --jpg           JPEG images (default)
  --b64           Embed as base64 data URIs (default)
  --files         Export images to ./mermaid/ folder
  --scale <n>     Device scale factor (default: 2)
  -v, --version   Show version
  -h, --help      Show help

Output: <name>_mermaid2<fmt>.md alongside each source file.

Examples:
  mermaid2img --md README.md
  mermaid2img --md docs/
  mermaid2img --md README.md --svg
  mermaid2img --md README.md --jpg --files`);
}

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    md: { type: "string" },
    svg: { type: "boolean" },
    jpg: { type: "boolean" },
    b64: { type: "boolean" },
    files: { type: "boolean" },
    scale: { type: "string" },
    version: { type: "boolean", short: "v" },
    help: { type: "boolean", short: "h" },
  },
  strict: true,
});

if (values.version) {
  console.log(`mermaid2img v${VERSION}`);
  process.exit(0);
}
if (values.help || !values.md) {
  help();
  process.exit(values.help ? 0 : 1);
}

if (values.svg && values.jpg) {
  console.error("Error: --svg and --jpg are mutually exclusive");
  process.exit(1);
}
if (values.b64 && values.files) {
  console.error("Error: --b64 and --files are mutually exclusive");
  process.exit(1);
}
if (values.svg && values.files) {
  console.error("Error: --files requires --jpg format");
  process.exit(1);
}

const mdPath = resolve(values.md);
const fmt: "svg" | "jpg" = values.svg ? "svg" : "jpg";
const mode: "b64" | "files" = values.files ? "files" : "b64";

const rawScale = parseInt(values.scale ?? "2", 10);
if (Number.isNaN(rawScale)) {
  console.error("Error: --scale must be a number (1-4)");
  process.exit(1);
}
const scale = Math.max(1, Math.min(4, rawScale));

if (!existsSync(mdPath)) {
  console.error(`Error: path not found: ${mdPath}`);
  process.exit(1);
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(full)));
    } else if (
      entry.name.endsWith(".md") &&
      !entry.name.includes("_mermaid2")
    ) {
      files.push(full);
    }
  }

  return files;
}

async function initPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: scale,
  });

  await page.setContent(`<!DOCTYPE html><html><head>
<script type="module">
import mermaid from '${MERMAID_CDN}';
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  themeVariables: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
  },
});
let _id = 0;
window._render = async (code) => {
  const { svg } = await mermaid.render('d' + (++_id), code);
  return svg;
};
</script></head><body style="margin:0;padding:24px;background:#fff"></body></html>`);

  try {
    await page.waitForFunction(
      () => typeof (window as any)._render === "function",
      { timeout: 30_000 },
    );
  } catch {
    throw new Error(
      `Mermaid failed to load — check your network connection.\nCDN: ${MERMAID_CDN}`,
    );
  }

  return page;
}

async function renderDiagram(
  page: Page,
  code: string,
): Promise<{ svg: string; jpg?: Buffer }> {
  const svgHtml = await page.evaluate(async (c: string) => {
    const svg = await (window as any)._render(c);
    document.body.innerHTML = svg;
    return svg;
  }, code);

  let jpg: Buffer | undefined;
  if (fmt === "jpg") {
    const el = await page.$("svg");
    if (!el) throw new Error("SVG element not found after rendering");
    jpg = (await el.screenshot({ type: "jpeg", quality: 92 })) as Buffer;
  }

  return { svg: svgHtml, jpg };
}

async function processFile(page: Page, filePath: string): Promise<boolean> {
  const content = await readFile(filePath, "utf-8");
  const matches = [...content.matchAll(MERMAID_RE)];

  if (!matches.length) return false;

  const dir = dirname(filePath);
  const ext = extname(filePath);
  const base = basename(filePath, ext);
  const mermaidDir = join(dir, "mermaid");

  console.log(`\n${basename(filePath)}: ${matches.length} diagram(s)`);

  if (fmt === "jpg" && mode === "files") {
    await mkdir(mermaidDir, { recursive: true });
  }

  let result = content;
  let failures = 0;

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const code = match[1].trim();
    const start = match.index!;
    const end = start + match[0].length;

    process.stdout.write(`  [${i + 1}/${matches.length}] `);

    try {
      const { svg, jpg } = await renderDiagram(page, code);
      let replacement: string;

      if (fmt === "svg") {
        replacement = `\n${svg}\n`;
      } else if (!jpg) {
        throw new Error("Screenshot capture failed");
      } else if (mode === "b64") {
        const b64 = jpg.toString("base64");
        replacement = `![Diagram ${i + 1}](data:image/jpeg;base64,${b64})`;
      } else {
        const fname = `${base}-${i + 1}.jpg`;
        await writeFile(join(mermaidDir, fname), jpg);
        replacement = `![Diagram ${i + 1}](./mermaid/${fname})`;
      }

      result = result.slice(0, start) + replacement + result.slice(end);
      console.log("done");
    } catch (err) {
      failures++;
      console.error(`failed — ${(err as Error).message}`);
    }
  }

  const suffix = fmt === "svg" ? "_mermaid2svg" : "_mermaid2jpg";
  const outPath = join(dir, `${base}${suffix}${ext}`);
  await writeFile(outPath, result, "utf-8");

  if (failures > 0) {
    console.warn(
      `  Warning: ${failures} diagram(s) failed and were left as raw mermaid blocks.`,
    );
  }
  console.log(`  -> ${outPath}`);
  return true;
}

async function main(): Promise<void> {
  process.stderr.write(BANNER + "\n");
  const info = await stat(mdPath);
  const files = info.isDirectory()
    ? await collectMarkdownFiles(mdPath)
    : [mdPath];

  if (!files.length) {
    console.log("No markdown files found.");
    return;
  }

  console.log(
    `${files.length} markdown file(s) to scan. Launching browser...`,
  );
  const browser = await chromium.launch({ headless: true });

  let processed = 0;

  try {
    const page = await initPage(browser);

    for (const file of files) {
      if (await processFile(page, file)) processed++;
    }

    await page.close().catch(() => {});
  } finally {
    await browser.close();
  }

  console.log(`\nDone. ${processed} file(s) with diagrams rendered.`);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
