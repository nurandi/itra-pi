// Data Models
let races = [];
let chartInstance = null;

// ITRA Math Logic
function getMonthsAgo(todayDate, raceDate) {
    let years = todayDate.getFullYear() - raceDate.getFullYear();
    let months = todayDate.getMonth() - raceDate.getMonth();
    let dayOffset = (todayDate.getDate() < raceDate.getDate()) ? -1 : 0;
    return years * 12 + months + dayOffset;
}

function getTimeWeight(monthsAgo) {
    if (monthsAgo >= 0 && monthsAgo <= 11) return 1.000;
    if (monthsAgo >= 12 && monthsAgo <= 17) return 0.995;
    if (monthsAgo >= 18 && monthsAgo <= 23) return 0.990;
    if (monthsAgo >= 24 && monthsAgo <= 29) return 0.985;
    if (monthsAgo >= 30 && monthsAgo <= 35) return 0.980;
    return 0.0;
}

function roundHalfUp(value, decimals=1) {
    let multiplier = Math.pow(10, decimals);
    return Math.floor(value * multiplier + 0.5) / multiplier;
}

function calculateItraPiCore(inputRaces, today = new Date()) {
    let validRaces = [];
    for (let race of inputRaces) {
        if(!race.score) continue;
        let dObj = new Date(race.date);
        if (isNaN(dObj.getTime())) continue; // invalid date
        
        let monthsAgo = getMonthsAgo(today, dObj);
        if (monthsAgo < 36 && monthsAgo >= 0) {
            validRaces.push({
                date: race.date,
                name: race.name,
                score: parseFloat(race.score),
                monthsAgo: monthsAgo
            });
        }
    }

    if (validRaces.length === 0) {
        return { pi: 0, maxAverage: 0, bestScenario: 0, allAverages: {}, allScenarioLogs: {}, bestScenarioLog: [], top5: [] };
    }

    for (let race of validRaces) {
        let tw = getTimeWeight(race.monthsAgo);
        let ws = roundHalfUp(race.score * tw, 1);
        race.timeWeight = tw;
        race.weightedScore = ws;
    }

    validRaces.sort((a, b) => b.weightedScore - a.weightedScore);
    let top5 = validRaces.slice(0, 5);

    let expWeightsMap = {
        1: [0.97],
        2: [0.99, 0.98],
        3: [1.00, 0.99, 0.99],
        4: [1.01, 1.00, 1.00, 0.99],
        5: [1.02, 1.01, 1.00, 1.00, 0.99]
    };

    let numScenarios = top5.length;
    let maxAverage = 0;
    let bestScenario = 0;
    let bestScenarioLog = [];
    let allAverages = {};
    let allScenarioLogs = {};

    for (let i = 1; i <= numScenarios; i++) {
        let scenarioRaces = top5.slice(0, i);
        let weights = expWeightsMap[i];

        let totalWxScore = 0;
        let scenarioLog = [];

        for (let j = 0; j < i; j++) {
            let wScore = scenarioRaces[j].weightedScore;
            let eWeight = weights[j];
            let wxScore = roundHalfUp(wScore * eWeight, 1);
            totalWxScore += wxScore;

            scenarioLog.push({
                name: scenarioRaces[j].name,
                date: scenarioRaces[j].date,
                wScore: wScore,
                eWeight: eWeight,
                wxScore: wxScore
            });
        }

        let avg = roundHalfUp(totalWxScore / i, 1);
        allAverages[i] = avg;
        allScenarioLogs[i] = scenarioLog; // Save log for every scenario

        if (avg > maxAverage) {
            maxAverage = avg;
            bestScenario = i;
            bestScenarioLog = scenarioLog;
        }
    }

    let finalPi = Math.floor(maxAverage);
    
    return {
        pi: finalPi,
        maxAverage: maxAverage,
        bestScenario: bestScenario,
        allAverages: allAverages,
        allScenarioLogs: allScenarioLogs,
        bestScenarioLog: bestScenarioLog,
        top5: top5
    };
}


// DOM Elements
const downloadPdfBtn = document.getElementById('download-pdf-btn');
const pasteInput = document.getElementById('itra-paste-input');
const raceListEl = document.getElementById('race-list');
const addRaceBtn = document.getElementById('add-race-btn');
const clearDataBtn = document.getElementById('clear-data-btn');
const currentPiEl = document.getElementById('current-pi-value');
const currentRawValue = document.getElementById('current-raw-value');
const currentScenarioEl = document.getElementById('current-scenario-value');
const piLevelEl = document.getElementById('current-pi-level');
const allScenariosContainer = document.getElementById('all-scenarios-container');
const targetPiInput = document.getElementById('target-pi-input');
const simulationResultsEl = document.getElementById('simulation-results');
const ctx = document.getElementById('simulationChart').getContext('2d');
const dashboardGrid = document.querySelector('.dashboard-grid');

