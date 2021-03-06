/**
 *  IBMPIGeofence
 *  PIGeofencingManager.swift
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


import Foundation
import CoreLocation
import CoreData
import MapKit
import CocoaLumberjack


public let kGeofencingManagerDidSynchronize = "com.ibm.mf.GeofencingManagerDidSynchronize"

@objc
public protocol MFGeofencingManagerDelegate:class {
    /// The device enters into a geofence
    func geofencingManager(manager: MFGeofencingManager, didEnterGeofence geofence: MFGeofence? )
    /// The device exits a geofence
    func geofencingManager(manager: MFGeofencingManager, didExitGeofence geofence: MFGeofence? )

	optional func geofencingManager(manager: MFGeofencingManager, didStartDownload download: MFDownload)
	optional func geofencingManager(manager: MFGeofencingManager, didReceiveDownload download: MFDownload)


}

/// `PIGeofencingManager` is your entry point to the PI Geofences.
/// Its responsability is to monitor the PI geofences. 
/// When the user enters or exits a geofence, `PIGeofencingManager` notifies
/// the Presence Insights backend
public final class MFGeofencingManager:NSObject {

	/// When `true`, the `PIGeofencingManager`does not post event against PIT backend
	public var privacy = false

    /// By default, `PIGeofencingManager` can monitore up to 15 regions simultaneously.
    public static let DefaultMaxRegions = 15
    
    let locationManager = CLLocationManager()

	/// Maximum of consecutive retry for downloading geofence definitions from PI
	/// We wait for one hour between each retry
	public var maxDownloadRetry:Int {
		set {
			MFGeofencePreferences.maxDownloadRetry = newValue
		}
		get {
			return MFGeofencePreferences.maxDownloadRetry
		}
	}

	/// Number of days between each check against PI for downloading the geofence definitions
	public var intervalBetweenDownloads = 1

    var regions:[String:CLCircularRegion]?
    
    /// The length of the sides of the bounding box used to find out
    /// which fences should be monitored.
    public let maxDistance:Int
    
    /// Maximum number of regions which can be monitored simultaneously.
    public let maxRegions:Int
    
    public lazy var dataController = MFGeofenceData.dataController

	/// MF Service
    let service:MFService
    
    public weak var delegate:MFGeofencingManagerDelegate?
    /// Create a `MFGeofencingManager`
	/// This initializer must be called in the main thread
    /// - parameter baseURL: Bluemix end point
    /// - parameter username: Bluemix username
    /// - parameter password: Bluemix password
    /// - parameter maxDistance: When a significant change location is triggered,
    /// `PIGeofencingManager` search for geofences within a square of side length 
    /// of maxDistance meters.
    /// - parameter maxRegions: The maximum number of regions being monitored at any time. The system
    /// limit is 20 regions per app. Default is 15
	public init(baseURL:String,username:String, password:String,maxDistance:Int = 10_000, maxRegions:Int = DefaultMaxRegions ) {


        self.maxDistance = maxDistance
        if (1...20).contains(maxRegions) {
            self.maxRegions = maxRegions
        } else {
            DDLogError("maxRegions \(maxRegions) is out of range",asynchronous:false)
            self.maxRegions = self.dynamicType.DefaultMaxRegions
        }
        self.service = MFService(baseURL:baseURL,username:username,password:password)
        super.init()
		
        self.locationManager.delegate = self

		self.service.delegate = self
		
        NSNotificationCenter.defaultCenter().addObserver(
			self,
			selector: #selector(MFGeofencingManager.didBecomeActive(_:)),
			name: UIApplicationWillEnterForegroundNotification,
			object: nil)
        
        NSNotificationCenter.defaultCenter().addObserver(
			self,
			selector: #selector(MFGeofencingManager.willResignActive(_:)),
			name: UIApplicationDidEnterBackgroundNotification,
			object: nil)
        
    }


    /// Enables or disables the logging
    /// - parameter enable: `true` to enable the logging
    public static func enableLogging(enable:Bool) {
        
        if enable {
            DDLog.addLogger(DDTTYLogger.sharedInstance()) // TTY = Xcode console
            DDLog.addLogger(DDASLLogger.sharedInstance()) // ASL = Apple System Logs
            
			let documentsFileManager = DDLogFileManagerDefault(logsDirectory:GeofenceUtils.documentsDirectory.path,defaultFileProtectionLevel:NSFileProtectionNone)

            let fileLogger: DDFileLogger = DDFileLogger(logFileManager: documentsFileManager) // File Logger
            fileLogger.rollingFrequency = 60*60*24  // 24 hours
            fileLogger.logFileManager.maximumNumberOfLogFiles = 7
            DDLog.addLogger(fileLogger)
        } else {
            DDLog.removeAllLoggers()
        }
    }

	public static func logFiles() -> [String] {
		let documentsFileManager = DDLogFileManagerDefault(logsDirectory:GeofenceUtils.documentsDirectory.path)

		return documentsFileManager.sortedLogFilePaths().map { String($0) }

	}

    /**
     Ask the back end for the latest geofences to monitor
     - parameter completionHandler:  The closure called when the synchronisation is completed
     */
	public func synchronize(completionHandler: ((Bool)-> Void)? = nil) {
		let request = MFGeofenceFencesDownloadRequest(lastSyncDate:MFGeofencePreferences.lastSyncDate)
		guard let response = service.executeDownload(request) else {
			completionHandler?(false)
			return
		}

		let moc = dataController.writerContext
		moc.performBlock {
			let download:MFDownload = moc.insertObject()

			download.sessionIdentifier = response.backgroundSessionIdentifier
			download.taskIdentifier = response.taskIdentifier
			download.progressStatus = .InProgress
			download.startDate = NSDate()
			do {
				try moc.save()
				let downloadURI = download.objectID.URIRepresentation()
				dispatch_async(dispatch_get_main_queue()) {
					let download = self.dataController.managedObjectWithURI(downloadURI) as! MFDownload
					self.delegate?.geofencingManager?(self, didStartDownload: download)
					completionHandler?(true)
				}
			} catch {
				DDLogError("Core Data Error \(error)",asynchronous:false)
				completionHandler?(false)
			}
		}

    }

	public func handleEventsForBackgroundURLSession(identifier: String, completionHandler: () -> Void) -> Bool {

		DDLogInfo("MFGeofencingManager.handleEventsForBackgroundURLSession",asynchronous:false)
		guard identifier.hasPrefix("com.ibm.MF") else {
			DDLogInfo("Not a MFbackgroundURLSession",asynchronous:false)
			return false
		}

		self.service.backgroundURLSessionCompletionHandler = completionHandler
		let config = NSURLSessionConfiguration.backgroundSessionConfigurationWithIdentifier(identifier)

		let session = NSURLSession(configuration: config, delegate: self.service, delegateQueue: nil)
		self.service.backgroundPendingSessions.insert(session)


		return true
	}

    func didBecomeActive(notification:NSNotification) {
    }
    
    /**
     Cancel all pending request when the app is going to background
     */
    func willResignActive(notification:NSNotification) {
        self.service.cancelAll()
    }
    
    ///
    /// - parameter code:   The code of the geofence to remove
	/// - parameter completionHandler: closure invoked on completion
	///
    func removeGeofence(code:String,completionHandler: ((Bool) -> Void)? = nil) {
        let geofenceDeleteRequest = MFGeofenceDeleteRequest(geofenceCode: code) {
            response in
            switch response.result {
            case .OK?:
                DDLogInfo("PIGeofenceDeleteRequest OK",asynchronous:false)
                let moc = self.dataController.writerContext
                moc.performBlock {
                    do {
                        let fetchRequest =  MFGeofence.fetchRequest
                        fetchRequest.predicate = NSPredicate(format: "code == %@",code)
                        guard let geofences = try moc.executeFetchRequest(fetchRequest) as? [MFGeofence] else {
                            DDLogError("Programming error",asynchronous:false)
                            fatalError("Programming error")
                        }
                        
                        guard let geofence = geofences.first else {
                            DDLogError("Programming error",asynchronous:false)
                            fatalError("Programming error")
                        }
                        DDLogInfo("Delete fence \(geofence.name) \(geofence.code)",asynchronous:false)
                        moc.deleteObject(geofence)
                        
                        try moc.save()
                        

						if let region = self.regions?[code] {
							self.regions?.removeValueForKey(code)
							self.locationManager.stopMonitoringForRegion(region)
							DDLogVerbose("Stop monitoring \(region.identifier)",asynchronous:false)
						}
						
						self.updateMonitoredGeofencesWithMoc(moc)
						dispatch_async(dispatch_get_main_queue()) {
                            completionHandler?(true)
                        }
                        
                    } catch {
                        DDLogError("Core Data Error \(error)",asynchronous:false)
                        assertionFailure("Core Data Error \(error)")
                    }
                }
                
            case .Cancelled?:
                DDLogVerbose("PIGeofenceDeleteRequest cancelled",asynchronous:false)
                dispatch_async(dispatch_get_main_queue()) {
                    completionHandler?(false)
                }
            case let .Error(error)?:
                DDLogError("PIGeofenceDeleteRequest error \(error)",asynchronous:false)
                dispatch_async(dispatch_get_main_queue()) {
                    completionHandler?(false)
                }
            case let .Exception(error)?:
                DDLogError("PIGeofenceDeleteRequest exception \(error)",asynchronous:false)
                dispatch_async(dispatch_get_main_queue()) {
                    completionHandler?(false)
                }
            case let .HTTPStatus(status,_)?:
                DDLogError("PIGeofenceDeleteRequest status \(status)",asynchronous:false)
                dispatch_async(dispatch_get_main_queue()) {
                    completionHandler?(false)
                }
            case nil:
                assertionFailure("Programming Error")
                dispatch_async(dispatch_get_main_queue()) {
                    completionHandler?(false)
                }
            }
        }
        
        self.service.executeRequest(geofenceDeleteRequest)
        
    }
    
    /**
     Add a `local` geofence, that is a geofence that is not defined by the backend
     - parameter name:   Name of the geofence
     - parameter center: The position of the center of the fence
     - parameter radius: The radius of the fence, should be larger than 200 m
     - parameter completionHandler:  Closure to be called when the fence has been added
     */
    func addGeofence(name:String,center:CLLocationCoordinate2D,radius:Int,completionHandler: ((MFGeofence?) -> Void)? = nil) {
        
        let geofenceCreateRequest = MFGeofenceCreateRequest(geofenceName: name, geofenceDescription: nil, geofenceRadius: radius, geofenceCoordinate: center) {
            response in
            switch response.result {
            case .OK?:
                DDLogVerbose("MFGeofenceCreateRequest OK \(response.geofenceCode)",asynchronous:false)
                guard let geofenceCode = response.geofenceCode else {
                    DDLogError("MFGeofenceCreateRequest Missing fence Id")
                    completionHandler?(nil)
                    return
                }
                
                let moc = self.dataController.writerContext
                
                moc.performBlock {
                    
                    let geofence:MFGeofence = moc.insertObject()
                    geofence.name = name
                    geofence.radius = radius
                    geofence.code = geofenceCode
                    geofence.latitude = center.latitude
                    geofence.longitude = center.longitude
                    
                    do {
                        try moc.save()
						self.updateMonitoredGeofencesWithMoc(moc)
                        let geofenceURI = geofence.objectID.URIRepresentation()
                        dispatch_async(dispatch_get_main_queue()) {
                            let geofence = self.dataController.managedObjectWithURI(geofenceURI) as! MFGeofence
                            completionHandler?(geofence)
                        }
                    } catch {
                        DDLogError("Core Data Error \(error)")
                        assertionFailure("Core Data Error \(error)")
                        dispatch_async(dispatch_get_main_queue()) {
                            completionHandler?(nil)
                        }
                    }
                    
                }
                
                
            case .Cancelled?:
                DDLogVerbose("MFGeofenceCreateRequest Cancelled",asynchronous:false)
                dispatch_async(dispatch_get_main_queue()) {
                    completionHandler?(nil)
                }
            case let .Error(error)?:
                DDLogError("MFGeofenceCreateRequest Error \(error)")
                dispatch_async(dispatch_get_main_queue()) {
                    completionHandler?(nil)
                }
            case let .Exception(error)?:
                DDLogError("MFGeofenceCreateRequest Exception \(error)")
                dispatch_async(dispatch_get_main_queue()) {
                    completionHandler?(nil)
                }
            case let .HTTPStatus(status,_)?:
                DDLogError("MFGeofenceCreateRequest Status \(status)")
                dispatch_async(dispatch_get_main_queue()) {
                    completionHandler?(nil)
                }
            case nil:
                assertionFailure("Programming Error")
                dispatch_async(dispatch_get_main_queue()) {
                    completionHandler?(nil)
                }
            }
        }
        
        service.executeRequest(geofenceCreateRequest)
        
    }
    
    /// - returns: The list of all the fences
    public func queryAllGeofences() -> [MFGeofence] {
        let moc = self.dataController.mainContext
        let fetchRequest = MFGeofence.fetchRequest
        do {
            guard let geofences = try moc.executeFetchRequest(fetchRequest) as? [MFGeofence] else {
                DDLogError("Programming Error")
                assertionFailure("Programming error")
                return []
            }
            return geofences
        } catch {
            DDLogError("Core Data Error \(error)")
            assertionFailure("Core Data Error \(error)")
            return []
        }
        
    }
    
	/// - parameter code:   the code of the fence we are asking for
	///
	/// - returns: the geofence with the given code or nil if not found
    public func queryGeofence(code:String) -> MFGeofence? {
        let moc = self.dataController.mainContext
        let fetchRequest = MFGeofence.fetchRequest
        fetchRequest.predicate = NSPredicate(format: "code = %@", code)
        do {
            guard let geofences = try moc.executeFetchRequest(fetchRequest) as? [MFGeofence] else {
                DDLogError("Programming Error",asynchronous:false)
                assertionFailure("Programming error")
                return nil
            }
            guard let geofence = geofences.first else {
                return nil
            }
            return geofence
        } catch {
            DDLogError("Core Data Error \(error)")
            assertionFailure("Core Data Error \(error)")
            return nil
        }
    }
    
    
    /**
     - returns: `true` indicates that this is the first time this `GeofencingManager`is used
     */
    public var firstTime:Bool {

        return !dataController.isStorePresent

    }

    public func currentGeofence(completionHandler:(geofence:MFGeofence?) -> Void) {

        guard let currentPosition = locationManager.location else {
            completionHandler(geofence: nil)
            return
        }

        // Compute North East and South West coordinates of the bbox of the regions
        // which could be monitored
        let region = MKCoordinateRegionMakeWithDistance(currentPosition.coordinate, Double(maxDistance), Double(maxDistance))

        let nw_lat_ = region.center.latitude + 0.5 * region.span.latitudeDelta
        let nw_lon_ = region.center.longitude - 0.5 * region.span.longitudeDelta
        let se_lat_ = region.center.latitude - 0.5 * region.span.latitudeDelta
        let se_lon_ = region.center.longitude + 0.5 * region.span.longitudeDelta

        let nw = CLLocationCoordinate2D(latitude: nw_lat_, longitude: nw_lon_)
        let se = CLLocationCoordinate2D(latitude: se_lat_, longitude: se_lon_)

        let moc = self.dataController.writerContext

        moc.performBlock {
            do {
                // find the geofences in the bbox of the current position
                let fetchRequest = MFGeofence.fetchRequest
                // We will need to access properties of all returned objects
                fetchRequest.returnsObjectsAsFaults = false
                // Filter out regions which are too far
                fetchRequest.predicate = NSPredicate(format: "latitude < \(nw.latitude) and latitude > \(se.latitude) and longitude > \(nw.longitude) and longitude < \(se.longitude)")
                guard let nearFences = try moc.executeFetchRequest(fetchRequest) as? [MFGeofence] else {
                    fatalError("Programming error, shouldn't be there")
                }
                
                // Sort fences in ascending order starting from the nearest fence
                let sortedFences = nearFences.sort(self.compareGeofence(currentPosition))
                
                for geofence in sortedFences {
                    let geofenceLocation = CLLocation(latitude: geofence.latitude.doubleValue, longitude: geofence.longitude.doubleValue)
                    let distance = currentPosition.distanceFromLocation(geofenceLocation)
                    if distance < geofence.radius.doubleValue {
                        let geofenceURI = geofence.objectID.URIRepresentation()
                        dispatch_async(dispatch_get_main_queue()){
                            let geofenceUI = self.dataController.managedObjectWithURI(geofenceURI) as! MFGeofence
                            completionHandler(geofence: geofenceUI)
                        }
                        return
                    }
                }
                
                dispatch_async(dispatch_get_main_queue()) {
                    completionHandler(geofence: nil)
                }
                
                
            } catch {
                DDLogError("Core Data Error \(error)")
                assertionFailure("Core Data Error \(error)")
                completionHandler(geofence: nil)
            }
        }
    }
    
}

