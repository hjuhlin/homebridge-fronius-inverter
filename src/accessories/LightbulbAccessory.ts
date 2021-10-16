import { Service, PlatformAccessory, CharacteristicValue, PlatformConfig, Logger, CharacteristicSetCallback } from 'homebridge';

import { FroniusInverterEnergyPlatform } from '../platform';
import { Site } from '../types/type';

export class LightBulbAccessory {
  private service: Service;
  private serviceSensor: Service;

  constructor(
    private readonly platform: FroniusInverterEnergyPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly site: Site,
    public readonly config: PlatformConfig,
    public readonly log: Logger,

  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Fronius')
      .setCharacteristic(this.platform.Characteristic.Model, 'Fronius')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'None');

    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.config['name'] as string);

    this.service.addOptionalCharacteristic(this.platform.customCharacteristic.characteristic.ElectricPower);
    this.service.addOptionalCharacteristic(this.platform.customCharacteristic.characteristic.TotalPowerConsumption);
    this.service.addOptionalCharacteristic(this.platform.customCharacteristic.characteristic.ResetTotal);

    const maxProduction = this.config['MaxProduction'];
    const power = site.P_PV;

    this.service.setCharacteristic(this.platform.Characteristic.Brightness, power / maxProduction * 100);
    this.service.setCharacteristic(this.platform.customCharacteristic.characteristic.ElectricPower, power);
    this.service.setCharacteristic(this.platform.Characteristic.On, power>0);

    this.service.getCharacteristic(this.platform.customCharacteristic.characteristic.ResetTotal)
      .on('set', this.setResetTotal.bind(this));

    this.service.getCharacteristic(this.platform.customCharacteristic.characteristic.ResetTotal)
      .on('get', this.getResetTotal.bind(this));

    this.serviceSensor = this.accessory.getService(this.platform.Service.LightSensor) ||
      this.accessory.addService(this.platform.Service.LightSensor);

    this.serviceSensor.setCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, power);

    this.accessory.context.totalenergy = 0;
    this.accessory.context.lastUpdated = new Date().getTime();
    this.accessory.context.startTime = new Date();
    this.accessory.context.lastReset = 0;
  }

  setResetTotal(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.accessory.context.totalenergy = 0;
    this.accessory.context.lastReset = value;
    this.accessory.context.fakeGatoService.setExtraPersistedData({ totalenergy: 0, lastReset: this.accessory.context.lastReset });

    callback(null);
  }

  getResetTotal(callback: CharacteristicSetCallback) {
    const extraPersistedData = this.accessory.context.fakeGatoService.getExtraPersistedData();

    if (extraPersistedData !== undefined) {
      this.accessory.context.lastReset = extraPersistedData.lastReset;
    }

    callback(null, this.accessory.context.lastReset);
  }

}
