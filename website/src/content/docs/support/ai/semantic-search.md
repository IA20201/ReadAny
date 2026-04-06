---
draft: false
title: Semantic Search
description: Understand vectorization, local indexes, and remote embedding options.
---

Semantic search helps you find passages by meaning, not only by exact keywords.

## How It Works

ReadAny combines:

- **vector similarity** for meaning-based retrieval
- **keyword search** for direct term matches

This usually gives better results than plain full-text search alone.

## Before You Can Use It

The book needs to be vectorized first.

You can usually do this by:

1. opening a book
2. finding the vectorize action
3. choosing a local or remote embedding source
4. waiting for indexing to finish

[Image path: semantic-search-vectorize]

## Local vs Remote Embedding

### Local Embedding

- runs on the current device
- keeps vectors local
- can be slower on low-power devices

### Remote Embedding

- uses a remote API provider
- can be useful on mobile
- still stores the resulting index locally after processing

[Image path: semantic-search-results-panel]

## Important Sync Note

Vector indexes are local-only.

This means:

- vector files do not sync across devices
- another device may know about the same book but still need to vectorize it itself
- sync should not overwrite a device that already has its own local vectors

## Tips for Better Results

- use natural-language queries, not just isolated keywords
- try shorter intent-based prompts like “the argument about labor value”
- re-vectorize if you changed embedding provider or local embedding setup significantly

## Troubleshooting

### Semantic search returns nothing

- make sure the book finished vectorization
- check that the embedding model is configured correctly
- try a broader, more natural query

### One device has vectors, another does not

This is expected. Vectors are not synced.
