package com.ibm.mf.geofence.demo;

import android.content.Context;

import com.ibm.mf.geofence.LoggingConfiguration;
import com.ibm.mf.geofence.MFGeofence;
import com.ibm.mf.geofence.MFGeofencingManager;
import com.ibm.mf.geofence.rest.HttpMethod;
import com.ibm.mf.geofence.rest.HttpRequest;
import com.ibm.mf.geofence.rest.HttpRequestCallback;
import com.ibm.mf.geofence.rest.HttpRequestError;
import com.ibm.mf.geofence.rest.HttpService;
import com.ibm.mf.geofence.rest.JSONPayloadRequest;

import org.apache.log4j.Logger;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Date;
import java.util.Locale;

/**
 *
 */
public class CustomHttpService extends HttpService {
    /**
     * Logger for this class.
     */
    private static final Logger log = LoggingConfiguration.getLogger(CustomHttpService.class.getSimpleName());
    /**
     * Part of a request path pointing to the pi conifg connector.
     */
    static final String CONFIG_CONNECTOR_PATH = "geofences";
    MFGeofencingManager manager;

    public CustomHttpService(MFGeofencingManager manager, Context context, String serverURL, String username, String password) {
        super(serverURL, username, password);
        this.manager = manager;
    }

    /**
     * Register the specified single geofence with the backend server.
     * @param fence the geofence to register.
     */
    public void addGeofence(final MFGeofence fence, final HttpRequestCallback<MFGeofence> userCallback) {
        log.debug("addGeofence(" + fence + ")");
            HttpRequestCallback<JSONObject> callback = new HttpRequestCallback<JSONObject>() {
                @Override
                public void onSuccess(JSONObject result) {
                    log.debug("sucessfully posted geofence " + fence);
                    MFGeofence updated = null;
                    try {
                        String code = result.has("@code") ? result.getString("@code") : null;
                        if (code != null) {
                            updated = new MFGeofence(code, fence.getName(), fence.getDescription(), fence.getLatitude(), fence.getLongitude(), fence.getRadius());
                        }
                    } catch(Exception e) {
                        log.error("error parsing JSON response: ", e);
                    }
                    if (updated != null) {
                        DemoUtils.loadGeofences(manager);
                        //updated.save();
                        //setInitialLocation();
                    }
                    if (userCallback != null) {
                        try {
                            userCallback.onSuccess(updated);
                        } catch(Exception e) {
                            userCallback.onError(new HttpRequestError(-1, e, "error parsing response for registration of fence " + fence));
                        }
                    }
                }

                @Override
                public void onError(HttpRequestError error) {
                    log.error("error posting geofence " + fence + " : " + error.toString());
                    if (userCallback != null) {
                        userCallback.onError(error);
                    }
                }
            };
            JSONObject payload = toJSONGeofence(fence, false);
            JSONPayloadRequest request = new JSONPayloadRequest(callback, HttpMethod.POST, payload.toString());
            String path = String.format(Locale.US, "%s", CONFIG_CONNECTOR_PATH);
            request.setPath(path);
            executeRequest(request);
    }

    /**
     * Register the specified single geofence with the backend server.
     * @param fence the geofence to register.
     */
    public void updateGeofence(final MFGeofence fence, final HttpRequestCallback<MFGeofence> userCallback) {
        log.debug("addGeofence(" + fence + ")");
        HttpRequestCallback<String> callback = new HttpRequestCallback<String>() {
            @Override
            public void onSuccess(String result) {
                log.debug("sucessfully updated geofence " + fence);
                DemoUtils.loadGeofences(manager);
                //updated.save();
                //setInitialLocation();
                if (userCallback != null) {
                    try {
                        userCallback.onSuccess(fence);
                    } catch(Exception e) {
                        userCallback.onError(new HttpRequestError(-1, e, "error parsing response for registration of fence " + fence));
                    }
                }
            }

            @Override
            public void onError(HttpRequestError error) {
                log.error("error putting geofence " + fence + " : " + error.toString());
                if (userCallback != null) {
                    userCallback.onError(error);
                }
            }
        };
        JSONObject payload = toJSONGeofence(fence, true);
        HttpRequest<String> request = new HttpRequest<String>(callback, HttpMethod.PUT, payload.toString()) {
            @Override
            protected String resultFromResponse(byte[] source) throws Exception {
                return new String(source, "UTF-8");
            }
        };
        String path = String.format(Locale.US, "%s/%s", CONFIG_CONNECTOR_PATH, fence.getCode());
        request.setPath(path);
        executeRequest(request);
    }

