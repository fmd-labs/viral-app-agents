---
name: creator-briefs
description: Write a viral.app creator brief the way viral.app's Copilot does. Settle the product, find proven sample videos in the viral video library (or the brand's own tracked videos), let the user pick them, write a short structured brief creators can follow, attach the picks as numbered samples, and decide who reads it. Works over MCP or over the REST API with an API key, for agents that run on webhooks and schedules. Use for "write a brief", "brief my creators", a brief built from videos the user picked or swiped, sample videos for an existing brief, and improving a brief. Campaign setup and creator chat are in creator-campaigns; open-ended trend research is in viral-research.
---

# Creator briefs

A brief is what creators read before they film: the assignment, who the video talks to, the one idea, how to build it, numbered sample videos to learn from, and what is fixed versus up to them. Good briefs are short and built on videos that already work.

Over MCP, load `viral-app-mcp` first if its conventions are not in context. Over REST (an API key, no MCP), every step below has a route: `references/rest-api.md`.

## Ground rules

1. **Product first.** Never search or draft without the product's name, what it does and who it is for. A link: read the page. A sentence: it must settle all three. A bare name ("my app") is not enough: ask again for what is missing.
2. **Look before you ask.** Read the organization's briefs, campaigns, creators and tracked accounts first. Never ask for what the data says, and offer an existing brief as the starting point when one fits.
3. **Samples carry the brief.** 3 to 5 sample videos, at most 10, spanning different hooks or formats: a brief built on several hooks is the norm. Pick for the angle, not the biggest view count.
4. **Draft, then one question.** Show the complete brief, ask "Does the brief look right?", and write only on a yes. A change gets a new draft and the same question.
5. **Reading is mandatory for creators.** Every creator a brief reaches must read it on their next visit (the app blocks until they confirm). Who reads it is the user's call. Creating a brief never notifies. Whether to notify (a chat message plus an email) is asked once, and only when someone would receive it:
   - `update_brief` and `add_brief_sample_videos`: ask when the brief's `notifiableCreatorCount` (from `get_brief`) is above 0; at 0, write silently.
   - `set_brief_audience` and `update_brief_creators`: ask about the creators the change newly reaches who have already joined (campaign counts from `list_campaigns`, creators from `list_creators`); when none of them has joined, stay silent. Ask in the same round as the audience itself.
6. **Never restate campaign settings.** Pay, video targets, platforms and dates live on the campaign; reference them with variables when the brief needs them (`references/brief-writing.md`).
7. **Unattended runs.** An agent running on a webhook or a schedule with nobody to answer creates drafts only: `notify: false`, no audience. It shares or notifies only on a standing instruction the user stated (for example "link every new brief to its app's campaign and notify the creators"). A question nobody can answer means "not now".

## Workflow

1. **Read** (silently): `list_briefs`, `list_campaigns`, `list_creators`, `list_tracked_accounts`. Note the niche the accounts suggest, campaigns without a brief, creators without a campaign.
2. **Start point and audience**, asked together:
   - Where are you starting from? From zero (first creator) · viral videos in my niche · my creators' best videos · creators already posting, I want a better structure.
   - Who should read it? Everyone at the brand (creators who join later too) · up to 3 campaigns without a brief · specific creators · not now (a draft; the default).
3. **Round 2**, one round per path:
   - From zero: the product (rule 1), always asked, then as the niche path.
   - Viral videos in my niche: the product when the accounts do not settle the niche, then the library search, the candidates, the one thing the viewer should do after watching, and anything that must be in or out (optional).
   - My creators' best videos: the tracked-videos search, the candidates, the one thing the viewer should do, and anything that must be in or out (optional).
   - Better structure: the one thing the viewer should do, and what must be in or out ("nothing special" is a fine answer), then the tracked-videos search.
   The viewer's action becomes the call to action and "The one idea"; the in/out answer fills "Must include" and "Avoid" (without one: the product moment and an ad disclosure in, claims you cannot back up out).
