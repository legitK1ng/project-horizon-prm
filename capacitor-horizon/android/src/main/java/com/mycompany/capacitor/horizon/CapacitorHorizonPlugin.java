package com.mycompany.capacitor.horizon;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CapacitorHorizon")
public class CapacitorHorizonPlugin extends Plugin {

    private CapacitorHorizon implementation = new CapacitorHorizon();

    @PluginMethod
    public void echo(PluginCall call) {
        String value = call.getString("value");

        JSObject ret = new JSObject();
        ret.put("value", implementation.echo(value));
        call.resolve(ret);
    }

    @PluginMethod
    public void getNativeContext(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("context", implementation.getNativeContext(getContext()));
        call.resolve(ret);
    }
}
