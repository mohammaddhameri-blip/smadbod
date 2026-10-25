# SMADBOD Guest and Master APKs

Two Android applications have distinct package IDs and can coexist on the same device:

- **SMADBOD Guest** (`com.mrdhameri.smadbod.guest`): for the smartboard or another classroom device. Displays the SMADBOD blackboard and the Guest Attendance tile. The pupil list is encrypted in the public repository and can only be decrypted on the Guest device with your private SMADBOD roster phrase. Skorskal is exclusively for exam marking. All pupils begin marked present. Untick absentees, optionally enter reasons, then send the record to the host's pairing code.
- **SMADBOD Master** (`com.mrdhameri.smadbod`): for your personal work phone. Creates its own random pairing code (256-bit channel token plus a separate 256-bit AES encryption key) stored encrypted using Android Keystore. Checks for incoming encrypted attendance, shows native notifications and a private inbox, and requires **Host review → Approve and open** before navigating to the official KPM site.

## First-time setup

1. Install **SMADBOD Master** on your personal work phone. Allow Android notifications.
2. In Master, tap **Pair device** to show a private QR, then choose Scan, Copy invite or Share invite.
3. Install **SMADBOD Guest** on the classroom smartboard/device, or open [Guest in a browser](https://mohammaddhameri-blip.github.io/smadbod/attendance/index.html).
4. Open SMADBOD's app library (six quick bell taps), then **Attendance**.
5. Unlock the encrypted roster using the private SMADBOD roster phrase. This phrase stays on the Guest device.
6. In Guest tap **Scan Master's QR**, **Paste from clipboard**, or open the private invite link on that Guest device. On a device without camera/QR support, expand **Enter pairing code manually**. You can choose to remember pairing on a trusted classroom device; otherwise the details are session-only. Manual entry still accepts multiple receiver codes.
7. Choose Year, Class and Date. All pupils are present initially; untick absentees and enter optional reasons.
8. Tap **Send to Master for approval**. The Guest encrypts a separate packet for each paired receiver and transmits it.
9. On your work phone, open the Master notification/inbox. Inspect absentees, select **Host review**, and explicitly **Approve and open**.
10. Master opens the official [MOEIS attendance page](https://moeispel.moe.gov.my/sahsiah/kehadiran/tabguru) in your usual browser. Sign in normally, verify and complete the official attendance in MOEIS.

**This beta does not automatically populate or submit the MOEIS form.** A Host approval initiates authorised review, **not** an official attendance update. Achieving scroll-free official submission requires inspecting the authenticated interface and establishing that KPM permits browser form automation.

## Privacy and background notifications

- No idMe password, MOEIS session or pupil roster passphrase is placed in GitHub or on the encrypted queue.
- The official encrypted roster is bundled as a ciphertext-only file in the Guest webapp; names are decrypted **only in the Guest session**.
- The pairing secret is never in repository code. It is encrypted in Master, and Guest remembers it only in the current browser session unless you explicitly opt to remember on a personally controlled classroom device.
- Android WorkManager polls approximately every **15 minutes or later** when Master is backgrounded, and about every minute while Master is open. Push notifications close to real time require separately configured Firebase Cloud Messaging.
- Encrypted packets expire after 72 hours. Dismissing the message deletes its ciphertext from the queue; this is **not** an official KPM approval.
- Keep both APKs private and follow your school’s policy on processing pupil records.

## Releases and updates

The GitHub workflow `.github/workflows/build-master-android.yml` builds and publisher-signs both APKs. You can download them from the [SMADBOD APK release](https://github.com/mohammaddhameri-blip/smadbod/releases/tag/master-android-latest).

Master and Guest package IDs differ so they cannot be mistaken for one another. Future builds use the same publisher signing certificate when that key is retained. Download any new version from the verified GitHub release; Android requires approval to install it.
