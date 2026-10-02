---
name: viral-research
description: Research what works in short-form UGC with viral.app. Search the curated viral video library by niche, format, hook, product type, region or language, find videos similar to a reference, pull deep hook, CTA and scene breakdowns, analyze a tracked video's actual content with AI (spends credits), check live platform data, and turn the findings into hooks, scripts and a creator brief. Use for "what's working in niche X", hook and format ideas, competitor or trend research, and inspiration for briefs. Not for reporting on the user's own performance (ugc-reporting).
---

# Viral research

Load `viral-app-mcp` first if its conventions (credits, ids) are not in context yet.

## Pick the source

| Question | Source | Cost |
| --- | --- | --- |
| What formats and hooks work in a niche, examples to copy | Viral video library: `search_viral_video_library`, `find_similar_viral_videos`, `get_viral_video_insights` | free |
| How our own or tracked competitors' videos performed over time | Tracked history: `get_top_videos`, `list_videos`, `get_video_history` | free |
| What actually happens in one of our tracked videos | `analyze_video` | credits (quote first) |
| A number right now, or a video or account that is not tracked | `live_get_video`, `live_get_account`, `live_get_account_videos`, `live_search_videos`, `live_search_hashtags`, `live_get_video_comments` | credits (quote first) |

The library is curated performance UGC (TikTok and Instagram Reels, mostly app and SaaS marketing). It is not the organization's tracked content.

## Library workflow

1. **Search**: map the niche to `verticals`, the style to `formats`, the opening to `hookArchetypes`, the product to `productTypes`; put the user's actual question in plain words into `search` (it searches transcripts, on-screen text, scenes, hooks, brands and creators). Pass `languages` for the language in the video (for example `["de"]` for German UGC; omitted searches every language). Start with `limit` 12 to 24. Filter values are in `references/library-filters.md`.
2. **Rank for the question**: `sort: "outlier"` for videos that beat their account's follower count ("punch above their weight"), `"views"` for reach, `"engagement"`, `"latest"` for post date, `"recent"` (default) for what the library added last. Leave `dateRange` at `all` unless recency is the question.
3. **Read the results**: every result carries `formatPrimary`, `hookArchetype`, `hookTextOverlay`, `whyItWorked` and `replicationTip`. Group by format and hook yourself; one search usually answers the question.
4. **Go deeper** on a handful of standouts only: `get_viral_video_insights` (hook timing, psychological trigger, retention, CTA mechanic, persona, scenes). `find_similar_viral_videos` with a result's `id` when the user likes one example and wants more of that kind.
5. Say facet values in plain words ("curiosity gap", not `curiosity_gap`).

## Own videos with AI

`analyze_video` watches one tracked video (`platform` + `platformVideoId` from `get_top_videos`, `list_videos` or `get_video`) and answers a `prompt`, optionally into an `outputSchema` (for example hook, first-3-seconds description, on-screen text, CTA, score). Quote first, get approval, then call with `confirm: true`. To compare several videos, quote the total, then call once per video and synthesize.

## From findings to hooks and a brief

1. Cluster what works into 3 to 5 patterns (format + hook + proof), each with 2 or 3 example videos and why they work.
2. Write hooks for the user's product per pattern: the first spoken line, the on-screen text, and the first visual.
3. Draft a brief in markdown (template in `references/hooks-to-brief.md`). Hand off to `creator-campaigns`: `create_brief` with `notify: false`, then `add_brief_sample_videos` with the chosen library videos (`libraryVideoId`, `orgrsv_` ids) and labels such as "Hook: POV notification".

## Presenting

In clients with UI, show examples with the `videos` or `video` card and a split by format or hook with `chart-pie` or `chart-bar`. In terminal clients, a table with link, format, hook, views and why it worked.
