package com.mrdhameri.smadbod.guest;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Checks publisher-controlled GitHub Releases, verifies the SHA-256 checksum,
 * then hands the APK to Android's installer. Never silently installs an APK.
 * Uses the same pinned master-android-latest release mechanism as STEM Battleship.
 */
final class UpdateManager {
    private static final String API =
        "https://api.github.com/repos/mohammaddhameri-blip/smadbod/releases/tags/master-android-latest";
    private static final String ASSET_PREFIX =
        "https://github.com/mohammaddhameri-blip/smadbod/releases/download/";
    private static final long MAX_APK_BYTES = 150L * 1024 * 1024;
    private final Activity activity;
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private File pendingApk;
    private boolean waitingForInstallPermission;

    UpdateManager(Activity activity) {
        this.activity = activity;
    }

    void checkForUpdates(boolean manual) {
        if (!busy.compareAndSet(false, true)) {
            if (manual) toast("SMADBOD Guest is already checking or downloading an update.");
            return;
        }
        new Thread(() -> {
            try {
                JSONObject release = new JSONObject(new String(downloadBytes(API, 512 * 1024), StandardCharsets.UTF_8));
                if (release.optBoolean("draft") || !"master-android-latest".equals(release.optString("tag_name")))
                    throw new Exception("Official update release is unavailable.");
                String latest = note(release.optString("body"), "GUEST_VERSION_NAME");
                String codeText = note(release.optString("body"), "GUEST_VERSION_CODE");
                if (!codeText.matches("[0-9]{1,9}"))
                    throw new Exception("The latest release has no valid version metadata yet.");
                long publishedCode = Long.parseLong(codeText);
                long currentCode = installedVersionCode();
                String current = installedVersion();
                String publisherSigner = note(release.optString("body"), "MASTER_SIGNER_SHA256");
                if (!publisherSigner.matches("[A-Fa-f0-9]{64}") ||
                        !publisherSigner.equalsIgnoreCase(installedSigner()))
                    throw new Exception("The update signer does not match this installed app.");
                if (publishedCode <= currentCode) {
                    if (manual) ui(() -> new AlertDialog.Builder(activity)
                        .setTitle("SMADBOD Guest is up to date")
                        .setMessage("Installed version: " + current + "\nNo newer APK is available.")
                        .setPositiveButton("OK", null).show());
                    return;
                }
                JSONArray assets = release.optJSONArray("assets");
                String apkName = "SMADBOD-Guest.apk";
                String checksumName = apkName + ".sha256";
                String apkUrl = null, checksumUrl = null;
                if (assets != null) for (int i = 0; i < assets.length(); i++) {
                    JSONObject asset = assets.getJSONObject(i);
                    String name = asset.optString("name");
                    String url = asset.optString("browser_download_url");
                    if (name.equals(apkName)) apkUrl = url;
                    if (name.equals(checksumName)) checksumUrl = url;
                }
                if (apkUrl == null || checksumUrl == null) {
                    throw new Exception("This release has no signed APK and checksum yet.");
                }
                if (!isPublisherAsset(apkUrl, "master-android-latest") || !isPublisherAsset(checksumUrl, "master-android-latest"))
                    throw new Exception("Update does not originate from the SMADBOD Guest publisher's release.");
                String chosenApk = apkUrl, chosenSum = checksumUrl;
                ui(() -> new AlertDialog.Builder(activity)
                    .setTitle("SMADBOD Guest update available")
                    .setMessage("Installed: " + current + "\nAvailable: " + latest
                        + "\n\nDownload the verified update from GitHub? "
                        + "Android will ask for approval before installation. Saved marking records stay on this device.")
                    .setNegativeButton("Later", null)
                    .setPositiveButton("Download update", (d, which) -> downloadAndInstall(chosenApk, chosenSum, apkName, publishedCode, publisherSigner))
                    .show());
            } catch (Exception error) {
                if (manual) ui(() -> new AlertDialog.Builder(activity)
                    .setTitle("Update check unavailable")
                    .setMessage(error.getMessage() + "\n\nConnect to the internet and try again.")
                    .setPositiveButton("OK", null).show());
            } finally {
                busy.set(false);
            }
        }, "smadbod-guest-update-check").start();
    }

