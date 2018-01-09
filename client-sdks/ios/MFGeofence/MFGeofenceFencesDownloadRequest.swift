/**
*  MFGeofence
*  MFGeofenceFencesDownloadRequest.swift
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



import Foundation
import CocoaLumberjack

/// Get the geofences defined on the MF backend
public final class MFGeofenceFencesDownloadRequest:NSObject,MFDownloadRequest {

	let lastSyncDate:NSDate?

	public init(lastSyncDate:NSDate?) {
		self.lastSyncDate = lastSyncDate
	}

	public func executeDownload(service:MFService) -> MFDownloadResponse? {

		DDLogVerbose("MFGeofenceFencesDownloadRequest.executeDownload",asynchronous:false)

		let path = "geofences"
		let url = NSURL(string:path,relativeToURL:service.baseURL)
		let URLComponents = NSURLComponents(URL:url!,resolvingAgainstBaseURL:true)!

		DDLogInfo("MFGeofenceFencesDownloadRequest \(URLComponents.URL!)",asynchronous:false)

		let request = NSMutableURLRequest(URL: URLComponents.URL!)
		GeofenceUtils.setBasicAuthHeader(request, username: service.username, password: service.password)

		let task = service.backgroundServiceSession.downloadTaskWithRequest(request)
		task.taskDescription = "MFGeofenceFencesDownloadRequest"
		task.resume()
		let taskIdentifier = task.taskIdentifier
		guard let backgroundSessionIdentifier = service.backgroundServiceSession.configuration.identifier else {
			DDLogError("No Background session identifier")
			return nil
		}

		return MFDownloadResponse(backgroundSessionIdentifier: backgroundSessionIdentifier, taskIdentifier: taskIdentifier)
	}
}