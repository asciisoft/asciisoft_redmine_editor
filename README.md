# asciisoft_redmine_editor (v1.2.0)

[한국어](README.ko.md)

A Redmine 7.0 plugin that replaces the Markdown (CommonMark) text areas with a WYSIWYG editor.
The original text area stays hidden, and the editor writes the content back to it as Markdown
(live while typing, and once more on save).

## Features
- WYSIWYG editing (TOAST UI Editor 3.2.2, bundled in the plugin, no external CDN, loaded only on pages with an editor)
- Toolbar: font, font size (7–48px) and line height at the left, saved as `<span style="…">`
  - The font and size boxes follow the cursor and show the current font/size (or the defaults)
  - Small up/down buttons next to each box change the value one step
- Keeps Redmine syntax such as `#123`, `[[Wiki]]`, `{{toc}}` and `@user`; issue link and wiki link buttons
- `@` opens a user picker (uses Redmine's own mention search; issue and wiki edit forms)
- Paste or drop images from the clipboard → uploaded as Redmine attachments and inserted
- Excel tables become Markdown tables; Word bold/italic/numbered lists are kept
- Images that cannot be loaded are shown as an "Image: file name" placeholder (saved content is unchanged)
- Content protection: text that may change when converted opens in Markdown mode with a notice;
  untouched content is saved exactly as it was
- When the toolbar is too narrow, buttons wrap to the next line instead of being hidden

## Requirements
Redmine 7.0 or later, Administration > Settings > General > Text formatting = Markdown (CommonMark)

## Installation (Docker)
### With Git (recommended)
```bash
cd /srv/redmine/plugins
git clone https://github.com/asciisoft/asciisoft_redmine_editor.git asciisoft_redmine_editor
cd /srv/redmine && docker compose restart redmine
```
- The folder name must be `asciisoft_redmine_editor` (it must match the plugin ID).
- For a private repository, `git clone` needs GitHub authentication (token or SSH key).

Update:
```bash
cd /srv/redmine/plugins/asciisoft_redmine_editor && git pull
cd /srv/redmine && docker compose restart redmine
```

### From a zip file
```bash
cd /srv/redmine/plugins && unzip ~/asciisoft_redmine_editor.zip
cd /srv/redmine && docker compose restart redmine
```

### After installation
Check "ASCII SOFT WYSIWYG 편집기" in Administration > Plugins. The first minutes after a restart
can be slow while assets are compiled.
Uninstall: delete the folder and restart (saved text is plain Markdown and is not affected).

## Settings (Administration > Plugins > Configure)
| Setting | Default | Description |
|---|---|---|
| Use WYSIWYG editor | on | Turns the plugin on or off |
| Default font | Segoe UI | Font shown when no font is set; editor text uses it |
| Default font size | 14px | Size shown when no size is set; editor text uses it |
| Editor height | 300 | 120–2000 px. Leave empty to grow with the content |
| Show Editor tab / Show Markdown tab | on / on | With only one on, that mode is used and the switch is hidden. With both off, both are shown |

Choosing the default font or size in the toolbar removes that formatting, so the saved Markdown stays clean.

## Security
- The DOMPurify 2.3.3 copy inside the editor is removed and replaced with DOMPurify 2.5.9 (build/patch-toastui.mjs)
- `style` is allowed only for font/size/line height (span), table cell alignment (td/th) and image size (img),
  and values are checked (url(), backgrounds etc. are removed)
- Pasted HTML is cleaned in a separate, non-executing document and sanitized again
- The mention picker calls same-site URLs only and shows names as plain text
- Redmine also sanitizes stored HTML on the server

## Known limitations
- Paragraph alignment (left/center/right) is not supported yet
- Pages without an attachment list (e.g. wiki edit) show existing images as placeholders
- Formatting HTML appears as tags in CSV export and plain-text email
- News/forum forms get no mention picker (Redmine does not provide a mention search URL there)

## Rebuilding the bundle
See build/BUILD.md. Dependency versions are pinned in build/package-lock.json.

License: GPL-2.0-or-later (LICENSE). Bundled third-party libraries: THIRD_PARTY_NOTICES.md
