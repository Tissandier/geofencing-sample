/**
 * Copyright (c) 2015-2016 IBM Corporation. All rights reserved.
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

package com.ibm.mf.geofence.demo;

import android.content.Context;
import android.net.Uri;

import com.ibm.mf.geofence.LoggingConfiguration;
import com.ibm.mf.geofence.MFGeofence;
import com.ibm.mf.geofence.rest.HttpMethod;
import com.ibm.mf.geofence.rest.HttpService;
import com.ibm.mf.geofence.rest.JSONPayloadRequest;
import com.ibm.mf.geofence.rest.HttpRequestCallback;
import com.ibm.mf.geofence.rest.HttpRequestError;

import org.apache.log4j.Logger;
import org.json.JSONObject;

import java.net.URL;
import java.util.List;

/**
 * A service that sends messages to a Slack channel for each geofence enter/exit event.
 */
public class SlackHTTPService extends HttpService {
    /**
     * Logger for this class.
     */
    private static final Logger log = LoggingConfiguration.getLogger(SlackHTTPService.class.getSimpleName());

    public SlackHTTPService(Context context) {
        super("https://cloudplatform.slack.com", null, null);
    }

    @Override
    protected Uri getBaseQueryURI() throws Exception {
        URL url = new URL(getServerURL());
        int port = url.getPort();
        String portStr = (port < 0) ? "" : ":" + port;
        Uri.Builder builder = new Uri.Builder().scheme(url.getProtocol()).encodedAuthority(url.getHost() + portStr);
        return builder.build();
    }

    /**
     * Send a single slack message for the specified geofences.
     * @param geofences the geofences to send a message about
     * @param type the type of geofence event: 'enter' or 'exit'.
     * @param channel the slack channel to send the message to.
     */
    public void postGeofenceMessages(List<MFGeofence> geofences, String type, String channel) {
        StringBuilder sb = new StringBuilder(":android: ").append(type).append(": ");
        int count = 0;
        for (MFGeofence fence : geofences) {
            if (count > 0) sb.append(", ");
            sb.append('\'').append(fence.getName()).append('\'');
            count++;
        }
        postMessage(sb.toString(), channel);
    }

    /**
     * Send a single slack message.
     * @param message the message to send
     * @param channel the slack channel to send the message to.
     */
    public void postMessage(String message, String channel) {
        HttpRequestCallback<JSONObject> callback = new HttpRequestCallback<JSONObject>() {
            @Override
            public void onSuccess(JSONObject result) {
                log.debug("slack request successful");
            }

            @Override
            public void onError(HttpRequestError error) {
                log.error("slack request error: " + error);
            }
        };
        JSONPayloadRequest request = new JSONPayloadRequest(callback, HttpMethod.POST, null);
        request.setPath("api/chat.postMessage");
        request.addParameter("token", "xoxb-16699261284-N2bQJgPCbgghzhPb0efFJhuw");
        request.addParameter("channel", channel);
        request.addParameter("text", message);
        executeRequest(request);
    }
}
