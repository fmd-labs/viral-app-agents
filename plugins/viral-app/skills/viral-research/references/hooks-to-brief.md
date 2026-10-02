# From research to hooks and a brief

## Pattern summary (what to show the user)

For each of 3 to 5 patterns:

- **Pattern**: format + hook archetype in plain words, for example "talking head, pain-point callout".
- **Why it works**: one or two sentences, grounded in `whyItWorked` and the insights.
- **Examples**: 2 or 3 library videos with link, views and outlier factor.
- **For your product**: one adapted hook (spoken line, on-screen text, first visual).

## Hook writing rules

- The first 1 to 2 seconds carry the hook: a spoken line, matching on-screen text, and a visual that makes sense with sound off.
- Name a specific situation or pain ("3 hours studying, still failing the quiz"), not a feature.
- Show the product on screen within the first 5 seconds when the pattern relies on proof.
- Write 2 or 3 variants per pattern so creators can test them.
- Do not copy a creator's exact words or footage; adapt the structure.

## Script outline (15 to 30 seconds)

1. Hook (0 to 2 s)
2. Problem or setup (2 to 6 s)
3. Product moment or proof (6 to 20 s)
4. Payoff and call to action (last 3 to 5 s)

## Brief template (markdown for `create_brief`)

```markdown
## The product
<What it is and who it is for, in two sentences.>

## Formats that work right now
1. **<Pattern name>**: <why it works>. Example hooks:
   - "<hook 1>"
   - "<hook 2>"
2. **<Pattern name>**: ...

## What to make
- Length: <15 to 30> seconds, vertical
- Hook in the first 2 seconds
- Show <the product moment> on screen

## Must include
- <product name said once>
- <one key benefit>

## Don't
- <claims to avoid, competitor names, prices>

## Sample videos
See the numbered examples below this brief.
```

Then, with approval: `create_brief` (`notify: false`), `add_brief_sample_videos` with the chosen `libraryVideoId`s and short labels (max 60 chars, for example "Hook: pain-point callout"), and link it to a campaign via `set_brief_campaigns` or `update_campaign` with `briefId`. Notify creators only when the user says so.
