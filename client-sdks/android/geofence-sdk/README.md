# <img style="vertical-align: middle" src="src/main/res/mipmap-mdpi/world_globe.png"/> Geofence Sample Android SDK

***The Android SDK is an Android API to retrieve geofences and emit entry/exit notifications to the back-end server.***

### Table Of Contents

1. [Installation](#installation)
2. [Usage](#usage)
    1. [Creating a geofencing manager](#creating-a-geofencing-manager)
    2. [Receiving local notifications](#receiving-local-notifications)
    3. [Initializing the list of geofences from a resource](#initializing-the-list-of-geofences-from-a-resource)
    4. [Logging](#logging)

## Installation

The SDK may be declared in the `build.gradle` of an app as a JCenter or Maven dependency with a groupId of `com.ibm.mf.geofence` and artifactId `geofence-sdk`. For instance:

```groovy
dependencies {
  compile 'com.ibm.mf.geofence:geofence-sdk:1.0.0'
  ...
}
```

## Usage

### Creating a geofencing manager

Instantiate the class `MFGeofencingManager` as follows:

```java
public class MyActivity extends Activity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    MFGeofencingManager manager = new MFGeofencingManager(this, serverUrl, username, password, maxDistance);
  }
}
```

Where:
* the first parameter must be of type [Context](http://developer.android.com/reference/android/content/Context.html) or one of its subclasses.
* `serverUrl` is a string expressing the URL to the back-end server, including the protocol, server name or IP address, and an optional port number. For example: "https://myserver.mybluemix.net:3000"
* `username` represents the PI user name used to authenticate with the backend server.
* `password` represents the PI password used to authenticate with the backend server.
* `maxDistance` represents the maximum distance, in meters, from the previous last known location, which triggers a significant location change event.

Once created, the `MFGeofenceManager` object will be able to:
* register or unregister gefoences based on the bounding box defined by the current location and `maxDistance`, i.e. a square box with a side of `maxDistance` and centered on the current location
* communicate with the backend server to emit geofence entry or exit events
* request from the backend server an up-to-date list of geofences

The minimum delay between synchronizations with the server can be controlled with the `getIntervalBetweenDownloads()` and `setIntervalBetweenDownloads(int)` methods,
which will enable retrieving and setting the minimum number of hours between synchronizations, respectively. When not set explicitly, this attribute has a default value of 24 hours. Example usage:

```java
MFGeofencingManager manager = new MFGeofencingManager(this, serverUrl, username, password, maxDistance);
if (manager.getIntervalBetweenDownloads() < 12) {
  manager.setIntervalBetweenDownloads(12);
}
```


### Receiving local notifications

An app using the SDK can receive notifications as broadcast events via a `BroadcastReceiver`:

```java
public class MyGeofenceReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        // extract information from the broadcast intent
        MFGeofenceEvent event = MFGeofenceEvent.fromIntent(intent);
        // get the affected geofences
        List<MFGeofence> geofences = event.getGeofences();
        switch(event.getEventType()) {
            // entered one or more geofences
            case ENTER:
                ...
                break;

             // exited one or more geofences
             case EXIT:
                ...
                break;

            // server synchronization yields new/updated/deleted geofences
            case SERVER_SYNC:
                // list of deleted geofence codes
                List<String> deletedGeofenceCodes = event.getDeletedGeofenceCodes();
                ...
                break;
        }
    }
}
```

The [BroadcastReceiver](http://developer.android.com/reference/android/content/BroadcastReceiver.html) can then be dynamically registered within an [Activity](http://developer.android.com/reference/android/app/Activity.html)'s lifecycle,
or declared in the app's Android manifest to receive notifications in the background, or both.

### Initializing the list of geofences from a resource

You can embed a zipped geojson file as a resource to initialize the list of geofences to monitor.

```java
MFGeofencingManager manager = ...;
manager.loadGeofencesFromResource("some/resource/folder/my_geofences.zip");
```

The operation is performed asynchronously and the method returns immediately. Upon completion of the operation, a broadcast message of type `MFGeofenceEvent.Type.SERVER_SYNC` is sent.

### Logging

The Geofence Sample SDK can log traces for debugging purposes, thanks to [Apache Log4j](http://logging.apache.org/log4j/1.2/).

To get the path to the log file:

```java
String logPath = MFGeofencingManager.getLogFilePath();
```
