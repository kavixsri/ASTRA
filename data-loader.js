window.SolarFlareApp = window.SolarFlareApp || {};

(function() {
  'use strict';

  class DataLoader {
    constructor(filePath) {
      this.filePath = filePath;
      this.data = [];
      this.currentIndex = 0;
      this.flareEvents = [];
      this.isLoaded = false;
    }

    async load() {
      console.log(`Loading dataset from ${this.filePath}...`);
      try {
        const response = await fetch(this.filePath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csvText = await response.text();
        this.parseCSV(csvText);
        this.extractFlares();
        this.isLoaded = true;
        console.log(`Successfully loaded ${this.data.length} rows.`);
        return true;
      } catch (error) {
        console.error('Failed to load dataset:', error);
        return false;
      }
    }

    parseCSV(csvText) {
      const lines = csvText.split('\n');
      if (lines.length < 2) return;
      
      const headers = lines[0].split(',');
      const timeIdx = headers.indexOf('timestamp');
      const sxrIdx = headers.indexOf('soft_xray_flux');
      const cdteIdx = headers.indexOf('hard_xray_cdte');
      const cztIdx = headers.indexOf('hard_xray_czt');
      const isFlareIdx = headers.indexOf('is_flare');
      const classIdx = headers.indexOf('flare_class');

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = lines[i].split(',');
        if (row.length < headers.length) continue;

        this.data.push({
          timestamp: new Date(row[timeIdx]),
          soft_xray_flux: parseFloat(row[sxrIdx]) || 1e-9,
          hard_xray_cdte: parseFloat(row[cdteIdx]) || 0,
          hard_xray_czt: parseFloat(row[cztIdx]) || 0,
          is_flare: parseInt(row[isFlareIdx]) || 0,
          flare_class: row[classIdx] || 'None'
        });
      }
    }

    // Extract flare events based on the 'is_flare' flag in the dataset
    extractFlares() {
      let inFlare = false;
      let currentFlare = null;

      for (let i = 0; i < this.data.length; i++) {
        const row = this.data[i];
        
        if (row.is_flare === 1 && !inFlare) {
          inFlare = true;
          currentFlare = {
            id: 'FLARE-' + (this.flareEvents.length + 1),
            startTime: row.timestamp,
            peakTime: row.timestamp, // will update
            endTime: row.timestamp,
            goesClass: row.flare_class !== '0' && row.flare_class !== 'None' ? row.flare_class : 'C', // fallback
            peakFlux: row.soft_xray_flux,
            region: 'AR' + (4000 + Math.floor(Math.random() * 100))
          };
        } else if (row.is_flare === 1 && inFlare) {
          if (row.soft_xray_flux > currentFlare.peakFlux) {
            currentFlare.peakFlux = row.soft_xray_flux;
            currentFlare.peakTime = row.timestamp;
            if (row.flare_class !== '0' && row.flare_class !== 'None') {
              currentFlare.goesClass = row.flare_class;
            }
          }
          currentFlare.endTime = row.timestamp;
        } else if (row.is_flare === 0 && inFlare) {
          inFlare = false;
          // Only save if it has a real class (strip sub-class number for simplicity, e.g. M1.2 -> M)
          if (currentFlare.goesClass.length > 1) {
             currentFlare.goesClass = currentFlare.goesClass.charAt(0);
          }
          this.flareEvents.push(currentFlare);
          currentFlare = null;
        }
      }
      
      // Close last flare if still open
      if (inFlare && currentFlare) {
        if (currentFlare.goesClass.length > 1) {
             currentFlare.goesClass = currentFlare.goesClass.charAt(0);
        }
        this.flareEvents.push(currentFlare);
      }
    }

    // Stream the full dataset as if it was generated (useful for static analysis)
    getRawData() {
      const timestamps = this.data.map(d => d.timestamp.getTime());
      const sxrFlux = this.data.map(d => d.soft_xray_flux);
      const hxrFlux = this.data.map(d => (d.hard_xray_cdte + d.hard_xray_czt) / 2); // Average the two HXR detectors

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