4. **Find samples**, one search per source, then decide from what came back:
   - Viral library: `search_viral_video_library` with 3 to 6 words for the niche and the angle in `search` ("college study planner app", "syllabus deadline panic"), `limit` 12, default sort (relevance). Long sentences match nothing: an empty result gets one retry with fewer words or `related: true` before you conclude the library has nothing. Pass `languages` for the language the videos should be in (for example `["en"]`): without it the API searches every language. Results carry `formatPrimary`, `hookArchetype`, `hookTextOverlay`, `whyItWorked` and `replicationTip`.
   - Own tracked videos: `get_top_videos` over the last 90 days, `metric: "viewCountInPeriod"`, `limit` 20.
   - A source with nothing on the product: say so in one line and use the other one.
   - Show 3 to 5 candidates (cards in clients with UI), one line each on what it shows a creator, then ask which to attach. "More like this one": `find_similar_viral_videos`. One standout to study: `get_viral_video_insights`. Say facet values in plain words ("curiosity gap", not `curiosity_gap`).
5. **Write the brief** (`references/brief-writing.md`): 200 to 350 words, the fixed sections, each pick labeled ("Money-glitch hook") and referenced by number under "Learn from the samples". The `name` is internal (creators never see it): product plus angle, for example "Plannr: deadline panic". Show the brief in full, ask rule 4's question.
6. **Create on yes**:
   - `create_brief` with `name`, `contentMarkdown`, `notify: false`.
   - `add_brief_sample_videos`: library picks by `libraryVideoId` (`orgrsv_…`), tracked picks by `platform` + `platformVideoId` (+ `orgAccountId`), each with its `label`, in the order the brief numbers them. A library video that left the library fails the call (`LIBRARY_VIDEO_NOT_FOUND` with its ids): drop it, renumber the brief, retry with the rest. Any other failure (402: the plan has no room to track more videos) leaves the brief citing samples it lacks: keep it a draft, tell the user, and never share it like that.
   - Audience, unless "not now": `set_brief_audience` (everyone, campaigns, creators). Name who will have to read it and how many before the call, with the notify question by rule 5.
7. **After**: show the brief (a `brief` card with the id in clients with UI). `get_brief_read_status` shows who read it; nudge unread creators with a chat message, never a second notify.

## Picks from your own UI

Agents with their own interface (a swipe deck, a gallery) run steps 4 to 6 with the user's picks instead of a question:

1. Search the library from the app's niche and angle; show the results in the UI (`thumbnailUrl`, `accountUsername`, `viewCount`, `hookTextOverlay`, `whyItWorked`).
2. Each pick ("swipe right") can pull `find_similar_viral_videos` for more of that kind; skip videos already shown.
3. With 3 to 5 picks, ask the one thing the viewer should do (or take it from the app's goal), then write the brief from the picks: their `hookArchetype` and `hookTextOverlay` feed "How to build it", their `whyItWorked` and `replicationTip` the lines under "Learn from the samples". Picks that mix hooks are the norm; label each.
4. Create, attach and share as in step 6. A brief written for an app's campaign goes to that campaign (`campaignIds`).

## Samples for an existing brief

`get_brief` and read it like a creator: product, viewer, the one idea, what is in or out, and the samples it already has (at most 10 in total). New samples are appended after the existing ones (duplicates are skipped), so they continue its numbering. Ask the source (tracked videos, library or both) and any direction, search once per source, show 3 to 5 candidates, then `add_brief_sample_videos` with the picks and labels, with the notify question by rule 5. If the brief's text is still empty or the editor's placeholder ("Instructions coming soon."), offer to write it from the new samples. If the samples pull somewhere the text does not go, offer the one-sentence edit.

## Improving a brief

`get_brief`, then check it against `references/brief-writing.md`: missing sections, more than 450 words (creators skim), a script instead of direction, campaign settings restated, samples without labels or not referenced by number. Propose the rewrite, then `update_brief` with only what changes, with the notify question by rule 5 (`notify: true` bumps the version and every creator in the audience must read it again).

Relabeling or reordering samples: `update_brief` with `sampleVideos` as the complete new list, each entry copied from `get_brief` (`orgAccountId`, `platform`, `platformVideoId`, `url`) plus its `label`. An entry sent without its label loses it; a sample left out is removed.
