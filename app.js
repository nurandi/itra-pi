// Data Models
let races = [];
let chartInstance = null;
let runnerName = '';
let runnerItraId = '';
let runnerGender = '';
let runnerAgeGroup = '';
let runnerNationality = '';

function getItraBadgeHtml(points) {
    if (!points) return '';
    let color = '#7d7d7d';
    let text = points;
    switch(String(points)) {
        case '1': color = '#8cc63f'; break;
        case '2': color = '#cdd500'; break;
        case '3': color = '#51c4e9'; break;
        case '4': color = '#ab6ba6'; break;
        case '5': color = '#df7329'; break;
        case '6': color = '#b7292b'; break;
        case 'SIM': color = '#18181b'; text = '★'; break;
    }
    return `<span style="background: ${color}; color: white; padding: 1px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; margin-right: 6px; display: inline-block; min-width: 12px; text-align: center;">${text}</span>`;
}

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
                ...race,
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
                ...scenarioRaces[j],
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
const bestRacesTbody = document.getElementById('best-races-tbody');
const bestRacesCard = document.getElementById('best-races-card');
const targetPiInput = document.getElementById('target-pi-input');
const simulationResultsEl = document.getElementById('simulation-results');
const ctx = document.getElementById('simulationChart').getContext('2d');
const dashboardGrid = document.querySelector('.dashboard-grid');
const runnerInfoEl = document.getElementById('runner-info');

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
        let raceName = "Unknown Race";
        if (chunk.length > 2) {
            if (chunk[1].toLowerCase() === 'category' && chunk.length > 3) {
                raceName = chunk[3];
            } else {
                raceName = chunk[2];
            }
        }
        
        let race = {
            id: Date.now() + Math.random().toString(),
            date: chunk[0],
            name: raceName,
            dist: '-',
            time: '-',
            score: 0
        };
        
        if (chunk.some(l => /\bDNF\b/i.test(l))) {
            return race; // Score remains 0, will be filtered out
        }
        
        let timeIndex = chunk.findIndex(l => /\b\d{1,3}:\d{2}(:\d{2})?\b/.test(l));
        let foundScore = false;
        
        if (timeIndex !== -1) {
            race.time = chunk[timeIndex].match(/\b\d{1,3}:\d{2}(:\d{2})?\b/)[0];
            for (let k = 1; k <= 3; k++) {
                if (timeIndex + k < chunk.length) {
                    let text = chunk[timeIndex + k];
                    if (text.toLowerCase().includes('race score')) continue;
                    let scoreMatch = text.match(/(?:^|\s)(\d+)/);
                    if (scoreMatch) {
                        let s = parseInt(scoreMatch[1]);
                        if (s > 100 && s < 2000) {
                            race.score = s;
                            foundScore = true;
                            break;
                        }
                    }
                }
            }
        }
        
        if (!foundScore) {
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
        
        let distMatch = chunk.find(l => /\d+(?:\.\d+)?\s*km/i.test(l));
        if (distMatch) {
            race.dist = distMatch.match(/(\d+(?:\.\d+)?)\s*km/i)[1] + ' km';
        }
        
        // Parse Elevation
        let elevMatch = chunk.find(l => /\b\d+\s*m\+/i.test(l));
        if (elevMatch) {
            race.elev = elevMatch.match(/(\d+)\s*m\+/i)[1] + ' m+';
        } else {
            race.elev = '-';
        }
        
        // Parse Points
        race.points = '';
        let fullChunkText = chunk.join(' ');
        let pointsMatch = fullChunkText.match(/Itra Point\s*(\d)/i);
        if (pointsMatch) {
            race.points = pointsMatch[1];
        } else {
            let mPlusMatch = fullChunkText.match(/\b\d+\s*m\+\s*([0-6])(?=\s|$)/i);
            if (mPlusMatch) {
                race.points = mPlusMatch[1];
            } else {
                let kmMatch = fullChunkText.match(/\d+(?:\.\d+)?\s*km(?:\s*\/)?\s*([0-6])(?=\s|$)/i);
                if (kmMatch) {
                    race.points = kmMatch[1];
                }
            }
        }
        
        // Fallback: Calculate Points from Distance and Elevation if missing!
        if (!race.points && race.dist !== '-' && race.elev !== '-') {
            let km = parseFloat(race.dist);
            let m = parseFloat(race.elev);
            if (!isNaN(km) && !isNaN(m)) {
                let effort = km + (m / 100);
                if (effort >= 210) race.points = '6';
                else if (effort >= 155) race.points = '5';
                else if (effort >= 115) race.points = '4';
                else if (effort >= 75) race.points = '3';
                else if (effort >= 45) race.points = '2';
                else if (effort >= 25) race.points = '1';
                else race.points = '0';
            }
        }
        
        // Fallback: Calculate Points from Distance and Elevation if missing!
        if (!race.points && race.dist !== '-' && race.elev !== '-') {
            let km = parseFloat(race.dist);
            let m = parseFloat(race.elev);
            if (!isNaN(km) && !isNaN(m)) {
                let effort = km + (m / 100);
                if (effort >= 210) race.points = '6';
                else if (effort >= 155) race.points = '5';
                else if (effort >= 115) race.points = '4';
                else if (effort >= 75) race.points = '3';
                else if (effort >= 45) race.points = '2';
                else if (effort >= 25) race.points = '1';
                else race.points = '0';
            }
        }
        
        return race;
    }
    
    return parsedRaces.filter(r => r.score > 0);
}

