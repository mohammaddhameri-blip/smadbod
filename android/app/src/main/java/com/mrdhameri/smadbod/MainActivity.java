package com.mrdhameri.smadbod;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebView.WebViewTransport;
import android.os.Message;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public final class MainActivity extends Activity {
    private static final String HOME="https://mohammaddhameri-blip.github.io/smadbod/";
    private static final String ATTENDANCE="https://mohammaddhameri-blip.github.io/skorskal-omr/?attendance=1";
    private static final String MOEIS="https://moeispel.moe.gov.my/sahsiah/kehadiran/tabguru";
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final Runnable foregroundPoll=new Runnable(){@Override public void run(){
        fetch(false,null);
        handler.postDelayed(this,60_000);
    }};
    private WebView web;
    private boolean active=false;

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(16,44,35));
        getWindow().setNavigationBarColor(Color.rgb(16,44,35));
        LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);
        page.setBackgroundColor(Color.rgb(17,51,39));
        LinearLayout bar=new LinearLayout(this);bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setPadding(7,6,7,6);bar.setBackgroundColor(Color.rgb(21,55,41));
        Button inbox=button("🔔 Inbox");inbox.setOnClickListener(v->fetch(true,null));
        Button pairing=button("Pair phone");pairing.setOnClickListener(v->showPair());
        Button refresh=button("↻");refresh.setContentDescription("Check for attendance");refresh.setOnClickListener(v->fetch(true,null));
        bar.addView(inbox,new LinearLayout.LayoutParams(0,48,1.15f));
        bar.addView(pairing,new LinearLayout.LayoutParams(0,48,1.4f));
        bar.addView(refresh,new LinearLayout.LayoutParams(0,48,.55f));
        page.addView(bar);
        web=new WebView(this);web.setBackgroundColor(Color.rgb(22,56,44));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setSupportMultipleWindows(true);
        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView w,WebResourceRequest r){return route(r.getUrl());}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onCreateWindow(WebView view,boolean isDialog,boolean isUserGesture,Message msg){
                if(!isUserGesture)return false;
                WebView child=new WebView(MainActivity.this);
                child.setWebViewClient(new WebViewClient(){
                    @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){
                        openExternal(r.getUrl());v.destroy();return true;
                    }
                    @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap favicon){
                        openExternal(Uri.parse(url));v.stopLoading();v.destroy();
                    }
                });
                WebViewTransport t=(WebViewTransport)msg.obj;t.setWebView(child);msg.sendToTarget();return true;
            }
        });
        page.addView(web,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1f));
        setContentView(page);
        web.loadUrl(HOME);
        setupPeriodic();
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},221);
    }
    private Button button(String title){
        Button b=new Button(this);b.setText(title);b.setTextSize(12);
        b.setAllCaps(false);b.setTextColor(Color.WHITE);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(28,76,56)));
        return b;
    }
    private boolean route(Uri uri){
        if(uri!=null&&"mohammaddhameri-blip.github.io".equalsIgnoreCase(uri.getHost())
            &&uri.getPath()!=null&&uri.getPath().startsWith("/smadbod/"))return false;
        openExternal(uri);return true;
    }
    private void openExternal(Uri url){
        if(url==null||!"https".equalsIgnoreCase(url.getScheme()))return;
        try{startActivity(new Intent(Intent.ACTION_VIEW,url));}
        catch(Exception e){Toast.makeText(this,"No browser available.",Toast.LENGTH_LONG).show();}
    }
    private void setupPeriodic(){
        Constraints constraints=new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest period=new PeriodicWorkRequest.Builder(PollWorker.class,15,TimeUnit.MINUTES)
            .setConstraints(constraints).build();
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "smadbod-attendance-poll",ExistingPeriodicWorkPolicy.KEEP,period);
        WorkManager.getInstance(this).enqueue(new OneTimeWorkRequest.Builder(PollWorker.class)
            .setConstraints(constraints).build());
    }
    private void showPair(){
        io.execute(()->{
            try{
                String code=BridgeClient.ensurePair(this);
                runOnUiThread(()->displayPair(code));
            }catch(Exception e){runOnUiThread(()->message("Device pairing unavailable. Check Android security settings."));}
        });
    }
    private void displayPair(String code){
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(22,12,22,4);
        TextView help=new TextView(this);help.setText(
            "Paste this private pairing code into Skorskal → Pupils → SMADBOD Attendance Bridge. "+
            "Use a separate code for your PC, one per line. Do not share your code publicly.");
        help.setTextSize(14);layout.addView(help);
        TextView secret=new TextView(this);secret.setText(code);secret.setTextSize(13);secret.setTextIsSelectable(true);
        secret.setPadding(4,18,4,18);layout.addView(secret);
        new AlertDialog.Builder(this).setTitle("Master phone pairing")
            .setView(layout)
            .setPositiveButton("Copy pairing code",(d,w)->{
                ClipboardManager cm=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                if(cm!=null)cm.setPrimaryClip(ClipData.newPlainText("SMADBOD private pairing",code));
                message("Copied. Clear the clipboard after pairing.");
            })
            .setNeutralButton("Generate new code",(d,w)->
                new AlertDialog.Builder(this).setMessage(
                    "Replace this phone's private pairing? The old code will stop receiving new attendance.")
                    .setPositiveButton("Replace",(a,b)->io.execute(()->{
                        try{String result=BridgeClient.newPair(this);runOnUiThread(()->displayPair(result));}
                        catch(Exception ignored){runOnUiThread(()->message("Unable to replace pairing."));}
                    })).setNegativeButton("Cancel",null).show())
            .setNegativeButton("Close",null).show();
    }
    private void fetch(boolean showInbox,String selectedId){
        if(!active&&!showInbox)return;
        io.execute(()->{
            try{
                JSONArray pending=BridgeClient.fetch(this);
                BridgeClient.notifyNew(this,pending);
                if(showInbox)runOnUiThread(()->showInbox(pending,selectedId));
            }catch(Exception e){
                Log.w("SMADBOD","Unable to fetch Attendance Bridge");
                if(showInbox)runOnUiThread(()->message("Cannot check attendance. Check your pairing, connection and try again."));
            }
        });
    }
    private void showInbox(JSONArray records,String selectedId){
        if(records.length()==0){new AlertDialog.Builder(this).setTitle("Attendance inbox")
            .setMessage("No attendance waiting for review. Background checks are approximately every 15 minutes or later when Android saves battery.")
            .setPositiveButton("OK",null).show();return;}
        if(selectedId!=null){
            for(int i=0;i<records.length();i++)if(selectedId.equals(records.optJSONObject(i).optString("_packetId"))){
                showDetails(records.optJSONObject(i));return;
            }
        }
        String[] labels=new String[records.length()];
        for(int i=0;i<records.length();i++){
            JSONObject item=records.optJSONObject(i),p= item==null?new JSONObject():item;
            JSONArray pupils=p.optJSONArray("pupils");int absent=0;
            if(pupils!=null)for(int j=0;j<pupils.length();j++)if(!pupils.optJSONObject(j).optBoolean("present",true))absent++;
            labels[i]=p.optString("date")+" · Year "+p.optString("year")+" "+p.optString("className")+" · "+absent+" absent";
        }
        new AlertDialog.Builder(this).setTitle("Attendance ready for review")
            .setItems(labels,(d,index)->showDetails(records.optJSONObject(index)))
            .setNegativeButton("Close",null).show();
    }
    private void showDetails(JSONObject item){
        if(item==null)return;
        StringBuilder summary=new StringBuilder();
        JSONArray pupils=item.optJSONArray("pupils");int absent=0;
        if(pupils!=null)for(int j=0;j<pupils.length();j++){
            JSONObject pupil=pupils.optJSONObject(j);
            if(pupil==null||pupil.optBoolean("present",true))continue;
            absent++;
            summary.append("• ").append(pupil.optString("examNo")).append("  ")
                .append(pupil.optString("name")).append("\n");
            if(!pupil.optString("reason").isEmpty())
                summary.append("   Reason: ").append(pupil.optString("reason")).append("\n");
        }
        if(absent==0)summary.append("All pupils marked present.\n");
        summary.append("\nThis is your SMADBOD record only. Nothing has been submitted to MOEIS. You must verify the official class, date and pupils, then save/approve there.");
        ScrollView scroll=new ScrollView(this);TextView view=new TextView(this);
        view.setText(summary.toString());view.setTextSize(15);
        view.setPadding(28,12,28,16);scroll.addView(view);
        String packetId=item.optString("_packetId");
        new AlertDialog.Builder(this)
            .setTitle(item.optString("date")+" · Year "+item.optString("year")+" "+item.optString("className"))
            .setView(scroll)
            .setPositiveButton("Host review",(d,w)->{
                new AlertDialog.Builder(this)
                    .setTitle("Approve handoff")
                    .setMessage("Approve this guest attendance handoff for KPM review? The official system is not edited automatically.")
                    .setPositiveButton("Approve and open",(a,b)->{
                        BridgeClient.preferences(this).edit().putLong("review_"+packetId,System.currentTimeMillis()).apply();
                        openExternal(Uri.parse(MOEIS));
                    })
                    .setNegativeButton("Not yet",null).show();
            })
            .setNeutralButton("Remove from inbox",(d,w)->new AlertDialog.Builder(this)
                .setMessage("Remove this notification only? This does NOT confirm KPM attendance.")
                .setPositiveButton("Remove",(d2,w2)->io.execute(()->{
                    try{BridgeClient.discard(this,packetId);runOnUiThread(()->message("Removed from private inbox."));}
                    catch(Exception e){runOnUiThread(()->message("Couldn't remove it; retry later."));}
                })).setNegativeButton("Cancel",null).show())
            .setNegativeButton("Close",null).show();
    }
    private void message(String text){Toast.makeText(this,text,Toast.LENGTH_LONG).show();}
    @Override protected void onResume(){
        super.onResume();active=true;
        handler.removeCallbacks(foregroundPoll);handler.post(foregroundPoll);
        if(getIntent()!=null&&"com.mrdhameri.smadbod.REVIEW".equals(getIntent().getAction())){
            String id=getIntent().getStringExtra("packet_id");
            getIntent().setAction(null);fetch(true,id);
        }
    }
    @Override protected void onPause(){active=false;handler.removeCallbacks(foregroundPoll);super.onPause();}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);
        if("com.mrdhameri.smadbod.REVIEW".equals(intent.getAction())){
            String id=intent.getStringExtra("packet_id");
            intent.setAction(null);fetch(true,id);
        }
    }
    @Override public void onBackPressed(){
        if(web!=null&&web.canGoBack()){web.goBack();return;}super.onBackPressed();
    }
    @Override protected void onDestroy(){handler.removeCallbacks(foregroundPoll);web.destroy();io.shutdownNow();super.onDestroy();}
}
