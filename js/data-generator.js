window.SolarFlareApp = window.SolarFlareApp || {};

(function() {

// Simple Mulberry32 PRNG
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

const prng = mulberry32(42);

// Normal distribution approximation
function boxMullerTransform() {
  const u1 = prng();
  const u2 = prng();
  
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0;
}

function generate(config = {}) {
  const numDays = config.numDays || 30;
  const cadenceSeconds = config.cadenceSeconds || 60;
  const startDate = config.startDate || new Date('2024-01-01T00:00:00Z');
  
  const totalSeconds = numDays * 24 * 60 * 60;
  const numPoints = Math.floor(totalSeconds / cadenceSeconds);
  
  const timestamps = new Float64Array(numPoints);
  const sxrFlux = new Float64Array(numPoints);
  const hxrFlux = new Float64Array(numPoints);
  const flareEvents = [];
  
  const startMs = startDate.getTime();
  const msPerCadence = cadenceSeconds * 1000;
  
  // Base background levels
  const baseSxr = 1e-7;
  const baseHxr = 5;
  
  // Generate background with noise and solar rotation modulation (27 days)
  for (let i = 0; i < numPoints; i++) {
    timestamps[i] = startMs + i * msPerCadence;
    
    // Modulation based on solar rotation
    const rotationMod = 1 + 0.5 * Math.sin(2 * Math.PI * i * cadenceSeconds / (27 * 24 * 3600));
    
    sxrFlux[i] = baseSxr * rotationMod + Math.abs(boxMullerTransform() * 5e-9);
    hxrFlux[i] = baseHxr * rotationMod + Math.abs(boxMullerTransform() * 1.5);
  }
  
  // Flare generation probabilities (for 30 days)
  const numB = 40;
  const numC = 20;
  const numM = 5;
  const numX = 2;
  
  const allFlareDefs = [
    ...Array(numB).fill('B'),
    ...Array(numC).fill('C'),
    ...Array(numM).fill('M'),
    ...Array(numX).fill('X')
  ];
  
  // Spread flares randomly across the time range
  let currentEventId = 1;
  const minGapSeconds = 30 * 60;
  let lastFlarePeakTime = -minGapSeconds;
  
  for (const flareClass of allFlareDefs) {
    let peakIndex;
    let attempts = 0;
    
    // Find a non-overlapping spot
    do {
      peakIndex = Math.floor(prng() * numPoints);
      attempts++;
    } while (
      attempts < 100 && 
      Math.abs(peakIndex * cadenceSeconds - lastFlarePeakTime) < minGapSeconds
    );
    
    lastFlarePeakTime = peakIndex * cadenceSeconds;
    const peakTimeMs = timestamps[peakIndex];
    
    // Flare parameters based on class
    let basePeakSxr, maxPeakSxr;
    let hxrMin, hxrMax;
    let riseTimeMin, riseTimeMax;
    let decayTimeMin, decayTimeMax;
    
    if (flareClass === 'B') {
      basePeakSxr = 1e-7; maxPeakSxr = 1e-6; hxrMin = 10; hxrMax = 50;
      riseTimeMin = 300; riseTimeMax = 900; decayTimeMin = 600; decayTimeMax = 1800;
    } else if (flareClass === 'C') {
      basePeakSxr = 1e-6; maxPeakSxr = 1e-5; hxrMin = 50; hxrMax = 500;
      riseTimeMin = 300; riseTimeMax = 1200; decayTimeMin = 900; decayTimeMax = 3600;
    } else if (flareClass === 'M') {
      basePeakSxr = 1e-5; maxPeakSxr = 1e-4; hxrMin = 500; hxrMax = 5000;
      riseTimeMin = 600; riseTimeMax = 1800; decayTimeMin = 1800; decayTimeMax = 5400;
    } else { // X
      basePeakSxr = 1e-4; maxPeakSxr = 1e-3; hxrMin = 5000; hxrMax = 50000;
      riseTimeMin = 600; riseTimeMax = 2400; decayTimeMin = 3600; decayTimeMax = 7200;
    }
    
    const peakSxr = basePeakSxr + prng() * (maxPeakSxr - basePeakSxr);
    const peakHxr = hxrMin + prng() * (hxrMax - hxrMin);
    
    const riseTime = riseTimeMin + prng() * (riseTimeMax - riseTimeMin);
    const decayTime = decayTimeMin + prng() * (decayTimeMax - decayTimeMin);
    const duration = riseTime + decayTime;
    
    const startTimeMs = peakTimeMs - riseTime * 1000;
    const endTimeMs = peakTimeMs + decayTime * 1000;
    
    // Inject flare signature into time series
    const startIndex = Math.max(0, Math.floor((startTimeMs - startMs) / msPerCadence));
    const endIndex = Math.min(numPoints - 1, Math.floor((endTimeMs - startMs) / msPerCadence));
    
    for (let i = startIndex; i <= endIndex; i++) {
      const t = (timestamps[i] - peakTimeMs) / 1000; // time relative to peak in seconds
      
      // SXR profile (Gaussian rise, exponential decay)
      let sxrProfile = 0;
      if (t < 0) {
        // Rise phase (Gaussian)
        const sigma = riseTime / 2.5;
        sxrProfile = peakSxr * Math.exp(-(t * t) / (2 * sigma * sigma));
      } else {
        // Decay phase (Exponential)
        const tau = decayTime / 3;
        sxrProfile = peakSxr * Math.exp(-t / tau);
      }
      
      // HXR profile (Impulsive Gaussian, centered slightly before SXR peak)
      const hxrPeakOffset = -0.2 * riseTime; // HXR peaks before SXR
      const hxrSigma = Math.min(riseTime / 4, 300); // Sharp spike
      const hxrT = t - hxrPeakOffset;
      const hxrProfile = peakHxr * Math.exp(-(hxrT * hxrT) / (2 * hxrSigma * hxrSigma));
      
      sxrFlux[i] += sxrProfile;
      hxrFlux[i] += hxrProfile;
    }
    
    const subclass = ((peakSxr / basePeakSxr)).toFixed(1);
    
    const instrumentRand = prng();
    let instrument = 'SoLEXS';
    if (instrumentRand > 0.6 && instrumentRand <= 0.9) instrument = 'HEL1OS';
    else if (instrumentRand > 0.9) instrument = 'Combined';

    flareEvents.push({
      id: `FLR-2024-${String(currentEventId).padStart(3, '0')}`,
      startTime: startTimeMs,
      peakTime: peakTimeMs,
      endTime: endTimeMs,
      goesClass: flareClass,
      goesSubclass: parseFloat(subclass),
      peakSxrFlux: peakSxr,
      peakHxrFlux: peakHxr,
      duration: duration,
      riseTime: riseTime,
      decayTime: decayTime,
      sxrHxrRatio: peakSxr / peakHxr,
      instrument: instrument
    });
    
    currentEventId++;
  }
  
  // Sort flare events by time
  flareEvents.sort((a, b) => a.peakTime - b.peakTime);
  
  return {
    timestamps: Array.from(timestamps),
    sxrFlux: Array.from(sxrFlux),
    hxrFlux: Array.from(hxrFlux),
    flareEvents,
    config: { startDate, cadenceSeconds, numDays, endDate: new Date(timestamps[numPoints-1]) }
  };
}

window.SolarFlareApp.DataGenerator = { generate };

})();
