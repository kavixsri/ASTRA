# Aditya-L1 Solar Flare ML Pipeline Dashboard

A comprehensive, browser-based machine learning pipeline and dashboard designed to process, analyze, nowcast, and forecast solar flare events using synthetic Soft X-Ray (SXR) and Hard X-Ray (HXR) data mimicking the **SoLEXS** and **HEL1OS** instruments aboard ISRO's Aditya-L1 mission.

## 🚀 Features

*   **Real-Time Flare Alerts:** Automated visual alerts triggered by nowcasting and forecasting models, featuring an animated risk panel, probability bars, and a rolling probability timeline.
*   **Machine Learning Nowcasting:** Utilizes a simulated Support Vector Machine (SVM) algorithm to extract physical features (peak flux, SXR/HXR ratio) and classify flares (B, C, M, X) against strict mathematical decision boundaries.
*   **Kinematic Forecasting:** Employs a regression model that calculates the early rise-phase derivative of the X-ray flux to predict imminent peaks, dynamically quantifying lead time.
*   **Active Region Monitoring:** Tracks solar active regions with heliographic coordinates and McIntosh magnetic classifications (Alpha, Beta, Beta-Gamma, Beta-Gamma-Delta) to estimate region-specific flare probabilities.
*   **Unified Master Flare Catalog:** A searchable, filterable, and sortable database of all combined SXR and HXR flare detections.
*   **Comprehensive Evaluation Metrics:** Visualizes model performance via Confusion Matrices, ROC Curves, Precision-Recall Curves, Lead Time Distributions, and Reliability Diagrams using Chart.js.

## 📁 Project Structure

```text
solar-flare-ml/
├── index.html              # Main dashboard layout (9 sections)
├── css/
│   └── styles.css          # Premium dark space-themed CSS with glassmorphism
└── js/
    ├── app.js              # Pipeline orchestrator, alerts, active regions, animations
    ├── catalog.js          # Master flare catalog logic (sorting, filtering)
    ├── charts.js           # Chart.js visualization wrappers
    ├── data-generator.js   # Physics-based synthetic data generation
    └── ml-pipeline.js      # Feature-based SVM nowcasting & kinematic forecasting
```

## 🛠️ Technologies Used

*   **HTML5 / CSS3:** Semantic structure with custom CSS variables, flexbox/grid layouts, CSS animations, and glassmorphism styling.
*   **Vanilla JavaScript (ES6+):** Modular, IIFE-wrapped JS architecture with zero build-step requirements.
*   **Chart.js (v4.4.4):** Used for rendering highly interactive and performant canvas-based charts. Includes `chartjs-adapter-date-fns` for time-scale parsing and `chartjs-plugin-annotation` for threshold lines.
*   **Google Fonts:** Inter font family for clean, modern typography.

## 💻 How to Run

Because this project is built entirely with client-side HTML, CSS, and JavaScript, it requires no backend server, node modules, or build processes.

1.  Clone or download this repository.
2.  Navigate to the `solar-flare-ml` directory.
3.  Double-click `index.html` to open it in any modern web browser (Chrome, Firefox, Safari, Edge).

## 🧠 Machine Learning Approach

*   **Nowcasting (Detection & Classification):** The pipeline uses a continuous scoring model (analogous to Logistic Regression or SVM) evaluating the `log10(peakSxrFlux)` alongside the thermal/non-thermal `sxrHxrRatio`. Decision boundaries are set at strict physical thresholds (e.g., -4.05 for X-class, -5.05 for M-class) to categorize events while rejecting background stochastic noise.
*   **Forecasting (Lead Time Prediction):** A threshold-based kinematic algorithm continuously evaluates the initial slope (`peakSxrFlux / riseTime`). Upon crossing a detection threshold (`1e-10`), it projects the lead time inversely proportional to the rise rate, factoring in a standard processing latency, yielding quantified warning times prior to the flare peak.

---
*Built for ISRO Space Science Research Data processing workflows.*
