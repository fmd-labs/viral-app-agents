# Briefs and creator chat

## Briefs

A brief tells creators what to make: the assignment, the one idea, hooks, what to include and avoid, sample videos (campaign settings such as pay and targets stay on the campaign). A campaign holds one brief; a brief can serve several campaigns.

- `list_briefs` (search, campaign filter) and `get_brief` (content as markdown, linked campaigns, samples, and how many creators a notify would reach right now).
- `create_brief`: `name` (unique per organization), `contentMarkdown`, optional `sampleVideos` from tracked videos, and `notify` (required). It can also take the audience (`campaignIds`, `creatorIds`, `allCreators`), but `creator-briefs` saves a draft first and sets the audience after the user confirms.
- `update_brief`: send only what changes. `sampleVideos` REPLACES the list (read `get_brief` first). `notify: true` bumps the version and re-notifies everyone in the audience; `notify: false` saves silently.
- `add_brief_sample_videos`: append tracked videos (`platform` + `platformVideoId`) or viral-library videos (`libraryVideoId`, `orgrsv_`; tracked as reference-only samples that count against the tracked-videos limit), each with an optional `label` creators see. Silent unless `notify: true`.
- `set_brief_campaigns`: set exactly which non-ended campaigns use the brief; `notify: true` notifies creators on newly linked campaigns.
- `set_brief_audience`: who reads it in one call: everyone at the organization (`allCreators`, creators who join later too), or linked campaigns (`campaignIds`) plus creators it is sent to directly (`creatorIds`). `update_brief_creators` adds or removes single creators. Every creator it newly reaches must read it on their next visit; `notify: true` also messages and emails them.
- `get_brief_read_status`: per creator, whether they read the current version, an earlier one, or not yet.
- `delete_brief`: permanent and silent. Confirm first.
- A campaign can also point at a brief through `update_campaign` with only `briefId` (no preview needed).

How to write one (structure, length, variables, sample labels) and the full workflow: `creator-briefs`.

## Creator chat

Chat tools, group chats, broadcasts and nudges: `creator-management`. Application threads: `open_application_chat` (`jobs-and-applications.md`).
