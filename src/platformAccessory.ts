import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import noble, { Peripheral, Characteristic } from '@abandonware/noble';
import { BluetoothLEDPlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LEDLightAccessory {
  private service: Service;
  
  private characteristic?: Characteristic;
  private connected: boolean = false;
  
  private peripheralInstance?: Peripheral; // Use a separate variable to hold the peripheral reference

  constructor(
    private readonly platform: BluetoothLEDPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly peripheral: Peripheral, // Read-only property, do not reassign
  ) {
    // Set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Your Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'LED Light Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, peripheral.uuid);

    // Get the LightBulb service, or create a new one if it doesn't exist
    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    // Set the service name (this is shown in the Home app)
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name,
    );

    // Register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    // Start scanning for Bluetooth devices
    noble.on('stateChange', async (state) => {
      if (state === 'poweredOn') {
        await noble.startScanningAsync([], false);
      }
    });

    noble.on('discover', async (discoveredPeripheral) => {
      if (discoveredPeripheral.uuid === this.accessory.context.device.uuid) {
        await noble.stopScanningAsync();
        this.peripheralInstance = discoveredPeripheral; // Store peripheral in a separate variable
        discoveredPeripheral.disconnectAsync();
      }
    });
  }

  async connectToDevice() {
    if (!this.peripheralInstance) {
      await noble.startScanningAsync();
      return;
    }

    await this.peripheralInstance.connectAsync();
    this.connected = true;

    // Discover services and characteristics
    const { characteristics } = await this.peripheralInstance.discoverSomeServicesAndCharacteristicsAsync(
      ['LED_SERVICE_UUID'], // Replace with actual service UUID
      ['LED_CHARACTERISTIC_UUID'], // Replace with actual characteristic UUID
    );
    this.characteristic = characteristics[0];
    this.platform.log.debug('Connected to LED device');
  }

  async setOn(value: CharacteristicValue) {
    if (!this.connected) {
      await this.connectToDevice();
    }
    if (!this.characteristic) {
      return;
    }

    const data = Buffer.from(value ? '01' : '00', 'hex'); // Example on/off command
    this.characteristic.write(data, true, (error) => {
      if (error) {
        this.platform.log.error('Error writing characteristic:', error);
      } else {
        this.platform.log.debug(`Set Characteristic On -> ${value}`);
      }
    });
  }

  async getOn(): Promise<CharacteristicValue> {
    const isOn = this.connected ? true : false; // Adjust logic as needed
    this.platform.log.debug('Get Characteristic On ->', isOn);
    return isOn;
  }
}
