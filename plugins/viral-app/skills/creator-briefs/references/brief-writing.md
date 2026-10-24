# Writing the brief

## Voice and length

- Write for the creator, not the brand: plain words, one video = one idea, direction instead of a script.
- 200 to 350 words. Past 450, creators skim; under 120, a part is usually missing.
- Open with `Hi $creator_first_name` when it reads naturally.

## Structure

`##` headings with short bullets, in this order:

| Section | What goes in |
| --- | --- |
| `## The assignment` | 1 to 2 sentences naming the video's job: content role, viewer and effect. "A native problem-solution demo for students who lose track of deadlines, so they see Acme as the easiest way to plan their week." |
| `## Who you're talking to` | The viewer's situation in 1 to 2 sentences, not demographics. |
| `## The one idea` | The message to remember and the proof to show on screen. |
| `## How to build it` | 2 to 4 hook directions, 2 to 4 story beats, the product moment, one call to action. |
| `## Learn from the samples` | Only with sample videos: one line per sample, in their order, by number and label: "1. Money-glitch hook (@handle): learn the hook and pacing; adapt the setting to our product; don't copy the wording." |
| `## Must include` | The non-negotiables: the product moment, a disclosure, approved claims. |
| `## Avoid` | What never to say or show. |
| `## Make it yours` | What the creator decides: delivery, setting, wording, humor. |
| `## Resources` | Only when the user gave links or access details (a promo code, a test account). |

## Variables

Never restate campaign settings (platforms, videos per cycle, payouts, dates): creators see them with the campaign. Where the brief needs one, use a variable, and only where it reads naturally:

`$creator_first_name`, `$creator_full_name`, `$creator_accounts`, `$creator_email`, `$brand_name`, `$campaign_video_target`, `$campaign_payout_cycle`, `$assignment_start_date`.

Any other `$word` is refused when the brief is saved; a price like `$10` is fine.

## Markdown

`##` and `###` headings, paragraphs, `**bold**`, `*italic*`, `[links](url)`, `- ` bullets, `1. ` numbered lists and `$variable` ids. No tables, code or quotes.

## Sample videos

- 3 to 5 per brief, at most 10. Pick for the angle the brief asks for, not the biggest numbers, and span different hooks or formats when the source has them.
- Each sample gets a label: the caption creators read above its tile, after its number ("2. Money-glitch hook"). A label is a name of 1 to 3 words for the hook or format, the way the brief's text refers to it, never a sentence (max 60 characters). What to take from the video goes into "Learn from the samples".
- Label every video the text points at and every video of a pick that mixes hooks or formats. Interchangeable samples can go without.
- Attach them in the order the brief numbers them. `add_brief_sample_videos` appends after the brief's existing samples (duplicates are skipped): on a new brief the first video is sample 1, on an existing one the numbering continues.

## From library results to the brief

| Library field | Feeds |
| --- | --- |
| `hookArchetype`, `hookTextOverlay` | Hook directions in "How to build it", the sample's label |
| `formatPrimary` | The format named in "The assignment" and the label |
| `whyItWorked` | The line under "Learn from the samples": what to learn |
| `replicationTip` | The same line: how to adapt it to this product |

Write facet values in plain words ("curiosity gap", "product demo"), never the snake_case ids. Adapt structure, never copy a creator's words or footage.

## Example

```markdown
Hi $creator_first_name,

## The assignment
A native problem-solution video for students who keep missing deadlines, so they see Plannr as the fastest way to get their week under control.

## Who you're talking to
A student who just realized three assignments are due this week and has no idea where to start.

## The one idea
Plannr turns a messy syllabus into a week plan in one tap. Show the plan appearing on screen.

## How to build it
- Hooks: a panicked "it's Sunday and I have three essays due", a calendar that is clearly too full, or "the app that saved my semester".
- Beats: the panic, opening the app, the plan appearing, the calm after.
- Product moment: the one-tap week plan, on screen for at least 3 seconds.
- Call to action: "link in bio, it's free to start".

## Learn from the samples
1. Deadline panic (@studywithmia): copy the pacing of the first 3 seconds, not the words.
2. Screen-recording reveal (@notesbyleo): how the app moment carries the video.
3. Before / after (@calmcampus): the split-screen ending.

## Must include
- The week plan on screen
- "Plannr" said once
- #ad or the platform's paid-partnership label

## Avoid
- Grades or exam results we can't back up
- Other apps by name

## Make it yours
Your setting, your wording, your humor. Film where you actually study.
```
