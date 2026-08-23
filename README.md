# qwen-lecture-ai-2

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_4BpwgU4KkAKBMyfwOpEk9yitZCyG)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

## `src/` — the previous implementation

`src/` holds the Vite app this project replaced. Nothing under `app/`,
`components/`, `lib/` or `tests/` imports it, and it is not part of the build.

It is kept in the tree rather than deleted because two of its modules have no
counterpart in the rewrite yet:

- **`src/export/ExportCenter.js`** produces JSON, Markdown, PDF, SRT, TXT and
  VTT. The replacement, `lib/history.ts`, produces JSON only.
- **`src/response/TTS.js`** (speech synthesis) has no counterpart at all —
  no reference to `speechSynthesis` or TTS exists in the new code.

The rest maps across: `QwenClient` → `lib/server/qwen.ts`, `NameMatcher` →
`lib/detection/*`, `StudyEngine` → `lib/ai/local-brief.ts` plus the flashcard
and quiz schemas, `whisper/` → `lib/asr/engines.ts`, `Sessions`/`Settings` →
`lib/session/machine.ts` and `lib/defaults.ts`.

Once those two gaps are closed — or a decision is taken to drop the features —
`src/` can be removed; the history keeps it either way.
