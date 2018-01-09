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

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.TaskStackBuilder;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.support.v4.app.NotificationCompat;

import com.ibm.mf.geofence.LoggingConfiguration;
import com.ibm.mf.geofence.MFGeofence;
import com.ibm.mf.geofence.MFGeofenceEvent;
import com.ibm.mf.geofence.Settings;

import org.apache.log4j.Logger;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 *
 */
public class MyGeofenceReceiver extends BroadcastReceiver {
    private static final Logger log = LoggingConfiguration.getLogger(MyGeofenceReceiver.class.getSimpleName());
    private static final String SLACK_CHANNEL = "#geo-spam";
    private static final AtomicInteger notifId = new AtomicInteger(0);
    //#private static final String SLACK_CHANNEL = "@lolo4j";
    private final SlackHTTPService slackService;
    private final MapsActivity activity;

    public MyGeofenceReceiver() {
        this(null);
    }

    public MyGeofenceReceiver(MapsActivity activity) {
        this.activity = activity;
        this.slackService = new SlackHTTPService(null);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        MFGeofenceEvent event = MFGeofenceEvent.fromIntent(intent);
        List<MFGeofence> geofences = event.getGeofences();
        Settings settings = (activity != null) ? activity.settings : loadSettings(context);
        switch(event.getEventType()) {
            case ENTER:
                log.debug("entering geofence(s) " + geofences);
                if (settings.getBoolean(MapsActivity.TRACKING_ENABLED_KEY, true)) {
                    if (activity != null) {
                        updateUI(geofences, true);
                    } else {
                        sendNotification(context, geofences, "enter");
                        slackService.postGeofenceMessages(geofences, "enter", SLACK_CHANNEL);
                    }
                }
                break;
            case EXIT:
                log.debug("exiting geofence(s) " + geofences);
                if (settings.getBoolean(MapsActivity.TRACKING_ENABLED_KEY, true)) {
                    if (activity != null) {
                        updateUI(geofences, false);
                    } else {
                        sendNotification(context, geofences, "exit");
                        slackService.postGeofenceMessages(geofences, "exit", SLACK_CHANNEL);
                    }
                }
                break;
            case SERVER_SYNC:
                log.debug(String.format("got new/updated geofences: %s - deleted: %s", geofences, event.getDeletedGeofenceCodes()));
                break;
        }
    }

    private void updateUI(List<MFGeofence> geofences, boolean active) {
        if (activity != null) {
            for (MFGeofence geofence: geofences) {
                activity.refreshGeofenceInfo(geofence, active);
            }
        }
    }

    private void sendNotification(Context context, List<MFGeofence> fences, String type) {
        String title = "Geofence: " + type;
        StringBuilder sb = new StringBuilder();
        int count = 0;
        for (MFGeofence g: fences) {
            if (count > 0) sb.append('\n');
            sb.append(String.format("%s : lat=%.6f; lng=%.6f; radius=%.0f m", g.getName(), g.getLatitude(), g.getLongitude(), g.getRadius()));
            count++;
        }
        NotificationCompat.Builder mBuilder = new NotificationCompat.Builder(context)
            .setAutoCancel(true)
            .setSmallIcon(android.R.drawable.ic_notification_overlay)
            .setContentTitle(title).setContentText(sb.toString());
        // Creates an explicit intent for an Activity in your app
        Intent resultIntent = new Intent(context, MapsActivity.class);

        // The stack builder object will contain an artificial back stack for the started Activity.
        // This ensures that navigating backward from the Activity leads out of your application to the Home screen.
        TaskStackBuilder stackBuilder = TaskStackBuilder.create(context);
        // Adds the back stack for the Intent (but not the Intent itself)
        stackBuilder.addParentStack(MapsActivity.class);
        // Adds the Intent that starts the Activity to the top of the stack
        stackBuilder.addNextIntent(resultIntent);
        PendingIntent resultPendingIntent = stackBuilder.getPendingIntent(0, PendingIntent.FLAG_UPDATE_CURRENT);
        mBuilder.setContentIntent(resultPendingIntent);
        NotificationManager mNotificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        // mId allows you to update the notification later on.
        mNotificationManager.notify(notifId.incrementAndGet(), mBuilder.build());
    }

    private Settings loadSettings(Context context) {
        //return new Settings(context, DemoUtils.extractSettingsData(context));
        return new Settings(context);
    }
}
