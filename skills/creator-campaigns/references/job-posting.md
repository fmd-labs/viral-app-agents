# Writing and publishing a job posting

How viral.app's Copilot takes a user from "post a job" to a public posting that creators apply to. Field names and units are in `jobs-and-applications.md`; this file is the conversation and the writing.

## Ground rules

- `create_job` makes a draft creators never see; only `set_job_status` `"public"` publishes, as its own approval.
- A number (amount, weekly volume) is never guessed. Amounts are advertised as "up to"; the exact payment rules are set in the campaign later.
- Before a round that asks for amounts, show the benchmark line of each pay type (below) as a norm, never a recommendation.
- One product per posting.

## Round 1, before any read

Two questions at once:

- **Where are you starting from?** My first creator job (walk me through it) · I've hired creators before (I know my terms) · I have the posting written (I'll paste it).
- **What are you promoting?** One text field: a link (read the page; product, audience, niche and social profiles come from it) or one sentence with the name, what it does and who it is for. Anything thinner is asked again.

Then silently `list_jobs`: a draft or paused posting for the same product is the better start; offer to edit or publish it instead.

## Round 2 by start point

- **First creator job**: one library search for formats and hooks working in the niche (`search_viral_video_library`), 3 to 5 videos with one line each on what a creator could make from it. They are starters for the posting and its example videos, never its theme. Then the shape lines (below) and four questions:
  - Job type: Canvas UGC (preselected: several short videos a week on a dedicated account) · Influencer (sponsored content on their own audience) · UGC Ads (videos the brand runs as paid ads) · other.
  - Platforms: TikTok, Instagram, YouTube, Facebook, Snapchat; the product page's own profiles preselected.
  - Videos a week per creator.
  - Pay (several): Flat Salary (a fixed amount each pay period) · Base Payment (per published video) · CPM Payment (per 1,000 views) · Bonus Payment (the highest bonus one video can earn).
- **Hired before**: one text question for the terms in their own words ("$15 per video, $1 CPM, 7 videos a week, US and Canada, English"), then one round for what it leaves open: job type, pay components and amounts, weekly volume, countries, languages.
- **Posting written**: one text question for the text; take every field it settles, ask only for pay and weekly volume when it names none, then the draft.

Round 3 (while an amount is open): the amount line of each chosen pay type, then one amount question per type in the organization's currency, asking for the highest amount offered:

- Flat salary at the posting's pay frequency, base payment per video, CPM per 1,000 views.
- Bonus: ONE amount, "What is the highest bonus a single video can earn?". Creators see "Bonus up to …"; the milestones themselves (100k, 500k, 1M) are campaign terms. A ladder becomes its top tier's amount plus one line in the body. A rate per 1,000 views is always the CPM, never a bonus; a bonus under about 5 USD is refused.
- Plus, while the round has room: "Where should creators live?" and "Which languages should the content be in?".

Never ask the rest: the minimum age is a default you state (none, or 18 for an age-gated product), the currency is the organization's default unless the user named another. Never bring up the application challenge (`challengeBriefMarkdown`): leave a pasted one out and an existing one untouched.

## Benchmark lines

Rounded figures from live postings on viral.app:

- "Most jobs on viral.app are Canvas UGC (several short videos a week on a dedicated account) and pay monthly."
- "Typical ask: 5 to 10 videos a week per creator, most often 7."
- "Pay is usually a mix: base payment per video plus a bonus payment is the most common pairing; about half of the postings add a CPM payment, a third a flat salary paid monthly."
- "Nearly every posting names the countries creators must live in and the languages the content is in."
- Base payment per video: "Typically $12 to $20, most often around $16 (in euros nearer €20)."
- Flat salary per month: "Typically $400 to $600, most often around $500 (in euros €300 to €550)."
- CPM payment: "Typically $1 to $1.25 per 1,000 views as one flat rate, most often $1 (€1 in euros)."
- Bonus payment: "The highest bonus a single video can earn is typically $75 to $500, most often tied to 500k or 1M views."

## The posting (`bodyMarkdown`)

What a creator reads before applying: 150 to 350 words, plain words, written to the creator ("you"), never to the team. `##` headings with a short paragraph or 2 to 4 bullets each:

| Section | What goes in |
| --- | --- |
| `## About the product` | What it is, who it is for, why people like it (2 to 3 sentences). |
| `## What you'll do` | The content itself: format, roughly how much in words ("several videos a week"; the exact numbers are requirement fields), where it gets posted. |
| `## Who you are` | The person this fits, in human terms. The hard requirements (countries, languages, minimum age, weekly volume) are fields that render as their own block: never repeat them as a checklist. |
| `## What you get` | Everything besides money: the product, creative freedom, feedback, the chance of ongoing work. |
| `## How we work together` | Briefs, approvals, reporting, how fast the brand replies: only what the user told you, never an approval step or reply time they did not give. |

