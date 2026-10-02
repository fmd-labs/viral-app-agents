# Campaigns

A campaign defines how assigned creators are paid per payout cycle. Every write goes through `preview_campaign`.

## Spec essentials

- `name`, `description`, `currency` (`USD`, `EUR`, `GBP`, ...), `videoTarget` (videos expected per cycle), `briefId` (optional).
- `schedule.anchor` is required and never guessed. Ask:
  - `rolling`: each creator's cycle starts the day they join; creators are added and paid on their own dates.
  - `fixed`: everyone shares one calendar cycle; a creator added mid-cycle gets a first period cut to the join day; payouts go out in one batch per cycle.
  The anchor locks once the campaign is in use.
- `schedule.interval` (`day`, `week`, `month`) and `intervalCount` (1 to 12): monthly = month × 1, biweekly = week × 2. `schedule.startsOn` defaults to today (rolling) or the start of the current week or month (fixed).
- `payouts` (replaces every payout when present), all amounts in MAJOR units:
  - `basePayouts`: `perVideo` per published video, optional `minViews`, `platforms`, `limit` (omitted: stops at the video target; `null`: unlimited; object: video or amount cap per cycle).
  - `cpmPayouts`: `tiers` of `{ from, to, rate }` per 1,000 views, progressive; `scope` `per_video` or `all_content`.
  - `flatBonuses`: milestone `tiers` of `{ from, to, amount }`; `mode` `highest` or `aggregated`.
  - `fixedSalary`: `{ amount }` per cycle; `performanceCap`: max CPM plus bonuses per cycle.
  - `eligibility`: `windowDays` (default 31) a video keeps counting; `publicationScope` `include_earlier` or `current_period_only`.
- Tiers are half-open `[from, to)`: each tier's `from` equals the previous `to`; only the last tier leaves `to` out.
- Entries of one family (`basePayouts`, `cpmPayouts`, `flatBonuses`) may share platforms and then STACK (a video earns each). Set that up only when the user asked for it; otherwise give each entry its own platforms. The preview warns (`base_payouts_overlap`, ...).

## Sanity ranges (live campaigns, per payout cycle)

When a number the user gives falls outside these, say so once and confirm before writing; never suggest numbers on your own: base payout per video 5 to 35 USD (median 14) or 5 to 20 EUR (median 10); CPM 0.5 to 3 USD per 1,000 views (median 1) or 0.1 to 2 EUR; fixed salary 150 to 6,000 USD a month (median 500); flat bonus roughly 10 at 10k views, 50 at 50k, 100 at 100k, 200 at 500k, 500 at 1M; video target 4 to 90 per month (median 30) or 3 to 28 per week (median 5).

## Create

1. Collect name, currency, anchor, cadence, video target and payouts. Shortcuts: `preview_campaign` with `fromJobId` derives a draft from a job's pay fields and lists `missing` paths (the anchor is always missing); `fromCampaignId` copies a campaign.
2. `preview_campaign` with the spec (plus overrides). Show `summary` sentences and `warnings`.
3. On approval: `create_campaign` with exactly the returned spec and its `previewHash`. A mismatch or missing hash fails with `PREVIEW_REQUIRED`.

## Update

1. `get_campaign`: quote its summary sentences; note `lockedFields`.
2. `preview_campaign` with `id` and only the changes. Top-level fields and schedule keys are partial; `payouts` replaces the whole block, so start from `get_campaign`'s `spec.payouts` and send the complete edited block.
3. Show `changes` (every sentence the edit alters). Rule changes hit every unpaid payout at once: say so before the approval.
4. `update_campaign` with the same changes and the `previewHash`. Attaching or swapping only `briefId` needs no preview.
5. A locked field (`CAMPAIGN_FIELD_LOCKED`) cannot change: offer a copy via `preview_campaign` with `fromCampaignId`.

## End and reactivate

- `get_campaign_end_context`: offer `cycleEnds.current` or `cycleEnds.next` as the end date (never invent one).
- If assignments reach past the chosen end, ask ONE consent question naming the creators: `endAssignments` (each moves to its last full period) and/or `revokeAssignments` (rows that cannot keep a full period are deleted).
- `end_campaign` with only the flags the user chose. `ASSIGNMENTS_ACTIVE` or `ASSIGNMENTS_AFTER_END` means consent is missing: report it, do not retry with other flags.
- `reactivate_campaign` clears the end date: name the campaign and its current end date before the approval.

## Assign creators

1. `list_creators` for `orgcre_` ids; `list_campaigns` for the `orgcamp_` id.
2. `get_assignment_options` with the campaign and creators:
   - Fixed campaigns: on the cycle's first day use `startBasis: "current"` without asking. Mid-cycle ask once: today (joins mid-period, salary pro rata), current (backdates to the cycle start, paid in full) or next (waits for the boundary), showing the three dates. Never offer a basis returned as null.
   - Rolling campaigns: `startBasis: "custom"` with `startDate` today unless the user names a day.
   - `blockedBy` creators cannot be assigned: say which and why (archived ones need unarchiving in the app). `payout_hold` on everyone means overdue payouts must be settled first: point to the Payouts page.
3. One `assign_creators_to_campaign` call for all creators. Switching or unassigning happens in the app.

## Read performance

- `get_campaign` for terms; `get_campaign_kpis` (views, posted and eligible videos, spend, CPM; previous period with `scope: "dateRange"`); `get_campaign_activity` (pace per creator: `onSchedule`, `runningTight`, `overdue`).