function saveRaces() {
    localStorage.setItem('itraRaces', JSON.stringify(races));
    localStorage.setItem('runnerName', runnerName);
    localStorage.setItem('runnerItraId', runnerItraId);
    localStorage.setItem('runnerGender', runnerGender);
    localStorage.setItem('runnerAgeGroup', runnerAgeGroup);
    localStorage.setItem('runnerNationality', runnerNationality);
    updateDashboard();
}

function loadRaces() {
    const saved = localStorage.getItem('itraRaces');
    runnerName = localStorage.getItem('runnerName') || '';
    runnerItraId = localStorage.getItem('runnerItraId') || '';
    runnerGender = localStorage.getItem('runnerGender') || '';
    if (runnerGender.toLowerCase().includes('female') || runnerGender.toLowerCase().includes('women')) {
        currentGender = 'women';
    } else {
        currentGender = 'men';
    }
    
    runnerAgeGroup = localStorage.getItem('runnerAgeGroup') || '';
    runnerNationality = localStorage.getItem('runnerNationality') || '';
    if (saved) {
        races = JSON.parse(saved);
        renderRaceList();
        updateDashboard();
    }
}

window.validateScore = (el) => {
    let val = parseInt(el.value);
    if (val < 0 || val > 1000) {
        el.style.borderColor = 'var(--error)';
        el.style.color = 'var(--error)';
    } else {
        el.style.borderColor = '';
        el.style.color = '';
    }
};

