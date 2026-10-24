# Setting up and tuning a campaign

How viral.app's Copilot walks a user from "set up a campaign" (or pasted deal terms) to a created campaign, and through later pay changes. The spec fields, preview and errors are in `campaigns.md`; this file is the conversation around them.

## Ground rules

- Read first: `list_campaigns`, `list_jobs`, `list_briefs`, `list_creators`. They decide which options exist below.
- Ask in rounds of up to 4 questions, 2 to 3 rounds before the draft. A number (amount, target, date) is never guessed: a missing one is a question.
- Before a round that asks for a number, show the benchmark lines for it (below). They describe the norm, never a recommendation: the window question stays unrecommended whatever they say.
- The server fills the start date, platforms, eligibility window and publication scope; the draft names them so the user can change any.
- Draft first: `preview_campaign` with the complete spec, show its sentences and warnings, ask "Does the draft look right?", and `create_campaign` with exactly that spec and `previewHash` on a yes. `ok: false`: fix the listed paths and preview again.

## Round 1: start, region, currency

Only when the message carries no terms. One round, three questions:

- **Where are you starting from?** From scratch · from a job listing (only when there are jobs) · copy a campaign (only when there are current campaigns) · paste deal terms.
- **Where are you looking for creators?** United States · Europe · mixed / international · another country or region. It picks the region line and the name.
- **Which currency will you pay creators in?** See Currency below; the organization's default currency preselected.

Naming: from scratch and pasted terms take "{Region} Creators" ("US Creators", "EU Creators", "Global Creators", "Brazil Creators"), with " #2", " #3" when the name exists; without a region answer, "Creator Campaign #N". A job listing takes its product title; a copy asks for its name.

## Round 2 by start point

- **From scratch**: the schedule lines and the region line, then four questions:
  - Cadence: monthly · biweekly · weekly (custom counts as free text).
  - Window: rolling ("each creator's cycle starts the day they join; you add and pay creators on their own dates") · fixed ("everyone shares one calendar cycle and one payout batch; mid-cycle joiners snap into it"). Never recommend one: it locks once the campaign is in use.
  - Target: videos per cycle. Every post counts, so 10 on TikTok and 10 on YouTube make 20. Count each video once across platforms (`videoTargetUnit: "creatives"`) or per platform (`videoTargetPlatforms`) only when the user asks.
  - Payout types (several): per video · fixed salary per cycle · CPM on views · bonus at view milestones.
  Then round 3: the amount line of every chosen type, then one amount question per type in the campaign's currency. A bonus ladder arrives as prose ("$50 at 100k, $200 at 500k").
- **From a job listing**: which listing, then `preview_campaign` with `fromJobId`. The server derives cadence, amounts and target from the listing; its `missing` paths (always the window, sometimes the target or name) become one round (with the first schedule line only), then preview again with the answers as overrides.
- **Copy a campaign**: which campaign and the copy's name, then `preview_campaign` with `fromCampaignId`. The copy keeps schedule, payouts and brief link.
- **Pasted terms**: fill the spec from the text and ask in one round only what it leaves open: cadence, window, target, region, currency (the first schedule line before it). An amount the text does not state is a question.

## Benchmark lines

Rounded figures from live campaigns on viral.app, shown as norms before the matching question:

- Schedule: "Most campaigns pay monthly on fixed windows that start on the 1st. Rolling windows are the usual pick for weekly cycles, or when creators join on their own dates."
- Target: "About 30 videos a month is typical, 60 in larger programs, 5 a week on weekly cycles. Every platform post counts, so the same video on 3 platforms counts 3 times: 10 videos on 3 platforms = 30 videos."
- Mix: "Per-video pay plus a milestone bonus is the most common mix. CPM shows up in about a third of campaigns, a fixed salary in about one in five."
- Region, United States: "US-focused campaigns lean fixed monthly windows and pay a little above the typical rates."
- Region, Europe: "European campaigns mostly pair per-video pay with milestone bonuses on fixed monthly windows. Rosters run bigger there, so targets sit nearer 60 videos a month."
- Region, mixed: "International campaigns mostly run fixed monthly windows and pay a little below the typical rates. Rosters run bigger there too, so targets sit nearer 60 videos a month."
- Per video: "Typically $9 to $22, most often around $14 (US-focused nearer $17; in euros around €10)."
- Salary: "Typically $400 to $1,500 a month, most often around $500 (US-focused nearer $1,000; rare outside the US)."
- CPM: "Typically $1 to $2 per 1,000 views as one flat rate (US-focused nearer $1.50; in euros around €1)."
- Bonus: "The common milestones are 100k, 500k and 1M views, paying roughly $100, $200 and $500. About half pay only the highest tier reached; the rest add every tier up."

The figures are USD with the euro variant where they have one; for any other currency keep the USD figures and say they are USD. A figure outside the sanity ranges in `campaigns.md` gets one confirmation before the write.

## Currency

- Campaigns are priced in USD, EUR, CHF, GBP, CNY, JPY, KRW, THB, IDR, VND or RUB, nothing else.
- viral.app pays creators through its payout integration only in USD, EUR, CHF and GBP. For any other currency, say that the team pays this campaign's payouts outside the platform and that it cannot pay hired marketplace creators, and confirm the choice.
- The region never sets the currency. On the job-listing and copy paths the source's currency wins: never send `currency` as an override there (the amounts would be re-labeled, not converted). When the source and the user's answer differ, say which currency the draft keeps.