- Never restate pay or rates in the body: amounts render from the payment fields, and a body that contradicts them reads as bait-and-switch. The one exception: when the user named the bonus milestones, one line under "What you get", the highest tier matching `bonusAmount`.
- Example videos and hooks from the research are inspiration at most: put their links in `exampleVideoUrls` (they become the posting's example tiles), not in the text. Library results carry no link: build it from the result, `https://www.tiktok.com/@{accountUsername}/video/{platformVideoId}` or `https://www.instagram.com/reel/{platformVideoId}/`.
- Markdown: `##`/`###` headings, paragraphs, bold, italic, links, `- ` bullets, `1. ` lists. No tables, code or quotes.

Show the whole draft (body, pay line, hard requirements, example videos), ask "Does the draft look right?", and `create_job` on a yes. There is no dry run for jobs: the saved draft, which creators do not see, is the check.

## The fields

- Required: `productTitle`, `productDescription` (max 300 characters), `productNiches`, `jobType`, `currency` and `payFrequency`; set only the pay amounts the user agreed to. `payFrequency` (`one_time`, `per_day`, `per_week`, `per_month`) is `per_month` unless the user says otherwise: most jobs pay monthly.
- `productNiches`: `ai_software`, `beauty`, `business`, `dating_relationships`, `education`, `entertainment`, `fashion`, `finance`, `fitness`, `food_drink`, `gaming`, `health_wellness`, `home_diy`, `kids_family`, `lifestyle`, `music`, `pets`, `productivity`, `spirituality`, `sports`, `tech`, `travel`, `other`.
- `platformFocus`: `tiktok`, `instagram`, `youtube`, `facebook`, `snapchat`. `contentFormats` (empty accepts any): `talking_head`, `faceless_clipping`, `unboxing`, `product_demo`, `lifestyle_vlog`, `review_testimonial`, `tutorial_how_to`, `skit_storytelling`, `ai_ugc`, `other`.
- `accountType` (`new_account`, `personal_account`, `company_account`): Canvas UGC means a dedicated account, so `new_account` fits it; set it only when the user agrees.
- Weekly volume goes in `minWeeklyVideos`, countries in `countryResidences` (ISO3, e.g. `USA`), languages in `languages` (ISO 639-1). Field rules beyond these: `jobs-and-applications.md`.

## Publishing

1. After `create_job`: "Saved as a draft, creators see nothing yet", show the job (a `job` card in clients with UI), then read the active-jobs quota: `get_usage_meter` with `"active_jobs"`.
2. Ask "Ready to publish?": publish it · change something · keep it as a draft. At the plan's cap (current count at or above the benefited count), offer to pause one of the public jobs and publish this one (two approvals), or say the plan is at its cap.
3. `set_job_status` `"public"` on yes. A publish refused on the active-job limit is not retried: offer to pause another job or keep the draft.
4. Once public, creators can apply from the marketplace; applications arrive per job (`jobs-and-applications.md`).

## Editing

`get_job` first. A body rewrite, pay change or requirement change: show it as before → after, ask "Does the change look right?", then `update_job`. A public job's change is live at once.

`update_job` replaces the whole posting, so send every field back with the changes, with three exceptions that break edits otherwise:

- The text as `bodyMarkdown` only: `get_job` returns `body` too, and sending both is refused.
- `challengeBriefMarkdown` and `videoSubmissionRequired` copied unchanged: left out, the application challenge is wiped.
- New example links in `exampleVideoUrls` with `exampleVideos` and `sampleVideos` left out (omitted, they keep their saved lists; sent, `exampleVideoUrls` is ignored).

## REST

| Step | MCP tool | Route |
| --- | --- | --- |
| List, count, read | `list_jobs`, `count_jobs`, `get_job` | `GET /jobs`, `GET /jobs/count`, `GET /jobs/{id}` |
| Create (draft) | `create_job` | `POST /jobs` |
| Replace | `update_job` | `PUT /jobs/{id}` |
| Publish, pause | `set_job_status` | `POST /jobs/{id}/status` |
| Copy | `duplicate_job` | `POST /jobs/{id}/duplicate` |
| Active-jobs quota | `get_usage_meter` | `GET /organization/meters/active_jobs` |
| Library search | `search_viral_video_library` | `GET /library/viral-videos` |

Base URL, keys and the partner header: `viral-app-mcp/references/rest-api.md`.