// Parse logic
function parseItraPaste(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedRaces = [];
    const dateRegex = /^\d{2,4}[-/]\d{1,2}[-/]\d{1,4}$/;
    
    let currentChunk = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (dateRegex.test(line)) {
            if (currentChunk.length > 0) {
                parsedRaces.push(processChunk(currentChunk));
            }
            currentChunk = [line];
        } else if (currentChunk.length > 0) {
            currentChunk.push(line);
        }
    }
    
    if (currentChunk.length > 0) {
        parsedRaces.push(processChunk(currentChunk));
    }
    
    function processChunk(chunk) {
        let race = {
            id: Date.now() + Math.random().toString(),
            date: chunk[0],
            name: chunk.length > 2 ? chunk[2] : "Unknown Race",
            score: 0
        };
        
        if (chunk.some(l => /\bDNF\b/i.test(l))) {
            return race; // Score remains 0, will be filtered out
        }
        
        let timeIndex = chunk.findIndex(l => /\b\d{1,3}:\d{2}(:\d{2})?\b/.test(l));
        if (timeIndex !== -1 && timeIndex + 1 < chunk.length) {
            let scoreMatch = chunk[timeIndex + 1].match(/(?:^|\s)(\d+)/);
            if (scoreMatch) race.score = parseInt(scoreMatch[1]);
        } else {
            for (let j = chunk.length - 1; j >= 0; j--) {
                let lowerLine = chunk[j].toLowerCase();
                if (lowerLine.includes(':') || lowerLine.match(/\d+\s*(m|km)\b/i) || lowerLine.includes('point') || lowerLine.match(/\b\d{4}-\d{2}-\d{2}\b/)) continue;
                
                let match = chunk[j].match(/(?:^|\s)(\d+)(down arrow|up arrow|-|\s|$)/i);
                if (match) {
                    let s = parseInt(match[1]);
                    if (s > 100 && s < 2000) { 
                        race.score = s;
                        break;
                    }
                }
            }
        }
        return race;
    }
    
    return parsedRaces.filter(r => r.score > 0);
}

function saveRaces() {
    localStorage.setItem('itraRaces', JSON.stringify(races));
    updateDashboard();
}

function loadRaces() {
    const saved = localStorage.getItem('itraRaces');
    if (saved) {
        races = JSON.parse(saved);
        renderRaceList();
        updateDashboard();
    }
}

function renderRaceList() {
    raceListEl.innerHTML = '';
    races.forEach((race) => {
        const row = document.createElement('div');
        row.className = 'race-row';
        row.innerHTML = `
            <div class="input-group">
                <label>Date</label>
                <input type="date" value="${race.date}" onchange="updateRace('${race.id}', 'date', this.value)">
            </div>
            <div class="input-group" style="flex: 2;">
                <label>Race Name</label>
                <input type="text" value="${race.name}" placeholder="e.g. UTMB 100K" onchange="updateRace('${race.id}', 'name', this.value)">
            </div>
            <div class="input-group">
                <label>Score</label>
                <input type="number" value="${race.score}" placeholder="0" onchange="updateRace('${race.id}', 'score', this.value)">
            </div>
            <button class="btn-remove" onclick="removeRace('${race.id}')">✕</button>
        `;
        raceListEl.appendChild(row);
    });
}

window.updateRace = (id, field, value) => {
    const race = races.find(r => r.id === id);
    if (race) {
        race[field] = value;
        saveRaces();
    }
}

window.removeRace = (id) => {
    races = races.filter(r => r.id !== id);
    saveRaces();
    renderRaceList();
}

addRaceBtn.addEventListener('click', () => {
    races.push({
        id: Date.now().toString(),
        date: '',
        name: '',
        score: ''
    });
    saveRaces();
    renderRaceList();
});

clearDataBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to clear all your imported races?")) {
        races = [];
        saveRaces();
        renderRaceList();
        targetPiInput.value = '';
    }
});

