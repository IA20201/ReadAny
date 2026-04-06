---
draft: false
title: Importing Books
description: Supported formats, import methods, and what happens after a book is added.
---

## Supported Formats

ReadAny supports the following ebook formats:

| Format | Extensions | Notes |
|---|---|---|
| EPUB | `.epub` | EPUB 2 and EPUB 3 |
| PDF | `.pdf` | Text-heavy PDFs work best |
| MOBI | `.mobi` | Legacy Kindle format |
| AZW / AZW3 | `.azw`, `.azw3` | DRM-free only |
| FB2 / FBZ | `.fb2`, `.fbz` | FictionBook format |
| CBZ | `.cbz` | Comic archive |

## What Happens During Import

When a book is imported, ReadAny will usually:

- copy the book into the app-managed library directory
- extract title, author, and cover information when available
- create a library record in the local database
- keep the original source file untouched

[Image path: import-book-dialog]

## Import Methods

### Drag and Drop

Drag one or more books into the library window.

### Import Button

1. Click the import button in the library
2. Choose one or more files
3. Wait for the import to finish

### File Association

On desktop, supported books can be associated with ReadAny so you can open them directly from the file manager.

## If a Book Came From Sync

Books that arrive from another device may not always be downloaded locally yet.

- On desktop, a synced remote book can appear with a **download required** state.
- Opening it will download the book file first, then open it.
- Covers and metadata can appear before the full file is downloaded.

[Image path: synced-book-download-required-state]

## Library Management

- search by title or author
- sort by title, author, recently read, or added date
- add tags to group books
- remove books from the library

## Tips

- Import a few books first before enabling sync on a fresh install.
- If you plan to keep a large library on desktop, consider moving the desktop library directory in **Settings → General**.
- DRM-protected books are not supported.