    /**
     * Unregister the specified single geofence from the backend server.
     * @param fence the geofence to unregister.
     */
    public void removeGeofence(final MFGeofence fence, final HttpRequestCallback<MFGeofence> userCallback) {
        log.debug("removeGeofence(" + fence + ")");
        HttpRequestCallback<String> callback = new HttpRequestCallback<String>() {
            @Override
            public void onSuccess(String result) {
                log.debug("sucessfully deleted geofence " + fence);
                DemoUtils.loadGeofences(manager);
                //setInitialLocation();
                if (userCallback != null) {
                    try {
                        userCallback.onSuccess(fence);
                    } catch(Exception e) {
                        userCallback.onError(new HttpRequestError(-1, e, "error parsing response for deletion of fence " + fence));
                    }
                }
            }

            @Override
            public void onError(HttpRequestError error) {
                log.error("error deleting geofence " + fence + " : " + error.toString());
                if (userCallback != null) {
                    userCallback.onError(error);
                }
            }
        };
        HttpRequest<String> request = new HttpRequest<String>(callback, HttpMethod.DELETE, null) {
            @Override
            protected String resultFromResponse(byte[] source) throws Exception {
                return new String(source, "UTF-8");
            }
        };
        String path = String.format(Locale.US, "%s/%s", CONFIG_CONNECTOR_PATH, fence.getCode());
        request.setPath(path);
        executeRequest(request);
    }

    JSONObject toJSONGeofence(MFGeofence fence, boolean isUpdate) {
        JSONObject json = new JSONObject();
        try {
            json.put("type", "Feature");
            JSONObject geometry = new JSONObject();
            json.put("geometry", geometry);
            geometry.put("type", "Point");
            JSONArray coord = new JSONArray();
            geometry.put("coordinates", coord);
            coord.put(fence.getLongitude());
            coord.put(fence.getLatitude());
            JSONObject properties = new JSONObject();
            json.put("properties", properties);
            properties.put("name", fence.getName());
            properties.put("description", fence.getDescription() == null ? "" : fence.getDescription());
            properties.put("radius", fence.getRadius());
            if (isUpdate) {
                JSONObject updated = new JSONObject();
                properties.put("@updated", updated);
                updated.put("by", getUsername());
                updated.put("timestamp", new Date().getTime());
            }
        } catch(JSONException e) {
            log.error("exception generating json for geofence " + fence, e);
        }
        return json;
    }

    /**
     * Parse a single geofence.
     * @param feature json object representing the fence.
     * @return a {@link MFGeofence} instance.
     * @throws Exception if a parsing error occurs.
     */
    static MFGeofence parseGeofence(JSONObject feature) throws Exception {
        JSONObject props = feature.getJSONObject("properties");
        String code = props.has("code") ? props.getString("code") : (props.has("@code") ? props.getString("@code") : null);
        String name = props.has("name") ? props.getString("name") : null;
        String description = props.has("description") ? props.getString("description") : null;
        double radius = props.has("radius") ? props.getDouble("radius") : -1d;
        JSONObject geometry = feature.getJSONObject("geometry");
        JSONArray coord = geometry.getJSONArray("coordinates");
        double lng = coord.getDouble(0);
        double lat = coord.getDouble(1);
        return new MFGeofence(code, name, description, lat, lng, radius);
    }
}