## Which videos a payout counts

Only when the terms say so; never invent a condition.

- Per-payout filters ("slideshows only", "videos tagged Approved", "with #ad", "once a video passes 10k views") go on that entry's `conditions` (match all unless the user says either/or). Under match any, a views row that counts "when reached" only combines with content types; otherwise offer match all, or on a base payout "by end of publication period". Tag ids come from `list_tags`; hashtags use letters, numbers and underscores only.
- A fee that depends on the video's own views ("€20 per video with 10k+ views, €5 below") is two base payouts that differ only in a views row (`atLeast` and `below` the same count), both counted at the end of the publication period (`countWhen: "byPublicationPeriodEnd"`).
- Terms on the creator's total for the period ("halved in months under 300k views", "bonus only in months above 100k") are a `totalViews` row (`atLeast` or `below`, with `countFrom: "periodVideos"` unless the terms count earlier videos' views too); a cut fee is two base payouts, never one.
- A minimum number of videos per period ("base pay only once they post their 6 videos") is a `totalVideos` row, `atLeast` with `"videoTarget"` when it follows the target. On a base payout, ask what happens to a short period's videos: lost (no carry), paid next period if that one reaches the minimum (`carry: "previousPeriod"`), or kept until a period reaches it (`carry: "untilPaid"`). Never pick the carry yourself.
- A video cross-posted to several platforms, paid once: a base payout's `creatives: "once"`; a CPM payout or bonus `creatives: "bestInWindow"` (or `"bestInPeriod"` when the terms judge the period's views); `scope: "per_creative"` when the copies' views add up. Only when the user asks, and never on a payout that covers one platform or counts current-period videos only.

## After the campaign exists

One next step at a time:

1. When creators have no current assignment (`list_creators`): "Assign creators to it now?" Then `get_assignment_options` and the start question from `campaigns.md` (Assign creators; never offer a start it returns as null), and one `assign_creators_to_campaign` call. Assigning tells the creators: show who before the call.
2. Unless it is a copy: "Attach a brief?" An existing brief: `update_campaign` with `briefId` alone (a brief shared with everyone at the organization cannot be attached). A new one: `creator-briefs`, with the brief going to this campaign.

## Changing what a campaign pays

1. `get_campaign`: read its spec, its sentences and `lockedFields`. A locked field cannot change: say so and offer a copy (`preview_campaign` with `fromCampaignId`).
2. Edit the whole `payouts` block starting from `spec.payouts` (a tier change sends the full ladder). Keep every entry's `id`, `conditions` and `minViews` exactly as they are unless the user asks: a payout sent without its `id` is replaced by a new one, which detaches any creator's custom rate on it (a 409 `CUSTOM_RATES_RESET_REQUIRED` names them), and dropping conditions makes that payout pay for every video. A new amount the user did not state is a question, after its benchmark line.
3. `preview_campaign` with `id` and the changes; show the before and after sentences and say that the new rules apply to every unpaid payout at once. When the campaign already paid a period, a views change re-judges earlier views: show that warning. Then "Does the change look right?" and `update_campaign` with the same changes and `previewHash`.
4. **One creator only** ("pay Maya €12 per video"): leave the campaign alone and set that creator's custom rates, values only (per video, CPM rate, bonus amount, fixed salary, caps, video target), each naming a payout of the campaign by its `id` from `spec.payouts`. The write replaces the creator's whole set, so start from their current custom values (on `get_campaign`, or `GET /campaigns/{id}/custom-rates/{creatorId}`) and add the change. `preview_creator_custom_rates` with `mode: "replace"`, show a short before → after list, ask "Do the custom rates look right?", then `set_creator_custom_rates` with the same values and its `previewHash`. An empty set resets the creator to the campaign's rates. Other payouts or conditions for one creator need their own campaign.
5. Ending and reactivating: `campaigns.md`.

## REST

| Step | MCP tool | Route |
| --- | --- | --- |
| Preview (dry run) | `preview_campaign` | `POST /campaigns/validate` (`spec`, `id`, `fromJobId` or `fromCampaignId`) |
| Create | `create_campaign` | `POST /campaigns` |
| Read, list | `get_campaign`, `list_campaigns` | `GET /campaigns/{id}`, `GET /campaigns` |
| Change | `update_campaign` | `PUT /campaigns/{id}` |
| End, reactivate | `get_campaign_end_context`, `end_campaign`, `reactivate_campaign` | `GET /campaigns/{id}/end-context`, `POST /campaigns/{id}/end`, `POST /campaigns/{id}/reactivate` |
| Custom rates | `preview_creator_custom_rates`, `set_creator_custom_rates` | `POST /campaigns/{id}/custom-rates/validate`, `PUT /campaigns/{id}/custom-rates/{creatorId}`; read with `GET` and reset with `DELETE` on the same path |
| Assign creators | `get_assignment_options`, `assign_creators_to_campaign` | `GET /creators/campaigns/assign-options`, `POST /creators/campaigns/assign` |

Over REST `previewHash` is optional but recommended: with it, a write that differs from the dry run is refused (409 `CAMPAIGN_PREVIEW_MISMATCH`, `CUSTOM_RATES_PREVIEW_MISMATCH`). Base URL, keys and the sub-org header: `viral-app-mcp/references/rest-api.md`.
