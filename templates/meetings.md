---
title: meetings
tags: [folder-note]
pageType: index
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
last_reviewed: <YYYY-MM-DD>
status: active
owner: PM
---
# meetings

Optional lane. Records of meetings, calls, and group discussions where a decision or action item emerged. Each file is one meeting, dated and slugged (`YYYY-MM-DD_<topic-slug>.md`). Decisions made in a meeting get their own `decisions/D-NNN_<type>_<slug>.md`; action items that become a plan get their own `roadmap/plans/YYYY-MM-DD_<slug>.md`.

This lane is *not* auto-scaffolded by `bootstrap-pm.mjs`. To use it, create the folder + this file by hand, or copy the template. A project without meeting records doesn't need this folder.

<!-- vault-maintain:index:start -->
## Notes

<!-- Add meeting files here, one per line:
- [[<ProjectPath>/meetings/YYYY-MM-DD_slug|YYYY-MM-DD <topic>]]
-->
<!-- vault-maintain:index:end -->

## Conventions

- **Filename:** `YYYY-MM-DD_<topic-slug>.md` (date prefix from the meeting date).
- **H1:** the topic slug, no date prefix.
- **Body sections:** see `templates/meeting-record.md` for the full shape. At minimum: Attendees, Agenda, Discussion, Decisions Made, Action Items.
- **Decisions and plans are not duplicated here.** A meeting that produces a decision gets a `decisions/D-NNN_<type>_<slug>.md`; the meeting record cites it. Same for plans: a meeting that produces a plan gets a `roadmap/plans/YYYY-MM-DD_<slug>.md`; the meeting record cites it. The meeting record is the *source*; the decision and plan are the *formalized outputs*.
- **Append-mostly.** Don't rewrite a past meeting record to reflect later developments; cite the new artifact instead.
- **Status on meeting records:** `active` while the meeting is in progress; `closed` once it ends (the default for a finished record). Agent producing the record in real time should set `active` and switch to `closed` when the meeting concludes.

## Navigation

- [[<ProjectPath>/<Project>|Back to <Project>]]
- [[Projects/Projects|Back to Projects]]
- [[Home|Back to Home]]
