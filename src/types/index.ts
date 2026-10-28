export interface LogEntry {
  id: string;
  category: string;
  timestamp: string;
  operator: string;
  shift: string;
  ipAddress: string;
  location: string;
  status: 'Normal' | 'Pending' | 'Fixed';
  details: {
    toolName?: string;
    deviceId?: string;
    line?: string;
    reportedStatus?: string;
    problemDetail?: string;
    temp?: string;
    mcbUp?: boolean;
    panelCleaned?: boolean;
    exhaustFan?: boolean;
    currentLoad?: string;
    filterCleaned?: boolean;
    coolingFan?: boolean;
    contentFeed?: boolean;
    powerStatus?: boolean;
    rootCause?: string;
    actionDone?: string;
  };
}

export interface AssetComponent {
  id: string;
  componentName: string;
  category: string;
  make: string;
  controllerSerial: string;
  ipAddress: string;
  stageLocation: string;
  statusFlag: 'OK' | 'FAULT';
  sopQrCode?: string;
  customFields?: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  type: 'manual' | 'alert' | 'system';
  refLogId?: string;
  sender: string;
  role: string;
  shift?: string;
  text: string;
  timestamp: string;
  resolved?: boolean;
  image?: string;
}

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

export interface ToolMaterialEntry {
  assetNo: string;
  assetName: string;
  count: number;
  stageCode: string;
}

export interface CompanyConfig {
  name: string;
  title: string;
  plant: string;
  accentColor: string;
}
