window.SolarFlareApp = window.SolarFlareApp || {};

(function () {
  'use strict';

  // ── Colour palette ─────────────────────────────────────────────────
  const COLORS = {
    flareB: '#4fc3f7',
    flareC: '#66bb6a',
    flareM: '#ffa726',
    flareX: '#ef5350',
    sxr: '#ff6b35',
    hxr: '#00bcd4',
    accent: '#f7931e',
    gold: '#ffd700',
    textPrimary: '#e0e6f0',
    textSecondary: '#8892a8',
    gridColor: 'rgba(255,255,255,0.06)'
  };

  const CLASS_COLORS = {
    B: COLORS.flareB,
    C: COLORS.flareC,
    M: COLORS.flareM,
    X: COLORS.flareX
  };

  // ── Chart instance registry (for destroy-before-create) ────────────
  const instances = {};

  function getCanvas(id) {
    const el = document.getElementById(id);
    return el || null;
  }

  function destroyOld(key) {
    if (instances[key]) {
      instances[key].destroy();
      instances[key] = null;
    }
  }

  // ── Downsample helper ──────────────────────────────────────────────
  function downsample(arr, maxPts) {
    if (arr.length <= maxPts) return arr;
    const step = Math.ceil(arr.length / maxPts);
    const out = [];
    for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
    return out;
  }

  function downsamplePaired(ts, vals, maxPts) {
    if (ts.length <= maxPts) return { ts, vals };
    const step = Math.ceil(ts.length / maxPts);
    const outTs = [], outVals = [];
    for (let i = 0; i < ts.length; i += step) {
      outTs.push(ts[i]);
      outVals.push(vals[i]);
    }
    return { ts: outTs, vals: outVals };
  }

  // ── 1. Light Curves ───────────────────────────────────────────────
  function renderLightCurves(data) {
    const KEY = 'lightCurves';
    destroyOld(KEY);
    const canvas = getCanvas('sxr-hxr-chart');
    if (!canvas) return;

    const maxPts = 500;
    const sxr = downsamplePaired(data.timestamps, data.sxrFlux, maxPts);
    const hxr = downsamplePaired(data.timestamps, data.hxrFlux, maxPts);

    // Flare annotations for M and X class events
    const annotations = {};
    data.flareEvents.forEach((f, i) => {
      if (f.goesClass !== 'M' && f.goesClass !== 'X') return;
      annotations['flare' + i] = {
        type: 'box',
        xMin: f.startTime,
        xMax: f.endTime,
        backgroundColor: f.goesClass === 'X'
          ? 'rgba(239,83,80,0.12)'
          : 'rgba(255,167,38,0.10)',
        borderColor: f.goesClass === 'X'
          ? 'rgba(239,83,80,0.35)'
          : 'rgba(255,167,38,0.30)',
        borderWidth: 1,
        label: {
          display: true,
          content: f.goesClass + f.goesSubclass,
          position: 'start',
          font: { size: 9, weight: '600' },
          color: f.goesClass === 'X' ? COLORS.flareX : COLORS.flareM
        }
      };
    });

    instances[KEY] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: sxr.ts,
        datasets: [
          {
            label: 'SXR Flux (W/m²)',
            data: sxr.vals,
            borderColor: COLORS.sxr,
            backgroundColor: 'rgba(255,107,53,0.08)',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: true,
            yAxisID: 'ySXR',
            tension: 0.2
          },
          {
            label: 'HXR Flux (cts/s)',
            data: hxr.vals,
            borderColor: COLORS.hxr,
            backgroundColor: 'rgba(0,188,212,0.06)',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: true,
            yAxisID: 'yHXR',
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { usePointStyle: true, padding: 16 } },
          annotation: { annotations }
        },
        scales: {
          x: {
            type: 'time',
            time: { tooltipFormat: 'yyyy-MM-dd HH:mm', unit: 'day' },
            ticks: { color: COLORS.textSecondary, maxTicksLimit: 10 },
            grid: { color: COLORS.gridColor }
          },
          ySXR: {
            type: 'logarithmic',
            position: 'left',
            title: { display: true, text: 'SXR (W/m²)', color: COLORS.sxr },
            ticks: { color: COLORS.sxr },
            grid: { color: COLORS.gridColor }
          },
          yHXR: {
            type: 'logarithmic',
            position: 'right',
            title: { display: true, text: 'HXR (cts/s)', color: COLORS.hxr },
            ticks: { color: COLORS.hxr },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  // ── 2. Confusion Matrix ────────────────────────────────────────────
  function renderConfusionMatrix(nowcastResults) {
    const KEY = 'confusionMatrix';
    destroyOld(KEY);
    const canvas = getCanvas('confusion-matrix-chart');
    if (!canvas) return;

    const cm = nowcastResults.confusionMatrix;
    const classes = nowcastResults.classes; // ['B','C','M','X']

    // Stacked horizontal bar: one bar per actual class, stacked by predicted
    const datasets = classes.map((predClass, pIdx) => ({
      label: 'Predicted ' + predClass,
      data: cm.map(row => row[pIdx]),
      backgroundColor: CLASS_COLORS[predClass],
      borderWidth: 0,
      barPercentage: 0.7
    }));

    instances[KEY] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: classes.map(c => 'Actual ' + c),
        datasets
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { usePointStyle: true, padding: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => `Predicted ${ctx.dataset.label.split(' ')[1]}: ${ctx.raw}`
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            title: { display: true, text: 'Count', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary },
            grid: { color: COLORS.gridColor }
          },
          y: {
            stacked: true,
            ticks: { color: COLORS.textPrimary },
            grid: { display: false }
          }
        }
      }
    });
  }

  // ── 3. ROC Curves ──────────────────────────────────────────────────
  function renderROC(nowcastResults) {
    const KEY = 'roc';
    destroyOld(KEY);
    const canvas = getCanvas('roc-curve-chart');
    if (!canvas) return;

    const datasets = nowcastResults.classes.map(c => ({
      label: `${c}-class (AUC=${nowcastResults.rocAuc[c].toFixed(3)})`,
      data: nowcastResults.rocCurves[c].fpr.map((x, i) => ({
        x,
        y: nowcastResults.rocCurves[c].tpr[i]
      })),
      borderColor: CLASS_COLORS[c],
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      showLine: true,
      tension: 0.3
    }));

    // Random classifier diagonal
    datasets.push({
      label: 'Random',
      data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      borderColor: 'rgba(255,255,255,0.2)',
      borderDash: [6, 4],
      borderWidth: 1,
      pointRadius: 0,
      showLine: true
    });

    instances[KEY] = new Chart(canvas, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { usePointStyle: true, padding: 12 } } },
        scales: {
          x: {
            min: 0, max: 1,
            title: { display: true, text: 'False Positive Rate', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary },
            grid: { color: COLORS.gridColor }
          },
          y: {
            min: 0, max: 1,
            title: { display: true, text: 'True Positive Rate', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary },
            grid: { color: COLORS.gridColor }
          }
        }
      }
    });
  }

  // ── 4. Precision-Recall Curves ─────────────────────────────────────
  function renderPR(nowcastResults) {
    const KEY = 'pr';
    destroyOld(KEY);
    const canvas = getCanvas('pr-curve-chart');
    if (!canvas) return;

    const datasets = nowcastResults.classes.map(c => ({
      label: c + '-class',
      data: nowcastResults.prCurves[c].recall.map((r, i) => ({
        x: r,
        y: nowcastResults.prCurves[c].precision[i]
      })),
      borderColor: CLASS_COLORS[c],
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      showLine: true,
      tension: 0.3
    }));

    instances[KEY] = new Chart(canvas, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { usePointStyle: true, padding: 12 } } },
        scales: {
          x: {
            min: 0, max: 1,
            title: { display: true, text: 'Recall', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary },
            grid: { color: COLORS.gridColor }
          },
          y: {
            min: 0, max: 1,
            title: { display: true, text: 'Precision', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary },
            grid: { color: COLORS.gridColor }
          }
        }
      }
    });
  }

  // ── 5. Per-Class Accuracy ──────────────────────────────────────────
  function renderPerClassAccuracy(nowcastResults) {
    const KEY = 'perClass';
    destroyOld(KEY);
    const canvas = getCanvas('per-class-chart');
    if (!canvas) return;

    const m = nowcastResults.metrics;
    const classes = nowcastResults.classes;

    const datasets = [
      {
        label: 'Accuracy',
        data: classes.map(c => (m.perClassAccuracy[c] * 100).toFixed(1)),
        backgroundColor: 'rgba(79,195,247,0.7)',
        borderRadius: 4
      },
      {
        label: 'TPR',
        data: classes.map(c => (m.perClassTPR[c] * 100).toFixed(1)),
        backgroundColor: 'rgba(102,187,106,0.7)',
        borderRadius: 4
      },
      {
        label: 'Precision',
        data: classes.map(c => (m.perClassPrecision[c] * 100).toFixed(1)),
        backgroundColor: 'rgba(255,167,38,0.7)',
        borderRadius: 4
      }
    ];

    instances[KEY] = new Chart(canvas, {
      type: 'bar',
      data: { labels: classes, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { usePointStyle: true, padding: 12 } },
          annotation: {
            annotations: {
              threshold: {
                type: 'line',
                yMin: 90,
                yMax: 90,
                borderColor: COLORS.gold,
                borderWidth: 2,
                borderDash: [6, 4],
                label: {
                  display: true,
                  content: '90 % Target',
                  position: 'end',
                  font: { size: 10 },
                  color: COLORS.gold,
                  backgroundColor: 'rgba(0,0,0,0.5)'
                }
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: COLORS.textPrimary },
            grid: { display: false }
          },
          y: {
            min: 0, max: 100,
            title: { display: true, text: 'Percentage (%)', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary },
            grid: { color: COLORS.gridColor }
          }
        }
      }
    });
  }

  // ── 6. Lead Time Histogram ─────────────────────────────────────────
  function renderLeadTimeHistogram(forecastResults) {
    const KEY = 'leadTime';
    destroyOld(KEY);
    const canvas = getCanvas('lead-time-chart');
    if (!canvas) return;

    // 10-min bins from 0-90
    const binEdges = [];
    for (let b = 0; b <= 90; b += 10) binEdges.push(b);
    const binLabels = [];
    const binCounts = [];
    for (let i = 0; i < binEdges.length - 1; i++) {
      binLabels.push(`${binEdges[i]}–${binEdges[i + 1]}`);
      const lo = binEdges[i], hi = binEdges[i + 1];
      binCounts.push(
        forecastResults.leadTimeDistribution.filter(v => v >= lo && v < hi).length
      );
    }

    const meanLead = forecastResults.metrics.meanLeadTime;

    instances[KEY] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: binLabels,
        datasets: [{
          label: 'Predictions',
          data: binCounts,
          backgroundColor: 'rgba(247,147,30,0.6)',
          borderColor: COLORS.accent,
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          annotation: {
            annotations: {
              meanLine: {
                type: 'line',
                xMin: meanLead / 10 - 0.5,
                xMax: meanLead / 10 - 0.5,
                borderColor: COLORS.flareX,
                borderWidth: 2,
                borderDash: [6, 4],
                label: {
                  display: true,
                  content: `Mean: ${meanLead.toFixed(1)} min`,
                  position: 'start',
                  font: { size: 10 },
                  color: COLORS.flareX,
                  backgroundColor: 'rgba(0,0,0,0.5)'
                }
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Lead Time (min)', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary },
            grid: { display: false }
          },
          y: {
            title: { display: true, text: 'Count', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary, stepSize: 1 },
            grid: { color: COLORS.gridColor }
          }
        }
      }
    });
  }

  // ── 7. Calibration (Reliability) Diagram ───────────────────────────
  function renderCalibration(forecastResults) {
    const KEY = 'calibration';
    destroyOld(KEY);
    const canvas = getCanvas('calibration-chart');
    if (!canvas) return;

    const cal = forecastResults.calibration;
    const dataPoints = cal.predicted
      .map((p, i) => (cal.observed[i] != null ? { x: p, y: cal.observed[i] } : null))
      .filter(Boolean);

    instances[KEY] = new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Model Calibration',
            data: dataPoints,
            borderColor: COLORS.accent,
            backgroundColor: COLORS.accent,
            pointRadius: 5,
            pointHoverRadius: 7,
            showLine: true,
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: 'Perfect Calibration',
            data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
            borderColor: 'rgba(255,255,255,0.25)',
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            showLine: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { usePointStyle: true, padding: 12 } } },
        scales: {
          x: {
            min: 0, max: 1,
            title: { display: true, text: 'Predicted Probability', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary },
            grid: { color: COLORS.gridColor }
          },
          y: {
            min: 0, max: 1,
            title: { display: true, text: 'Observed Frequency', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary },
            grid: { color: COLORS.gridColor }
          }
        }
      }
    });
  }

  // ── 8. Forecast Timeline ───────────────────────────────────────────
  function renderForecastTimeline(forecastResults) {
    const KEY = 'forecastTimeline';
    destroyOld(KEY);
    const canvas = getCanvas('forecast-timeline-chart');
    if (!canvas) return;

    // Last 20 successful predictions
    const successes = forecastResults.predictions
      .filter(p => p.hit && p.actualTime)
      .sort((a, b) => a.actualTime - b.actualTime)
      .slice(-20);

    const labels = successes.map(p => p.flareId);
    const leadTimes = successes.map(p => p.leadTimeMinutes);
    const bgColors = successes.map(p => CLASS_COLORS[p.actualClass] || COLORS.textSecondary);

    instances[KEY] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Lead Time (min)',
          data: leadTimes,
          backgroundColor: bgColors,
          borderWidth: 0,
          borderRadius: 4,
          barPercentage: 0.6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const p = successes[ctx.dataIndex];
                return `Lead: ${p.leadTimeMinutes} min | ${p.actualClass}-class`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Lead Time (minutes)', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary },
            grid: { color: COLORS.gridColor }
          },
          y: {
            ticks: { color: COLORS.textPrimary, font: { size: 10 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  // ── 9. Probability Timeline (NEW) ──────────────────────────────────
  function renderProbabilityTimeline(data, forecastResults) {
    const KEY = 'probabilityTimeline';
    destroyOld(KEY);
    const canvas = getCanvas('probability-timeline-chart');
    if (!canvas) return;

    const classes = ['B', 'C', 'M', 'X'];
    const startMs = data.timestamps[0];
    const endMs = data.timestamps[data.timestamps.length - 1];
    const windowMs = 24 * 60 * 60 * 1000; // 1-day rolling window

    // Build time ticks — one per day
    const timeTicks = [];
    for (let t = startMs; t <= endMs; t += windowMs) {
      timeTicks.push(t);
    }

    // For each class, compute a running probability at each time tick
    // based on forecast predictions that fall within a ±12 h window
    const halfWindow = windowMs / 2;
    const seriesByClass = {};
    classes.forEach(c => {
      seriesByClass[c] = timeTicks.map(t => {
        const nearby = forecastResults.predictions.filter(p => {
          const ref = p.predictedTime || p.actualTime;
          return ref && Math.abs(ref - t) < halfWindow && p.actualClass === c;
        });
        if (nearby.length === 0) return null;
        const avgProb = nearby.reduce((s, p) => s + p.probability, 0) / nearby.length;
        return Math.min(100, avgProb * 100);
      });
    });

    const datasets = classes.map(c => ({
      label: c + '-class',
      data: seriesByClass[c],
      borderColor: CLASS_COLORS[c],
      backgroundColor: CLASS_COLORS[c].replace(')', ',0.08)').replace('rgb', 'rgba'),
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
      fill: true,
      spanGaps: true
    }));

    instances[KEY] = new Chart(canvas, {
      type: 'line',
      data: { labels: timeTicks, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { usePointStyle: true, padding: 12 } }
        },
        scales: {
          x: {
            type: 'time',
            time: { tooltipFormat: 'yyyy-MM-dd', unit: 'day' },
            ticks: { color: COLORS.textSecondary, maxTicksLimit: 10 },
            grid: { color: COLORS.gridColor }
          },
          y: {
            min: 0, max: 100,
            title: { display: true, text: 'Probability (%)', color: COLORS.textSecondary },
            ticks: { color: COLORS.textSecondary },
            grid: { color: COLORS.gridColor }
          }
        }
      }
    });
  }

  // ── 10. Render All ─────────────────────────────────────────────────
  function renderAll(data, nowcastResults, forecastResults) {
    renderLightCurves(data);
    renderConfusionMatrix(nowcastResults);
    renderROC(nowcastResults);
    renderPR(nowcastResults);
    renderPerClassAccuracy(nowcastResults);
    renderLeadTimeHistogram(forecastResults);
    renderCalibration(forecastResults);
    renderForecastTimeline(forecastResults);
    renderProbabilityTimeline(data, forecastResults);
  }

  // ── Init (set Chart.js globals) ────────────────────────────────────
  function init() {
    Chart.defaults.color = COLORS.textSecondary;
    Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }

  // ── Export ─────────────────────────────────────────────────────────
  window.SolarFlareApp.Charts = {
    init,
    renderAll,
    renderLightCurves,
    renderConfusionMatrix,
    renderROC,
    renderPR,
    renderPerClassAccuracy,
    renderLeadTimeHistogram,
    renderCalibration,
    renderForecastTimeline,
    renderProbabilityTimeline
  };
})();
