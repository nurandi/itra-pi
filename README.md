# ITRA Performance Index (PI) Calculator

An unofficial, client-side web application designed to help trail runners estimate and simulate their [ITRA Performance Index](https://itra.run/FAQ/PerformanceIndex). 

**Live App:** [https://nurandi.github.io/itra-pi/](https://nurandi.github.io/itra-pi/)

## 🚀 Features

- **Automated Score Parsing:** Easily copy and paste your race history directly from the official ITRA website. The app parses your results instantly.
- **Manual Entry:** Add custom or hypothetical races manually to see how they impact your overall score.
- **Accurate Math:** Replicates the official ITRA decay formula, calculating maximum averages across multiple scenarios (Top 1 to Top 5 races) based on how old the races are (0-36 months).
- **Target PI Simulation:** Enter a target PI, and the app will simulate exactly what score you need to achieve in your next race (assuming it was run today) to hit that target.
- **Improvement Simulation:** Calculates the exact score required in your next race to improve your overall PI by at least +1.
- **PDF Export:** Generate clean, printable A4 PDF reports of your current PI status, your historical races, and your calculation breakdown.

## 🛠️ How It Works

The ITRA PI is calculated based on a weighted average of your best 5 races within the last 36 months. As races get older, their weight decreases (time decay). 

This tool runs the exact same mathematical simulation across 5 different scenarios to find your best possible score, just like the official ITRA algorithm.

For a deep dive into the math behind the ITRA Performance Index, check out this [detailed Threads explanation](https://www.threads.com/share/LU2-4pzqa/).

## 🏃‍♂️ Usage

1. Open your runner profile on [itra.run](https://itra.run).
2. Highlight and copy your race results table.
3. Paste the text directly into the "Race History" input box in the app.
4. Watch the dashboard instantly update with your Current PI, Level, and Simulation targets!

## 💻 Technology Stack

This is a 100% static, client-side web application. It requires zero installation and uses zero backend servers. All data processing and math is handled directly inside your browser.

- **HTML5 / CSS3 / JavaScript (Vanilla)**
- **Chart.js** (For rendering the simulation curves)
- **jsPDF & html2canvas** (For PDF report generation)
- Hosted automatically via **GitHub Pages**

## ⚠️ Disclaimer

This is an unofficial tool made by a runner, for runners. It is not affiliated with, endorsed by, or sponsored by the International Trail Running Association. ITRA® is a registered trademark of the International Trail Running Association.
