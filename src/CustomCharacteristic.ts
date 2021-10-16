import {API, Characteristic, CharacteristicProps, Formats, Perms, WithUUID} from 'homebridge';

export class CustomCharacteristic {

  private api: API;
  public characteristic: { [key: string]: WithUUID< { new(): Characteristic }> } = {};

  constructor(api: API) {
    this.api = api;

    this.createCharacteristics('ElectricPower', 'E863F10D-079E-48FF-8F27-9C2605A29F52', {
      format: Formats.FLOAT,
      minValue: 0,
      maxValue: 9999,
      minStep: 0.1,
      unit: 'Watts',
      description: 'Power in watts',
      perms: [Perms.NOTIFY, Perms.PAIRED_READ],
    }, 'Electric Power');

    this.createCharacteristics('TotalPowerConsumption', 'E863F10C-079E-48FF-8F27-9C2605A29F52', {
      format: Formats.FLOAT,
      minValue: 0,
      maxValue: 1000000000,
      minStep: 0.00001,
      unit: 'kWh',
      description: 'Total Consumption in kWh',
      perms: [Perms.NOTIFY, Perms.PAIRED_READ],
    }, 'Total Consumption');

    this.createCharacteristics('ResetTotal', 'E863F112-079E-48FF-8F27-9C2605A29F52', {
      format: Formats.UINT32,
      perms: [Perms.NOTIFY, Perms.PAIRED_WRITE],
    }, 'Reset');
  }

  private createCharacteristics(key: string, uuid: string, props: CharacteristicProps, displayName: string = key) {
    this.characteristic[key] = class extends this.api.hap.Characteristic {
      static readonly UUID: string = uuid;

      constructor() {
        super(displayName, uuid, props);
        this.value = this.getDefaultValue();
      }
    };
  }
}