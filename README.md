<p align="center">
<img alt="Home Bridge logotype" src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">
</p>

# Homebridge Platform Fronius Inverters Plugin

This is a plugin for Fronius Inverters

1.0.0 - 1.0.4: First version
1.0.5 - 1.0.7: Testing with - power usage
1.1 - null check for current power usage
1.2 - Changed Eve stats from 9 min to 10 min.

# Default config

```json
"platforms": [
    {
        "name": "Fronius Inverter Energy",
        "ip": "192.168.0.X",
        "UpdateTime": 5,
        "MaxProduction": 10000,
        "ViewElectricPowerProduction": false,
        "EveLoging": false,
        "Debug": false,
        "platform": "FroniusInverterEnergy"
    }
]
```
