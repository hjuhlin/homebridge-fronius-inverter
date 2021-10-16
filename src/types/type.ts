export interface Inverter {
        DT: number;
        E_Day: number;
        E_Total: number;
        E_Year: number;
        P: number;
    }

export interface Inverters {
        1: Inverter;
    }

export interface Site {
        E_Day: number;
        E_Total: number;
        E_Year: number;
        Meter_Location: string;
        Mode: string;
        P_Akku?: any;
        P_Grid?: any;
        P_Load?: any;
        P_PV: number;
        rel_Autonomy?: any;
        rel_SelfConsumption?: any;
    }

export interface Data {
        Inverters: Inverters;
        Site: Site;
        Version: string;
    }

export interface Body {
        Data: Data;
    }

export interface RequestArguments {}

export interface Status {
        Code: number;
        Reason: string;
        UserMessage: string;
    }

export interface Head {
        RequestArguments: RequestArguments;
        Status: Status;
        Timestamp: Date;
    }

export interface FroniusObject {
        Body: Body;
        Head: Head;
    }
