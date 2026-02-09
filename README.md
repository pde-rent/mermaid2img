```
                           _    _ ___ _
  _ __  ___ _ _ _ __  __ _(_)__| | , |_)_ __  __ _
 | '  \/ -_) '_| '  \/ _` | / _` |7 /| | '  \/ _` |
 |_|_|_\___|_| |_|_|_\__,_|_\__,_/___|_|_|_|_\__, |
                          diagrams to images |___/
```

# mermaid2img

Render mermaid diagrams in markdown files to images.

## Install

```bash
bun install
bunx playwright install chromium
```

## Usage

```bash
# JPEG base64 inline (default)
mermaid2img --md docs/architecture.md

# JPEG files in ./mermaid/ folder
mermaid2img --md docs/architecture.md --jpg --files

# Inline SVG
mermaid2img --md docs/architecture.md --svg

# Higher resolution
mermaid2img --md docs/architecture.md --scale 3
```

## Output

Creates `<name>_mermaid2<fmt>.md` alongside the source file with mermaid code blocks replaced by rendered images.

## How It Works

Launches a headless Chromium browser via Playwright, loads Mermaid.js from CDN, and renders each diagram in-browser. A single page is reused for all diagrams (CDN fetched once). SVG is extracted from the DOM; JPEG is captured via element screenshot.

First run requires `bunx playwright install chromium` (~200MB download).

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--md <path>` | Markdown file to process | required |
| `--svg` | Inline SVG output | |
| `--jpg` | JPEG output | yes |
| `--b64` | Embed as base64 data URIs | yes |
| `--files` | Export to `./mermaid/` folder | |
| `--scale <n>` | Device scale factor (1-4) | 2 |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Licence

This project is licensed under the MIT License — see [LICENCE](LICENCE).
