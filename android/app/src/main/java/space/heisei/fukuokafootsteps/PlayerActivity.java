package space.heisei.fukuokafootsteps;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import org.json.JSONObject;

public final class PlayerActivity extends Activity {
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + ASSET_HOST + "/player/index.html";
    private static final List<String> FILES = Arrays.asList("index.html", "main.mjs", "player.mjs",
        "offline.mjs", "cloud.mjs", "style.css", "dome-map.svg", "record-artwork.png", "title-serif.woff2");
    private WebView web;
    private NfcAdapter nfc;
    private volatile boolean foreground;
    private boolean pageReady;
    private String pendingMarker;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"https".equals(uri.getScheme()) || !ASSET_HOST.equals(uri.getHost())) return null;
                String name = uri.getLastPathSegment();
                if (name == null || !("/player/" + name).equals(uri.getPath()) || !FILES.contains(name)) {
                    return new WebResourceResponse("text/plain", "UTF-8", null);
                }
                String mime = name.endsWith(".mjs") ? "text/javascript"
                    : name.endsWith(".css") ? "text/css"
                    : name.endsWith(".svg") ? "image/svg+xml"
                    : name.endsWith(".png") ? "image/png"
                    : name.endsWith(".woff2") ? "font/woff2" : "text/html";
                try {
                    return new WebResourceResponse(mime, mime.startsWith("text/") ? "UTF-8" : null,
                        getAssets().open(name));
                } catch (IOException error) {
                    return new WebResourceResponse("text/plain", "UTF-8", null);
                }
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return true;
                String url = request.getUrl().toString();
                if (START.equals(url)) return false;
                if ("https://www.openstreetmap.org/copyright".equals(url)) {
                    startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                }
                return true;
            }

            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                pageReady = false;
            }

            @Override public void onPageFinished(WebView view, String url) {
                pageReady = START.equals(url);
                if (pageReady && pendingMarker != null) {
                    send(pendingMarker);
                    pendingMarker = null;
                }
            }
        });
        setContentView(web);
        nfc = NfcAdapter.getDefaultAdapter(this);
        web.loadUrl(START);
    }

    @Override protected void onResume() {
        super.onResume();
        foreground = true;
        immerse();
        if (nfc != null && nfc.isEnabled()) {
            nfc.enableReaderMode(this, this::readTag,
                NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B
                    | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V
                    | NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS, null);
        } else {
            Toast.makeText(this, "NFCを設定で有効にしてください", Toast.LENGTH_LONG).show();
        }
    }

    @Override protected void onPause() {
        foreground = false;
        if (nfc != null) nfc.disableReaderMode(this);
        super.onPause();
    }

    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) immerse();
    }

    @SuppressWarnings("deprecation")
    private void immerse() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controls = getWindow().getInsetsController();
            if (controls != null) {
                controls.hide(WindowInsets.Type.systemBars());
                controls.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION);
        }
    }

    private void readTag(Tag tag) {
        Ndef ndef = Ndef.get(tag);
        NdefMessage message = ndef == null ? null : ndef.getCachedNdefMessage();
        if (message == null) return;
        for (NdefRecord record : message.getRecords()) {
            if (record.getTnf() != NdefRecord.TNF_WELL_KNOWN
                || !Arrays.equals(record.getType(), NdefRecord.RTD_TEXT)) continue;
            String marker = TagText.marker(record.getPayload());
            if (marker != null) {
                runOnUiThread(() -> {
                    if (!foreground) return;
                    if (pageReady) send(marker);
                    else pendingMarker = marker;
                });
                return;
            }
        }
    }

    private void send(String marker) {
        if (!START.equals(web.getUrl())) return;
        web.evaluateJavascript("window.dispatchEvent(new CustomEvent('exhibition-nfc',{detail:"
            + JSONObject.quote(marker) + "}));", null);
    }
}
