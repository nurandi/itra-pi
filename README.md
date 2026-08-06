# ITRA Performance Index (PI) Calculator

An unofficial, client-side web application designed to help trail runners estimate and simulate their [ITRA Performance Index](https://itra.run/FAQ/PerformanceIndex). 

**Live App:** [https://nurandi.github.io/itra-pi/](https://nurandi.github.io/itra-pi/)

## 🚀 Features

- **Automated Profile Parsing:** Just hit `Ctrl+A` on your ITRA profile page and paste it into the app. It automatically extracts your Name, ITRA ID, Gender, Age Category, Nationality, and all race results (including Distance and Time).
- **Accurate PI Levels:** Automatically detects your gender to accurately assign your official ITRA category (e.g., Elite, Advanced, Strong) based on your score.
- **Dynamic Simulation:** Enter a target PI, and the app will simulate exactly what score you need in your next race (dynamically scaling up to 1000 for Elite athletes) to hit that target.
- **Improvement Simulation:** Calculates the exact score required in your next race to improve your overall PI by at least +1.
- **Manual Entry:** Add custom or hypothetical races manually to see how they impact your overall score, with built-in score validation guardrails (0-1000).
- **PDF Report Export:** Generate clean, paginated A4 PDF reports of your current PI status, detailed race history table, and calculation breakdown using native browser printing.
- **Mobile Responsive:** Works beautifully on mobile devices, with intelligent collapsing panels and touch-friendly charts.
- **Privacy First:** 100% of calculations are done in your browser. No data is sent to any server.

## 🛠️ How It Works

The ITRA PI is calculated based on a weighted average of your best 5 races within the last 36 months. As races get older, their weight decreases (time decay). 

This tool runs the exact same mathematical simulation across 5 different scenarios to find your best possible score, just like the official ITRA algorithm.

For a deep dive into the math behind the ITRA Performance Index, check out this [detailed Threads explanation](https://www.threads.com/share/LU2-4pzqa/).

## 🏃‍♂️ Usage

1. Open your runner profile on [itra.run](https://itra.run) and navigate to the **Results** tab. (Make sure to click **"Load more results"** if needed to show your races from the last 3 years).
2. Select all the text on the page (`Ctrl+A` or `Cmd+A`) and copy it.
3. Paste the text directly into the "Race History" input box in the app.
4. Watch the dashboard instantly update with your custom Athlete Badges, Current PI, Level, and Simulation charts!

*(Don't have an ITRA profile? You can copy and paste this [Sample Data](sample-data.txt) to test the app!)*

## 💻 Technology Stack

This is a 100% static, client-side web application. It requires zero installation and uses zero backend servers. All data processing and math is handled directly inside your browser.

- **HTML5 / CSS3 / JavaScript (Vanilla)**
- **Chart.js** (For rendering the simulation curves)
- Hosted automatically via **GitHub Pages**

## ⚠️ Disclaimer

This is an unofficial tool made by a runner, for runners. It is not affiliated with, endorsed by, or sponsored by the International Trail Running Association. ITRA® is a registered trademark of the International Trail Running Association.
