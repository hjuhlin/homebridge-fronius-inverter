const request = require('request');

import { PlatformConfig, Logger } from 'homebridge';

export class HttpRequest {

  readonly urlStatusAllDevices = `http://${this.config['Ip']}/solar_api/v1/GetPowerFlowRealtimeData.fcgi`;

  constructor(
    public readonly config: PlatformConfig,
    public readonly log: Logger,
  ) {}

  createInstance() {
    return {};
  }

  GetStatusListForAll() {
    return new Promise((resolve, reject) => {
      request(
        {
          url: this.urlStatusAllDevices,
          method: 'GET',
          json: true,
        }, (error, response, body) => {
          if (error) {
            reject(error);
          } else {
            resolve(body);
          }
        });
    });
  }
}