# Viral video library filters

Values for `search_viral_video_library`. Several values in one filter widen the match. The tool's schema is authoritative if these drift.

## verticals (the niche)

`education_study`, `career_work`, `business_entrepreneurship`, `marketing_sales`, `technology_ai`, `software_apps`, `finance_investing`, `ecommerce_retail`, `health_fitness`, `beauty_fashion`, `food_cooking`, `home_lifestyle`, `travel_outdoors`, `relationships_family`, `entertainment_culture`, `gaming`, `news_commentary`, `other`

## formats (how it is made)

`tutorial_how_to`, `talking_head`, `screen_recording`, `product_demo_review`, `storytime_vlog`, `skit_pov`, `listicle_countdown`, `comparison_reaction`, `trend_meme_remix`, `interview_street`, `cinematic_montage`, `other`

`talking_head` and `screen_recording` describe presentation, so their results still carry a structural `formatPrimary` such as `product_demo_review`. Do not conclude from `formatPrimary` that a talking-head result is not one.

## hookArchetypes (the opening)

`bold_claim`, `pain_point_callout`, `curiosity_gap`, `mistake_warning`, `quick_win_promise`, `contrarian_take`, `question_hook`, `story_in_medias_res`, `proof_results`, `secret_reveal`, `challenge_dare`, `other`

## productTypes

`ecommerce_physical`, `ecommerce_digital`, `mobile_app`, `saas`, `course_coaching`, `service`, `marketplace`, `subscription_content`, `other`

## Other filters

- `languages`: ISO 639-1 codes of the language spoken or written in the video, classified from the video (`["es"]` finds Spanish UGC from any country). Omitted = every language.
- `regions`: 2-letter country codes of the account's region.
- `platform`: `all` (default), `tiktok`, `instagram`.
- `minViews`, `minOutlierFactor`: floors for reach and for over-performance relative to followers.
- `brandDetected`, `productDetected`: `any`, `yes`, `no`.
- `bookmarkedOnly`: the organization's shared bookmarks.
- `dateRange`: `all` (default), `7d`, `14d`, `30d`.
- `sort`: `recent` (default, newest in the library), `latest` (platform post date), `views`, `engagement`, `outlier`.
- `limit` (up to 60) and `offset` for paging.

## Example searches

| User asks | Arguments |
| --- | --- |
| "What UGC works for study apps?" | `verticals: ["education_study"], productTypes: ["mobile_app"], sort: "outlier", limit: 24` |
| "Screen recordings with a voiceover for a finance app" | `verticals: ["finance_investing"], formats: ["screen_recording"], search: "screen recording with voiceover explaining the app"` |
| "Spanish-language hooks for a fitness app" | `verticals: ["health_fitness"], languages: ["es"], sort: "views"` |
| "Videos where a creator reacts to a notification" | `search: "creator reacts to a notification on their phone"` |
| "What's new this week in AI tools" | `verticals: ["technology_ai"], dateRange: "7d", sort: "latest"` |
