import {
  API,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';
import noble from '@abandonware/noble';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { LEDLightAccessory } from './platformAccessory';

/**
 * BluetoothLEDPlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class BluetoothLEDPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  public readonly accessories: PlatformAccessory[] = [];

  private connected: boolean = false;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.log.debug('Finished initializing platform:', this.config.name);

    // Start scanning for Bluetooth devices when Homebridge finishes launching
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  /**
   * Discover and register devices based on Bluetooth name from the config.
   */
  discoverDevices() {
    noble.on('stateChange', async (state) => {
      if (state === 'poweredOn') {
        await noble.startScanningAsync([], false);
      }
    });

    noble.on('discover', async (peripheral) => {
      if (this.connected) {
        return;
      }

      this.log.debug(
        `name: ${peripheral.advertisement.localName} uuid: ${peripheral.uuid}`,
      );

      // Match the Bluetooth name against the config
      if (peripheral.advertisement.localName === this.config.bluetoothName) {
        await noble.stopScanningAsync();
        this.log.success(
          `Connection OK! ${peripheral.advertisement.localName} ${peripheral.uuid}`,
        );

        const uuid = this.api.hap.uuid.generate(peripheral.uuid);

        const existingAccessory = this.accessories.find(
          (accessory) => accessory.UUID === uuid,
        );

        if (existingAccessory) {
          this.log.info(
            'Restoring existing accessory from cache:',
            existingAccessory.displayName,
          );
          new LEDLightAccessory(this, existingAccessory, peripheral);
        } else {
          this.log.info('Setting up new accessory:', peripheral.advertisement.localName);

          const accessory = new this.api.platformAccessory(
            peripheral.advertisement.localName || 'Bluetooth LED Light',
            uuid,
          );

          accessory.context.device = {
            uuid: peripheral.uuid,
            name: peripheral.advertisement.localName,
          };

          new LEDLightAccessory(this, accessory, peripheral);

          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
            accessory,
          ]);
          this.log.debug('Registration OK!');
        }
        this.connected = true;
        peripheral.disconnectAsync();
      }
    });
  }
}