pasteInput.addEventListener('input', (e) => {
    const text = e.target.value;
    if (text.length > 20) {
        const parsed = parseItraPaste(text);
        if (parsed.length > 0) {
            races = parsed;
            renderRaceList();
            saveRaces();
            e.target.value = ''; 
            e.target.placeholder = "Successfully imported " + parsed.length + " races!";
            setTimeout(() => { e.target.placeholder = "Paste your ITRA results table here...\n(e.g. highlight the table, press Ctrl+C, then paste here)"; }, 3000);
        } else {
            e.target.value = '';
            e.target.placeholder = "Could not detect valid races in that text. Please try copying again!";
            setTimeout(() => { e.target.placeholder = "Paste your ITRA results table here...\n(e.g. highlight the table, press Ctrl+C, then paste here)"; }, 4000);
        }
    }
});

targetPiInput.addEventListener('input', updateDashboard);

function updateDashboard() {
    if (races.length === 0) {
        document.body.classList.add('empty-state');
    } else {
        document.body.classList.remove('empty-state');
    }

    const today = new Date();
    const result = calculateItraPiCore(races, today);
    // Update PI Value
    currentPiEl.textContent = result.pi || '0';
    currentRawValue.textContent = result.maxAverage ? result.maxAverage.toFixed(1) : '0.0';
    currentScenarioEl.textContent = result.bestScenario || '-';
    
    // Update PI Level
    if (result.pi > 0) {
        const levelData = getPiLevel(result.pi, currentGender);
        piLevelEl.textContent = levelData.n;
        piLevelEl.style.color = levelData.c;
    } else {
        piLevelEl.textContent = '-';
        piLevelEl.style.color = 'var(--text-main)';
    }
    
    // Render all scenarios list as expandable accordions
    let scenariosHtml = ``;
    if (result.allAverages && Object.keys(result.allAverages).length > 0) {
        for (let i = 1; i <= Object.keys(result.allAverages).length; i++) {
            if (result.allAverages[i]) {
                const isBest = (i === result.bestScenario);
                const log = result.allScenarioLogs[i];
                
                let tableHtml = `<div class="top-races-table" style="overflow-x: auto; margin-top: 1rem;">
                    <table>
                        <tr><th>Date</th><th>Name</th><th>W. Score</th><th>Weight</th><th>Final Score</th></tr>`;
                
                log.forEach((r) => {
                    tableHtml += `
                        <tr>
                            <td>${r.date}</td>
                            <td>${r.name}</td>
                            <td>${r.wScore.toFixed(1)}</td>
                            <td>${r.eWeight.toFixed(2)}</td>
                            <td style="font-weight: bold; color: #fff;">${r.wxScore.toFixed(1)}</td>
                        </tr>
                    `;
                });
                tableHtml += `</table></div>`;

                scenariosHtml += `
                    <details class="scenario-details-item" ${isBest ? 'open' : ''}>
                        <summary class="${isBest ? 'best-scenario-summary' : ''}">
                            <span class="scenario-title">Scenario ${i} ${isBest ? '⭐ (BEST)' : ''}</span>
                            <span class="scenario-score">${result.allAverages[i].toFixed(1)}</span>
                        </summary>
                        <div class="scenario-content">
                            ${tableHtml}
                        </div>
                    </details>
                `;
            }
        }
    } else {
        scenariosHtml = `<p style="color: var(--text-muted); text-align: center;">No valid calculations yet. Add or paste races to see scenarios.</p>`;
    }
    
    allScenariosContainer.innerHTML = scenariosHtml;
    
    runSimulation(result, today);
}