function renderRaceList() {
    raceListEl.innerHTML = '';
    races.forEach((race) => {
        const row = document.createElement('div');
        row.className = 'race-row';
        let scoreStyle = (race.score !== '' && (race.score < 0 || race.score > 1000)) ? 'border-color: var(--error); color: var(--error);' : '';
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
                <input type="number" value="${race.score}" min="0" max="1000" placeholder="0" style="${scoreStyle}" oninput="validateScore(this)" onchange="updateRace('${race.id}', 'score', this.value)">
            </div>
            <button class="btn-remove" onclick="removeRace('${race.id}')">✕</button>
        `;
        raceListEl.appendChild(row);
    });
}

window.updateRace = (id, field, value) => {
    const race = races.find(r => r.id === id);
    if (race) {
        if (field === 'score') {
            race[field] = parseInt(value) || 0;
        } else {
            race[field] = value;
        }
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
        runnerName = '';
        runnerItraId = '';
        runnerGender = '';
        runnerAgeGroup = '';
        runnerNationality = '';
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
            
            const itraIdMatch = text.match(/(?:^|\n)([^\n]*?)\n\s*ITRA ID:\s*(ITRA-\d+)/i);
            if (itraIdMatch) {
                runnerName = itraIdMatch[1].trim();
                runnerItraId = itraIdMatch[2].toUpperCase();
            }
            
            const genderMatch = text.match(/Gender:\s*([^\n]+)/i);
            if (genderMatch) {
                runnerGender = genderMatch[1].trim();
                if (runnerGender.toLowerCase().includes('female') || runnerGender.toLowerCase().includes('women')) {
                    currentGender = 'women';
                } else {
                    currentGender = 'men';
                }
            }
            
            const ageMatch = text.match(/Age Category:\s*([^\n]+)/i);
            if (ageMatch) runnerAgeGroup = ageMatch[1].trim();
            
            const natMatch = text.match(/(?:Nationality|Country):\s*([^\n]+)/i);
            if (natMatch) runnerNationality = natMatch[1].trim();
            
            renderRaceList();
            saveRaces();
            e.target.value = ''; 
            e.target.placeholder = "Successfully imported " + parsed.length + " races!";
            setTimeout(() => { e.target.placeholder = "Paste your ITRA results table here...\n(e.g. highlight the table, press Ctrl+C, then paste here)"; }, 3000);
        } else {
            alert("No race scores found. Please make sure you are pasting from the 'Results' tab which contains your individual race scores.");
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
        clearDataBtn.parentElement.style.display = 'none';
    } else {
        document.body.classList.remove('empty-state');
        clearDataBtn.parentElement.style.display = 'block';
    }
    
    if (runnerName || runnerItraId) {
        runnerInfoEl.style.display = 'flex';
        let html = '';
        
        let tags = [];
        if (runnerName) tags.push(runnerName);
        if (runnerItraId) tags.push(runnerItraId);
        if (runnerAgeGroup) tags.push(runnerAgeGroup);
        if (runnerNationality) tags.push(runnerNationality);
        
        if (tags.length > 0) {
            let tagsHtml = tags.map((t, idx) => {
                let isName = (idx === 0 && runnerName);
                return `<span class="athlete-tag ${isName ? 'athlete-name-tag' : ''}">${t}</span>`;
            }).join('');
            html += `<div class="athlete-tags">${tagsHtml}</div>`;
        }
        
        runnerInfoEl.innerHTML = html;
    } else {
        runnerInfoEl.style.display = 'none';
        runnerInfoEl.innerHTML = '';
    }
    
    // Generate simple table layout for PDF print
    let printHtml = `
    <table class="print-only" style="width: 100%; margin-top: 1rem; font-size: 0.85rem; border-collapse: collapse;">
        <thead>
            <tr style="background: #f0f0f0;">
                <th style="text-align: left; padding: 6px; border: 1px solid #ccc; white-space: nowrap;">DATE</th>
                <th style="text-align: left; padding: 6px; border: 1px solid #ccc;">RACE NAME</th>
                <th style="text-align: right; padding: 6px; border: 1px solid #ccc; white-space: nowrap;">DIST.</th>
                <th style="text-align: right; padding: 6px; border: 1px solid #ccc; white-space: nowrap;">ELEV.</th>
                <th style="text-align: right; padding: 6px; border: 1px solid #ccc; white-space: nowrap;">TIME</th>
                <th style="text-align: right; padding: 6px; border: 1px solid #ccc; white-space: nowrap;">SCORE</th>
            </tr>
        </thead>
        <tbody>
    `;
    if (races.length === 0) {
        printHtml += `<tr><td colspan="6" style="text-align: center; padding: 6px; border: 1px solid #ccc;">No races recorded</td></tr>`;
    } else {
        races.forEach(r => {
            printHtml += `
            <tr>
                <td style="padding: 6px; border: 1px solid #ccc; white-space: nowrap;">${r.date}</td>
                <td style="padding: 6px; border: 1px solid #ccc;">${r.points ? getItraBadgeHtml(r.points) : ''}${r.name}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #ccc; white-space: nowrap;">${r.dist || '-'}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #ccc; white-space: nowrap;">${r.elev || '-'}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #ccc; white-space: nowrap;">${r.time || '-'}</td>
                <td style="text-align: right; padding: 6px; border: 1px solid #ccc; font-weight: bold; white-space: nowrap;">${r.score}</td>
            </tr>`;
        });
    }
    printHtml += `</tbody></table>`;
    const printContainer = document.getElementById('print-race-history');
    if (printContainer) printContainer.innerHTML = printHtml;

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

    // Render best 5 races detail table
    if (result.top5 && result.top5.length > 0) {
        bestRacesCard.style.display = 'block';
        let bestRacesHtml = '';
        result.top5.forEach(r => {
            bestRacesHtml += `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 0.75rem 0.5rem; white-space: nowrap;">${r.date}</td>
                    <td style="padding: 0.75rem 0.5rem;">${r.points ? getItraBadgeHtml(r.points) : ''}${r.name}</td>
                    <td style="padding: 0.75rem 0.5rem; text-align: right;">${r.score.toFixed ? r.score.toFixed(1) : r.score}</td>
                    <td style="padding: 0.75rem 0.5rem; text-align: right;">${r.timeWeight.toFixed(3)}</td>
                    <td style="padding: 0.75rem 0.5rem; text-align: right; font-weight: bold; color: var(--text-main);">${r.weightedScore.toFixed(1)}</td>
                </tr>
            `;
        });
        bestRacesTbody.innerHTML = bestRacesHtml;
    } else {
        bestRacesCard.style.display = 'none';
        bestRacesTbody.innerHTML = '';
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
                        <tr><th style="white-space: nowrap;">DATE</th><th>NAME</th><th>W. SCORE</th><th>WEIGHT</th><th>FINAL SCORE</th></tr>`;
                
                log.forEach((r) => {
                    tableHtml += `
                        <tr>
                            <td style="white-space: nowrap;">${r.date}</td>
                            <td>${r.points ? getItraBadgeHtml(r.points) : ''}${r.name}</td>
                            <td>${r.wScore.toFixed(1)}</td>
                            <td>${r.eWeight.toFixed(2)}</td>
                            <td style="font-weight: bold; color: var(--text-main);">${r.wxScore.toFixed(1)}</td>
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
    let improveLog = null;
    let targetScore = null;
    let targetScenario = null;
    let targetLog = null;
    
    const plotX = [];
    const scenY = {1:[], 2:[], 3:[], 4:[], 5:[]};
    const maxY = [];
    
    let minSim = Math.max(0, Math.floor((currentResult.pi - 150) / 50) * 50);
    let maxSim = Math.min(1000, Math.ceil((Math.max(currentResult.pi, targetPi || 0) + 100) / 50) * 50);
    
    for (let s = minSim; s <= maxSim; s+=5) {
        plotX.push(s);
        const testRaces = [...races, { date: newDate, name: "Next race (simulation)", score: s, points: 'SIM' }];
        const res = calculateItraPiCore(testRaces, today);
        
        maxY.push(res.maxAverage);
        for(let i=1; i<=5; i++) {
            scenY[i].push(res.allAverages[i] || null);
        }
        
        if (improveScore === null && res.pi > currentResult.pi) {
            improveScore = s;
            improveScenario = res.bestScenario;
            improveLog = res.bestScenarioLog;
        }
        if (targetPi && targetScore === null && res.pi >= targetPi) {
            targetScore = s;
            targetScenario = res.bestScenario;
            targetLog = res.bestScenarioLog;
        }
    }
    
    let simText = "";
    
    function buildSimTable(log) {
        let tableHtml = `<div class="top-races-table" style="overflow-x: auto; margin-top: 1rem;">
            <table>
                <tr><th style="white-space: nowrap;">DATE</th><th>NAME</th><th>W. SCORE</th><th>WEIGHT</th><th>FINAL SCORE</th></tr>`;
        log.forEach((r) => {
            const isSim = r.name === "Next race (simulation)";
            const rowStyle = isSim ? 'color: var(--accent); font-weight: 500;' : '';
            const finalColor = isSim ? 'var(--accent)' : 'var(--text-main)';
            
            tableHtml += `
                <tr style="${rowStyle}">
                    <td style="white-space: nowrap;">${r.date}</td>
                    <td>${r.points ? getItraBadgeHtml(r.points) : ''}${r.name}</td>
                    <td>${r.wScore.toFixed(1)}</td>
                    <td>${r.eWeight.toFixed(2)}</td>
                    <td style="font-weight: bold; color: ${finalColor};">${r.wxScore.toFixed(1)}</td>
                </tr>
            `;
        });
        tableHtml += `</table></div>`;
        return tableHtml;
    }
    
    if (improveScore) {
        simText += `
        <div class="sim-box success clickable" style="flex-direction: column; align-items: stretch;" onclick="const t = this.querySelector('.sim-table'); t.style.display = t.style.display === 'none' ? 'block' : 'none';">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div class="sim-box-info">
                    <h4>To Improve Current PI</h4>
                    <p>Increase your PI by at least +1</p>
                </div>
                <div class="sim-box-score">
                    <div class="big-number">${improveScore}</div>
                    <div class="scenario-badge">Uses Scenario ${improveScenario}</div>
                </div>
            </div>
            <div class="sim-table" style="display: none; width: 100%; border-top: 1px dashed var(--border-color); margin-top: 1rem; padding-top: 0.5rem;">
                ${buildSimTable(improveLog)}
            </div>
        </div>`;
    } else {
        simText += `
        <div class="sim-box error">
            <div class="sim-box-info">
                <h4>Improve Current PI</h4>
                <p>Cannot improve PI with a single race (up to ${maxSim}).</p>
            </div>
        </div>`;
    }
    
    if (targetPi) {
        if (targetScore) {
            simText += `
            <div class="sim-box clickable" style="flex-direction: column; align-items: stretch;" onclick="const t = this.querySelector('.sim-table'); t.style.display = t.style.display === 'none' ? 'block' : 'none';">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div class="sim-box-info">
                        <h4>To Reach Target PI (${targetPi})</h4>
                        <p>Minimum score required in your next race</p>
                    </div>
                    <div class="sim-box-score">
                        <div class="big-number">${targetScore}</div>
                        <div class="scenario-badge">Uses Scenario ${targetScenario}</div>
                    </div>
                </div>
                <div class="sim-table" style="display: none; width: 100%; border-top: 1px dashed var(--border-color); margin-top: 1rem; padding-top: 0.5rem;">
                    ${buildSimTable(targetLog)}
                </div>
            </div>`;
        } else {
            simText += `
            <div class="sim-box error">
                <div class="sim-box-info">
                    <h4>Target PI (${targetPi})</h4>
                    <p>Cannot reach PI ${targetPi} with a single new race (up to ${maxSim}).</p>
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
    let nameText = runnerName;
    if (!nameText) {
        const userName = prompt("Enter your name for the report (optional):");
        if (userName === null) return; // User clicked Cancel
        nameText = userName.trim();
    }
    
    // Create temporary print header
    const printHeaderContainer = document.createElement('div');
    printHeaderContainer.className = 'print-only';
    printHeaderContainer.style.textAlign = 'center';
    printHeaderContainer.style.marginBottom = '2rem';
    printHeaderContainer.style.borderBottom = '3px solid #000';
    printHeaderContainer.style.paddingBottom = '1rem';
    
    const nameHeader = document.createElement('h1');
    nameHeader.style.margin = '0 0 0.5rem 0';
    
    if (nameText) {
        nameHeader.innerHTML = `
            <div style="font-size: 2.5rem; font-weight: 800; line-height: 1.2;">${nameText}</div>
            <div style="font-size: 1.4rem; font-weight: 600; color: #555; margin-top: 0.25rem;">ITRA Performance Report</div>
        `;
    } else {
        nameHeader.innerHTML = `<div style="font-size: 2.2rem; font-weight: 800;">ITRA Performance Report</div>`;
    }
    
    printHeaderContainer.appendChild(nameHeader);
    
    // Add athlete details below name in PDF
    let pdfTags = [];
    if (runnerItraId) pdfTags.push(runnerItraId);
    if (runnerAgeGroup) pdfTags.push(runnerAgeGroup);
    if (runnerNationality) pdfTags.push(runnerNationality);
    
    if (pdfTags.length > 0) {
        const detailsSub = document.createElement('div');
        detailsSub.style.fontSize = '1.1rem';
        detailsSub.style.color = '#444';
        detailsSub.style.fontWeight = '600';
        detailsSub.textContent = pdfTags.join('  |  ');
        printHeaderContainer.appendChild(detailsSub);
    }
    
    // Insert at the very top
    const container = document.querySelector('.container');
    container.insertBefore(printHeaderContainer, container.firstChild);
    
    // Temporarily change document title so Native Print uses it as the filename
    const originalTitle = document.title;
    const dateStr = new Date().toISOString().split('T')[0];
    const safeName = nameText ? '_' + nameText.replace(/[^a-z0-9]/gi, '_') : '';
    document.title = `ITRA_PI_Report${safeName}_${dateStr}`;
    
    // Open all scenario accordions so they are visible in the PDF
    document.querySelectorAll('details').forEach(el => el.setAttribute('open', ''));
    
    // Slight delay to allow DOM to render before triggering print dialog
    setTimeout(() => {
        window.print();
        
        // Cleanup after print dialog closes
        document.title = originalTitle;
        printHeaderContainer.remove();
    }, 150);
});

// Initialize
let currentGender = 'men';

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
