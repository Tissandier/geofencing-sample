/**
*  MFGeofence
*  MFGeofencePreferences.swift
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

private let kLastDownloadDate = "com.ibm.LastDownloadDate"
private let kLastDownloadErrorDate = "com.ibm.lastDownloadErrorDate"
private let kErrorDownloadCountKey = "com.ibm.downloads.errorCount"
private let kLastSyncDate = "com.ibm.downloads.lastSyncDate"
private let kMaxDownloadRetry = "com.ibm.downloads.maxDownloadRetry"

struct MFGeofencePreferences {
	static var lastDownloadDate:NSDate? {
		set {
			if let newValue = newValue {
				MFUnprotectedPreferences.sharedInstance.setObject(newValue, forKey: kLastDownloadDate)
			} else {
				MFUnprotectedPreferences.sharedInstance.removeObjectForKey(kLastDownloadDate)
			}
		}
		get {
			return MFUnprotectedPreferences.sharedInstance.objectForKey(kLastDownloadDate) as? NSDate
		}
	}

	static var lastDownloadErrorDate:NSDate? {
		set {
			if let newValue = newValue {
				MFUnprotectedPreferences.sharedInstance.setObject(newValue, forKey: kLastDownloadErrorDate)
			} else {
				MFUnprotectedPreferences.sharedInstance.removeObjectForKey(kLastDownloadErrorDate)
			}
		}
		get {
			return MFUnprotectedPreferences.sharedInstance.objectForKey(kLastDownloadErrorDate) as? NSDate
		}
	}

	static var downloadErrorCount:Int? {
		set {
			if let newValue = newValue {
				MFUnprotectedPreferences.sharedInstance.setInteger(newValue, forKey: kErrorDownloadCountKey)
			} else {
				MFUnprotectedPreferences.sharedInstance.removeObjectForKey(kErrorDownloadCountKey)
			}
		}
		get {
			return MFUnprotectedPreferences.sharedInstance.integerForKey(kErrorDownloadCountKey)
		}
	}

	static func resetDownloadErrors() {
		downloadErrorCount = nil
		// We stop retrying
		lastDownloadErrorDate = nil
		lastDownloadDate = NSDate()
		synchronize()
	}

	static func downloadError() {
		guard downloadErrorCount < maxDownloadRetry else {
			DDLogError("Too many errors for the download, wait until tomorrow")
			resetDownloadErrors()
			return
		}
		// Reset the lastDownloadDate so we can try again when
		// a significant change is triggered
		lastDownloadDate = nil
		lastDownloadErrorDate = NSDate()
		downloadErrorCount = (downloadErrorCount ?? 0) + 1
		synchronize()
	}

	static var lastSyncDate:NSDate? {
		set {
			if let newValue = newValue {
				MFUnprotectedPreferences.sharedInstance.setObject(newValue, forKey: kLastSyncDate)
			} else {
				MFUnprotectedPreferences.sharedInstance.removeObjectForKey(kLastSyncDate)
			}
			synchronize()
		}
		get {
			return MFUnprotectedPreferences.sharedInstance.objectForKey(kLastSyncDate) as? NSDate
		}
	}

	static func synchronize() {
		MFUnprotectedPreferences.sharedInstance.synchronize()
	}

	static var maxDownloadRetry:Int {
		set {
			MFUnprotectedPreferences.sharedInstance.setInteger(newValue, forKey: kMaxDownloadRetry)
			synchronize()
		}
		get {
			let max = MFUnprotectedPreferences.sharedInstance.integerForKey(kMaxDownloadRetry) ?? 10
			return max
		}
	}

	static func reset() {
		self.lastDownloadDate = nil
		self.lastDownloadErrorDate = nil
		self.downloadErrorCount = nil
		self.lastSyncDate = nil
		synchronize()
	}

}