    private void downloadAndInstall(String apkUrl, String checksumUrl, String fileName, long advertisedVersion, String signerHash) {
        if (!busy.compareAndSet(false, true)) return;
        toast("Downloading SMADBOD Guest update from GitHub...");
        new Thread(() -> {
            File output = null;
            try {
                String expected = new String(downloadBytes(checksumUrl, 1024), StandardCharsets.UTF_8)
                    .trim().split("\\s+")[0].toLowerCase(Locale.ROOT);
                if (!expected.matches("[a-f0-9]{64}")) throw new Exception("Invalid update checksum.");
                File folder = new File(activity.getCacheDir(), "updates");
                if (!folder.exists() && !folder.mkdirs()) throw new Exception("Cannot prepare download directory.");
                output = new File(folder, "smadbod-guest-update.apk");
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                HttpURLConnection connection = connect(apkUrl);
                try {
                    if (connection.getResponseCode() != 200) throw new Exception("GitHub APK download failed (HTTP " + connection.getResponseCode() + ").");
                    int contentLength = connection.getContentLength();
                    if (contentLength > MAX_APK_BYTES) throw new Exception("Update file too large.");
                    long total = 0;
                    try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(output)) {
                        byte[] buffer = new byte[32768];
                        int read;
                        while ((read = in.read(buffer)) != -1) {
                            total += read;
                            if (total > MAX_APK_BYTES) throw new Exception("Update exceeds size limit.");
                            digest.update(buffer, 0, read);
                            out.write(buffer, 0, read);
                        }
                    }
                    if (total < 100000) throw new Exception("Incomplete APK download.");
                } finally { connection.disconnect(); }
                StringBuilder actual = new StringBuilder();
                for (byte b : digest.digest()) actual.append(String.format(Locale.ROOT, "%02x", b & 0xff));
                if (!expected.equals(actual.toString())) throw new Exception("APK checksum mismatch. Update cancelled.");
                verifyDownloadedPackage(output, advertisedVersion, signerHash);
                File verified = output;
                ui(() -> {
                    toast("APK downloaded and verified.");
                    promptInstall(verified);
                });
            } catch (Exception error) {
                if (output != null) output.delete();
                ui(() -> new AlertDialog.Builder(activity)
                    .setTitle("Update download failed")
                    .setMessage(error.getMessage())
                    .setPositiveButton("OK", null).show());
            } finally {
                busy.set(false);
            }
        }, "smadbod-guest-update-download").start();
    }

    private void promptInstall(File apk) {
        pendingApk = apk;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !activity.getPackageManager().canRequestPackageInstalls()) {
            waitingForInstallPermission = true;
            new AlertDialog.Builder(activity)
                .setTitle("Allow APK installation")
                .setMessage("Android needs your approval to install updates from SMADBOD Guest. "
                    + "Enable 'Allow from this source', then return to SMADBOD Guest.")
                .setNegativeButton("Not now", (d, which) -> waitingForInstallPermission = false)
                .setPositiveButton("Open Android settings", (d, which) -> {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
                    activity.startActivity(intent);
                }).show();
            return;
        }
        waitingForInstallPermission = false;
        try {
            Uri uri = FileProvider.getUriForFile(activity,
                activity.getPackageName() + ".fileprovider", apk);
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(uri, "application/vnd.android.package-archive");
            install.setClipData(ClipData.newRawUri("SMADBOD Guest APK", uri));
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(install);
        } catch (Exception error) {
            new AlertDialog.Builder(activity).setTitle("Cannot open Android installer")
                .setMessage(error.getMessage()).setPositiveButton("OK", null).show();
        }
    }

    void onResume() {
        if (waitingForInstallPermission && pendingApk != null &&
            (Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || activity.getPackageManager().canRequestPackageInstalls())) {
            promptInstall(pendingApk);
        }
    }

    private static boolean isPublisherAsset(String url, String tag) {
        return url.startsWith(ASSET_PREFIX + tag + "/") && url.startsWith("https://");
    }

    private String installedVersion() throws Exception {
        return activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionName;
    }

    private long installedVersionCode() throws Exception {
        android.content.pm.PackageInfo info =
            activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }

    private static String note(String body, String key) {
        if (body == null) return "";
        for (String line : body.split("\\r?\\n")) {
            if (line.startsWith(key + "=")) return line.substring(key.length() + 1).trim();
        }
        return "";
    }

    // Verify both application identity and signing certificate before invoking Android's installer.
    // Android still independently verifies the signature and requests the user's confirmation.
    private String installedSigner() throws Exception {
        int flags = Build.VERSION.SDK_INT >= 28
                ? android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES
                : android.content.pm.PackageManager.GET_SIGNATURES;
        return signatureFingerprint(activity.getPackageManager().getPackageInfo(activity.getPackageName(), flags));
    }

    private static String signatureFingerprint(android.content.pm.PackageInfo info) throws Exception {
        android.content.pm.Signature[] signatures;
        if (Build.VERSION.SDK_INT >= 28 && info.signingInfo != null)
            signatures = info.signingInfo.getApkContentsSigners();
        else
            signatures = info.signatures;
        if (signatures == null || signatures.length != 1)
            throw new Exception("APK signer unavailable or ambiguous.");
        byte[] bytes = MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray());
        StringBuilder hex = new StringBuilder();
        for (byte b : bytes) hex.append(String.format(Locale.ROOT, "%02X", b & 0xff));
        return hex.toString();
    }

    private void verifyDownloadedPackage(File apk, long advertisedCode, String expectedSigner) throws Exception {
        android.content.pm.PackageManager manager = activity.getPackageManager();
        int flags = Build.VERSION.SDK_INT >= 28
                ? android.content.pm.PackageManager.GET_SIGNING_CERTIFICATES
                : android.content.pm.PackageManager.GET_SIGNATURES;
        android.content.pm.PackageInfo archive = manager.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        if (archive == null || !activity.getPackageName().equals(archive.packageName))
            throw new Exception("Downloaded APK belongs to a different app.");
        long code = Build.VERSION.SDK_INT >= 28 ? archive.getLongVersionCode() : archive.versionCode;
        if (code != advertisedCode || code <= installedVersionCode())
            throw new Exception("Downloaded APK version does not match the release.");
        if (!expectedSigner.equalsIgnoreCase(signatureFingerprint(archive)) ||
                !expectedSigner.equalsIgnoreCase(installedSigner()))
            throw new Exception("Downloaded APK signing certificate mismatch.");
    }

    private static HttpURLConnection connect(String url) throws Exception {
        if (!url.startsWith("https://")) throw new Exception("Insecure update URL blocked.");
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setRequestProperty("User-Agent", "SMADBOD Guest-Android-Updater");
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setInstanceFollowRedirects(true);
        return connection;
    }

    private static byte[] downloadBytes(String url, int maxBytes) throws Exception {
        HttpURLConnection connection = connect(url);
        try {
            if (connection.getResponseCode() != 200) throw new Exception("GitHub responded HTTP " + connection.getResponseCode() + ".");
            try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    if (out.size() + read > maxBytes) throw new Exception("Release metadata is too large.");
                    out.write(buffer, 0, read);
                }
                return out.toByteArray();
            }
        } finally { connection.disconnect(); }
    }

    private void toast(String message) { ui(() -> Toast.makeText(activity, message, Toast.LENGTH_LONG).show()); }
    private void ui(Runnable action) { activity.runOnUiThread(action); }
}
