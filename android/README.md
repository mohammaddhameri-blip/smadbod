# SMADBOD Master Android APK (personal use)

A standalone native Android shell for your existing SMADBOD classroom blackboard and educational tools, with a **private attendance receiver** for your work phone.

## Current features

- Opens the existing SMADBOD GitHub Pages interface on your work phone.
- **Pair phone** creates a random 256-bit bridge token plus a separate 256-bit AES-GCM decryption key, stored locally using Android Keystore encryption. The code is not committed to GitHub.
- **Inbox** displays encrypted attendance packets after decryption on the phone, including date, class, present/absent totals, and the names/reasons for absentees.
- Background notifications via Android WorkManager approximately every **15 minutes or later** (Android may delay them for battery/Doze). Foreground checks run every minute.
- Tapping a notification opens the master APK attendance inbox and lets you inspect the record.
- **Open MOEIS** launches the official attendance page in your normal browser. Sign in via idMe yourself if necessary. No automatic MOEIS form filling, clicking, saving, or submission occurs in this version.
- **Remove from inbox** deletes a private handoff; it NEVER claims that official attendance has been confirmed.
- No Firebase Cloud Messaging is configured; therefore near-instant closed-app alerts are **not guaranteed**. Firebase configuration and server-side device subscriptions would be needed for push delivery.

## Pairing and usage

1. On your work phone, install the signed `SMADBOD-Master.apk` from the repository's `master-android-latest` release.
2. Open the master APK and grant the Android notification permission.
3. Tap **Pair phone** and **Copy pairing code**.
4. On the device where you mark attendance, open SMADBOD → Attendance. This opens Skorskal's encrypted 2026 roster.
5. Unlock Skorskal's roster, select Year / Class / Date, and untick pupils who are absent.
6. Under **SMADBOD Attendance Bridge**, paste your master-phone pairing code. If you also have a paired work-PC Chrome/Edge extension, paste its **different** code on another line (up to three receiver codes).
7. Tap **Send to work PC** (the control now supports PC and phone recipients). The pupil list is independently AES-GCM encrypted to each recipient's key and transmitted as ciphertext.
8. While the master APK is open, it checks every minute. When it is closed, Android's background work checks approximately every 15 minutes, sometimes later. Tap the notification or open **Inbox** to review the attendance.
9. Tap **Open MOEIS**, sign in normally if needed, and enter/review/approve the attendance in the official system yourself.

## Important restrictions

- A notification **does not mean MOEIS has been updated**. The official system remains authoritative.
- The SMADBOD GitHub Pages site and source repository are publicly visible; the attendance pairing secrets and decrypted pupil details are not in the source. Only use attendance transfer if your school permits sending encrypted pupil data via the approved device/network.
- Avoid copying your pairing code into chat, screenshots, public repositories, or another person's device. Rotate it if compromised.
- AES-GCM encrypted packets expire on the server within 72 hours (expiry enforced in reads; cleanup on subsequent requests).
- A long pairing string remains in Android's clipboard until replaced; avoid leaving it there.
- Android notifications may be disabled or delayed by permission/battery policy. Enable notifications in system settings.
- The sender currently reuses Skorskal's official roster and attendance checklist; SMADBOD does not duplicate the school's pupil list.
- For true near-instant **push** delivery when the app is closed, we need an authorised Firebase project with Cloud Messaging, plus secure server-side subscription and dispatch. WorkManager cannot provide 1-minute background checks.

## Build

The `.github/workflows/build-master-android.yml` GitHub Actions workflow builds and signs a release APK. Its signer is cached and verified against the stable release fingerprint. Install future releases from the same channel to preserve local pairing.

The master Android application lives under `android/`, with unique package name `com.mrdhameri.smadbod`. Its package is distinct from the Skorskal Android APK.
