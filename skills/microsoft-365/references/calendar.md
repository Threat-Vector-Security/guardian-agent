# Calendar

Use `m365` for Calendar work. Use `m365_schema` if an endpoint is unclear.

CRITICAL: Always execute reads immediately. When the user asks about their calendar, upcoming events, or schedule, call the tool right away. Do not ask if they want you to check.

## List events

Always include `attendees` and `location` — the user will ask follow-ups about who's invited and where.

```json
{
  "tool": "m365",
  "args": {
    "service": "calendar",
    "resource": "me/events",
    "method": "list",
    "params": {
      "$top": 10,
      "$select": "subject,start,end,location,organizer,attendees,isAllDay,isCancelled",
      "$orderby": "start/dateTime"
    }
  }
}
```

When presenting results, format as:
- Date/time range — **Subject** — Location (if any) — Attendee count

## Get calendar view (date range with recurring event expansion)

Use `calendarView` when the user asks about a date range. This expands recurring events into individual occurrences.

```json
{
  "tool": "m365",
  "args": {
    "service": "calendar",
    "resource": "me/calendarView",
    "method": "list",
    "params": {
      "startDateTime": "2026-03-01T00:00:00Z",
      "endDateTime": "2026-03-31T23:59:59Z",
      "$select": "subject,start,end,location,attendees,isAllDay",
      "$orderby": "start/dateTime"
    }
  }
}
```

## Get today's events

Compute today's start/end in UTC and use `calendarView`:
- `startDateTime`: today at 00:00:00Z
- `endDateTime`: today at 23:59:59Z

## Create an event

```json
{
  "tool": "m365",
  "args": {
    "service": "calendar",
    "resource": "me/events",
    "method": "create",
    "json": {
      "subject": "Meeting",
      "start": { "dateTime": "2026-03-20T10:00:00", "timeZone": "UTC" },
      "end": { "dateTime": "2026-03-20T10:30:00", "timeZone": "UTC" },
      "location": { "displayName": "Conference Room A" },
      "attendees": [
        { "emailAddress": { "address": "user@example.com" }, "type": "required" }
      ]
    }
  }
}
```

## Update an event

Put the `eventId` in `id`, not `json`.

```json
{
  "tool": "m365",
  "args": {
    "service": "calendar",
    "resource": "me/events",
    "method": "update",
    "id": "EVENT_ID",
    "json": {
      "subject": "Updated Meeting Title"
    }
  }
}
```

## Delete an event

```json
{
  "tool": "m365",
  "args": {
    "service": "calendar",
    "resource": "me/events",
    "method": "delete",
    "id": "EVENT_ID"
  }
}
```

Before writes:
- Confirm title, date, timezone, and duration if they are missing
- Read first if the user refers to an existing event vaguely
- `start` and `end` require both `dateTime` and `timeZone`

Approval rules:
- Creates, updates, and deletes are mutating and may require approval
- Reads (list, get, calendarView) pass through — no approval needed
