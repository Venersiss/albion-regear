# Coup De Grace CTA Composition Sheets

## Status

Planned for a later development phase. This document describes the proposed CTA composition and signup system for the Coup De Grace Albion Regear website.

## Goal

Replace the guild's spreadsheet-based CTA composition workflow with a live, mobile-friendly website feature where:

- Administrators can create and manage CTA composition sheets.
- Members can open a public link without creating an account.
- Members can select a specific empty role slot using their registered Albion IGN.
- Everyone viewing the sheet can see the live composition.
- Members cannot delete or modify the sheet structure or other players' signups.
- Administrators can create multiple composition sheets for the same CTA.

The Excel reference used for this plan is `Cta Spreadsheet.xlsx`.

## Reference spreadsheet structure

The example workbook contains party sections with fields including:

- Online
- Role
- Weapon
- Sign up
- Off-hand
- Head
- Chest
- Boots
- Cape
- Food
- Potion
- Notes

It also contains multiple composition sheets, including `Clap Kite`, `Clap BrawL`, and a `DA CHECK` sheet for disarray level and group-size reference values.

The website should preserve the useful information from this layout while making the data structured, searchable, permission-controlled, and responsive.

## Agreed member signup rules

### Specific slot selection

Members must choose a specific empty slot. They will not be automatically assigned to the next available slot.

Example:

```text
Party 1
  DTank 1       [Empty]
  DTank 2       [Empty]
  DPS 1         [Empty]
```

A member selects one of the empty slots, confirms their registered IGN, and claims that exact slot.

### Registered IGNs only

Members can only sign up using an existing member record from the Supabase `members` table. They cannot type an unregistered IGN or create a new member from the public CTA page.

If a member is missing from the roster, an administrator must add them from the Members section before they can sign up.

### Multiple sheets per CTA

Administrators can create multiple composition sheets for one CTA.

Examples:

- Main Zerg
- Backup Zerg
- Party 1 composition
- Party 2 composition
- Training group
- Alternative composition

Each sheet has its own shareable public link, parties, slots, signups, status, and activity history.

## Admin functionality

Add a new navigation section called `CTA Sheets`.

Administrators should be able to:

- Create a new CTA sheet.
- Choose the CTA name, date, and UTC start time.
- Add multiple sheets for the same CTA.
- Add, remove, rename, and reorder parties.
- Add, remove, rename, and reorder role slots.
- Set a role classification for each slot.
- Add custom role labels such as DTank, Off-tank, Shotcaller, Backup Caller, or Brawl DPS.
- Add weapon requirements.
- Add off-hand requirements when applicable.
- Add helmet, armor, boots, cape, food, potion, and notes.
- Edit an existing sheet.
- Duplicate an existing sheet.
- Save a sheet as a reusable template.
- Create a new sheet from a saved template.
- Move a member from one slot to another.
- Remove a member signup.
- Lock or unlock public signups.
- Mark members as present, absent, late, or signed up.
- View who created or changed the sheet.
- View activity history for administrative changes.
- Copy or regenerate the public share link.
- Export the final composition as CSV or Excel in a later phase.

## Public member functionality

Each CTA sheet receives a secure public link, for example:

```text
albion-regear.vercel.app/cta/secure-share-code
```

Members do not need a website account.

The public flow should be:

1. Open the CTA sheet link.
2. View the CTA name, sheet name, date, and UTC start time.
3. Search for a registered Albion IGN.
4. Choose an available specific slot.
5. Confirm the signup.
6. See the updated composition immediately.
7. Use a private edit code to modify their own signup later.

The public page should update in real time when another member or administrator changes the sheet.

## Public permissions

Members can:

- View the composition.
- Filter by party or role classification.
- Search the visible signups.
- Claim an empty slot.
- Release or change their own signup using their private edit code, while the sheet is unlocked.

Members cannot:

- Delete the CTA sheet.
- Delete a party.
- Delete or rename a role slot.
- Edit weapon or gear requirements.
- Edit another member's signup.
- Remove another member.
- Change the date or UTC time.
- Lock or unlock the sheet.
- Add an unregistered IGN.

Administrators retain full control.

## Signup ownership and edit protection

Because members do not have accounts, each signup should receive a private edit code after submission.

Recommended behavior:

- The member selects their registered IGN and an empty slot.
- The server creates a random edit code.
- The code is shown once after signup.
- A secure hash of the code is stored, not the plain code.
- The member can use the code to edit or release only that signup.
- Clearing browser storage will not remove the signup, but the member may need an administrator to help recover access.

The public page should avoid exposing private edit codes in URLs.

## Proposed sheet layout

### Header

- Guild name: Coup De Grace
- CTA name
- Composition sheet name
- Date
- Start time in UTC using 24-hour format
- Signup status: Open or Locked
- Filled slots count, such as `32 / 40 filled`
- Optional disarray level and recommended group size

### Navigation

- Sheet selector when multiple sheets exist
- Party tabs
- Role classification filters
- Search by member IGN

### Composition rows

Each row represents one specific slot and may contain:

- Slot number
- Role classification
- Custom role label
- Assigned member IGN
- Signup state
- Online or attendance state
- Weapon
- Off-hand
- Headgear
- Armor
- Boots
- Cape
- Food
- Potion
- Notes

Empty slots should be visually clear and easy to select on mobile.

## Recommended role model

Use two role fields:

1. `classification`
   - Tank
   - Support
   - Healer
   - DPS
   - Bomb
   - Caller

