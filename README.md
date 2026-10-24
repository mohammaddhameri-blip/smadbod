# SMADBOD — working prototype (v0.1)

A standalone, responsive, installable blackboard-first teaching hub designed for the school smartboard, desktop, and mobile browsers.

## Test locally

From this folder:

```sh
python -m http.server 8080
```

Visit `http://localhost:8080`. On a phone/tablet within the same trusted network you can visit your PC's LAN IP and port if the firewall allows it; offline installation and service workers require a secure context (HTTPS) in production.

## What works now

- Full-screen interactive traditional dark-green blackboard with finger/mouse/stylus chalk, eraser, text tool, colour picker, undo/redo, named boards, local autosave, export to PNG and touchscreen resizing.
- Six **rapid** bell clicks/taps within three seconds open the application library. The gesture is **not** authentication or access control.
- Seven categories: Attendance, Year 2, Year 5, Year 6, Educational Games, Educational Tools, Homework. Click tiles to list the current known resources.
- Catalog is declared in `catalog.js` and separates verified webapp URLs from GitHub repository source links. No unverified GitHub Pages site is presented as a verified webapp. Add/verify publication URLs as each project comes online.
- Homework creator has Year 1–6, multi-class Cemerlang/Gemilang/Terbilang, subject, instructions, due date, optional file selection (preview only), and a **default OFF** Auto Reminder toggle. Local drafts persist in browser storage. Preview ClassBell notification without sending anything.
- PWA manifest and caching for offline blackboard/library shell when served via HTTPS.

## IMPORTANT: Not yet live

This prototype **does not send ClassBell push notifications**, publish homework to a shared database, or expose school pupil records. Homework drafts are local only and never transmitted. Selected attachments are **not stored or uploaded** in this version. Completion/photo proof and teacher verification views are planned but not yet wired to the ClassBell backend.

### ClassBell integration (next stage)

The connected Supabase project currently exposes `cr_posts` (class updates), `cr_memberships` (class subscriptions), `cr_children` (account ↔ pupil links), `cr_jobs` (scheduled notifications), and `cr_subscriptions` (push subscriptions). **Do not** write directly from this static PWA using private credentials. Use a teacher-authenticated backend endpoint that enforces class permissions server-side and routes to parents of linked pupils. No database schema or live user data was modified in preparing this prototype.

Before a production launch implement:

1. Teacher authentication and class-scoped authorization; a six-click bell is only an interface shortcut. Never use pupil/tester codes as staff authorization.
2. Assignment model with `assignment_id`, author, targeted class(es), subject, title, instructions, due date, attachments (private storage), `reminders_enabled` (false by default), reminder schedule, and explicit publish state. A published assignment should reach relevant parent accounts only.
3. Parent–child linkage and individual pupil homework statuses. Define states `pending`, `parent_completed`, `teacher_verified`, overdue computed from due date; optional proof images visible to authorized teacher and own parent. Photos are not required to complete.
4. A server-side scheduled reminder job, *created only if a teacher opts in*, targeting only parents of pupils who remain incomplete at send time; deduplicate per parent/child/assignment so siblings and retries do not create duplicates. When teacher disables reminders, cancel outstanding jobs.
5. Push messaging using ClassBell's existing authorized subscription pipeline and a secure server process. Test with pilot users before sending to all parents. Retain audit records of send/cancel/verification.
6. School privacy policies, private attachments storage with signed short-lived access, upload limits, and class-appropriate retention.

## Publishing

Source code has been published in the `mohammaddhameri-blip/smadbod` repository on the `main` branch. To host the website, open **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/(root)**, and save. Once GitHub Pages finishes deploying, use `https://mohammaddhameri-blip.github.io/smadbod/`.

**Publishing source code alone does not enable GitHub Pages.** Confirm that Pages is enabled before using the site on a smartboard. Existing apps remain in separate repositories.

## Project files

- `index.html`, `style.css`, `app.js`: front end and blackboard/Homework functionality.
- `catalog.js`: tile list + links.
- `manifest.webmanifest`, `sw.js`, `assets/icon.svg`: PWA shell.