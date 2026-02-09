# Contributing to Mermaid2img

Contributions welcome. Keep it lean.

## Areas for Contribution

- PNG output format support
- Custom mermaid theme configuration via flag
- Batch processing of multiple markdown files
- Watch mode for iterative editing
- Test suite

## Getting Started

1. Fork the repository
2. Create a feature branch
3. Install dependencies: `bun install && bunx playwright install chromium`
4. Make your changes
5. Test against markdown files with mermaid diagrams
6. Submit a pull request

## Guidelines

- **Bun only** — use `bun` / `bunx`, not `npm` / `npx`
- **Single file** — all logic stays in `main.ts`
- **Minimal dependencies** — only `playwright` as a runtime dependency
- **Keep it lean** — no over-engineering, no unnecessary abstractions
