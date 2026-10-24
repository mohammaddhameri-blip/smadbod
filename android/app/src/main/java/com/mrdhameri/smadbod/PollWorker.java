package com.mrdhameri.smadbod;

import android.content.Context;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONArray;

public final class PollWorker extends Worker {
    public PollWorker(@NonNull Context context,@NonNull WorkerParameters params){super(context,params);}
    @NonNull @Override public Result doWork(){
        try{
            JSONArray pending=BridgeClient.fetch(getApplicationContext());
            BridgeClient.notifyNew(getApplicationContext(),pending);
            return Result.success();
        }catch(Exception e){
            Log.w("SMADBOD","Attendance poll could not complete");
            return Result.retry();
        }
    }
}
