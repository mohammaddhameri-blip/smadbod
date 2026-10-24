# SMADBOD Attendance Bridge (personal beta)

This is a **private teacher-operated** Chrome/Edge extension. It receives sealed attendance records from Skorskal, notifies the work PC, and opens the official MOEIS attendance page with a read-only summary overlay.

**Current limitation:** It does not log in to idMe, select/modify MOEIS controls, submit attendance, or confirm official status. Until KPM's actual authenticated attendance form and permission for automation are verified, the teacher must enter/confirm the official record manually. A handoff notification is not proof of official submission.

## Install on your Windows work PC

1. Download the SMADBOD source ZIP from https://github.com/mohammaddhameri-blip/smadbod/archive/refs/heads/main.zip and **Extract All**.
2. Chrome: open `chrome://extensions` — or Edge: open `edge://extensions`.
3. Enable **Developer mode**, click **Load unpacked**, and select the extracted **bridge-extension** folder (the folder containing `manifest.json`).
4. Pin **SMADBOD Attendance Bridge** to the browser toolbar.
5. Open the extension and choose **New pairing**, then **Copy code**. **Never post your code in chat, GitHub, screenshots, or to another person.** Creating a new pairing invalidates future delivery to the old code but does not delete any previously encrypted packets, which expire automatically.

## Send attendance from SMADBOD

1. In SMADBOD, open **Attendance → Open Attendance · Skorskal**.
2. Unlock the official 2026 roster using your existing private staff access phrase.
3. Select the year, class and date. Everyone is present by default; untick absent pupils. Optionally enter reasons.
4. Paste the extension's `SB1.…` pairing code into **SMADBOD Attendance Bridge**.
5. Click **🔔 Send to work PC**. This encrypts the class record in your browser and sends only ciphertext to the private queue.
6. Keep Chrome/Edge running on the work PC. The extension checks for new packets about once per minute and raises a Windows notification.
7. Click the notification: the official MOEIS attendance URL opens. Sign in to idMe **yourself** if required. The extension shows a **read-only** list of absentees, date, and class when the MOEIS page loads.
8. Enter/review the official MOEIS attendance form and confirm using MOEIS, then dismiss the bridge notification from the extension.

The bridge currently does **not** make official attendance scroll-free: it eliminates a second transfer of the attendance list but does not auto-populate unknown KPM fields. Reliable assisted filling can be added after inspecting a redacted screenshot / element map from the authorised logged-in page, and verifying KPM allows the automation.

## Security and privacy

- The extension generates two unrelated, cryptographically random 256-bit secrets. One acts as a capability token; the other is the encryption key.
- AES-256-GCM encrypts the complete attendance record on the Skorskal device before transmission. Supabase stores an opaque ciphertext and a token-derived channel hash, **not pupil names or idMe credentials in plaintext**.
- The public application code contains neither secret. Skorskal remembers the pairing **only for the current browser session**; the extension stores the code locally on the paired work PC.
- The encrypted queue expires after **72 hours**; reading is limited to the pairing token, and dismissing a packet removes its server copy. Expired records are also cleaned up during subsequent bridge requests.
- This is a **personal, limited-use beta**, not a school-wide attendance product or official KPM integration. Only use it for actual pupil records if your school permits the encrypted transfer and your work PC is suitably protected.
- Desktop notifications contain only date, class and aggregate attendance counts; identifiable pupil names are shown in the local extension/MOEIS overlay, not notification banners.
- The extension cannot bypass KPM login or anti-bot protections, and it never stores idMe usernames/passwords, cookies or session tokens.
- If you lose the pairing code, click New pairing on the work PC, then paste the new code into Skorskal. Previously sent packets can only be opened with the original code and expire after 72 hours.

## Files

- `manifest.json` — Chrome/Edge Manifest V3 permissions.
- `background.js` — polling, decryption, notifications and official-page launch.
- `popup.html` / `popup.js` — private pairing and inbox.
- `moeis-overlay.js` — intentionally read-only attendance preview inside the MOEIS browser tab.
- `icons/icon.png` — extension desktop-notification icon.

The shared private queue service is a separate Supabase Edge Function: `smadbod-attendance-bridge`. The underlying table is RLS-protected and has **no anon/authenticated direct access**. Never put a service-role key or personal pairing code in this repository.
