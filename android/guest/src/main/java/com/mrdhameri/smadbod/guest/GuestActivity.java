package com.mrdhameri.smadbod.guest;

import android.app.Activity;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.WebChromeClient;
import android.webkit.PermissionRequest;
import android.content.Intent;
import android.graphics.Color;
import android.content.res.ColorStateList;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.widget.Toast;

public final class GuestActivity extends Activity {
    private WebView web;
    private PermissionRequest pendingCameraRequest;
    private static final int CAMERA_PERMISSION=472;
    private UpdateManager updates;
    private static final String ROOT = "https://mohammaddhameri-blip.github.io/smadbod/";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(16,45,36));
        getWindow().setNavigationBarColor(Color.rgb(16,45,36));
        LinearLayout page=new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setBackgroundColor(Color.rgb(19,53,43));
        LinearLayout bar=new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setPadding(12,2,10,2);
        bar.setBackgroundColor(Color.rgb(21,55,41));
        TextView title=new TextView(this);
        title.setText("SMADBOD Guest");
        title.setTextSize(14);
        title.setTextColor(Color.WHITE);
        title.setGravity(android.view.Gravity.CENTER_VERTICAL);
        bar.addView(title,new LinearLayout.LayoutParams(0,44,1f));
        Button update=new Button(this);
        update.setText("⬇ Update");
        update.setTextSize(12);
        update.setAllCaps(false);
        update.setTextColor(Color.WHITE);
        update.setBackgroundTintList(ColorStateList.valueOf(Color.rgb(28,76,56)));
        bar.addView(update,new LinearLayout.LayoutParams(108,44));
        page.addView(bar);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(19,53,43));
        page.addView(web,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1f));
        setContentView(page);
        updates=new UpdateManager(this);
        update.setOnClickListener(v->updates.checkForUpdates(true));
        updates.checkForUpdates(false);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onPermissionRequest(PermissionRequest request){
                runOnUiThread(()->{
                    Uri origin=request.getOrigin();
                    if(origin==null||!"https".equalsIgnoreCase(origin.getScheme())
                        ||!"mohammaddhameri-blip.github.io".equalsIgnoreCase(origin.getHost())){
                        request.deny();return;
                    }
                    boolean camera=false;
                    for(String resource:request.getResources())
                        if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource))camera=true;
                    if(!camera){request.deny();return;}
                    if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    else{
                        if(pendingCameraRequest!=null)pendingCameraRequest.deny();
                        pendingCameraRequest=request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA},CAMERA_PERMISSION);
                    }
                });
            }
        });
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
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){
        super.onRequestPermissionsResult(requestCode,permissions,results);
        if(requestCode!=CAMERA_PERMISSION||pendingCameraRequest==null)return;
        PermissionRequest request=pendingCameraRequest;pendingCameraRequest=null;
        if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        else request.deny();
    }
    @Override protected void onResume() {
        super.onResume();
        if(updates!=null)updates.onResume();
    }
    @Override public void onBackPressed() {
        if(web != null && web.canGoBack()) { web.goBack(); return; }
        super.onBackPressed();
    }
    @Override public void onDestroy() {
        if(pendingCameraRequest!=null){pendingCameraRequest.deny();pendingCameraRequest=null;}
        if(web != null) web.destroy();
        super.onDestroy();
    }
}
