import { AssetComponent, LogEntry, ChatMessage } from '../types';

export const SAMPLE_PLANT_ASSETS: AssetComponent[] = [
  {
    id: "asset_tohnichi_01",
    componentName: "LT-0988 (WiFi Torque Wrench)",
    category: "Tools",
    make: "Tohnichi",
    controllerSerial: "A06814",
    ipAddress: "192.168.1.51",
    stageLocation: "0201CH12LH (Chassis)",
    statusFlag: "FAULT",
    sopQrCode: "",
    customFields: {
      "Torque Range": "10 - 50 Nm",
      "Calibration Due": "15-Dec-2026",
      "Line Allocation": "Line 02 Main"
    }
  },
  {
    id: "asset_atlas_02",
    componentName: "NR-1102 (DC Electric Nutrunner)",
    category: "Tools",
    make: "Atlas Copco",
    controllerSerial: "PF6000-8812",
    ipAddress: "192.168.1.52",
    stageLocation: "Stage-04LH (Front Axle)",
    statusFlag: "OK",
    sopQrCode: "",
    customFields: {
      "Torque Range": "40 - 180 Nm",
      "Fieldbus": "Profinet",
      "Calibration Due": "28-Nov-2026"
    }
  },
  {
    id: "asset_moxa_03",
    componentName: "MX-3011 (Serial-to-Ethernet)",
    category: "Tools",
    make: "Moxa",
    controllerSerial: "NPort-5150A",
    ipAddress: "192.168.1.53",
    stageLocation: "Line-02-Rack-01",
    statusFlag: "OK",
    sopQrCode: "",
    customFields: {
      "Port Mode": "RS-485 2-wire",
      "Baud Rate": "9600 8-N-1"
    }
  },
  {
    id: "asset_cognex_04",
    componentName: "VS-4001 (Machine Vision Camera)",
    category: "Tools",
    make: "Cognex In-Sight",
    controllerSerial: "IS7402-11",
    ipAddress: "192.168.1.54",
    stageLocation: "Inspection-Station-A",
    statusFlag: "OK",
    sopQrCode: "",
    customFields: {
      "Lens": "16mm C-Mount",
      "Inspection": "Bolt Presence & Seal"
    }
  },
  {
    id: "asset_ups_05",
    componentName: "UP-2005 (Plant UPS Unit)",
    category: "UPS",
    make: "Schneider APC",
    controllerSerial: "SURT3000XLI",
    ipAddress: "192.168.1.55",
    stageLocation: "Sub-Panel-02B",
    statusFlag: "FAULT",
    sopQrCode: "",
    customFields: {
      "Capacity": "3000 VA / 2100 W",
      "Battery Pack": "4x 12V 9Ah"
    }
  },
  {
    id: "asset_andon_06",
    componentName: "TV-0801 (55\" Andon Display)",
    category: "TVs & Scanners",
    make: "Panasonic Industrial",
    controllerSerial: "TH-55EQ1W",
    ipAddress: "192.168.1.56",
    stageLocation: "Line-02-Overhead",
    statusFlag: "OK",
    sopQrCode: "",
    customFields: {
      "Resolution": "1920x1080 @ 60Hz",
      "Extender": "HDMI over Cat6"
    }
  }
];

