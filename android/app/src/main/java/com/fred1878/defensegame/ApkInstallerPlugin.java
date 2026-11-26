package com.fred1878.defensegame;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", canInstall());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is not available");
            return;
        }
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "update.apk");
        if (url == null || url.isEmpty()) {
            call.reject("Missing APK url");
            return;
        }
        if (!canInstall()) {
            call.reject("Install permission is not granted");
            return;
        }
        String safeName = new File(fileName == null ? "update.apk" : fileName).getName();
        if (!safeName.toLowerCase().endsWith(".apk")) {
            safeName = "update.apk";
        }
        final String downloadName = safeName;
        final String downloadUrl = url;

        executor.execute(() -> {
            try {
                File apk = downloadApk(downloadUrl, downloadName);
                installApk(apk);
                call.resolve();
            } catch (Exception error) {
                String message = error.getMessage();
                call.reject(message == null || message.isEmpty()
                    ? "Download or install failed"
                    : message);
            }
        });
    }

    private boolean canInstall() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return getContext().getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    private File downloadApk(String urlString, String fileName) throws Exception {
        File dir = new File(getContext().getCacheDir(), "apks");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new Exception("Could not create download folder");
        }
        File outFile = new File(dir, fileName);
        HttpURLConnection connection = null;
        try {
            connection = openFollowingRedirects(new URL(urlString));
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) {
                throw new Exception("Download failed (" + code + ")");
            }
            long total = connection.getContentLengthLong();
            try (
                InputStream input = connection.getInputStream();
                FileOutputStream output = new FileOutputStream(outFile)
            ) {
                byte[] buffer = new byte[16 * 1024];
                long received = 0;
                long lastEmit = 0;
                int read;
                while ((read = input.read(buffer)) >= 0) {
                    output.write(buffer, 0, read);
                    received += read;
                    if (received - lastEmit >= 64 * 1024
                        || (total > 0 && received >= total)) {
                        lastEmit = received;
                        JSObject progress = new JSObject();
                        progress.put("received", received);
                        progress.put("total", total > 0 ? total : 0);
                        notifyListeners("progress", progress);
                    }
                }
                output.flush();
            }
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
        return outFile;
    }

    private HttpURLConnection openFollowingRedirects(URL start) throws Exception {
        URL url = start;
        for (int attempt = 0; attempt < 8; attempt++) {
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setRequestProperty("User-Agent", "DefenseGame-Android");
            connection.setRequestProperty("Accept", "*/*");
            int code = connection.getResponseCode();
            if (code == HttpURLConnection.HTTP_MOVED_PERM
                || code == HttpURLConnection.HTTP_MOVED_TEMP
                || code == HttpURLConnection.HTTP_SEE_OTHER
                || code == 307
                || code == 308) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new Exception("Redirect without Location");
                }
                url = new URL(url, location);
                continue;
            }
            return connection;
        }
        throw new Exception("Too many redirects");
    }

    private void installApk(File apk) throws Exception {
        Activity activity = getActivity();
        if (activity == null) {
            throw new Exception("Activity is not available");
        }
        Uri uri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apk
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(intent);
    }
}
