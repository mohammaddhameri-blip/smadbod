package com.mrdhameri.smadbod;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import java.nio.charset.StandardCharsets;

public final class NotificationUtil {
    private static final String CHANNEL="smadbod-attendance-v1";
    private NotificationUtil(){}
    public static void post(Context context,String id,String date,String year,String classroom){
        if(Build.VERSION.SDK_INT>=33&&context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
        NotificationManager nm=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(nm==null)return;
        if(Build.VERSION.SDK_INT>=26)
            nm.createNotificationChannel(new NotificationChannel(CHANNEL,"Attendance ready for review",NotificationManager.IMPORTANCE_HIGH));
        Intent intent=new Intent(context,MainActivity.class);
        intent.setAction("com.mrdhameri.smadbod.REVIEW");
        intent.putExtra("packet_id",id);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int req=(id.hashCode()&0x7fffffff);
        PendingIntent pi=PendingIntent.getActivity(context,req,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder=Build.VERSION.SDK_INT>=26
            ? new Notification.Builder(context,CHANNEL):new Notification.Builder(context);
        builder.setContentTitle("SMADBOD attendance ready")
            .setContentText("Year "+year+" "+classroom+" · "+date+" · Tap to review")
            .setSmallIcon(android.R.drawable.ic_menu_my_calendar)
            .setAutoCancel(true)
            .setContentIntent(pi);
        nm.notify(req,builder.build());
    }
}
