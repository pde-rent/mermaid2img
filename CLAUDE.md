# Mermaid2img — Claude Code Guidelines

## Overview

Minimal CLI tool to render mermaid diagrams in markdown files to images (JPEG/SVG). Single TypeScript entry point (`main.ts`), runs on Bun.

## Runtime

- **Bun** — always use `bun` / `bunx`, never `npm` / `npx`
- **Playwright** — headless Chromium for mermaid rendering via CDN
- Install: `bun install && bunx playwright install chromium`

## Architecture

- `main.ts` — single entry point, all logic
- Mermaid.js loaded via CDN in headless browser (no local bundle)
- Single browser page reused across all diagrams (CDN fetch happens once)
- SVG extracted from DOM, JPEG via Playwright element screenshot
- Output written alongside source markdown with `_mermaid2{fmt}` suffix

## Commits

- Never co-author commits with AI names
- Keep commit messages concise and descriptive
- No `--no-verify` or skipping hooks

## Key Design Decisions

- `parseArgs` from `node:util` for CLI argument parsing (no deps)
- Diagrams processed in reverse order to preserve string indices during replacement
- Device scale factor configurable via `--scale` (default 2) for retina-quality output
- Mermaid version pinned to major 11 via CDN URL
- Regex uses multiline flag to anchor fences at line boundaries

## Testing

Test against markdown files with mermaid diagrams:
```bash
bun main.ts --md test.md
bun main.ts --md test.md --svg
bun main.ts --md test.md --jpg --files
bun main.ts --md test.md --scale 3
bun main.ts --version
bun main.ts --help
```
