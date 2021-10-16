import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { LightBulbAccessory } from './accessories/LightbulbAccessory';
import { FroniusObject, Site } from './types/type';
import { HttpRequest } from './utils/httprequest';
import { CustomCharacteristic } from './CustomCharacteristic';

import fakegato from 'fakegato-history';
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class FroniusInverterEnergyPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public customCharacteristic: CustomCharacteristic;

  private FakeGatoHistoryService;
  private lastUpdate1min = new Date('2021-01-01');
  private lastUpdate9min = new Date('2021-01-01');
  private update1min=false;
  private update9min=false;
  private start = true;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.customCharacteristic = new CustomCharacteristic(api);

    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });

    this.FakeGatoHistoryService = fakegato(this.api);

    setInterval(() => {
      const httpRequest = new HttpRequest(this.config, log);

      httpRequest.GetStatusListForAll().then((results)=> {
        const now = new Date();
        const added1Min = new Date(this.lastUpdate1min.getTime()+(1*60000));
        const added9Min = new Date(this.lastUpdate9min.getTime()+(9*60000));

        if (now>added1Min) {
          this.lastUpdate1min = now;
          this.update1min = true;
        }

        if (now>added9Min) {
          this.lastUpdate9min = now;
          this.update9min = true;
        }

        const froniusObject = (<FroniusObject>results);

        if (froniusObject !== undefined && froniusObject.Body !== undefined &&
          froniusObject.Body.Data!==undefined && froniusObject.Body.Data.Site!==undefined) {

          const site = froniusObject.Body.Data.Site;

          const accessoryObject = this.getAccessory(site, 'inverter');
          const service = accessoryObject.accessory.getService(this.Service.Lightbulb);
          const serviceSensor = accessoryObject.accessory.getService(this.Service.LightSensor);
          if (service!==undefined && serviceSensor!==undefined) {
            const maxProduction = this.config['MaxProduction'];
            const power = site.P_PV;

            if (this.config['Debug'] as boolean) {
              this.log.info('Update current power', power);
            }

            serviceSensor.setCharacteristic(this.Characteristic.CurrentAmbientLightLevel, power);
            service.setCharacteristic(this.Characteristic.Brightness, power / maxProduction * 100);
            service.setCharacteristic(this.customCharacteristic.characteristic.ElectricPower, power);
            service.setCharacteristic(this.Characteristic.On, power>0);

            if (this.config['EveLoging'] as boolean && this.update1min) {
              if (this.start===true) {
                if (accessoryObject.accessory.context.fakeGatoService!==undefined) {
                  if (accessoryObject.accessory.context.fakeGatoService.isHistoryLoaded()) {
                    const extraPersistedData = accessoryObject.accessory.context.fakeGatoService.getExtraPersistedData();

                    if (extraPersistedData !== undefined) {
                      accessoryObject.accessory.context.totalenergy = extraPersistedData.totalenergy;
                      this.log.info(this.config['Name'] + ' - loading total energy from file ' +
                     accessoryObject.accessory.context.totalenergy+' kWh');
                    } else {
                      this.log.warn(this.config['Name'] + ' - starting new log for total energy in file!');
                      accessoryObject.accessory.context.fakeGatoService.setExtraPersistedData({ totalenergy:0, lastReset: 0 });
                    }
                  } else {
                    this.log.error(this.config['Name'] + ' - history not loaded yet!');
                  }
                }
              }

              const now = new Date().getTime();
              const refresh = (now - accessoryObject.accessory.context.lastUpdated)/ 1000;
              const add = (power / ((60 * 60) / (refresh)));
              const totalenergy = accessoryObject.accessory.context.totalenergy + add/1000;
              accessoryObject.accessory.context.lastUpdated = now;
              accessoryObject.accessory.context.totalenergy = totalenergy;

              if (this.config['Debug'] as boolean) {
                const totalenergyLog = Math.round(totalenergy* 100000) / 100000;

                this.log.info(accessoryObject.accessory.displayName +': '+ totalenergyLog +
                   ' kWh from '+accessoryObject.accessory.context.startTime.toISOString());
              }

              service.updateCharacteristic(this.customCharacteristic.characteristic.TotalPowerConsumption,
                accessoryObject.accessory.context.totalenergy);
            }

            if (this.config['EveLoging'] as boolean && this.update9min) {
              if (accessoryObject.accessory.context.fakeGatoService!==undefined) {
                accessoryObject.accessory.context.fakeGatoService.setExtraPersistedData({
                  totalenergy:accessoryObject.accessory.context.totalenergy});

                accessoryObject.accessory.context.fakeGatoService.addEntry({
                  time: Math.round(new Date().valueOf() / 1000),
                  power: Math.round(power),
                });
              }
            }
          }
        }
      });

      this.update1min= false;
      this.update9min= false;

    }, (this.config['UpdateTime'] as number) * 1000);

  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  discoverDevices() {
    const httpRequest = new HttpRequest(this.config, this.log);

    httpRequest.GetStatusListForAll().then((results)=> {
      const froniusObject = (<FroniusObject>results);

      if (froniusObject !== undefined && froniusObject.Body !== undefined &&
        froniusObject.Body.Data!==undefined && froniusObject.Body.Data.Site!==undefined) {

        const site = froniusObject.Body.Data.Site;

        const accessoryObject = this.getAccessory(site, 'inverter');
        new LightBulbAccessory(this, accessoryObject.accessory, site, this.config, this.log);
        this.addOrRestorAccessory(accessoryObject.accessory, this.config['Name'], 'inverter', accessoryObject.exists);

        if (this.config['EveLoging'] as boolean === true) {
          const fakeGatoService = new this.FakeGatoHistoryService('custom', accessoryObject.accessory,
            {log: this.log, storage: 'fs', disableTimer:true});

          accessoryObject.accessory.context.fakeGatoService = fakeGatoService;
        }

        this.accessories.forEach(accessory => {
          let found = false;

          if (accessory.UUID === this.localIdForType(site, 'inverter')) {
            found = true;
          }

          if (found === false || this.config['ClearAllAtStartUp'] as boolean) {
            this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            this.log.info('Removing existing accessory:', accessory.displayName);
          }
        });
      }
    });
  }

  public getAccessory(device: Site, type: string) {
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === this.localIdForType(device, type));

    if (existingAccessory!==undefined) {
      existingAccessory.displayName = this.config['Name'];

      return {accessory : existingAccessory, exists : true};
    }

    const accessory = new this.api.platformAccessory(this.config['Name'], this.localIdForType(device, type));
    accessory.context.device = device;

    return {accessory : accessory, exists : false};
  }

  public addOrRestorAccessory(accessory: PlatformAccessory<Record<string, unknown>>, name: string, type: string, exists: boolean ) {
    if (exists) {
      this.log.info('Restoring existing accessory:', name +' ('+type+')');
      this.api.updatePlatformAccessories([accessory]);
    } else {
      this.log.info('Adding new accessory:', name +' ('+type+')');
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }

  localIdForType(device:Site, type:string):string {
    return this.api.hap.uuid.generate(this.config['Name']+'_'+type);
  }
}
