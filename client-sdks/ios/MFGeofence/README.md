# MF Geofence

MF Geofence allows to monitor an unlimited number of geofences defined on the Presence Insight platform. 
It is written in Swift.

At any time, you can add, remove or update geofences on the Bluemix plateform and MF Geofence
will automatically synchronize against the Bluemix backend.

The SDK does not use the GPS and is therefore energy efficient and does not drain the battery.

MF Geofence has been tested with several thousands of geofences. 
The recommended minimal radius for a geofence is 100 meters. Geofences should not overlap and should be distant
at least few hundreds meters. 

Each time the user enters or exits a geofence, the Bluemix platform is notified.


## Installation

MF Geofence requires a minimum deployment target of iOS 9.

### CocoaPods

[CocoaPods](http://cocoapods.org) is a dependency manager for Cocoa projects. You can install it with the following command:

```bash
$ gem install cocoapods
```

> CocoaPods 1.0.0.rc1+ is required to build MFGeofence 1.0.0.

To integrate MFGeofence into your Xcode project using CocoaPods, specify it in your `Podfile`:

```ruby
platform :ios, '8.0'
use_frameworks!

pod 'MFGeofence',:git => 'git@github.ibm.com:MobileFirst/geofencing-sample.git'
```

Then, run the following command:

```bash
$ pod install
```

## Usage

To enable the Presence Insight geofencing  you must instantiate `MFGeofencingManager` 
and implement `handleEventsForBackgroundURLSession` in the AppDelegate

```swift
import MFGeofence

var mfGeofencingManager: MFGeofencingManager?

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

	func application(application: UIApplication, didFinishLaunchingWithOptions launchOptions: [NSObject: AnyObject]?) -> Bool {
	
		MFGeofencingManager.enableLogging(true)

		let baseURL = "http://geofencing-sample.mybluemix.net"
		let username = "demo"
		let password = "demo"

		mfGeofencingManager = MFGeofencingManager(
			baseURL: baseURL,
			username: username,
			password: password)

	}
	
	func application(application: UIApplication, handleEventsForBackgroundURLSession identifier: String, completionHandler: () -> Void) {

		mfGeofencingManager?.handleEventsForBackgroundURLSession(identifier, completionHandler: completionHandler)
	}

	
}
```


### Synchronization

The method `handleEventsForBackgroundURLSession` is necessary because MFGeofence downloads the geofences using
the iOS Background Transfert Service.

By default, IBMPIGeofenceSDK checks at most once a day, if there are new geofences on the backend. You can change
this default value with the property:

```swift
public final class PIGeofencingManager:NSObject {

	/// Number of hours between each check against PI for downloading the geofence definitions 
	public var intervalBetweenDownloads = 24

}
```

### Enter and Exit events

If you wish to be notified when the user enters or exits a geofence, you need to implement `MFGeofencingManagerDelegate`


```swift
extension AppDelegate:MFGeofencingManagerDelegate {

	// MARK: - MFGeofencingManagerDelegate

	func geofencingManager(manager: PIGeofencingManager, didEnterGeofence geofence: MFGeofence? ) {


	}

	func geofencingManager(manager: PIGeofencingManager, didExitGeofence geofence: MFGeofence? ) {

	}


}

```


### Logging

MFGeofence can log traces for debugging purpose, thanks to [CocoaLumberjack](https://cocoapods.org/pods/CocoaLumberjack).

To enable the logging:

```swift
	MFGeofencingManager.enableLogging(true)
```

To get the paths to the log files,


```swift
	let logFiles = MFGeofencingManager.logFiles()
```