function runSimulation(currentResult, today) {
    if (!currentResult.pi) {
        simulationResultsEl.innerHTML = "";
        if(chartInstance) chartInstance.destroy();
        return;
    }
    
    const targetPiInputVal = parseInt(targetPiInput.value);
    const targetPi = isNaN(targetPiInputVal) ? (currentResult.pi ? currentResult.pi + 10 : null) : targetPiInputVal;
    
    if (currentResult.pi) {
        targetPiInput.placeholder = `${currentResult.pi + 10}`;
    }
    
    const newDate = today.toISOString().split('T')[0];
    
    let improveScore = null;
    let improveScenario = null;
    let targetScore = null;
    let targetScenario = null;
    
    const plotX = [];
    const scenY = {1:[], 2:[], 3:[], 4:[], 5:[]};
    const maxY = [];
    
    for (let s = 300; s <= 800; s+=5) {
        plotX.push(s);
        const testRaces = [...races, { date: newDate, name: "Simulation", score: s }];
        const res = calculateItraPiCore(testRaces, today);
        
        maxY.push(res.maxAverage);
        for(let i=1; i<=5; i++) {
            scenY[i].push(res.allAverages[i] || null);
        }
        
        if (improveScore === null && res.pi > currentResult.pi) {
            improveScore = s;
            improveScenario = res.bestScenario;
        }
        if (targetPi && targetScore === null && res.pi >= targetPi) {
            targetScore = s;
            targetScenario = res.bestScenario;
        }
    }
    
    let simText = "";
    
    if (improveScore) {
        simText += `
        <div class="sim-box success">
            <div class="sim-box-info">
                <h4>To Improve Current PI</h4>
                <p>Increase your PI by at least +1</p>
            </div>
            <div class="sim-box-score">
                <div class="big-number">${improveScore}</div>
                <div class="scenario-badge">Uses Scenario ${improveScenario}</div>
            </div>
        </div>`;
    } else {
        simText += `
        <div class="sim-box error">
            <div class="sim-box-info">
                <h4>Improve Current PI</h4>
                <p>Cannot improve PI with a single race (up to 800).</p>
            </div>
        </div>`;
    }
    
    if (targetPi) {
        if (targetScore) {
            simText += `
            <div class="sim-box">
                <div class="sim-box-info">
                    <h4>To Reach Target PI (${targetPi})</h4>
                    <p>Minimum score required in your next race</p>
                </div>
                <div class="sim-box-score">
                    <div class="big-number">${targetScore}</div>
                    <div class="scenario-badge">Uses Scenario ${targetScenario}</div>
                </div>
            </div>`;
        } else {
            simText += `
            <div class="sim-box error">
                <div class="sim-box-info">
                    <h4>Target PI (${targetPi})</h4>
                    <p>Cannot reach PI ${targetPi} with a single new race (up to 800).</p>
                </div>
            </div>`;
        }
    }
    
    simulationResultsEl.innerHTML = simText;
    
    updateChart(plotX, maxY, scenY, currentResult.pi, targetPi);
}

function updateChart(labels, maxData, scenData, currentPI, targetPI) {
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    const datasets = [
        {
            label: 'Final PI (Max)',
            data: maxData,
            borderColor: 'rgba(113, 113, 122, 0.25)', // Semi-transparent Zinc 500
            borderWidth: 7, // Thicker halo effect
            tension: 0,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 10 // Pushes this line to the very background
        },
        { label: 'Scenario 1', data: scenData[1], borderColor: '#ea580c', borderWidth: 1.5, tension: 0, borderDash: [4, 4], pointRadius: 0, order: 1 },
        { label: 'Scenario 2', data: scenData[2], borderColor: '#0284c7', borderWidth: 1.5, tension: 0, borderDash: [4, 4], pointRadius: 0, order: 1 },
        { label: 'Scenario 3', data: scenData[3], borderColor: '#059669', borderWidth: 1.5, tension: 0, borderDash: [4, 4], pointRadius: 0, order: 1 },
        { label: 'Scenario 4', data: scenData[4], borderColor: '#7c3aed', borderWidth: 1.5, tension: 0, borderDash: [4, 4], pointRadius: 0, order: 1 },
        { label: 'Scenario 5', data: scenData[5], borderColor: '#db2777', borderWidth: 1.5, tension: 0, borderDash: [4, 4], pointRadius: 0, order: 1 }
    ];
    
    const config = {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        plugins: [{
            id: 'crosshairPlugin',
            afterDraw: (chart) => {
                if (chart.tooltip && chart.tooltip._active && chart.tooltip._active.length) {
                    const activePoint = chart.tooltip._active[0];
                    const ctx = chart.ctx;
                    const x = activePoint.element.x;
                    const y = activePoint.element.y;
                    const { top, bottom, left, right } = chart.chartArea;
                    
                    ctx.save();
                    ctx.beginPath();
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'rgba(161, 161, 170, 0.5)'; // Zinc 400
                    ctx.setLineDash([4, 4]);
                    
                    // Vertical line
                    ctx.moveTo(x, top);
                    ctx.lineTo(x, bottom);
                    
                    // Horizontal line
                    ctx.moveTo(left, y);
                    ctx.lineTo(right, y);
                    
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }],
        options: {
            layout: { padding: { top: 20 } },
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    labels: { 
                        color: '#a1a1aa',
                        usePointStyle: true,
                        pointStyle: 'line'
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'New Race Score', color: '#a1a1aa' },
                    grid: { color: '#27272a' },
                    ticks: { color: '#a1a1aa' }
                },
                y: {
                    title: { display: true, text: 'Resulting Raw PI', color: '#a1a1aa' },
                    grid: { color: '#27272a' },
                    ticks: { color: '#a1a1aa' }
                }
            }
        }
    };
    
    chartInstance = new Chart(ctx, config);
}

