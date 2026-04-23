# Auto-Template New Note

Auto-Template New Note is an Obsidian plugin that applies one configured template to every newly created empty Markdown note.

## Behavior

- Applies to all newly created `.md` files in the vault.
- Never overwrites non-empty notes.
- Treats whitespace-only notes as empty.
- Ignores non-Markdown files.
- Ignores the configured template file itself.
- Copies the template content exactly as written.
- Does not process variables such as `{{date}}`, `{{time}}`, or `{{title}}` in v1.

## Settings

Set the template path in plugin settings. Example:

```text
Templates/Standard.md
```

The setting is saved even if the file does not exist yet, so you can configure the plugin before creating the template file.

## Manual Command

Use `Auto-Template: Apply configured template to current note` from the command palette to apply the configured template to the active empty Markdown note.

## Creator

creator: [samantha leck](https://ko-fi.com/heysam)
