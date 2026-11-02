#!/usr/bin/env bash
# Vercel "Ignored Build Step" (vercel.json ignoreCommand, which is capped at 256 characters — hence this file).
# Exit 0 = skip the deploy, exit 1 = build. Skips commits that change nothing the site is built from: docs / *.md, SQL
# migrations, the video studio pack, tests and the probe / cleanup scripts (every kept deployment counts against the
# Hobby plan's 10 GB Deployment Storage).
git diff --quiet HEAD^ HEAD -- . \
  ':(exclude)docs' ':(exclude)supabase' ':(exclude).github' ':(exclude).claude' \
  ':(exclude)*.md' ':(exclude)**/*.md' \
  ':(exclude)server' ':(exclude)studio-pack' ':(exclude)**/*.test.mjs' \
  ':(exclude)scripts/probe-site.mjs' ':(exclude)scripts/probe-actions.mjs' ':(exclude)scripts/test-intake-e2e.mjs' \
  ':(exclude)scripts/vercel-cleanup.mjs' ':(exclude)scripts/qa-chats.cjs' ':(exclude)lib/vercel-cleanup.js'
