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
  private lastUpdate10min = new Date('2021-01-01');
  private update1min=false;
  private update10min=false;
  private start = true;
  private pauseToTime = new Date();
  private callingService = false;

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
      if (this.pauseToTime<new Date() && this.callingService===false) {

        const httpRequest = new HttpRequest(this.config, log);

        this.callingService = true;

        httpRequest.GetStatusListForAll().then((results)=> {
          const now = new Date();
          const added1Min = new Date(this.lastUpdate1min.getTime()+(1*60000));
          const added10Min = new Date(this.lastUpdate10min.getTime()+(10*60000));

          if (now>added1Min) {
            this.lastUpdate1min = now;
            this.update1min = true;
          }

          if (now>added10Min) {
            this.lastUpdate10min = now;
            this.update10min = true;
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
              let power = site.P_PV;

              if (site.P_PV===null) {
                power=0;
              }

              if (this.config['Debug'] as boolean) {
                this.log.info('Update current power', power);
              }

              serviceSensor.setCharacteristic(this.Characteristic.CurrentAmbientLightLevel, power>0?power: 0.0001);
              service.setCharacteristic(this.Characteristic.Brightness, power / maxProduction * 100);
              service.setCharacteristic(this.customCharacteristic.characteristic.ElectricPower, power);
              service.setCharacteristic(this.Characteristic.On, power>0);

              if (power>1) {
                if (this.config['EveLoging'] as boolean && this.update1min) {
                  if (this.start===true) {
                    if (accessoryObject.accessory.context.fakeGatoService!==undefined) {
                      if (accessoryObject.accessory.context.fakeGatoService.isHistoryLoaded()) {
                        const extraPersistedData = accessoryObject.accessory.context.fakeGatoService.getExtraPersistedData();

                        if (extraPersistedData !== undefined) {
                          accessoryObject.accessory.context.totalenergy = extraPersistedData.totalenergy;
                          this.log.info(this.config['name'] as string + ' - loading total energy from file ' +
                     accessoryObject.accessory.context.totalenergy+' kWh');
                        } else {
                          this.log.warn(this.config['name'] as string + ' - starting new log for total energy in file!');
                          accessoryObject.accessory.context.fakeGatoService.setExtraPersistedData({ totalenergy:0, lastReset: 0 });
                        }
                      } else {
                        this.log.error(this.config['name'] as string + ' - history not loaded yet!');
                      }
                    }

                    this.start=false;
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

                if (this.config['EveLoging'] as boolean && this.update10min && this.start===false) {
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
          }

          this.callingService = false;

        }).catch((error) => {
          this.log.error('Unreachable - update', error);
          this.callingService = false;
          this.pauseToTime = new Date(new Date().getTime()+(1*60000));
        });

        this.update1min= false;
        this.update10min= false;
      }
    }, this.config['UpdateTime'] as number * 1000);

  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  discoverDevices() {
    const httpRequest = new HttpRequest(this.config, this.log);

    this.callingService=true;

    httpRequest.GetStatusListForAll().then((results)=> {
      const froniusObject = (<FroniusObject>results);

      if (froniusObject !== undefined && froniusObject.Body !== undefined &&
        froniusObject.Body.Data!==undefined && froniusObject.Body.Data.Site!==undefined) {

        const site = froniusObject.Body.Data.Site;

        const accessoryObject = this.getAccessory(site, 'inverter');
        new LightBulbAccessory(this, accessoryObject.accessory, site, this.config, this.log);
        this.addOrRestorAccessory(accessoryObject.accessory, this.config['name'] as string, 'inverter', accessoryObject.exists);

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

      this.callingService=false;

    }).catch((error) => {
      this.log.error('Unreachable - start up', error);
      this.callingService=false;
    });
  }

  public getAccessory(device: Site, type: string) {
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === this.localIdForType(device, type));

    if (existingAccessory!==undefined) {
      existingAccessory.displayName = this.config['name'] as string;

      return {accessory : existingAccessory, exists : true};
    }

    const accessory = new this.api.platformAccessory(this.config['name'] as string, this.localIdForType(device, type));
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
    return this.api.hap.uuid.generate(this.config['name'] as string+'_'+type);
  }
}
