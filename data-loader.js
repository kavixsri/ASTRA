window.SolarFlareApp = window.SolarFlareApp || {};

(function() {
  'use strict';

  // Map the numeric flare_class codes in the dataset to GOES letter classes
  // Based on actual flux analysis of the dataset:
  //   0 = Background (no flare), flux < 1e-6
  //   1 = C-class, flux 1e-6 to 1e-5
  //   2 = M-class, flux 1e-5 to 1e-4
  //   3 = X-class, flux >= 1e-4
  const CLASS_MAP = { '0': 'None', '1': 'C', '2': 'M', '3': 'X' };

  // Compute GOES subclass from peak flux (e.g. C3.8, M1.2, X1.0)
  function getGoesSubclass(goesClass, peakFlux) {
    const bases = { 'C': 1e-6, 'M': 1e-5, 'X': 1e-4 };
    const base = bases[goesClass];
    if (!base) return '';
    return (peakFlux / base).toFixed(1);
  }

  class DataLoader {
    constructor(filePath) {
      this.filePath = filePath;
      this.data = [];
      this.flareEvents = [];
      this.isLoaded = false;
    }

    async load() {
      console.log(`[ASTRA] Loading dataset from ${this.filePath}...`);
      try {
        const response = await fetch(this.filePath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csvText = await response.text();
        this.parseCSV(csvText);
        this.extractFlares();
        this.isLoaded = true;
        console.log(`[ASTRA] Successfully loaded ${this.data.length} data points and extracted ${this.flareEvents.length} flare events.`);
        return true;
      } catch (error) {
        console.error('[ASTRA] Failed to load dataset:', error);
        return false;
      }
    }

    parseCSV(csvText) {
      const lines = csvText.split('\n');
      if (lines.length < 2) return;
      
      // Trim headers to handle \r
      const headers = lines[0].split(',').map(h => h.trim());
      const timeIdx = headers.indexOf('timestamp');
      const sxrIdx = headers.indexOf('soft_xray_flux');
      const cdteIdx = headers.indexOf('hard_xray_cdte');
      const cztIdx = headers.indexOf('hard_xray_czt');
      const isFlareIdx = headers.indexOf('is_flare');
      const classIdx = headers.indexOf('flare_class');

      console.log(`[ASTRA] CSV columns found: timestamp=${timeIdx}, sxr=${sxrIdx}, cdte=${cdteIdx}, czt=${cztIdx}, is_flare=${isFlareIdx}, flare_class=${classIdx}`);

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const row = line.split(',');
        if (row.length < 6) continue; // need at least the core columns

        const classCode = row[classIdx] ? row[classIdx].trim() : '0';

        this.data.push({
          timestamp: new Date(row[timeIdx].trim()),
          soft_xray_flux: parseFloat(row[sxrIdx]) || 1e-9,
          hard_xray_cdte: parseFloat(row[cdteIdx]) || 0,
          hard_xray_czt: parseFloat(row[cztIdx]) || 0,
          is_flare: parseInt(row[isFlareIdx]) || 0,
          flare_class_code: classCode,
          flare_class: CLASS_MAP[classCode] || 'None'
        });
      }
    }

    extractFlares() {
      let inFlare = false;
      let currentFlare = null;

      for (let i = 0; i < this.data.length; i++) {
        const row = this.data[i];
        
        if (row.is_flare === 1 && !inFlare) {
          // Start of a new flare event
          inFlare = true;
          const hxrAvg = (row.hard_xray_cdte + row.hard_xray_czt) / 2;
          currentFlare = {
            id: 'FLARE-' + (this.flareEvents.length + 1),
            startTime: row.timestamp.getTime(),
            peakTime: row.timestamp.getTime(),
            endTime: row.timestamp.getTime(),
            goesClass: row.flare_class !== 'None' ? row.flare_class : 'C',
            goesSubclass: '',
            peakFlux: row.soft_xray_flux,
            peakSxrFlux: row.soft_xray_flux,
            peakHxrFlux: hxrAvg,
            duration: 0,
            riseTime: 0,
            decayTime: 0,
            sxrHxrRatio: row.soft_xray_flux / Math.max(0.01, hxrAvg),
            instrument: 'Aditya-L1 SoLEXS/HEL1OS',
            region: 'AR' + (4080 + this.flareEvents.length)
          };

        } else if (row.is_flare === 1 && inFlare) {
          // Continuing within a flare
          if (row.soft_xray_flux > currentFlare.peakFlux) {
            currentFlare.peakFlux = row.soft_xray_flux;
            currentFlare.peakSxrFlux = row.soft_xray_flux;
            currentFlare.peakTime = row.timestamp.getTime();
            if (row.flare_class !== 'None') {
              currentFlare.goesClass = row.flare_class;
            }
          }
          const hxrAvg = (row.hard_xray_cdte + row.hard_xray_czt) / 2;
          if (hxrAvg > currentFlare.peakHxrFlux) {
            currentFlare.peakHxrFlux = hxrAvg;
          }
          currentFlare.endTime = row.timestamp.getTime();

        } else if (row.is_flare === 0 && inFlare) {
          // End of flare
          inFlare = false;
          this._finalizeFlare(currentFlare);
          this.flareEvents.push(currentFlare);
          currentFlare = null;
        }
      }
      
      // Close last flare if still open at end of dataset
      if (inFlare && currentFlare) {
        this._finalizeFlare(currentFlare);
        this.flareEvents.push(currentFlare);
      }

      console.log(`[ASTRA] Flare breakdown: ${this.flareEvents.filter(f=>f.goesClass==='C').length} C-class, ${this.flareEvents.filter(f=>f.goesClass==='M').length} M-class, ${this.flareEvents.filter(f=>f.goesClass==='X').length} X-class`);
    }

    _finalizeFlare(flare) {
      flare.duration = (flare.endTime - flare.startTime) / 1000;
      flare.riseTime = (flare.peakTime - flare.startTime) / 1000;
      flare.decayTime = (flare.endTime - flare.peakTime) / 1000;
      flare.sxrHxrRatio = flare.peakSxrFlux / Math.max(0.01, flare.peakHxrFlux);
      flare.goesSubclass = getGoesSubclass(flare.goesClass, flare.peakFlux);
    }

    getRawData() {
      const timestamps = this.data.map(d => d.timestamp.getTime());
      const sxrFlux = this.data.map(d => d.soft_xray_flux);
      const hxrFlux = this.data.map(d => (d.hard_xray_cdte + d.hard_xray_czt) / 2);

      return {
        series: this.data,
        timestamps,
        sxrFlux,
        hxrFlux,
        flareEvents: this.flareEvents
      };
    }
  }

  window.SolarFlareApp.DataLoader = DataLoader;
})();
