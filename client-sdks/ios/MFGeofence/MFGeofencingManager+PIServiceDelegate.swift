/**
*  IBMPIGeofence
*  PIGeofencingManager+PIServiceDelegate.swift
*
*  Performs all communication to the PI Rest API.
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

import UIKit
import CocoaLumberjack

extension MFGeofencingManager: MFServiceDelegate {

	public func didProgress(session: NSURLSession, downloadTask: NSURLSessionDownloadTask,progress:Float) {

		let application = UIApplication.sharedApplication()
		var bkgTaskId = UIBackgroundTaskInvalid
		bkgTaskId = application.beginBackgroundTaskWithExpirationHandler {
			if bkgTaskId != UIBackgroundTaskInvalid {
				DDLogError("****** PIGeofencingManager.didProgress ExpirationHandler \(bkgTaskId)",asynchronous:false)
				let id = bkgTaskId
				bkgTaskId = UIBackgroundTaskInvalid
				application.endBackgroundTask(id)
			}
		}
		if bkgTaskId == UIBackgroundTaskInvalid {
			DDLogError("****** No background time for MFGeofencingManager.didProgress!!!",asynchronous:false)
		}

		DDLogVerbose("MFGeofencingManager.didProgress beginBackgroundTaskWithExpirationHandler \(bkgTaskId)",asynchronous:false)

		DDLogVerbose("MFGeofencingManager.didProgress \(progress)",asynchronous:false)

		let moc = dataController.writerContext
		moc.performBlock {
			let request = MFDownload.fetchRequest
			request.predicate = NSPredicate(format: "sessionIdentifier = %@ and taskIdentifier = %ld", session.configuration.identifier!,downloadTask.taskIdentifier)
			do {
				let downloads = try moc.executeFetchRequest(request) as! [MFDownload]
				guard let download = downloads.first  else {
					DDLogError("MFGeofencingManager.didReceiveFile download not found",asynchronous:false)
					return
				}
				guard downloads.count == 1 else {
					DDLogError("MFGeofencingManager.didReceiveFile more than one download!",asynchronous:false)
					return
				}
				download.progress = progress

				try moc.save()

			} catch {
				DDLogError("MFGeofencingManager.didReceiveFile error \(error)",asynchronous:false)
			}
			dispatch_async(dispatch_get_main_queue()) {
				if bkgTaskId != UIBackgroundTaskInvalid {
					DDLogVerbose("****** MFGeofencingManager.didProgress endBackgroundTask \(bkgTaskId)",asynchronous:false)
					let id = bkgTaskId
					bkgTaskId = UIBackgroundTaskInvalid
					application.endBackgroundTask(id)
				}
			}

		}
	}

	public func didCompleteWithError(session: NSURLSession, task: NSURLSessionTask, didCompleteWithError error: NSError?) {

		guard let _ = error else {
			return
		}

		let application = UIApplication.sharedApplication()
		var bkgTaskId = UIBackgroundTaskInvalid
		bkgTaskId = application.beginBackgroundTaskWithExpirationHandler {
			if bkgTaskId != UIBackgroundTaskInvalid {
				DDLogError("****** MFGeofencingManager.didCompleteWithError ExpirationHandler \(bkgTaskId)",asynchronous:false)
				let id = bkgTaskId
				bkgTaskId = UIBackgroundTaskInvalid
				application.endBackgroundTask(id)
			}
		}
		if bkgTaskId == UIBackgroundTaskInvalid {
			DDLogError("****** No background time for MFGeofencingManager.didCompleteWithError!!!")
		}

		DDLogVerbose("MFGeofencingManager.didCompleteWithError beginBackgroundTaskWithExpirationHandler \(bkgTaskId)",asynchronous:false)
		
		MFGeofencePreferences.downloadError()

		let moc = dataController.writerContext
		moc.performBlock {
			let request = MFDownload.fetchRequest
			request.predicate = NSPredicate(format: "sessionIdentifier = %@ and taskIdentifier = %ld", session.configuration.identifier!,task.taskIdentifier)
			do {
				let downloads = try moc.executeFetchRequest(request) as! [MFDownload]
				guard let download = downloads.first  else {
					DDLogError("MFGeofencingManager.didReceiveFile download not found",asynchronous:false)
					return
				}
				guard downloads.count == 1 else {
					DDLogError("MFGeofencingManager.didReceiveFile more than one download!",asynchronous:false)
					return
				}
				download.progressStatus = .NetworkError
				download.endDate = NSDate()

				try moc.save()

				let downloadURI = download.objectID.URIRepresentation()
				dispatch_async(dispatch_get_main_queue()) {
					let download = self.dataController.managedObjectWithURI(downloadURI) as! MFDownload

					self.delegate?.geofencingManager?(self, didReceiveDownload: download)
				}

			} catch {
				DDLogError("MFGeofencingManager.didReceiveFile error \(error)",asynchronous:false)
			}
			dispatch_async(dispatch_get_main_queue()) {
				if bkgTaskId != UIBackgroundTaskInvalid {
					DDLogVerbose("****** MFGeofencingManager.didCompleteWithError endBackgroundTask \(bkgTaskId)",asynchronous:false)
					let id = bkgTaskId
					bkgTaskId = UIBackgroundTaskInvalid
					application.endBackgroundTask(id)
				}
			}
		}
	}
	
	public func didReceiveFile(session: NSURLSession, downloadTask: NSURLSessionDownloadTask,geofencesURL:NSURL) {

		let application = UIApplication.sharedApplication()
		var bkgTaskId = UIBackgroundTaskInvalid
		bkgTaskId = application.beginBackgroundTaskWithExpirationHandler {
			if bkgTaskId != UIBackgroundTaskInvalid {
				DDLogError("****** MFGeofencingManager.didReceiveFile ExpirationHandler \(bkgTaskId)",asynchronous:false)
				let id = bkgTaskId
				bkgTaskId = UIBackgroundTaskInvalid
				application.endBackgroundTask(id)
			}
		}
		if bkgTaskId == UIBackgroundTaskInvalid {
			DDLogError("****** No background time for MFGeofencingManager.didReceiveFile!!!",asynchronous:false)
		}

		dispatch_async(dispatch_get_main_queue()) {
			self.stopMonitoringRegions()
			let moc = self.dataController.writerContext
			moc.performBlock {
				defer {
					moc.reset()
				}
				let request = MFDownload.fetchRequest
				request.predicate = NSPredicate(format: "sessionIdentifier = %@ and taskIdentifier = %ld", session.configuration.identifier!,downloadTask.taskIdentifier)
				do {
					let downloads = try moc.executeFetchRequest(request) as! [MFDownload]
					guard let download = downloads.first  else {
						MFGeofencePreferences.downloadError()
						DDLogError("MFGeofencingManager.didReceiveFile download not found")
						return
					}
					guard downloads.count == 1 else {
						MFGeofencePreferences.downloadError()
						DDLogError("MFGeofencingManager.didReceiveFile more than one download!")
						return
					}
					download.progressStatus = .Received
					download.progress = 1
					download.endDate = NSDate()
					download.url = geofencesURL.absoluteString
					try moc.save()
					var data:NSData? = nil
					do {
						data = try NSData(contentsOfURL: geofencesURL, options: .DataReadingMappedAlways)
						let anyObject = try NSJSONSerialization.JSONObjectWithData(data!, options: [])
						if let jsonObject = anyObject as? [String:AnyObject] {
							if let error = self.seedGeojson(moc, geojson: jsonObject)  {
								DDLogError("Geojson processing error \(error)")
								download.progressStatus = .ProcessingError
								MFGeofencePreferences.downloadError()
							} else {
								download.progressStatus = .Processed
								DDLogInfo("MFGeofencingManager.updateGeofences OK!!!",asynchronous:false)
								MFGeofencePreferences.resetDownloadErrors()
							}
						} else {
							DDLogError("MFGeofencingManager.updateGeofences Can't read json file: \(anyObject)")
							download.progressStatus = .ProcessingError
							MFGeofencePreferences.downloadError()
						}
					} catch {
						DDLogError("MFGeofencingManager.updateGeofences error \(error)")
						if let data = data {
							let stringFile = String(data:data,encoding: NSUTF8StringEncoding)
							DDLogError("MFGeofencingManager.updateGeofences json \(stringFile)")
						}
						download.progressStatus = .ProcessingError
						MFGeofencePreferences.downloadError()
					}
					try moc.save()
					let downloadURI = download.objectID.URIRepresentation()
					dispatch_async(dispatch_get_main_queue()) {
						let download = self.dataController.managedObjectWithURI(downloadURI) as! MFDownload
						self.delegate?.geofencingManager?(self, didReceiveDownload: download)
					}
				} catch {
					DDLogError("MFGeofencingManager.didReceiveFile error \(error)")
				}
				self.updateMonitoredGeofencesWithMoc(moc)
				dispatch_async(dispatch_get_main_queue()) {
					self.startMonitoringRegions()
					NSNotificationCenter.defaultCenter().postNotificationName(kGeofencingManagerDidSynchronize, object: nil)
					if bkgTaskId != UIBackgroundTaskInvalid {
						DDLogVerbose("****** MFGeofencingManager.didReceiveFile endBackgroundTask \(bkgTaskId)",asynchronous:false)
						let id = bkgTaskId
						bkgTaskId = UIBackgroundTaskInvalid
						application.endBackgroundTask(id)
					}
				}
			}
		}
	}

}