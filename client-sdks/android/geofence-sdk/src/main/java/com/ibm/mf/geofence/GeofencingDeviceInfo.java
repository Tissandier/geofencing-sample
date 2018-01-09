/**
 * Copyright (c) 2015, 2016 IBM Corporation. All rights reserved.
 * <p/>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p/>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p/>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ibm.mf.geofence;

import android.content.Context;

/**
 * This class serves solely to make the descriptor accessible
 */
class GeofencingDeviceInfo {
    // shared prefs or settings
    /**
     * The name of the shared preferences file where the descriptor is stored.
     */
    static final String SHARED_PREF = "default_shared_prefs";
    /**
     * The name of the descritpor key in the sghared preferences (also used in the settings).
     */
    static final String DESCRIPTOR_KEY = "device_descriptor";
    private final Context context;
    private String descriptor;

    GeofencingDeviceInfo(Context context) {
        this.context = context;
        descriptor = android.provider.Settings.Secure.getString(this.context.getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
    }

    protected String getDescriptor() {
        return descriptor;
    }
}
