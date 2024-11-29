import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';

import axios from 'axios'; // Make sure to install axios: npm install axios
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

export class ExampleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // Store the single router accessory
  private routerAccessory: PlatformAccessory | undefined;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      this.setupRouterAccessory();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // Store the accessory for later use
    this.routerAccessory = accessory;
  }

  /**
   * Set up a single accessory representing the router.
   */
  private setupRouterAccessory() {
    const routerDisplayName = 'Router';
    const uuid = this.api.hap.uuid.generate(routerDisplayName);

    // Check if the router accessory already exists in the cache
    if (this.routerAccessory) {
      this.log.info('Restoring existing router accessory from cache:', this.routerAccessory.displayName);
    } else {
      this.log.info('Adding new router accessory:', routerDisplayName);

      // Create a new accessory
      const accessory = new this.api.platformAccessory(routerDisplayName, uuid);
      accessory.context.device = { name: routerDisplayName };

      // Add a service to the accessory
      const routerService =
        accessory.getService(this.Service.Switch) ||
        accessory.addService(this.Service.Switch, 'Router Status');

      // Set up characteristics (e.g., On/Off for online status)
      routerService
        .getCharacteristic(this.Characteristic.On)
        .onGet(this.getRouterOnlineStatus.bind(this)); // Optional for control

      // Store the accessory
      this.routerAccessory = accessory;

      // Register the accessory
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }

    // Start updating router stats periodically
    this.updateRouterStats();
  }

  /**
   * Fetch router stats and update HomeKit characteristics.
   */
  private async updateRouterStats() {
    if (!this.routerAccessory) {
      this.log.error('Router accessory not initialized.');
      return;
    }

    const routerService = this.routerAccessory.getService(this.Service.Switch);
    if (!routerService) {
      this.log.error('Router service not found.');
      return;
    }

    setInterval(async () => {
      try {
        const stats = await this.fetchRouterStats();
        this.log.debug('Router stats fetched:', stats);

        // Update characteristics based on stats
        routerService.updateCharacteristic(this.Characteristic.On, stats.online);
      } catch (error) {
        this.log.error('Error fetching router stats:', (error as Error).message);
      }
    }, 60000); // Update every 60 seconds
  }

  /**
   * Fetch router stats.
   * Replace this with your actual logic to connect to the router.
   */
  private async fetchRouterStats(): Promise<{ online: boolean }> {
    try {
      // Replace with your router's IP or admin URL
      const routerUrl = `http://${this.config.routerIP}/status`;

      // Use Axios to fetch the data
      const response = await axios.get(routerUrl, {
        auth: {
          username: this.config.username,
          password: this.config.password,
        },
      });

      // Parse the response data and extract required stats
      const data = response.data;
      this.log.debug('Router response:', data);

      // Example: Check the router's online status
      return { online: data.online }; // Adjust based on your router's API
    } catch (error) {
      this.log.error('Error failed to fetch router stats:', (error as Error).message);
      return { online: false }; // Default to offline on error
    }
  }

  /**
   * Handle "On" characteristic get request.
   */
  private async getRouterOnlineStatus(): Promise<boolean> {
    try {
      const stats = await this.fetchRouterStats();
      return stats.online;
    } catch {
      return false; // Assume offline on error
    }
  }

  /**
   * Handle "On" characteristic set request.
   * Optionally implement router control if supported.
   */
  private async setRouterOnlineStatus(value: boolean) {
    this.log.info('Set router online status:', value);
    // Implement control logic if needed
  }
}
