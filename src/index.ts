import { API } from 'homebridge';
import { BluetoothLEDPlatform } from './platform';  // Update import to the correct class name

import { PLUGIN_NAME, PLATFORM_NAME } from './settings';

// Default export of the platform
export default (api: API) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, BluetoothLEDPlatform);  // Register NetworkMonitorPlatform
};
