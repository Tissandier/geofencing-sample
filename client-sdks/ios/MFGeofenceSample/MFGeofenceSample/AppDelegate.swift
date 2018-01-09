//
//  AppDelegate.swift
//  MFGeofenceSample
//
//  Created by slizeray on 03/05/16.
//  Copyright © 2016 IBM. All rights reserved.
//

import UIKit
import MFGeofence
import CoreLocation

var mfGeofencingManager: MFGeofencingManager?

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

	var window: UIWindow?

	private let locationManager = CLLocationManager()

	private static let dateFormatter:NSDateFormatter = {
		let dateFormatter = NSDateFormatter()
		dateFormatter.dateStyle = .MediumStyle
		dateFormatter.timeStyle = .MediumStyle
		return dateFormatter
	}()
	

	func application(application: UIApplication, didFinishLaunchingWithOptions launchOptions: [NSObject: AnyObject]?) -> Bool {
		// Override point for customization after application launch.
		MFGeofencingManager.enableLogging(true)

		let settings = UIUserNotificationSettings(forTypes: [.Alert, .Sound], categories: nil)
		UIApplication.sharedApplication().registerUserNotificationSettings(settings)

		let baseURL = "https://geofencing-sample-et.mybluemix.net"
		let username = "demo"
		let password = "demo"

		mfGeofencingManager = MFGeofencingManager(
			baseURL: baseURL,
			username: username,
			password: password)

		mfGeofencingManager?.delegate = self

		self.manageAuthorizations()

		return true
	}

	func applicationWillResignActive(application: UIApplication) {
		// Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
		// Use this method to pause ongoing tasks, disable timers, and throttle down OpenGL ES frame rates. Games should use this method to pause the game.
	}

	func applicationDidEnterBackground(application: UIApplication) {
		// Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
		// If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
	}

	func applicationWillEnterForeground(application: UIApplication) {
		// Called as part of the transition from the background to the inactive state; here you can undo many of the changes made on entering the background.
	}

	func applicationDidBecomeActive(application: UIApplication) {
		// Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
	}

	func applicationWillTerminate(application: UIApplication) {
		// Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
	}


	func application(application: UIApplication, didReceiveLocalNotification notification: UILocalNotification) {
		let state = UIApplication .sharedApplication().applicationState
		if state == .Active {

			let title = NSLocalizedString("Alert.LocalNotification.Title",comment:"")
			let message = notification.alertBody ?? NSLocalizedString("Alert.LocalNotification.MissingBody",comment:"")
			self.showAlert(title, message: message)

		}

	}

	func application(application: UIApplication, handleEventsForBackgroundURLSession identifier: String, completionHandler: () -> Void) {

		mfGeofencingManager?.handleEventsForBackgroundURLSession(identifier, completionHandler: completionHandler)
	}
	
}

extension AppDelegate {


	private func manageAuthorizations() {

		if !CLLocationManager.isMonitoringAvailableForClass(CLCircularRegion) {
			dispatch_async(dispatch_get_main_queue()) {
				let title = NSLocalizedString("Alert.NoMonitoring.Title",comment:"")
				let message = NSLocalizedString("Alert.NoMonitoring.Message",comment:"")
				self.showAlert(title, message: message)

			}

		} else {
			switch CLLocationManager.authorizationStatus() {
			case .NotDetermined:
				locationManager.requestAlwaysAuthorization()

			case .AuthorizedAlways:
				fallthrough
			case .AuthorizedWhenInUse:
				break
			case .Restricted, .Denied:
				let alertController = UIAlertController(
					title: NSLocalizedString("Alert.Monitoring.Title",comment:""),
					message: NSLocalizedString("Alert.Monitoring.Message",comment:""),
					preferredStyle: .Alert)

				let cancelAction = UIAlertAction(title: NSLocalizedString("Cancel",comment:""), style: .Cancel){ (action) in
				}
				alertController.addAction(cancelAction)

				let openAction = UIAlertAction(title: NSLocalizedString("Alert.Monitoring.OpenAction",comment:""), style: .Default) { (action) in
					if let url = NSURL(string:UIApplicationOpenSettingsURLString) {
						UIApplication.sharedApplication().openURL(url)
					}
				}
				alertController.addAction(openAction)

				dispatch_async(dispatch_get_main_queue()) {
					self.window?.rootViewController?.presentViewController(alertController, animated: true, completion: nil)

				}
			}
		}

		let refreshStatus = UIApplication.sharedApplication().backgroundRefreshStatus
		switch refreshStatus {
		case .Restricted:
			fallthrough
		case .Denied:
			let alertController = UIAlertController(
				title: NSLocalizedString("Alert.BackgroundRefresh.Title",comment:""),
				message: NSLocalizedString("Alert.BackgroundRefresh.Message",comment:""),
				preferredStyle: .Alert)

			let okAction = UIAlertAction(title: NSLocalizedString("OK",comment:""), style: .Default){ (action) in
			}
			alertController.addAction(okAction)


			dispatch_async(dispatch_get_main_queue()) {
				self.window?.rootViewController?.presentViewController(alertController, animated: true, completion: nil)

			}
			
		case .Available:
			break
			
		}
		
	}
	
}



extension AppDelegate:MFGeofencingManagerDelegate {

	// MARK: - MFGeofencingManagerDelegate

	func geofencingManager(manager: MFGeofencingManager, didEnterGeofence geofence: MFGeofence? ) {

		let geofenceName = geofence?.name ?? "Error,unknown fence"

		let notification = UILocalNotification()
		notification.alertBody = String(format:NSLocalizedString("Region.Notification.Enter %@", comment: ""),geofenceName)

		notification.soundName = UILocalNotificationDefaultSoundName
		if let geofence = geofence {
			notification.userInfo = ["geofence.code":geofence.code]
		}

		UIApplication.sharedApplication().presentLocalNotificationNow(notification)

	}

	func geofencingManager(manager: MFGeofencingManager, didExitGeofence geofence: MFGeofence? ) {

		let geofenceName = geofence?.name ?? "Error,unknown fence"

		let notification = UILocalNotification()
		notification.alertBody = String(format:NSLocalizedString("Region.Notification.Exit %@", comment: ""),geofenceName)

		notification.soundName = UILocalNotificationDefaultSoundName
		if let geofence = geofence {
			notification.userInfo = ["geofence.code":geofence.code]
		}

		UIApplication.sharedApplication().presentLocalNotificationNow(notification)
	}
	
	
}


extension AppDelegate {

	func showAlert(title:String,message:String) {

		if let _ = self.window?.rootViewController?.presentedViewController {
			self.window?.rootViewController?.dismissViewControllerAnimated(true, completion: nil)
		}

		let alertController = UIAlertController(
			title: NSLocalizedString(title,comment:""),
			message: NSLocalizedString(message,comment:""),
			preferredStyle: .Alert)

		let okAction = UIAlertAction(title: NSLocalizedString("OK",comment:""), style: .Default){ (action) in
		}
		alertController.addAction(okAction)


		self.window?.rootViewController?.presentViewController(alertController, animated: true, completion: nil)
	}
}



