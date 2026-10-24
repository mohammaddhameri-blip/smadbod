# SMADBOD — Guest & Master Attendance (v0.4)

## Two separate SMADBOD device roles

**SMADBOD Guest** (classroom smartboard, browser or Guest APK) collects the daily pupil attendance from the encrypted 2026 roster, with all pupils **present by default**. The teacher unticks absentees, optionally enters reasons, and presses **Send to Master**. Only ciphertext is transmitted, separately encrypted to each paired receiver. Staff access to the roster requires the private roster passphrase, which is never transmitted or included in the repository.

**SMADBOD Master** (personal work-phone APK) receives the attendance in its private inbox and notifies the host. The host reviews the date, class and absences, then must separately tap **Host review → Approve and open**. Only after that action does the Master open the official MOEIS page in the phone's browser.

**Current limitation:** The official KPM site is **NOT automatically filled or submitted**. Host approval currently opens the site for authorised manual entry and final confirmation. Automating form entry requires verification of the logged-in MOEIS interface and KPM authorisation. **Host approval is not proof of official KPM submission.**

Install the [Guest APK](https://github.com/mohammaddhameri-blip/smadbod/releases/tag/master-android-latest) on the classroom device or use [SMADBOD Guest webapp](https://mohammaddhameri-blip.github.io/smadbod/attendance/index.html). Install the [Master APK](https://github.com/mohammaddhameri-blip/smadbod/releases/tag/master-android-latest) on the work phone. Separate package names permit both to coexist on Android. See [Android setup](android/README.md).

**Notifications:** Android WorkManager checks roughly every 15 minutes or later when backgrounded; when the Master is open it checks once per minute. True immediate background push needs FCM. Never share pairing codes, passwords or actual pupil records in the public repo.

## Desktop PC extension (optional)

The original Chrome/Edge [Attendance Bridge](bridge-extension/README.md) remains available as a second paired **receiver**. It does not send attendance or replace the Master phone.

A standalone, responsive, installable blackboard-first teaching hub designed for the school smartboard, desktop, and mobile browsers.

## Test locally

From this folder:

```sh
python -m http.server 8080
```

Visit `http://localhost:8080`. On a phone/tablet within the same trusted network you can visit your PC's LAN IP and port if the firewall allows it; offline installation and service workers require a secure context (HTTPS) in production.

## What works now

- Full-screen interactive traditional dark-green blackboard with finger/mouse/stylus chalk, eraser, text tool, colour picker, undo/redo, named boards, local autosave, export to PNG and touchscreen resizing.
- **Compact blackboard controls (v0.2):** Pencil button opens the left drawing tools; the panel automatically closes 30 seconds after its most recent interaction. Includes pen, eraser, text, chalk colours, brush size, undo, redo and clear. Undo/redo, red X clear, ••• boards, and 💾 save are also accessible through the bottom icon-only toolbar.
- **Subject is the board name:** Click the top-left name to edit, then press Enter or click outside to save (Escape cancels). New boards are named Subject, Subject 2, Subject 3, etc.; duplicate names receive numeric suffixes. Previously saved custom names and drawings are retained.
- **Always-visible live clock and date:** The analog clock occupies the top centre and the day/date/year the top-right. Both use the device's local clock and update automatically. The date is shortened on narrow phone screens without being hidden.
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