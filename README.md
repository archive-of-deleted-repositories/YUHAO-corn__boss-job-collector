# Opportunity Queue

A tiny Chromium extension for capturing BOSS job postings into a sortable side panel.

## Redesign Plan
- See slice document: `UI_REDESIGN_SLICES.md`
- Rollout rule: one slice per PR, merge in order to reduce regression risk

## Optional JD Formatter
Structured JD formatting is optional and disabled by default.

Configure in side panel toolbar:
- Click `AI Format`
- Fill `Provider / Model / Endpoint / API Key`
- Toggle `Enable JD formatter`
- Click `Save`

Supported providers:
- `OpenAI` (Responses API format)
- `Anthropic` (Messages API format)

OpenAI-compatible providers (including Doubao Ark) should use `OpenAI` provider.

Example (Doubao Ark, OpenAI-compatible):
- Provider: `OpenAI`
- Model: `doubao-seed-2-0-lite-260215`
- Endpoint or Base URL:
  - `https://ark.cn-beijing.volces.com/api/v3` (auto-normalized to `/responses`)
  - or `https://ark.cn-beijing.volces.com/api/v3/responses`

Storage key (for reference): `opportunityQueueJdFormatterConfig`

Disable formatter by turning off `Enable JD formatter` and saving.


## MVP
- Open the side panel from the extension toolbar icon
- Click `Capture Current Job` on a BOSS page
- Save current job into local storage
- Reorder saved jobs by drag and drop
- Edit captured fields inline
- Export to Markdown or JSON

## Current capture fields
- `url`
- `company`
- `role`
- `location`
- `jdText`
- `capturedAt`

## Notes
- Company is captured from the active card in the left list
- Role, location, JD text, and job link are captured from the right detail panel

## Load locally
1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder: `/Users/godcorn/cursor/opportunity-queue`
5. Click the extension icon to open the side panel

## Suggested Git Workflow (Slice by Slice)
1. `git checkout -b slice/01-card-compact`
2. Implement only the selected slice
3. `git add . && git commit -m "feat: slice 01 card compact layout"`
4. `git push -u origin slice/01-card-compact`
5. `gh pr create --fill --base main --head slice/01-card-compact`
6. Merge, then start next slice branch from updated `main`
