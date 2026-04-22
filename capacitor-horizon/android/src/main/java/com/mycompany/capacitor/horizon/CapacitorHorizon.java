package com.mycompany.capacitor.horizon;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;

public class CapacitorHorizon {

    public String echo(String value) {
        Logger.info("Echo", value);
        return value;
    }

    public JSObject getNativeContext(Context context) {
        JSObject result = new JSObject();
        
        JSObject deviceInfo = new JSObject();
        deviceInfo.put("model", Build.MODEL);
        deviceInfo.put("platform", "android");
        deviceInfo.put("osVersion", Build.VERSION.RELEASE);
        result.put("deviceInfo", deviceInfo);
        
        JSObject permissions = new JSObject();
        permissions.put("contacts", ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED ? "granted" : "denied");
        permissions.put("calls", ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED ? "granted" : "denied");
        result.put("permissions", permissions);
        
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean isIgnoringBatteryOptimizations = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && pm != null) {
            isIgnoringBatteryOptimizations = pm.isIgnoringBatteryOptimizations(context.getPackageName());
        }
        result.put("isBatteryOptimized", !isIgnoringBatteryOptimizations);
        
        return result;
    }
}
