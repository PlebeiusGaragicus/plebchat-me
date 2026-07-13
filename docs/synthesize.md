# Synthesize mode

Synthesize is an IDE-like workspace for turning sources into documents: versioned markdown files, an AI collaborator that edits them **with your approval**, and your reference sources — all side by side, all in your browser.

## Projects

Everything lives in a **project**. The dashboard lists yours; create one, and you land in its workspace. Projects (and everything in them) are stored locally in your browser, per nostr identity.

## The workspace

- **Sidebar** (drag to resize, collapsible): three sections — **Chats**, **Files**, and **Sources** — with create buttons on each. Double-click a file to rename it; hover for delete (hold ++shift++ while clicking delete to skip the confirmation).
- **Two tabbed columns**: open items become tabs. With the left column occupied, the next item opens on the right. Drag tabs between columns — or drop one on the right edge to split. The divider between columns drags; your arrangement is remembered per project.
- **Small screens** get a single column with the sidebar as a drawer.

## Files: markdown with live preview

Files open in an editor with Obsidian-style live preview: markdown syntax markers show only on the line you're editing; elsewhere you see the formatted result. Changes save automatically.

- **Versions are snapshots you take.** The camera button in the file toolbar snapshots the current state as a new version; the arrows step through history. Autosave and agent edits update the current version in place — only you create versions.
- **`[[Title]]` wiki-links** connect files. ++cmd++ / ++ctrl++ + click a link to open that file (it's created if it doesn't exist).

## Sources

Sources are read-only reference documents (markdown) the agent can read and cite. Add them by hand via the sidebar's **+** (title, optional URL, pasted content). Importing sources from Search mode is planned.

## The agent

Open a chat and ask the agent to read, write, or edit the project's files. It runs entirely in your browser against the AI endpoint you configure (the same bring-your-own endpoint as Search mode).

The agent can list, read, and search files and sources on its own. **It cannot change a file without you**: every edit stops at an approval banner showing exactly what text would be replaced. Apply it, or reject it — optionally with feedback, which goes back to the agent so it can try a different approach.

Chats are threads in the sidebar, one agent per thread; a running thread keeps working while you look at other tabs.

!!! note "Local-first, for now"
    Synthesize projects don't sync over nostr yet — the event model is a shared design decision with Debate mode (see the [proposal](proposals/synthesize-mode.md)). Your work stays in this browser until then.
