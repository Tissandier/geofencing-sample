# geofencing-sample

***Readme is a work in progress***

**Geofence RESTFUL API**

_This API permits to perform geofence CRUD operations on a backend Cloudant DB._


| Route             | HTTP Verb | Description           |
| :---              |     :---: |          ---:         |
| /geofences        | GET       | Get all the geofences |
| /geofences        | POST      | Create a geofence (Feature) or a bunch of geofences (FeatureCollection)    |
| /geofences/:id    | GET       | Get a single geofence |
| /geofences/:id    | PUT       | Update  geofence info |
| /geofences/:id    | DELETE    | Delete a geofence     |
| /events           | POST      | Posts enter or exit events for a given device in a given geofence. |


Geofence sample payload of the `/geofences` endpoint:


```
{
   "type": "Feature",
   "geometry": {
      "type": "Point",
      "coordinates": [ Longitude, Latitude ]
   },
   "properties":{
      "name": "String",
      "description": "String",
      "radius": Number

   }
}
```
The Payload must be a valid [GeoJSON Objects](http://geojson.org/):

⋅⋅*`coordinates`  the "coordinates" member must be a single point. It indicates the center point of the fence.

⋅⋅*`radius` must be a number that provide the threshold in meters to define the fence perimeter.  Default value is 100.



Sample payload of the `/events` endpoint:

```
{
  "notifications": [
    {
      "descriptor": "072bad9d-8b76-43b1-b2f4-7b28b1e8a9dd",
      "detectedTime": "2016-01-07T04:14:00+00:00",
      "data": {
        "geofenceCode": "2b9a7d",
        "crossingType": "enter"
      }
    }
  ]
}
```

Details about the fields of the `/events` payload:

| Field          |  Type  | Description |
|:---------------|:-------|:------------|
|  descriptor    | string | Uniquely identifies the device reporting the event. |
|  detectedTime  | string | Represents the specific time stamp when the device detected the fence. The format is ISO 8601, for instance "2016-08-16T13:29:20.575Z". |
|  geofenceCode  | string | Unique identifier of the geofence. |
|  crossingType  | string | The type of the crossing event: "enter" or "exit". |



**Geofence UI**

A simple UI allows you to create, edit, delete, import and export geofences.

***Creating a geofence***
To create a geofence, you must click on the `Add geofence` button, and then click on the map where you want to drop the geofence.
If you want to abort the creation process, press the ESC key on the keyboard.

***Editing geofences***
You can edit geofences either by interacting directly on the map to update their position and radius, ot by using the form on the right pane. To set the geofence name, you must use the form. Any change is automatically saved on the server side.

***Deleting a geofence***
To delete a geofence, you must click on the trash icon in the table row corresponding to the geofence to delete. A modal dialog will ask you for confirmation before processing the deletion.

***Importing geofences***
The UI also allows you to import geofences from a GeoJSON file. Only 'Point' typed features will be taken into account for the import, other feature types found in the GeoJSON file will be ignored.
To import geofences, click on the `Import geofences` button. A modal dialog will appear where you will have to choose a GeoJSON file to upload. You can also choose which default values you want for name and radius, in case these would not be set in the GeoJSON features found in the GeoJSON file.
Once you have properly set the modal dialog form, click on the 'Upload' button. The GeoJSON file will be uploaded and parsed to preview the fences to import in the map.
You must now choose if you want to complete the import process and save the fences on the server-side, or if you want to cancel the import process, by clicking either on the `Save Import` button or on the `Cancel Import` button.


***Exporting geofences***
To export the geofences in a GeoJSON file, just click on the `Export geofences` button.
