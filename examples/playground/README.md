# Playground

This is a local demo app to validate the core features without a backend.

## Setup

From repo root:

```bash
npm install
npm run build
```

Then:

```bash
cd examples/playground
npm install
npm run dev
```

Open the URL shown by Vite.

## What to test

- Query cache: `staleTime`, `cacheTime`, `keepPreviousData`
- Dedupe: click `Refetch` multiple times quickly
- Retry: toggle `Error on` and refetch
- Tag invalidation and cancel
- Mutations with optimistic updates
- Infinite query paging
- Persistence: reload the page (session storage)
