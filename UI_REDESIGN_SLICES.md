# Opportunity Queue UI Redesign Slices

## Goal
Ship the side panel redesign in small, testable slices so we do not break capture flow.

## Direction (locked)
- Card title (`role`) is single-line only, with ellipsis.
- Card actions use a subtle top-right kebab menu.
- Salary-related UI and logic are removed.
- Expanded view is redesigned as a coherent detail layout (not a fragmented block).
- JD formatting via lightweight model is optional: if configured, format; if not, keep raw text.

## Non-goals
- No backend service.
- No auth flow.
- No major data migration outside local storage compatibility.

## Slice Plan

### Slice 1: Card Compact Layout Foundation
Scope:
- Make role title single-line (`ellipsis`), slightly smaller font.
- Normalize card row rhythm: title row, company/location row, meta row.
- Keep current features working (expand/edit/delete/reorder).

Acceptance:
- Long role names never wrap to 2 lines.
- Card heights stay visually stable across list items.
- No regression in drag reorder and open/close.

Rollback:
- CSS-only rollback possible by reverting card typography/layout styles.

### Slice 2: Action Hierarchy and Kebab Menu
Scope:
- Keep card primary interaction as click-to-expand.
- Move secondary actions into a low-emphasis kebab button at top-right.
- Keep menu items: open source, edit fields, delete.

Acceptance:
- Menu is discoverable but visually low noise.
- Clicking anywhere else closes the menu.
- Card click and menu click do not conflict.

Rollback:
- Revert menu styles/placement only; event handlers can remain.

### Slice 3: Split Layout with Fixed Reader Pane
Scope:
- Replace card inline expansion with a fixed bottom reader pane.
- Compress top area into a single-line toolbar (capture remains primary action).
- Keep list and reader visible together; selecting a card updates reader content.
- Add draggable divider to resize list vs reader height.
- Move `Copy JD` and `Open source` into reader header action area.

Acceptance:
- No card inline expansion remains in list.
- Switching jobs does not require page-like navigation.
- Reader pane remains usable with long JD text and narrow side panel width.
- Divider resizing persists and does not break layout.

Rollback:
- Revert workspace split layout while preserving Slice 1 and Slice 2 card behavior.

### Slice 4: Salary Removal End-to-End
Scope:
- Remove salary badge from card summary.
- Remove salary field from editor.
- Remove salary review text/status from footer.
- Stop exporting salary in markdown/json templates.
- Keep backward compatibility for old stored jobs (ignore legacy salary keys safely).

Acceptance:
- No salary wording appears in UI.
- Old data with salary keys does not crash rendering.
- Copy/export still works.

Rollback:
- Restore salary UI blocks and salary mapping in render/export logic.

### Slice 5: Optional JD Structured Formatting (Lightweight Model)
Scope:
- Add optional formatter pipeline for JD text.
- If API key/config exists, call model and generate structured sections.
- If missing/failed, silently fall back to raw JD text.
- Provide simple toggle in detail view: `Raw | Structured` (only show structured tab when available).

Implementation notes:
- Never hardcode API key in repo.
- Store user config in extension storage (e.g., `jdFormatterEnabled`, `jdFormatterApiKey`).
- Add host permission for model endpoint only when enabling this slice.
- Use timeout and strict failure fallback to raw mode.

Acceptance:
- No configured key: behavior unchanged from today.
- Configured key + successful call: structured view appears.
- Model failure/network timeout: raw view still available, no blocking.

Rollback:
- Disable formatter feature flag; raw mode remains fully functional.

### Slice 6: Final Polish and QA Gate
Scope:
- Refine spacing, typography, and contrast.
- Verify empty/loading/error statuses.
- Cross-check interaction consistency in 320-420px side panel widths.

Acceptance:
- Visual rhythm is consistent in collapsed and expanded states.
- No layout jumps or clipped controls on narrow width.
- Core workflows pass manual QA checklist.

## Execution Order
1. Slice 1
2. Slice 2
3. Slice 3
4. Slice 4
5. Slice 5 (optional, can be delayed)
6. Slice 6

## Observed Issues Backlog
- Menu popup can be hidden behind adjacent cards when opened near card boundaries.
  - Resolved in Slice 2 (active card stacking context + stronger menu layering).

## Manual QA Checklist (per slice)
- Capture one new job from BOSS page.
- Capture same job again (update path).
- Expand/collapse card.
- Reorder multiple cards.
- Open menu and trigger each action.
- Copy JD and verify clipboard.
- Export markdown/json and inspect fields.
- Reload extension and confirm storage persistence.

## Data Compatibility Notes
- Existing local data may contain: `salary`, `salaryRaw`, `salaryNeedsReview`.
- New UI should ignore these fields without deleting them immediately.
- Optional cleanup migration can be added later after UI is stable.
