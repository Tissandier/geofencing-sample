/**
*  MFGeofence
*  MFDownload
*
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
import CoreData


public enum MFDownloadProgressStatus:Int16 {
	case NoStarted
	case InProgress
	case Received
	case Processed
	case ProcessingError
	case NetworkError
}

extension MFDownloadProgressStatus:CustomStringConvertible {
	public var description:String {
		switch self {
		case .NoStarted: return "NoStarted"
		case .InProgress: return "InProgress"
		case .Received: return "Received"
		case .Processed : return "Processed"
		case .ProcessingError: return "ProcessingError"
		case .NetworkError: return "NetworkError"
		}
	}
}

public class MFDownload: ManagedObject {

	public var progressStatus:MFDownloadProgressStatus {
		get {
			willAccessValueForKey("progressStatus")
			let value = self.primitiveProgressStatus.shortValue
			didAccessValueForKey("progressStatus")
			return MFDownloadProgressStatus(rawValue: value)!
		}

		set {
			willChangeValueForKey("progressStatus")
			self.primitiveProgressStatus = NSNumber(short: newValue.rawValue)
			didChangeValueForKey("progressStatus")
		}
	}

}

extension MFDownload: ManagedObjectType {

	static public var entityName: String {
		return "MFDownload"
	}

}
