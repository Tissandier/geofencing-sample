/**
 * Copyright (c) 2015, 2016 IBM Corporation. All rights reserved.
 * <p/>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p/>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p/>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ibm.mf.geofence;

import org.apache.log4j.Logger;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Utility methods to parse one or more geofences in geojson format.
 */
class GeofencingJSONUtils {
    /**
     * Logger for this class.
     */
    private static final Logger log = LoggingConfiguration.getLogger(GeofencingJSONUtils.class.getSimpleName());
    /**
     * Date format used to convert dates from/to UTC format such as "2015-08-24T09:00:00-05:00".
     */
    static final String DATE_FORMAT = "yyyy-MM-dd'T'HH:mm:ss.SSSZ";

    /**
     * Parse a list of geofences.
     * @param json json object representing the list of fences.
     * @return a list of {@link MFGeofence} instances.
     * @throws Exception if a parsing error occurs.
     */
    static GeofenceList parseGeofences(JSONObject json) throws Exception {
        Set<PersistentGeofence> localGeofences = new HashSet<>(PersistentGeofence.listAll(PersistentGeofence.class));
        List<PersistentGeofence> result = new ArrayList<>();
        JSONArray features = json.getJSONArray("features");
        for (int i=0; i<features.length(); i++) {
            JSONObject feature = features.getJSONObject(i);
            result.add(parseGeofence(feature));
        }
        int totalFeatures = result.size();
        // shoud now contain only the fences to delete
        localGeofences.removeAll(result);
        int n = localGeofences.size();
        List<String> deletedCodes = null;
        if (n > 0) {
            deletedCodes = new ArrayList<>(n);
            for (PersistentGeofence fence: localGeofences) {
                deletedCodes.add(fence.getCode());
                fence.delete();
            }
            log.debug(String.format("deleted %d geofences from local DB", n));
        }
        /*
        if (json.has("properties")) {
            JSONObject properties = json.getJSONObject("properties");
            List<String> deletedCodes = null;
            if (properties.has("deleted")) {
                JSONArray deletedCodesJson = properties.getJSONArray("deleted");
                deletedCodes = new ArrayList<>(deletedCodesJson.length());
                for (int i=0; i<deletedCodesJson.length(); i++) {
                    deletedCodes.add(deletedCodesJson.getString(i));
                }
                if (!deletedCodes.isEmpty()) {
                    n = GeofencingUtils.deleteGeofences(deletedCodes);
                    log.debug(String.format("deleted %d geofences from local DB", n));
                }
            }
            int totalGeofences = properties.has("totalFeatures") ? properties.getInt("totalFeatures") : -1;
            return new GeofenceList(result, totalGeofences, deletedCodes);
        }
        */
        return new GeofenceList(result, totalFeatures, deletedCodes);
    }

    /**
     * Parse a single geofence.
     * @param feature json object representing the fence.
     * @return a {@link MFGeofence} instance.
     * @throws Exception if a parsing error occurs.
     */
    static PersistentGeofence parseGeofence(JSONObject feature) throws Exception {
        JSONObject props = feature.getJSONObject("properties");
        String code = props.has("code") ? props.getString("code") : (props.has("@code") ? props.getString("@code") : null);
        String name = props.optString("name", null);
        String description = props.optString("description", null);
        double radius = props.optDouble("radius", -1d);
        JSONObject geometry = feature.getJSONObject("geometry");
        JSONArray coord = geometry.getJSONArray("coordinates");
        double lng = coord.getDouble(0);
        double lat = coord.getDouble(1);
        PersistentGeofence geofence = GeofencingUtils.geofenceFromCode(code);
        if (geofence == null) {
            // if not in local DB create a new one
            geofence = new PersistentGeofence(code, name, description, lat, lng, radius);
        } else {
            // update existing geofence
            geofence.setName(name);
            geofence.setDescription(description);
            geofence.setLatitude(lat);
            geofence.setLongitude(lng);
            geofence.setRadius(radius);
        }
        return geofence;
    }

    /*
    {
      "notifications": [
        {
          "data": {
            "crossingType": "enter",
            "fenceCode": "34c824e9-b5ba-4032-b41e-a81e17fedc89"
          },
          "detectedTime": "2016-02-10T08:54:08+01:00",
          "descriptor": "343487045bbab8e9"
        }
      ],
      "sdkVersion": "1.0.1"
    }
    */
    static JSONObject toJSONGeofenceEvent(List<PersistentGeofence> fences, MFGeofenceEvent.Type type, String deviceID, String sdkVersion) {
        JSONObject json = new JSONObject();
        try {
            json.put("sdkVersion", sdkVersion == null ? "" : sdkVersion);
            JSONArray notifications = new JSONArray();
            json.put("notifications", notifications);
            String date = formatDate(new Date());
            for (PersistentGeofence fence: fences) {
                notifications.put(toJSONGeofenceEvent(fence, deviceID, date, type));
            }
        } catch(JSONException e) {
            log.error("exception generating json for geofence list", e);
        }
        return json;
    }

    static JSONObject toJSONGeofenceEvent(PersistentGeofence fence, String deviceID, String date, MFGeofenceEvent.Type type) {
        JSONObject json = new JSONObject();
        try {
            json.put("descriptor", deviceID);
            //json.put("descriptor", deviceID);
            json.put("detectedTime", date);
            JSONObject data = new JSONObject();
            json.put("data", data);
            data.put("geofenceCode", fence.getCode());
            data.put("geofenceName", fence.getName());
            data.put("crossingType", type.operation());
        } catch(JSONException e) {
            log.error("exception generating json for geofence list", e);
        }
        return json;
    }

    static String formatDate(Date date) {
        return new SimpleDateFormat(DATE_FORMAT).format(date);
    }
}
