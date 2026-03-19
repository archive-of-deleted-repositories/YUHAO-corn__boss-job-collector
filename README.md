# Opportunity Queue

A tiny Chromium extension for capturing BOSS job postings into a sortable side panel.

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
- `salary`
- `jdText`
- `capturedAt`

## Notes
- Company is captured from the active card in the left list
- Role, location, JD text, and job link are captured from the right detail panel
- Salary may be obfuscated on BOSS and may need manual cleanup after capture

## Load locally
1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder: `/Users/godcorn/cursor/opportunity-queue`
5. Click the extension icon to open the side panel
