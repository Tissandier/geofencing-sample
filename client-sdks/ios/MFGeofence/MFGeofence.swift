/**
 *  MFGeofence
 *  MFGeofence.swift
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
import CoreLocation

/// Represents a geofence
public final class MFGeofence: ManagedObject {

    /// - returns: The coordinates of the center of this fence.
    public var coordinate:CLLocationCoordinate2D {
        return CLLocationCoordinate2D(latitude: self.latitude.doubleValue, longitude: self.longitude.doubleValue)
    }
}


extension MFGeofence: ManagedObjectType {
    
    public static var entityName: String {
        return "MFGeofence"
    }
    
}
