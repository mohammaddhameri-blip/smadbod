package com.mrdhameri.smadbod.guest;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.widget.Toast;

public final class GuestActivity extends Activity {
    private WebView web;
    private static final String ROOT = "https://mohammaddhameri-blip.github.io/smadbod/";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(16,45,36));
        getWindow().setNavigationBarColor(Color.rgb(16,45,36));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(19,53,43));
        setContentView(web);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if(uri.toString().startsWith(ROOT)) return false;
                if("https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch(Exception e) { Toast.makeText(GuestActivity.this,"Browser unavailable",Toast.LENGTH_SHORT).show(); }
                }
                return true;
            }
        });
        web.loadUrl(ROOT);
    }
    @Override public void onBackPressed() {
        if(web != null && web.canGoBack()) { web.goBack(); return; }
        super.onBackPressed();
    }
    @Override public void onDestroy() {
        if(web != null) web.destroy();
        super.onDestroy();
    }
}
