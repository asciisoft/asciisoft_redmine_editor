# asciisoft_redmine_editor (v1.3.4)

[한국어](README.ko.md)

A Redmine 7.0 plugin that replaces the Markdown (CommonMark) text areas with a WYSIWYG editor.
The original text area stays hidden, and the editor writes the content back to it as Markdown
(live while typing, and once more on save).

## Features
- WYSIWYG editing (TOAST UI Editor 3.2.2, bundled in the plugin, no external CDN, loaded only on pages with an editor)
- Toolbar (all buttons 32x32px): Font | Size | Bold, Italic, Strike, Heading | Checklist, Horizontal rule, Quote |
  Bullet list, Numbered list, Indent, Outdent, Line height | Table, Image, Link | Inline code, Code block | Issue link, Wiki link
  - The font and size boxes follow the cursor and show the current font/size (or the defaults)
  - Small up/down chevron buttons next to each box change the value one step
  - Font sizes: 7–99px (shown with "px"). Korean fonts (맑은 고딕, 굴림, 돋움, 바탕, 궁서) are listed only when the UI language is Korean
  - Formatting is saved as `<span style="…">`
- Issue link / wiki link buttons open a 320x200 layer popup with a blurred background (click outside or press Esc to cancel)
- Keeps Redmine syntax such as `#123`, `[[Wiki]]`, `{{toc}}` and `@user`
- `@` opens a user picker (uses Redmine's own mention search; issue and wiki edit forms)
- Paste or drop images from the clipboard → uploaded as Redmine attachments and inserted
- Excel tables become Markdown tables; Word bold/italic/numbered lists are kept
- Images that cannot be loaded are shown as an "Image: file name" placeholder (saved content is unchanged)
- Clicking any empty area of the editor body (for example below the last line) puts the cursor at the nearest position so you can type right away
- Content protection: text that may change when converted opens in Markdown mode with a notice;
  untouched content is saved exactly as it was
- The toolbar always stays on one line (about 40px high). When the editor is too narrow, the buttons that do not fit move into the "⋯" more menu (about 930px of editor width shows every button)

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
| Show Editor tab / Show Markdown tab | on / on | With only one on, that mode is used and the switch is hidden. With both off, both are shown |
| Use the editor for comments | on | When off, issue comments and news comments use a plain text box without the editor or toolbar. Saving is unchanged and Markdown you type still applies |
| Editor height per screen | off | For each screen (issue description, issue comment, news content, news comment, forum, wiki, document description, project description) turn on "Custom" to use a fixed height (120–2000 px); when off, the editor opens at Redmine's default row count |

Choosing the default font or size in the toolbar removes that formatting, so the saved Markdown stays clean.

## Security
- The DOMPurify 2.3.3 copy inside the editor is removed and replaced with DOMPurify 2.5.9 (build/patch-toastui.mjs)
- The editor's own styles are isolated from Redmine's form styles (`.tabular`) so paragraphs, labels and popups render correctly
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
