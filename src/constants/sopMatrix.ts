export interface SOPIssue {
  field: string;
  text: string;
}

export interface SOPCategory {
  icon: string;
  issues: Record<string, SOPIssue>;
}

export const DEEP_SOP_MATRIX: Record<string, SOPCategory> = {
  "WiFi Torque Wrench": {
    icon: "🛠️",
    issues: {
      "Network Pairing & Sync Failure": {
        field: "wrenchSync",
        text: "Turn off wrench for 5 seconds. Hold WiFi/Sync until blue LED blinks rapidly. If it fails to authenticate, dock the wrench into the local USB terminal to manually clear the memory cache line. Verify structural calibration on the Master Rig (Nominal 15 Nm deviation must be < ±2%)."
      },
      "Memory Cache Full (Offline Lock)": {
        field: "wrenchCache",
        text: "Turn off wrench for 5 seconds. Hold WiFi/Sync until blue LED blinks rapidly. If it fails to authenticate, dock the wrench into the local USB terminal to manually clear the memory cache line. Verify structural calibration on the Master Rig (Nominal 15 Nm deviation must be < ±2%)."
      },
      "Calibration Drift / Tolerances Out of Spec": {
        field: "wrenchCal",
        text: "Turn off wrench for 5 seconds. Hold WiFi/Sync until blue LED blinks rapidly. If it fails to authenticate, dock the wrench into the local USB terminal to manually clear the memory cache line. Verify structural calibration on the Master Rig (Nominal 15 Nm deviation must be < ±2%)."
      },
      "Access Denied (MAC Filtering Error)": {
        field: "wrenchMac",
        text: "Turn off wrench for 5 seconds. Hold WiFi/Sync until blue LED blinks rapidly. If it fails to authenticate, dock the wrench into the local USB terminal to manually clear the memory cache line. Verify structural calibration on the Master Rig (Nominal 15 Nm deviation must be < ±2%)."
      }
    }
  },
  "Uninterruptible Power Supply (UPS)": {
    icon: "⚡",
    issues: {
      "Electrical Current Overload Warning (currentLoad)": {
        field: "currentLoad",
        text: "Inspect the UPS LCD screen for live Amps load. Unplug unauthorized personal accessories from the rear sockets. Carefully pull out the front filtration grid (hot-swappable, do not turn off unit), clean off grease and dust, and slide it back in. Toggle the filterCleaned software variable to clear the warning."
      },
      "Air Intake Filter Grid Clogged (filterCleaned)": {
        field: "filterCleaned",
        text: "Inspect the UPS LCD screen for live Amps load. Unplug unauthorized personal accessories from the rear sockets. Carefully pull out the front filtration grid (hot-swappable, do not turn off unit), clean off grease and dust, and slide it back in. Toggle the filterCleaned software variable to clear the warning."
      },
      "Internal Battery Degradation Alarm": {
        field: "batteryAlarm",
        text: "Inspect the UPS LCD screen for live Amps load. Unplug unauthorized personal accessories from the rear sockets. Carefully pull out the front filtration grid (hot-swappable, do not turn off unit), clean off grease and dust, and slide it back in. Toggle the filterCleaned software variable to clear the warning."
      },
      "Static Inverter Bypass Mode Engaged": {
        field: "bypassMode",
        text: "Inspect the UPS LCD screen for live Amps load. Unplug unauthorized personal accessories from the rear sockets. Carefully pull out the front filtration grid (hot-swappable, do not turn off unit), clean off grease and dust, and slide it back in. Toggle the filterCleaned software variable to clear the warning."
      }
    }
  },
  "Industrial Barcode Scanner": {
    icon: "🖨️",
    issues: {
      "Character Corruption / Parsing Errors": {
        field: "scanParsing",
        text: "Clean the glass reader pane with an alcohol swab. Scan the laminated configuration sheet barcodes in sequence: [Reset to Factory Defaults] -> [Enable HID Keyboard Emulation with Enter Suffix]. If unresponsive, move the USB plug from an external passive hub directly into the workstation motherboard's blue USB 3.0 slot."
      },
      "Aiming Illumination Laser Weak/Off": {
        field: "scanLaser",
        text: "Clean the glass reader pane with an alcohol swab. Scan the laminated configuration sheet barcodes in sequence: [Reset to Factory Defaults] -> [Enable HID Keyboard Emulation with Enter Suffix]. If unresponsive, move the USB plug from an external passive hub directly into the workstation motherboard's blue USB 3.0 slot."
      },
      "Virtual COM Port Driver Crash": {
        field: "scanDriver",
        text: "Clean the glass reader pane with an alcohol swab. Scan the laminated configuration sheet barcodes in sequence: [Reset to Factory Defaults] -> [Enable HID Keyboard Emulation with Enter Suffix]. If unresponsive, move the USB plug from an external passive hub directly into the workstation motherboard's blue USB 3.0 slot."
      },
      "Symbology Lock (Won't read 2D/QR codes)": {
        field: "scanSymbology",
        text: "Clean the glass reader pane with an alcohol swab. Scan the laminated configuration sheet barcodes in sequence: [Reset to Factory Defaults] -> [Enable HID Keyboard Emulation with Enter Suffix]. If unresponsive, move the USB plug from an external passive hub directly into the workstation motherboard's blue USB 3.0 slot."
      }
    }
  },
  "TV Displays & Status Monitors (Andon)": {
    icon: "📺",
    issues: {
      "Frozen Metric Telemetry / Web Socket Signal Drop": {
        field: "tvSocket",
        text: "Press Ctrl + F5 on the terminal keypad to force-refresh the interface page. If it is completely blank, cycle the physical power brick on the HDMI over Ethernet Extender box mounted behind the TV bezel. Set output properties to 1920x1080 @ 60Hz with a scale factor of 100%."
      },
      "Aspect Ratio Distortion (Clipped Dashboard UI)": {
        field: "tvAspect",
        text: "Press Ctrl + F5 on the terminal keypad to force-refresh the interface page. If it is completely blank, cycle the physical power brick on the HDMI over Ethernet Extender box mounted behind the TV bezel. Set output properties to 1920x1080 @ 60Hz with a scale factor of 100%."
      },
      "Screen Black / Client Box DHCP Lease Expiry": {
        field: "tvBlack",
        text: "Press Ctrl + F5 on the terminal keypad to force-refresh the interface page. If it is completely blank, cycle the physical power brick on the HDMI over Ethernet Extender box mounted behind the TV bezel. Set output properties to 1920x1080 @ 60Hz with a scale factor of 100%."
      }
    }
  },
  "Moxa Device (Serial-to-Ethernet)": {
    icon: "🔌",
    issues: {
      "IP Address Conflict / Gateway Unreachable": {
        field: "moxaIp",
        text: "Disconnect the Moxa LAN cable and run a terminal ping test to verify no other terminal matches the static IP. Open Moxa NPort Admin console, match serial port configuration settings directly to the machine manual requirements (e.g., Baud Rate 9600, Parity None, Stop Bit 1). Restart the Moxa NPort Real COM Engine service in Windows."
      },
      "Serial Data Stream Timeout (RS-485/232 Fault)": {
        field: "moxaSerial",
        text: "Disconnect the Moxa LAN cable and run a terminal ping test to verify no other terminal matches the static IP. Open Moxa NPort Admin console, match serial port configuration settings directly to the machine manual requirements (e.g., Baud Rate 9600, Parity None, Stop Bit 1). Restart the Moxa NPort Real COM Engine service in Windows."
      },
      "NPort Virtual COM Driver Mapping Disconnect": {
        field: "moxaMapping",
        text: "Disconnect the Moxa LAN cable and run a terminal ping test to verify no other terminal matches the static IP. Open Moxa NPort Admin console, match serial port configuration settings directly to the machine manual requirements (e.g., Baud Rate 9600, Parity None, Stop Bit 1). Restart the Moxa NPort Real COM Engine service in Windows."
      }
    }
  },
  "Machine Vision Systems": {
    icon: "📷",
    issues: {
      "Excessive Inspection False Rejects (Light Drift)": {
        field: "visionReject",
        text: "Close all structural line inspection hood shrouds to block factory roof lighting shifts. Clean the camera lens cover with an anti-static cloth. Access vision panel controls and initiate the Exposure Autofocus Self-Optimization Loop to re-teach the Golden Master reference template."
      },
      "Pattern Alignment Drift / Missing Frame Triggers": {
        field: "visionAlign",
        text: "Close all structural line inspection hood shrouds to block factory roof lighting shifts. Clean the camera lens cover with an anti-static cloth. Access vision panel controls and initiate the Exposure Autofocus Self-Optimization Loop to re-teach the Golden Master reference template."
      },
      "Industrial Fieldbus Drop (Profinet / EtherNet IP)": {
        field: "visionBus",
        text: "Close all structural line inspection hood shrouds to block factory roof lighting shifts. Clean the camera lens cover with an anti-static cloth. Access vision panel controls and initiate the Exposure Autofocus Self-Optimization Loop to re-teach the Golden Master reference template."
      }
    }
  }
};