function getPiLevel(pi, gender) {
    if (pi <= 0) return { n: '-', c: 'var(--text-main)' };
    
    let levels;
    if (gender === 'women') {
        levels = [
            { t: 775, n: 'Elite 1', c: '#cc4952' },
            { t: 750, n: 'Elite 2', c: '#cc4952' },
            { t: 725, n: 'Elite 3', c: '#cc4952' },
            { t: 700, n: 'Elite 4', c: '#cc4952' },
            { t: 675, n: 'Expert 1', c: '#d69155' },
            { t: 650, n: 'Expert 2', c: '#d69155' },
            { t: 625, n: 'Expert 3', c: '#d69155' },
            { t: 600, n: 'Expert 4', c: '#d69155' },
            { t: 575, n: 'Advanced 1', c: '#d2ca59' },
            { t: 550, n: 'Advanced 2', c: '#d2ca59' },
            { t: 525, n: 'Advanced 3', c: '#d2ca59' },
            { t: 500, n: 'Advanced 4', c: '#d2ca59' },
            { t: 475, n: 'Intermediate 1', c: '#5eb174' },
            { t: 450, n: 'Intermediate 2', c: '#5eb174' },
            { t: 400, n: 'Intermediate 3', c: '#5eb174' },
            { t: 300, n: 'Intermediate 4', c: '#5eb174' },
            { t: 0,   n: 'Novice', c: '#34764b' }
        ];
    } else {
        levels = [
            { t: 900, n: 'Elite 1', c: '#cc4952' },
            { t: 875, n: 'Elite 2', c: '#cc4952' },
            { t: 850, n: 'Elite 3', c: '#cc4952' },
            { t: 825, n: 'Elite 4', c: '#cc4952' },
            { t: 800, n: 'Expert 1', c: '#d69155' },
            { t: 775, n: 'Expert 2', c: '#d69155' },
            { t: 750, n: 'Expert 3', c: '#d69155' },
            { t: 725, n: 'Expert 4', c: '#d69155' },
            { t: 700, n: 'Advanced 1', c: '#d2ca59' },
            { t: 650, n: 'Advanced 2', c: '#d2ca59' },
            { t: 600, n: 'Advanced 3', c: '#d2ca59' },
            { t: 550, n: 'Advanced 4', c: '#d2ca59' },
            { t: 500, n: 'Intermediate 1', c: '#5eb174' },
            { t: 450, n: 'Intermediate 2', c: '#5eb174' },
            { t: 400, n: 'Intermediate 3', c: '#5eb174' },
            { t: 300, n: 'Intermediate 4', c: '#5eb174' },
            { t: 0,   n: 'Novice', c: '#34764b' }
        ];
    }
    
    for (let l of levels) {
        if (pi > l.t) return l;
    }
    return levels[levels.length - 1];
}

// PDF Download Logic
downloadPdfBtn.addEventListener('click', () => {
    if (typeof html2pdf === 'undefined') {
        window.print();
        return;
    }
    
    try {
        downloadPdfBtn.textContent = '⏳ Generating...';
        downloadPdfBtn.disabled = true;
        
        const element = document.getElementById('pdf-content');
        const opt = {
            margin:       [10, 10, 10, 10],
            filename:     `ITRA_PI_Report_${new Date().toISOString().split('T')[0]}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#09090b' },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().set(opt).from(element).save().then(() => {
            downloadPdfBtn.textContent = '📄 Download PDF Report';
            downloadPdfBtn.disabled = false;
        }).catch(err => {
            console.error("PDF generation failed:", err);
            downloadPdfBtn.textContent = '📄 Download PDF Report';
            downloadPdfBtn.disabled = false;
            alert("Failed to generate PDF. Check console for details.");
        });
    } catch (err) {
        console.error("PDF sync error:", err);
        downloadPdfBtn.textContent = '📄 Download PDF Report';
        downloadPdfBtn.disabled = false;
        window.print(); // Fallback
    }
});

// Initialize
let currentGender = 'men';
document.querySelectorAll('input[name="gender"]').forEach(input => {
    input.addEventListener('change', (e) => {
        currentGender = e.target.value;
        updateDashboard();
    });
});

loadRaces();
updateDashboard();

// Sidebar Toggle Logic
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');

toggleSidebarBtn.addEventListener('click', () => {
    dashboardGrid.classList.toggle('sidebar-hidden');
    
    // Slight delay to let animation finish before forcing a chart resize if needed
    setTimeout(() => {
        if(chartInstance) {
            chartInstance.resize();
        }
    }, 300);
});
