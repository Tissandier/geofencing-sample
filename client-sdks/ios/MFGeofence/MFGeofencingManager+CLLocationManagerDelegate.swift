/**
*  MFGeofence
*  MFGeofencingManager+CLLocationManagerDelegate.swift
*
*  © Copyright 2016 IBM Corp.
*
*  Licensed under the Presence Insights Client iOS Framework License (the "License");
*  you may not use this file except in compliance with the License. You may find
*  a copy of the license in the license.txt file in this package.
*
*  Unless required by applicable law or agreed to in writing, software
*  distributed under the License is distributed on an "AS IS" BASIS,
*  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*  See the License for the specific language governing permissions and
*  limitations under the License.
**/


import CoreLocation
import CocoaLumberjack



extension MFGeofencingManager: CLLocationManagerDelegate {

	public func locationManager(manager: CLLocationManager, didChangeAuthorizationStatus status: CLAuthorizationStatus){
		switch status {
		case .AuthorizedAlways:
			fallthrough
		case .AuthorizedWhenInUse:
			self.locationManager.startMonitoringSignificantLocationChanges()
			DDLogVerbose("didChangeAuthorizationStatus.startMonitoringSignificantLocationChanges",asynchronous:false)
		case .Denied:
			self.stopMonitoringRegions()
			DDLogVerbose("didChangeAuthorizationStatus.Denied",asynchronous:false)
		case .NotDetermined:
			self.stopMonitoringRegions()
			DDLogVerbose("didChangeAuthorizationStatus.NotDetermined",asynchronous:false)
		case .Restricted:
			self.stopMonitoringRegions()
			DDLogVerbose("didChangeAuthorizationStatus.Restricted",asynchronous:false)

		}

	}

	public func locationManager(manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
		DDLogVerbose("didUpdateLocations")
		self.updateMonitoredGeofences()

		var days = Double(self.intervalBetweenDownloads)
		if days < 1 {
			days = 1
		}
		if let lastDownloadDate = MFGeofencePreferences.lastDownloadDate where lastDownloadDate.timeIntervalSinceNow > -60 * 60 * 24 * days {
			// synchronize less than one day ago
			return

		}

		if let lastDownloadErrorDate = MFGeofencePreferences.lastDownloadErrorDate where lastDownloadErrorDate.timeIntervalSinceNow > -60 * 60 {
			// error less than one hour ago
			// wait for retry
			return

		}

		// This data will be reset if there is an error
		// so we retry one hour later
		// MFServiceDelegate
		MFGeofencePreferences.lastDownloadDate = NSDate()
		MFGeofencePreferences.synchronize()
		
		synchronize { success in
			if success == false {
				MFGeofencePreferences.downloadError()
			}
		}

	}

	public func locationManager(manager: CLLocationManager, didEnterRegion region: CLRegion){
		guard let geofence = self.queryGeofence(region.identifier) else {
			DDLogError("didEnterRegion Region \(region.identifier) not found",asynchronous:false)
			self.delegate?.geofencingManager(self, didEnterGeofence: nil)
			return
		}

		DDLogVerbose("didEnterRegion \(region.identifier) \(geofence.name)",asynchronous:false)

		self.sendMFGeofenceEvent(.Enter, geofence: geofence)

		self.delegate?.geofencingManager(self, didEnterGeofence: geofence)

	}

	public func locationManager(manager: CLLocationManager, didExitRegion region: CLRegion){

		guard let geofence = self.queryGeofence(region.identifier) else {
			DDLogError("didExitRegion Region \(region.identifier) not found",asynchronous:false)
			self.delegate?.geofencingManager(self, didExitGeofence: nil)
			return
		}

		DDLogVerbose("didExitRegion \(region.identifier) \(geofence.name)",asynchronous:false)

		self.sendMFGeofenceEvent(.Exit, geofence: geofence)

		self.delegate?.geofencingManager(self, didExitGeofence: geofence)

	}


	private func sendMFGeofenceEvent(event:MFGeofenceEvent,geofence: MFGeofence?) {

		guard privacy == false else {
			DDLogVerbose("sendMFGeofenceEvent \(geofence?.name) \(event), privacyOn !!!",asynchronous:false)
			return
		}

		guard let geofence = geofence else {
			DDLogError("****** sendMFGeofenceEvent, Missing fence",asynchronous:false)
			return
		}

		let application = UIApplication.sharedApplication()
		var bkgTaskId = UIBackgroundTaskInvalid
		bkgTaskId = application.beginBackgroundTaskWithExpirationHandler {
			if bkgTaskId != UIBackgroundTaskInvalid {
				DDLogError("****** MFGeofenceMonitoringRequest ExpirationHandler \(bkgTaskId)",asynchronous:false)
				self.service.cancelAll()
				let id = bkgTaskId
				bkgTaskId = UIBackgroundTaskInvalid
				application.endBackgroundTask(id)
			}
		}
		if bkgTaskId == UIBackgroundTaskInvalid {
			DDLogError("****** No background time for MFGeofenceMonitoringRequest",asynchronous:false)
		}

		DDLogInfo("MFGeofenceMonitoringRequest beginBackgroundTaskWithExpirationHandler \(bkgTaskId)",asynchronous:false)

		DDLogInfo("Create MFGeofenceMonitoringRequest \(geofence.code) , \(geofence.name), \(event.rawValue)",asynchronous:false)

		let piRequest = MFGeofenceMonitoringRequest(geofenceCode:geofence.code,eventTime:NSDate(),event:event,geofenceName: geofence.name) {
			response in
			switch response.result {
			case let .HTTPStatus(status,_)?:
				DDLogError("****** MFGeofenceMonitoringRequest status \(status)",asynchronous:false)
				DDLogError("****** MFGeofenceMonitoringRequest \(response.httpRequest)",asynchronous:false)
			case let .Error(error)?:
				DDLogError("****** MFGeofenceMonitoringRequest error \(error)",asynchronous:false)
			case let .Exception(exception)?:
				DDLogError("****** MFGeofenceMonitoringRequest exception \(exception)",asynchronous:false)
			case .Cancelled?:
				DDLogVerbose("****** MFGeofenceMonitoringRequest cancelled",asynchronous:false)
			case .OK?:
				DDLogInfo("MFGeofenceMonitoringRequest OK \(event.rawValue) : \(geofence.code)",asynchronous:false)
			case nil:
				break
			}
			dispatch_async(dispatch_get_main_queue()) {
				if bkgTaskId != UIBackgroundTaskInvalid {
					DDLogInfo("****** MFGeofenceMonitoringRequest endBackgroundTask \(bkgTaskId)",asynchronous:false)
					let id = bkgTaskId
					bkgTaskId = UIBackgroundTaskInvalid
					application.endBackgroundTask(id)
				}
			}
		}

		service.executeRequest(piRequest)

	}


}