export const SAMPLE_PLANT_LOGS: LogEntry[] = [
  {
    id: "log_demo_01",
    category: "Tools",
    timestamp: "07:42 AM",
    operator: "Ramesh Sharma",
    shift: "A",
    ipAddress: "192.168.1.51",
    location: "0201CH12LH (Chassis)",
    status: "Pending",
    details: {
      toolName: "LT-0988 (WiFi Torque Wrench)",
      deviceId: "2004",
      line: "Line 02",
      reportedStatus: "Fault Alert",
      problemDetail: "Memory cache full & WiFi sync failure. Tool locked after bolt tightening cycle 42.",
      rootCause: "Subnet router DHCP lease expiration prevented cache clearance.",
      actionDone: "Docked tool to terminal USB, awaiting technician master rig check."
    }
  },
  {
    id: "log_demo_02",
    category: "UPS",
    timestamp: "08:15 AM",
    operator: "Vikram Meena",
    shift: "A",
    ipAddress: "192.168.1.55",
    location: "Sub-Panel-02B",
    status: "Pending",
    details: {
      toolName: "UP-2005 (Plant UPS Unit)",
      deviceId: "3015",
      line: "Line 02",
      reportedStatus: "Need Maintenance",
      currentLoad: "18",
      filterCleaned: false,
      coolingFan: true,
      problemDetail: "Air intake filter grid clogged with paint shop dust drift.",
      rootCause: "Intake dust accumulation causing internal thermal rise.",
      actionDone: "Cleaned front mesh grid; awaiting technician confirmation."
    }
  },
  {
    id: "log_demo_03",
    category: "Tools",
    timestamp: "06:30 AM",
    operator: "Sanjay Verma",
    shift: "A",
    ipAddress: "192.168.1.52",
    location: "Stage-04LH (Front Axle)",
    status: "Normal",
    details: {
      toolName: "NR-1102 (DC Electric Nutrunner)",
      deviceId: "1102",
      line: "Line 02",
      reportedStatus: "Working / Normal",
      problemDetail: "Pre-shift torque verification OK on calibration bench (120 Nm nominal)."
    }
  }
];

export const SAMPLE_PLANT_MESSAGES: ChatMessage[] = [
  {
    id: "msg_demo_01",
    type: "system",
    sender: "SHIFT SUPERVISOR",
    role: "System",
    shift: "A",
    text: "📢 Shift A Line 02 operations commenced. Daily targets: 38 Chassis (AL-BOSS-1415) and 24 Multi-Axle (AL-AVTR-1618).",
    timestamp: "06:30 AM"
  },
  {
    id: "msg_demo_02",
    type: "alert",
    refLogId: "log_demo_01",
    sender: "CRITICAL SYSTEM GATE",
    role: "System",
    shift: "A",
    text: "🚨 [FAULT ALERT] Fault at 0201CH12LH (Chassis) (IP: 192.168.1.51). Memory cache lock on LT-0988.",
    timestamp: "07:42 AM",
    resolved: false
  },
  {
    id: "msg_demo_03",
    type: "alert",
    refLogId: "log_demo_02",
    sender: "CRITICAL SYSTEM GATE",
    role: "System",
    shift: "A",
    text: "🚨 [NEED MAINTENANCE] High temperature warning on Sub-Panel-02B UPS unit (IP: 192.168.1.55).",
    timestamp: "08:15 AM",
    resolved: false
  }
];

export const SAMPLE_PLANT_BOM: Record<string, Record<string, { count: number; stageCode: string; assetName: string }>> = {
  "AL-BOSS-1415": {
    "LT-0988": { count: 2, stageCode: "0201CH12LH", assetName: "WiFi DC Torque Wrench (10-50 Nm)" },
    "NR-1102": { count: 4, stageCode: "Stage-04LH", assetName: "DC Electric Nutrunner (40-180 Nm)" }
  },
  "AL-AVTR-1618": {
    "LT-0988": { count: 2, stageCode: "0201CH12LH", assetName: "WiFi DC Torque Wrench (10-50 Nm)" },
    "NR-1102": { count: 6, stageCode: "Stage-04LH", assetName: "DC Electric Nutrunner (40-180 Nm)" },
    "MX-3011": { count: 1, stageCode: "Line-02-Rack", assetName: "Moxa Serial-to-Ethernet NPort" }
  },
  "AL-DOST-PLUS": {
    "LT-0988": { count: 1, stageCode: "0201CH12LH", assetName: "WiFi DC Torque Wrench (10-50 Nm)" },
    "VS-4001": { count: 1, stageCode: "Inspection-A", assetName: "Cognex In-Sight Vision Camera" }
  }
};
