package com.mrdhameri.smadbod;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** Attendance data is encrypted by the sender. The server stores opaque ciphertext only. */
public final class BridgeClient {
    public static final String ENDPOINT =
        "https://qekcgsfeomjckctiubgm.supabase.co/functions/v1/smadbod-attendance-bridge";
    private static final String ALIAS="smadbod-master-local-key-v1";
    private static final String STORE="smadbod-master-private-v1";
    private static final SecureRandom RANDOM=new SecureRandom();
    private BridgeClient(){}

    static SharedPreferences preferences(Context context) {
        return context.getApplicationContext().getSharedPreferences(STORE,Context.MODE_PRIVATE);
    }
    private static byte[] random(int n){byte[] a=new byte[n];RANDOM.nextBytes(a);return a;}
    private static String enc(byte[] bytes){return Base64.encodeToString(bytes,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);}
    private static byte[] dec(String s){return Base64.decode(s,Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);}
    private static SecretKey localKey() throws Exception {
        KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
        if(!ks.containsAlias(ALIAS)){
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
            generator.generateKey();
        }
        return (SecretKey)ks.getKey(ALIAS,null);
    }
    private static String sealLocal(String plaintext) throws Exception{
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,localKey());
        JSONObject wrap=new JSONObject();
        wrap.put("iv",enc(cipher.getIV()));
        wrap.put("data",enc(cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8))));
        return wrap.toString();
    }
    private static String unsealLocal(String json) throws Exception{
        JSONObject o=new JSONObject(json);
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE,localKey(),new GCMParameterSpec(128,dec(o.getString("iv"))));
        return new String(cipher.doFinal(dec(o.getString("data"))),StandardCharsets.UTF_8);
    }
    public static synchronized String getPair(Context c) throws Exception {
        String encrypted=preferences(c).getString("pair",null);
        if(encrypted==null)return null;
        String value=unsealLocal(encrypted);
        if(!value.matches("SB1\\.[A-Za-z0-9_-]{43}\\.[A-Za-z0-9_-]{43}"))
            throw new SecurityException("Stored pairing is invalid; reset the pairing.");
        return value;
    }
    public static synchronized String ensurePair(Context c) throws Exception {
        String prior=getPair(c);return prior!=null?prior:newPair(c);
    }
    public static synchronized String newPair(Context c) throws Exception {
        String code="SB1."+enc(random(32))+"."+enc(random(32));
        preferences(c).edit().putString("pair",sealLocal(code)).remove("alerted").apply();
        return code;
    }
    private static JSONObject call(String pair,JSONObject body) throws Exception {
        if(pair==null)throw new IllegalStateException("Pair the master phone first.");
        String[] fields=pair.split("\\.");
        HttpURLConnection connection=(HttpURLConnection)new URL(ENDPOINT).openConnection();
        try{
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(9000);connection.setReadTimeout(11000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type","application/json");
            connection.setRequestProperty("x-bridge-token",fields[1]);
            connection.setRequestProperty("Cache-Control","no-store");
            byte[] raw=body.toString().getBytes(StandardCharsets.UTF_8);
            try(OutputStream stream=connection.getOutputStream()){stream.write(raw);}
            int status=connection.getResponseCode();
            InputStream input=status<400?connection.getInputStream():connection.getErrorStream();
            byte[] answer;
            try(InputStream in=input; ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buf=new byte[4096];int len;int total=0;
                while((len=in.read(buf))!=-1){
                    total+=len;if(total>150000)throw new IllegalStateException("Bridge response too large");
                    out.write(buf,0,len);
                }
                answer=out.toByteArray();
            }
            JSONObject parsed=new JSONObject(new String(answer,StandardCharsets.UTF_8));
            if(status>=400||!parsed.optBoolean("ok",false))
                throw new IllegalStateException("Attendance queue unavailable ("+status+").");
            return parsed;
        }finally{connection.disconnect();}
    }
    public static JSONArray fetch(Context c) throws Exception {
        String pair=getPair(c);
        if(pair==null)return new JSONArray();
        JSONObject req=new JSONObject().put("action","pull");
        JSONArray envelopes=call(pair,req).optJSONArray("packets");
        JSONArray decrypted=new JSONArray();
        if(envelopes==null)return decrypted;
        String keyField=pair.split("\\.")[2];
        SecretKeySpec aes=new SecretKeySpec(dec(keyField),"AES");
        for(int i=0;i<envelopes.length();i++){
            try{
                JSONObject env=envelopes.getJSONObject(i);
                Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE,aes,
                    new GCMParameterSpec(128,dec(env.getString("iv"))));
                String raw=new String(cipher.doFinal(dec(env.getString("ciphertext"))),StandardCharsets.UTF_8);
                JSONObject attendance=new JSONObject(raw);
                if(!"smadbod.attendance.v1".equals(attendance.optString("schema")))continue;
                if(!attendance.optString("date").matches("20\\d{2}-\\d{2}-\\d{2}"))continue;
                JSONArray pupils=attendance.optJSONArray("pupils");
                if(pupils==null||pupils.length()>200)continue;
                attendance.put("_packetId",env.getString("id"));
                decrypted.put(attendance);
            }catch(Exception failure){Log.w("SMADBOD","Unable to decrypt one attendance packet");}
        }
        return decrypted;
    }
    public static void discard(Context c,String id) throws Exception{
        if(!id.matches("[0-9a-fA-F-]{36}"))throw new IllegalArgumentException("Bad packet ID");
        call(getPair(c),new JSONObject().put("action","ack").put("id",id));
        SharedPreferences p=preferences(c);
        Set<String> alerted=new HashSet<>(p.getStringSet("alerted",new HashSet<>()));
        alerted.remove(id);p.edit().putStringSet("alerted",alerted).apply();
    }
    public static void notifyNew(Context c,JSONArray records){
        SharedPreferences p=preferences(c);
        Set<String> alerted=new HashSet<>(p.getStringSet("alerted",new HashSet<>()));
        for(int i=0;i<records.length();i++){
            JSONObject rec=records.optJSONObject(i);if(rec==null)continue;
            String id=rec.optString("_packetId");
            if(id.isEmpty()||alerted.contains(id))continue;
            alerted.add(id);
            NotificationUtil.post(c,id,rec.optString("date"),
                rec.optString("year"),rec.optString("className"));
        }
        p.edit().putStringSet("alerted",alerted).apply();
    }
}