2. `role_label`
   - DTank
   - Off-tank
   - Shotcaller
   - Fake/Backup Caller
   - Brawl DPS
   - Any custom role created by an administrator

This keeps filtering simple while preserving the detailed role names used in the guild's spreadsheets.

## Attendance and online status

The spreadsheet's `Online` column should become clearer website statuses:

- Signed up
- Present
- Late
- Absent
- Excused

Members may claim a slot, but attendance status should be controlled by administrators to avoid inaccurate reporting.

Actual website presence and CTA attendance should remain separate concepts.

## Proposed Supabase tables

### `cta_sheets`

Stores the top-level composition sheet.

Suggested fields:

- `id`
- `guild_id`
- `name`
- `cta_name`
- `starts_at`
- `timezone`, default `UTC`
- `status`, such as draft, open, locked, archived
- `share_token_hash`
- `created_by`
- `created_at`
- `updated_at`

### `cta_parties`

Stores the parties belonging to a sheet.

Suggested fields:

- `id`
- `sheet_id`
- `name`
- `sort_order`
- `created_at`

### `cta_slots`

Stores each specific selectable role slot.

Suggested fields:

- `id`
- `party_id`
- `slot_number`
- `classification`
- `role_label`
- `weapon`
- `off_hand`
- `helmet`
- `armor`
- `boots`
- `cape`
- `food`
- `potion`
- `notes`
- `sort_order`

### `cta_signups`

Stores the member assigned to a specific slot.

Suggested fields:

- `id`
- `sheet_id`
- `slot_id`
- `member_id`
- `edit_code_hash`
- `attendance_status`
- `signed_up_at`
- `updated_at`

Add a unique constraint so one slot cannot be claimed twice and, if desired, one member cannot claim multiple slots on the same sheet.

### `cta_templates`

Stores reusable composition templates.

Suggested fields:

- `id`
- `guild_id`
- `name`
- `description`
- `template_data` or related template-party and template-slot records
- `created_by`
- `created_at`
- `updated_at`

### `cta_activity`

Stores changes for auditing.

Suggested fields:

- `id`
- `sheet_id`
- `actor_id`
- `actor_name`
- `action`
- `entity_type`
- `entity_id`
- `details`
- `created_at`

Examples of activity entries:

- Sheet created
- Party added
- Slot edited
- Member signup added
- Member moved to another slot
- Signup removed by administrator
- Sheet locked
- Sheet unlocked

## Security model

Public access should not expose unrestricted Supabase table permissions.

Recommended approach:

- Administrators use their existing Supabase Auth session.
- The public CTA link contains a random share token.
- A server endpoint validates the token before returning sheet data.
- Public reads are limited to the selected sheet.
- Public signup requests validate that the selected member exists and the selected slot is empty.
- Public edits validate the private signup edit code.
- Public users never receive permission to delete parties, slots, sheets, or other signups.
- Row Level Security remains enabled for all CTA tables.

## Realtime behavior

Supabase Realtime should update the public and admin views when:

- A member claims a slot.
- A member changes their own signup.
- An administrator edits a slot.
- An administrator moves a member.
- An administrator removes a signup.
- An administrator locks or unlocks a sheet.

The page should show a small live-update indicator without confusing it with CTA attendance.

## Suggested admin interface

### CTA Sheets list

Show cards or rows with:

- CTA name
- Composition sheet name
- Date and UTC start time
- Status
- Filled slot count
- Last updated time
- Created by
- Open, edit, duplicate, and share actions

### Sheet editor

Desktop layout:

- Left: sheet and party navigation.
- Center: editable composition grid.
- Right: sheet settings and publish/lock controls.

Mobile layout:

- Sheet selector at the top.
- Party tabs.
- Stack each slot as a card.
- Use an edit drawer or modal for gear requirements.

### Public sheet

Prioritize the live roster and empty slots. Keep administrative controls completely hidden from public users.

## Suggested implementation phases

### Phase 1: Data and security

- Add CTA sheet, party, slot, signup, template, and activity tables.
- Add RLS policies.
- Add secure public share-token endpoints.
- Add audit logging.

### Phase 2: Admin sheet management

- Add CTA Sheets navigation.
- Create and edit sheets.
- Add parties and specific slots.
- Add gear requirements.
- Duplicate sheets and save templates.

### Phase 3: Public signup

- Build the shareable public page.
- Search registered IGNs.
- Claim a specific empty slot.
- Generate private edit codes.
- Allow members to edit or release only their own signup.

### Phase 4: Live operations

- Add Supabase Realtime updates.
- Add role and party filters.
- Add attendance controls.
- Add lock and unlock behavior.
- Add admin activity history.

### Phase 5: Export and polish

- Export a completed sheet as CSV.
- Consider Excel export/import.
- Add print-friendly composition view.
- Improve mobile usability.
- Test concurrent signups and duplicate-slot conflicts.

## Important decisions for implementation later

These decisions are already made:

- Members choose a specific empty slot.
- Only registered member IGNs can sign up.
- Multiple composition sheets can exist for one CTA.

Decisions still worth confirming before development:

- Whether one member may claim more than one slot on the same sheet.
- Whether members can release their own signup or must ask an administrator.
- Whether the sheet should automatically lock at the CTA start time or only when an administrator locks it.
- Whether public members should see private notes or only gear and role information.
- Whether Excel import is needed, or whether templates and duplication are sufficient.
