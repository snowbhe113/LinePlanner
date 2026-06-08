const IHO_PROFILES = {
  "Order 2": { full:false, overlap:0, cross:5, confidence:.95, spc:1, cell:10, desc:"General deeper-water survey where full seafloor search is normally not required.", badge:"GENERAL BATHYMETRY" },
  "Order 1b": { full:false, overlap:10, cross:5, confidence:.95, spc:2, cell:5, desc:"Bathymetric survey for areas shallower than 100 m where full seafloor search is not required.", badge:"BATHYMETRY ONLY" },
  "Order 1a": { full:true, overlap:25, cross:8, confidence:.95, spc:3, cell:2, desc:"Harbours, approaches and recommended tracks where under-keel clearance is critical; full seafloor search.", badge:"FULL SEAFLOOR SEARCH" },
  "Special": { full:true, overlap:30, cross:10, confidence:.95, spc:5, cell:1, desc:"Critical shallow-water navigation areas requiring high confidence and full bottom search.", badge:"SPECIAL ORDER" },
  "Exclusive": { full:true, overlap:50, cross:12, confidence:.95, spc:10, cell:.5, desc:"Highly critical areas requiring the most conservative planning assumptions.", badge:"CRITICAL NAVIGATION AREA" }
};

const SONARS = {
  "Custom MBES": { beams:512, modes:["Equidistant","Equiangular"], freqs:[12,40,70,100,200,300,400], maxAngle:140, rangeBase:120 },
  "Kongsberg EM2040": { beams:512, modes:["Equidistant","Equiangular"], freqs:[200,300,400], maxAngle:140, planningRanges: {400: 80,300: 140,200: 250} },
  "Kongsberg EM2042": { beams:1024, modes:["Equidistant","Equiangular"], freqs:[200,300,400], maxAngle:140, planningRanges: {400: 90,300: 160,200: 300} },
  "Kongsberg EM712": { beams:512, modes:["Equidistant","Equiangular"], freqs:[40,70,100], maxAngle:140, planningRanges: {100: 500,70: 1000,40: 1500} },
  "Kongsberg EM124": { beams:512, modes:["Equidistant","Equiangular"], freqs:[12], maxAngle:150, planningRanges: {12: 6000}, rangeNote: "6000 m+ planning assumption" },
  "R2Sonic 2024": { beams:1024, modes:["Equidistant","Equiangular"], freqs:[200,300,400], maxAngle:160, planningRanges: {400: 100,300: 180,200: 300} },
  "R2Sonic 2026": { beams:1024, modes:["Equidistant","Equiangular"], freqs:[170,200,300,400], maxAngle:160, planningRanges: {400: 120,300: 220,200: 350, 170:450} },
  "Norbit iWBMS": { beams:512, modes:["Equidistant","Equiangular"], freqs:[200,400,700], maxAngle:140, planningRanges: {700: 60,400: 100,200: 180} },
  "Teledyne SeaBat T20": { beams:512, modes:["Equidistant","Equiangular"], freqs:[200,300,400], maxAngle:140, planningRanges: {400: 80,300: 110,200: 180} },
  "Teledyne SeaBat T50": { beams:1024, modes:["Equidistant","Equiangular"], freqs:[200,300,400], maxAngle:140, planningRanges: {400: 100,300: 150,200: 250} }
};

const RECOMMENDATION_BASIS = {
  frequency: "Recommended from depth and sonar frequency options.",
  swathAngle: "Recommended from IHO order, full seafloor search, bottom slope, and sea state.",
  overlap: "Recommended from IHO order and full seafloor search requirement.",
  pingRate: "Calculated from required soundings per cell, vessel speed, and beam spacing.",
  maxRange: "Recommended from depth, selected frequency, and sonar planning profile.",
  crosslinePercent: "Recommended as a percentage of total planned survey line length.",
  beamCount: "Planning value used for density estimation. Choose 512 or 1024 unless using a verified sonar-specific configuration.",
  beamMode: "Equidistant assumes near-uniform seabed spacing. Equiangular uses the maximum angular beam spacing for conservative density."
};

const state = {
  ihoOrder:"Order 1a", cellSize:2, requiredSpc:3, compliance:95,
  depth:30, minDepth:20, maxDepth:40, planningDepthSource:"Average", seaState:"Calm", bottomSlope:"Flat", bottomReturn:"Good",
  sonarModel:"Kongsberg EM2040", frequency:300, swathAngle:140, beamCount:512, pingRate:5, maxRange:140, beamMode:"Equidistant",
  speed:6, overlap:30, turnTime:12, opsAllowance:15, crosslinePercent:8,
  areaLength:1500, areaWidth:600, azimuth:0, runIn:50, runOut:50,
  activeTab:"summary"
};

const els = {};
const inputIds = ["ihoOrder","cellSize","requiredSpc","compliance","depth","minDepth","maxDepth","planningDepthSource","seaState","bottomSlope","bottomReturn","sonarModel","frequency","swathAngle","beamCount","pingRate","maxRange","beamMode","speed","overlap","turnTime","opsAllowance","crosslinePercent","areaLength","areaWidth","azimuth","runIn","runOut"];
function $(id){return document.getElementById(id)}
function fmt(n,d=1){return isFinite(n)?Number(n).toFixed(d):"--"}
function rad(d){return d*Math.PI/180}
function deg(r){return r*180/Math.PI}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function getPlanningDepth(s=state){
  if(s.planningDepthSource==="Minimum") return Math.max(.1,Number(s.minDepth));
  if(s.planningDepthSource==="Maximum") return Math.max(.1,Number(s.maxDepth));
  return Math.max(.1,Number(s.depth));
}
function planningDepthLabel(s=state){
  const source=s.planningDepthSource||"Average";
  return `${source} depth`;
}

function requiredSlantRange(depth, swathAngle) {
  return depth / Math.cos(rad(swathAngle / 2));
}

function getSonarRange(sonar, frequency) {
  if (!sonar.planningRanges) return sonar.rangeBase || 0;
  return sonar.planningRanges[frequency] || Math.max(...Object.values(sonar.planningRanges));
}

function recommendFrequency(depth, swathAngle, sonar) {
  const required = requiredSlantRange(depth, swathAngle);

  const valid = sonar.freqs
    .filter(f => getSonarRange(sonar, f) >= required)
    .sort((a, b) => b - a);

  return valid[0] || Math.min(...sonar.freqs);
}

function findLowerFrequencyThatPasses(requiredRange, sonar, currentFrequency) {
  return sonar.freqs
    .filter(f => f < currentFrequency)
    .sort((a, b) => b - a)
    .find(f => getSonarRange(sonar, f) >= requiredRange);
}

function init(){
  inputIds.forEach(id=>els[id]=$(id));
  fillSelect(els.ihoOrder,Object.keys(IHO_PROFILES));
  fillSelect(els.planningDepthSource,["Minimum","Average","Maximum"]);
  fillSelect(els.seaState,["Calm","Moderate","Rough"]);
  fillSelect(els.bottomSlope,["Flat","Moderate","Steep","Rugged"]);
  fillSelect(els.bottomReturn,["Good","Moderate","Weak"]);
  fillSelect(els.sonarModel,Object.keys(SONARS));
  fillSelect(els.beamMode,["Equidistant","Equiangular"]);
  updateFrequencyOptions();
  inputIds.forEach(id=>els[id].addEventListener("input",()=>handleInput(id)));
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{state.activeTab=b.dataset.tab;render()}));
  $("loadExample").onclick = loadExample;
  $("resetBtn").onclick = reset;
  $("copyBtn").onclick = copySummary;
  $("shareBtn").onclick = share;

  if ($("exportBtn")) {
    $("exportBtn").onclick = toggleExportMenu;
  }

  if ($("exportJsonBtn")) {
    $("exportJsonBtn").onclick = () => {
      closeExportMenu();
      exportJson();
    };
  }

  if ($("exportPdfBtn")) {
    $("exportPdfBtn").onclick = () => {
      closeExportMenu();
      exportPdfReport();
    };
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".export-menu")) {
      closeExportMenu();
    }
  });

  $("applySonarRecommendations").onclick = () => applySonarRecommendations(true);

  if ($("manualBtn")) {
    $("manualBtn").onclick = () => window.open("Survey_Line_Planner_Technical_Manual_v1.pdf", "_blank");
  }
  loadExample();
}

function toggleExportMenu() {
  $("exportMenu").classList.toggle("open");
}

function closeExportMenu() {
  $("exportMenu").classList.remove("open");
}

function calculationRows(c) {
  const speedMps = state.speed * 0.514444;
  const halfAngle = state.swathAngle / 2;
  const bottomF = c.bottomF;
  const overlapDecimal = state.overlap / 100;
  const cellArea = state.cellSize * state.cellSize;
  const requiredCrossLen = c.mainLen * state.crosslinePercent / 100;

  return `
    <h2>7. Calculation Details</h2>

    <h3>7.1 Swath and Range Calculations</h3>
    <table>
      <tr>
        <th>Calculation</th>
        <th>Formula</th>
        <th>Substitution</th>
        <th>Result</th>
      </tr>

      <tr>
        <td>Planning depth</td>
        <td>Ds = selected depth source</td>
        <td>${planningDepthLabel()} = ${fmt(c.depth,1)} m</td>
        <td>${fmt(c.depth,1)} m</td>
      </tr>

      <tr>
        <td>Required slant range</td>
        <td>Rrequired = Ds / cos(θ / 2)</td>
        <td>${fmt(c.depth,1)} / cos(${fmt(halfAngle,1)}°)</td>
        <td>${fmt(c.slant,1)} m</td>
      </tr>

      <tr>
        <td>Theoretical swath</td>
        <td>Wt = 2Ds tan(θ / 2)</td>
        <td>2 × ${fmt(c.depth,1)} × tan(${fmt(halfAngle,1)}°)</td>
        <td>${fmt(c.theoretical,1)} m</td>
      </tr>

      <tr>
        <td>Effective swath</td>
        <td>We = 2Ds tan(αe)</td>
        <td>2 × ${fmt(c.depth,1)} × tan(${fmt(c.effHalf,1)}°)</td>
        <td>${fmt(c.effective,1)} m</td>
      </tr>

      <tr>
        <td>Usable swath</td>
        <td>Wu = We × Fbottom</td>
        <td>${fmt(c.effective,1)} × ${fmt(bottomF,2)}</td>
        <td>${fmt(c.usable,1)} m</td>
      </tr>
    </table>

    <h3>7.2 Line Spacing and Mainline Calculations</h3>
    <table>
      <tr>
        <th>Calculation</th>
        <th>Formula</th>
        <th>Substitution</th>
        <th>Result</th>
      </tr>

      <tr>
        <td>Line spacing</td>
        <td>S = Wu × (1 - O)</td>
        <td>${fmt(c.usable,1)} × (1 - ${fmt(overlapDecimal,2)})</td>
        <td>${fmt(c.lineSpacing,1)} m</td>
      </tr>

      <tr>
        <td>Number of mainlines</td>
        <td>Nline = ceil(Warea / S) + 1</td>
        <td>ceil(${state.areaWidth} / ${fmt(c.lineSpacing,1)}) + 1</td>
        <td>${c.mainLines}</td>
      </tr>

      <tr>
        <td>Average line length</td>
        <td>Lline = Larea + Rin + Rout</td>
        <td>${state.areaLength} + ${state.runIn} + ${state.runOut}</td>
        <td>${fmt(c.avgLine,0)} m</td>
      </tr>

      <tr>
        <td>Total mainline length</td>
        <td>Ltotal = Nline × Lline</td>
        <td>${c.mainLines} × ${fmt(c.avgLine,0)}</td>
        <td>${fmt(c.mainLen,0)} m</td>
      </tr>
    </table>

    <h3>7.3 Density Calculations</h3>
    <table>
      <tr>
        <th>Calculation</th>
        <th>Formula</th>
        <th>Substitution</th>
        <th>Result</th>
      </tr>

      <tr>
        <td>Speed conversion</td>
        <td>Vm/s = Vkn × 0.514444</td>
        <td>${state.speed} × 0.514444</td>
        <td>${fmt(speedMps,3)} m/s</td>
      </tr>

      <tr>
        <td>Along-track spacing</td>
        <td>Δx = Vm/s / P</td>
        <td>${fmt(speedMps,3)} / ${state.pingRate}</td>
        <td>${fmt(c.along,3)} m</td>
      </tr>

      <tr>
        <td>Across-track spacing</td>
        <td>${state.beamMode === "Equidistant" ? "Δy = Wu / (Nb - 1)" : "Δydesign = max(Δyi)"}</td>
        <td>${state.beamMode === "Equidistant" ? `${fmt(c.usable,1)} / (${state.beamCount} - 1)` : "Maximum adjacent angular beam spacing"}</td>
        <td>${fmt(c.across,3)} m</td>
      </tr>

      <tr>
        <td>Cell area</td>
        <td>Acell = G²</td>
        <td>${state.cellSize}²</td>
        <td>${fmt(cellArea,2)} m²</td>
      </tr>

      <tr>
        <td>Footprint area</td>
        <td>Afootprint = Δx × Δy</td>
        <td>${fmt(c.along,3)} × ${fmt(c.across,3)}</td>
        <td>${fmt(c.footprint,4)} m²</td>
      </tr>

      <tr>
        <td>Estimated SPC</td>
        <td>SPCest = Acell / Afootprint</td>
        <td>${fmt(cellArea,2)} / ${fmt(c.footprint,4)}</td>
        <td>${fmt(c.spc,1)}</td>
      </tr>

      <tr>
        <td>Maximum speed</td>
        <td>Vmax = Δxmax × P</td>
        <td>Calculated from required SPC ${state.requiredSpc}, cell size ${state.cellSize} m, and across-track spacing ${fmt(c.across,3)} m</td>
        <td>${fmt(c.maxSpeedKnots,1)} kn</td>
      </tr>

      <tr>
        <td>Minimum ping rate</td>
        <td>Pmin = Vm/s / Δxmax</td>
        <td>Calculated at ${fmt(speedMps,3)} m/s and required SPC ${state.requiredSpc}</td>
        <td>${fmt(c.minPingRate,1)} Hz</td>
      </tr>
    </table>

    <h3>7.4 Crossline Calculations</h3>
    <table>
      <tr>
        <th>Calculation</th>
        <th>Formula</th>
        <th>Substitution</th>
        <th>Result</th>
      </tr>

      <tr>
        <td>Required crossline length</td>
        <td>LQC,req = Ltotal × PQC</td>
        <td>${fmt(c.mainLen,0)} × ${state.crosslinePercent}%</td>
        <td>${fmt(requiredCrossLen,0)} m</td>
      </tr>

      <tr>
        <td>Single crossline length</td>
        <td>LQC,line = Warea + Rin + Rout</td>
        <td>${state.areaWidth} + ${state.runIn} + ${state.runOut}</td>
        <td>${fmt(c.avgCross,0)} m</td>
      </tr>

      <tr>
        <td>Number of crosslines</td>
        <td>NQC = ceil(LQC,req / LQC,line)</td>
        <td>ceil(${fmt(requiredCrossLen,0)} / ${fmt(c.avgCross,0)})</td>
        <td>${c.crossLines}</td>
      </tr>

      <tr>
        <td>Crossline spacing</td>
        <td>SQC = Larea / (NQC + 1)</td>
        <td>${state.areaLength} / (${c.crossLines} + 1)</td>
        <td>${fmt(c.crossSpacing,0)} m</td>
      </tr>

      <tr>
        <td>Total crossline length</td>
        <td>LQC = NQC × LQC,line</td>
        <td>${c.crossLines} × ${fmt(c.avgCross,0)}</td>
        <td>${fmt(c.crossLen,0)} m</td>
      </tr>
    </table>

    <h3>7.5 Duration Calculations</h3>
    <table>
      <tr>
        <th>Calculation</th>
        <th>Formula</th>
        <th>Substitution</th>
        <th>Result</th>
      </tr>

      <tr>
        <td>Run time</td>
        <td>Trun = (Ltotal + LQC) / (Vm/s × 3600)</td>
        <td>(${fmt(c.mainLen,0)} + ${fmt(c.crossLen,0)}) / (${fmt(speedMps,3)} × 3600)</td>
        <td>${fmt(c.runHours,2)} h</td>
      </tr>

      <tr>
        <td>Turn time</td>
        <td>Tturn,total = ((Nline + NQC) × Tturn) / 60</td>
        <td>((${c.mainLines} + ${c.crossLines}) × ${state.turnTime}) / 60</td>
        <td>${fmt(c.turns,2)} h</td>
      </tr>

      <tr>
        <td>Subtotal time</td>
        <td>Tsubtotal = Trun + Tturn,total</td>
        <td>${fmt(c.runHours,2)} + ${fmt(c.turns,2)}</td>
        <td>${fmt(c.runHours + c.turns,2)} h</td>
      </tr>

      <tr>
        <td>Total estimated time</td>
        <td>Ttotal = Tsubtotal × (1 + Aops)</td>
        <td>${fmt(c.runHours + c.turns,2)} × (1 + ${fmt(state.opsAllowance / 100,2)})</td>
        <td>${fmt(c.totalTime,2)} h</td>
      </tr>
    </table>
  `;
}

function exportPdfReport() {
  const c = compute();
  const rec = recommendSonar();
  const warningList = warnings(c, rec);
  const exportDate = new Date().toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  const reportHtml = `
    <!doctype html>
    <html>
    <head>
      <title>Survey Line Plan Report</title>
      <style>
        @page {
          size: A4;
          margin: 16mm;
        }

        body {
          font-family: Arial, sans-serif;
          color: #09213f;
          margin: 0;
          line-height: 1.45;
        }

        h1 {
          margin: 0 0 4px;
          color: #0f2d57;
          font-size: 24px;
        }

        h2 {
          margin-top: 24px;
          color: #14466f;
          font-size: 16px;
          border-bottom: 1px solid #d8e1ea;
          padding-bottom: 6px;
        }

        .subtitle {
          color: #51627a;
          margin-bottom: 18px;
        }

        .badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 14px 0;
        }

        .badge {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 999px;
          background: #e8eef4;
          font-size: 12px;
          font-weight: 700;
        }

        .pass {
          background: #e8f7ef;
          color: #155d38;
        }

        .warn {
          background: #fff6df;
          color: #7a5400;
        }

        .critical {
          background: #ffe8e8;
          color: #8c0707;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 12px;
        }

        th,
        td {
          text-align: left;
          border-bottom: 1px solid #edf1f5;
          padding: 7px 6px;
          vertical-align: top;
        }

        th {
          color: #51627a;
          font-weight: 700;
          background: #f4f7fa;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin-top: 10px;
        }

        .card {
          border: 1px solid #d8e1ea;
          border-radius: 10px;
          padding: 10px;
          background: #f8fafc;
        }

        .label {
          color: #51627a;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .06em;
        }

        .value {
          font-size: 20px;
          font-weight: 800;
          margin-top: 4px;
        }

        .note {
          margin-top: 24px;
          padding: 10px;
          background: #f4f7fa;
          border-left: 4px solid #1d7d99;
          color: #51627a;
          font-size: 12px;
        }
        h3 {
          margin-top: 18px;
          color: #1d7d99;
          font-size: 14px;
        }

        td:nth-child(2),
        td:nth-child(3) {
          font-family: "Consolas", monospace;
          font-size: 11px;
        }
        .report-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 18px;
          border-bottom: 2px solid #d8e1ea;
          padding-bottom: 12px;
        }

        .report-logo {
          width: 58px;
          height: 58px;
          object-fit: contain;
          flex: 0 0 auto;
        }

        .report-title-block {
          flex: 1;
        }

        .report-title-block h1 {
          margin: 0 0 4px;
        }

        .report-title-block .subtitle {
          margin: 0;
        }
        .report-date {
          margin-top: 4px;
          color: #51627a;
          font-size: 12px;
        }
        .page-break {
          break-before: page;
          page-break-before: always;
        }

        .avoid-break {
          break-inside: avoid;
          page-break-inside: avoid;
        } 
        p {
          font-size: 12px;
        } 
      </style>
    </head>

    <body>
      <div class="report-header">
        <img class="report-logo" src="logo.png" alt="Survey Line Planner logo">
        <div class="report-title-block">
          <h1>Survey Line Plan Report</h1>
          <div class="subtitle">Generated from Survey Line Planner</div>
          <div class="report-date">Export date: ${exportDate}</div>
        </div>
      </div>

      <div class="badges">
        <span class="badge ${c.pass ? "pass" : "critical"}">Density ${c.pass ? "PASS" : "FAIL"}</span>
        <span class="badge">${state.ihoOrder}</span>
        <span class="badge">${c.iho.badge}</span>
      </div>

      <h2>1. Survey Requirements</h2>
      <table>
        <tr><th>Parameter</th><th>Value</th></tr>
        <tr><td>IHO Order</td><td>${state.ihoOrder}</td></tr>
        <tr><td>Grid Cell Size</td><td>${state.cellSize} m</td></tr>
        <tr><td>Required SPC</td><td>${state.requiredSpc}</td></tr>
        <tr><td>Compliance Target</td><td>${state.compliance}%</td></tr>
        <tr><td>Full Seafloor Search</td><td>${c.iho.full ? "On" : "Off"}</td></tr>
      </table>

      <h2>2. Environment and Sonar Settings</h2>
      <table>
        <tr><th>Parameter</th><th>Value</th></tr>
        <tr><td>Planning Depth Source</td><td>${planningDepthLabel()}</td></tr>
        <tr><td>Planning Depth</td><td>${fmt(c.depth,1)} m</td></tr>
        <tr><td>Sea State</td><td>${state.seaState}</td></tr>
        <tr><td>Bottom Slope</td><td>${state.bottomSlope}</td></tr>
        <tr><td>Bottom Return</td><td>${state.bottomReturn}</td></tr>
        <tr><td>Sonar Model</td><td>${state.sonarModel}</td></tr>
        <tr><td>Frequency</td><td>${state.frequency} kHz</td></tr>
        <tr><td>Swath Angle</td><td>${state.swathAngle}°</td></tr>
        <tr><td>Beam Count</td><td>${state.beamCount}</td></tr>
        <tr><td>Beam Spacing Mode</td><td>${state.beamMode}</td></tr>
        <tr><td>Ping Rate</td><td>${state.pingRate} Hz</td></tr>
        <tr><td>Maximum Range</td><td>${state.maxRange} m</td></tr>
      </table>

      <section class="page-break avoid-break">
      <h2>3. Planning Results</h2>
      <div class="grid">
        <div class="card"><div class="label">Line Spacing</div><div class="value">${fmt(c.lineSpacing,1)} m</div></div>
        <div class="card"><div class="label">Usable Swath</div><div class="value">${fmt(c.usable,1)} m</div></div>
        <div class="card"><div class="label">Expected SPC</div><div class="value">${fmt(c.spc,1)}</div></div>
        <div class="card"><div class="label">Maximum Speed</div><div class="value">${fmt(c.maxSpeedKnots,1)} kn</div></div>
        <div class="card"><div class="label">Mainlines</div><div class="value">${c.mainLines}</div></div>
        <div class="card"><div class="label">Total Time</div><div class="value">${fmt(c.totalTime,2)} h</div></div>
      </div>
      </section>

      <h2>4. Line Plan</h2>
      <table>
        <tr><th>Parameter</th><th>Value</th></tr>
        <tr><td>Survey Length</td><td>${state.areaLength} m</td></tr>
        <tr><td>Survey Width</td><td>${state.areaWidth} m</td></tr>
        <tr><td>Run-in</td><td>${state.runIn} m</td></tr>
        <tr><td>Run-out</td><td>${state.runOut} m</td></tr>
        <tr><td>Mainline Azimuth</td><td>${state.azimuth}°</td></tr>
        <tr><td>Average Line Length</td><td>${fmt(c.avgLine,0)} m</td></tr>
        <tr><td>Total Mainline Length</td><td>${fmt(c.mainLen/1000,2)} km</td></tr>
      </table>

      <h2>5. Crosslines</h2>
      <table>
        <tr><th>Parameter</th><th>Value</th></tr>
        <tr><td>Crossline Percentage</td><td>${state.crosslinePercent}%</td></tr>
        <tr><td>Required Crossline Length</td><td>${fmt(c.reqCrossLen/1000,2)} km</td></tr>
        <tr><td>Number of Crosslines</td><td>${c.crossLines}</td></tr>
        <tr><td>Crossline Spacing</td><td>${fmt(c.crossSpacing,0)} m</td></tr>
        <tr><td>Crossline Azimuth</td><td>${fmt(c.crossAz,0)}°</td></tr>
        <tr><td>Total Crossline Length</td><td>${fmt(c.crossLen/1000,2)} km</td></tr>
      </table>

      <h2>6. Warnings and Guidance</h2>
      <table>
        <tr><th>Type</th><th>Message</th></tr>
        ${warningList.map(w => `
          <tr>
            <td>${w.title}</td>
            <td>${w.text}</td>
          </tr>
        `).join("")}
      </table>

      ${calculationRows(c)}

      <h2>8. Recommendation Basis</h2>
      <p>${rec.reasons.join(" ")}</p>

      <div class="note">
        Planning estimates only. Final survey design must consider contract specifications, IHO S-44, national requirements, sonar manufacturer limits, vessel motion, sound velocity, weather, and field QC.
      </div>

      <script>
        window.onload = () => {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  const reportWindow = window.open("", "_blank");

  if (!reportWindow) {
    alert("Popup blocked. Please allow popups to export the PDF report.");
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write(reportHtml);
  reportWindow.document.close();
}

function fillSelect(sel, arr){sel.innerHTML=arr.map(x=>`<option>${x}</option>`).join("")}

function handleInput(id){
  const el=els[id];
  state[id] = el.tagName === "SELECT" && id !== "frequency"
    ? el.value
    : Number(el.value);
  if (id === "pingRate") {
    state.pingRate = clamp(Number(state.pingRate), 1, 50);
    el.value = state.pingRate;
  }
  if(id==="ihoOrder") applyIhoRecommendations();
  if(["sonarModel","depth","minDepth","maxDepth","planningDepthSource","bottomSlope","seaState","bottomReturn","ihoOrder","requiredSpc","cellSize","speed"].includes(id)) {
    if(id==="sonarModel") {
      updateBeamModes();
      updateFrequencyOptions();
    }

    const rec=recommendSonar();

    if(id==="sonarModel") {
      applySonarRecommendations(false);
    }
  }
  render();
}

function applyIhoRecommendations(){
  const p=IHO_PROFILES[state.ihoOrder];
  state.cellSize=p.cell; state.requiredSpc=p.spc; state.overlap=p.overlap; state.crosslinePercent=p.cross; renderInputs();
}
function updateBeamModes(){
  const prof=SONARS[state.sonarModel];
  fillSelect(els.beamMode,prof.modes); if(!prof.modes.includes(state.beamMode)) state.beamMode=prof.modes[0];
}
function updateFrequencyOptions() {
  const prof = SONARS[state.sonarModel];

  fillSelect(els.frequency, prof.freqs);

  if (!prof.freqs.includes(Number(state.frequency))) {
    state.frequency = prof.freqs[0];
  }

  els.frequency.value = state.frequency;
}

function recommendSonar() {
  const prof = SONARS[state.sonarModel];
  const iho = IHO_PROFILES[state.ihoOrder];
  const planningDepth = getPlanningDepth(state);

  let angle = prof.maxAngle;

  if (state.bottomSlope === "Moderate") angle -= 10;
  if (state.bottomSlope === "Steep") angle -= 20;
  if (state.bottomSlope === "Rugged") angle -= 30;

  if (state.seaState === "Moderate") angle -= 10;
  if (state.seaState === "Rough") angle -= 25;

  if (iho.full) angle -= 5;

  angle = clamp(Math.round(angle / 5) * 5, 90, prof.maxAngle);

  const frequency = recommendFrequency(planningDepth, angle, prof);
  const range = getSonarRange(prof, frequency);
  const mode = prof.modes.includes("Equidistant") ? "Equidistant" : prof.modes[0];

  const preliminary = compute({
    ...state,
    frequency,
    swathAngle: angle,
    beamCount: prof.beams,
    maxRange: range,
    beamMode: mode,
    pingRate: state.pingRate
  });

  const pingRate = clamp(Math.ceil(preliminary.minPingRate), 1, 50);

  return {
    frequency,
    swathAngle: angle,
    beamCount: prof.beams,
    maxRange: Math.ceil(range),
    beamMode: mode,
    pingRate,
    maxSpeed: preliminary.maxSpeedKnots,
    reasons: [
      `${planningDepthLabel(state)} ${fmt(planningDepth,0)} m requires outer-beam slant range ${fmt(requiredSlantRange(planningDepth, angle),1)} m.`,
      `${frequency} kHz is selected as the highest supported frequency with sufficient planning range.`,
      `${state.bottomSlope} slope, ${state.seaState.toLowerCase()} sea state, and full-search requirement set recommended swath angle to ${angle}°.`,
      `Ping rate is calculated from required SPC, vessel speed, grid size, and beam spacing.`
    ]
  };
}

function applySonarRecommendations(force){
  const r=recommendSonar();
  ["frequency","swathAngle","beamCount","pingRate","maxRange","beamMode"].forEach(k=>state[k]=r[k]);
  renderInputs(); render();
}

function compute(s=state){
  const iho=IHO_PROFILES[s.ihoOrder]; const half=s.swathAngle/2; const depth=getPlanningDepth(s); const speedMps=s.speed*.514444;
  const theoretical=2*depth*Math.tan(rad(half)); const slant=depth/Math.cos(rad(half));
  let effHalf=half, rangeLimited=false;
  if(s.maxRange<=depth){effHalf=5; rangeLimited=true;} else { const rangeHalf=deg(Math.acos(depth/s.maxRange)); if(rangeHalf<half){effHalf=rangeHalf; rangeLimited=true;} }
  const effective=2*depth*Math.tan(rad(effHalf));
  const bottomF = { Good: 1, Moderate: 0.94, Weak: 0.86 }[s.bottomReturn];
  const slopeF = 1;
  const seaF = 1;
  const conf = 1;
  const usable = effective * bottomF;
  const lineSpacing=usable*(1-s.overlap/100); const mainLines=Math.max(1,Math.ceil(s.areaWidth/Math.max(lineSpacing,1))+1);
  const avgLine=s.areaLength+s.runIn+s.runOut; const mainLen=mainLines*avgLine;
  const along=speedMps/Math.max(s.pingRate,.1); const across = getAcrossTrackSpacing(s, usable, depth);
  const cellArea=s.cellSize*s.cellSize; const footprint=along*across; const spc=cellArea/Math.max(footprint,.000001); const pass=spc>=s.requiredSpc;
  const recCross=IHO_PROFILES[s.ihoOrder].cross; const crossPct=s.crosslinePercent; const reqCrossLen=mainLen*crossPct/100; const avgCross=s.areaWidth+s.runIn+s.runOut; const crossLines=crossPct>0?Math.max(1,Math.ceil(reqCrossLen/Math.max(avgCross,1))):0; const crossSpacing=s.areaLength/(crossLines+1); const crossLen=crossLines*avgCross; const crossAz=(Number(s.azimuth)+90)%360;
  const runHours=(mainLen+crossLen)/(Math.max(speedMps,.1)*3600); const turns=(mainLines+crossLines)*s.turnTime/60; const subtotal=runHours+turns; const totalTime=subtotal*(1+s.opsAllowance/100);
  const alongRequired=cellArea/(Math.max(s.requiredSpc,.1)*Math.max(across,.000001)); const maxSpeedMps=alongRequired*s.pingRate; const maxSpeedKnots=maxSpeedMps/.514444; const minPingRate=speedMps/Math.max(alongRequired,.000001);
  
  return {iho, depth, theoretical,slant,effHalf,effective,usable,lineSpacing,mainLines,avgLine,mainLen,along,across,footprint,spc,pass,recCross,reqCrossLen,avgCross,crossLines,crossSpacing,crossLen,crossAz,runHours,turns,totalTime,maxSpeedKnots,minPingRate,slopeF,seaF,bottomF,conf,rangeLimited};
}

function warnings(c, rec) {
  const w = [];
  const prof = SONARS[state.sonarModel];
  const selectedRange = getSonarRange(prof, Number(state.frequency));
  const requiredRange = requiredSlantRange(c.depth, state.swathAngle);
  const lowerFreq = findLowerFrequencyThatPasses(requiredRange, prof, Number(state.frequency));

  if (c.pass) {
    w.push({
      type: "pass",
      title: "Density requirement met",
      text: `Expected ${fmt(c.spc,1)} soundings/cell ≥ required ${state.requiredSpc}.`
    });
  } else {
    w.push({
      type: "critical",
      title: "Density Warning",
      text: `Expected ${fmt(c.spc,1)} soundings/cell is below required ${state.requiredSpc}. Reduce speed, increase ping rate, or reduce line spacing.`
    });
  }

  if (requiredRange > selectedRange) {
    w.push({
      type: "warning",
      title: "Range Warning",
      text: `Selected ${state.frequency} kHz planning range is ${fmt(selectedRange,0)} m, but required outer-beam range is ${fmt(requiredRange,1)} m. ${lowerFreq ? `Try ${lowerFreq} kHz or reduce swath angle.` : `Reduce swath angle or increase planning range if justified.`}`
    });
  }

  if (state.overlap < IHO_PROFILES[state.ihoOrder].overlap) {
    w.push({
      type: "warning",
      title: "Overlap Guidance",
      text: `Current ${state.overlap}% is below recommended ${IHO_PROFILES[state.ihoOrder].overlap}% for ${state.ihoOrder}.`
    });
  }

  if (state.speed > c.maxSpeedKnots) {
    w.push({
      type: "warning",
      title: "Speed Warning",
      text: `Current ${fmt(state.speed,1)} kn exceeds calculated max ${fmt(c.maxSpeedKnots,1)} kn.`
    });
  }

  if (state.seaState === "Rough") {
    w.push({
      type: "caution",
      title: "Environmental Caution",
      text: "Rough sea state reduces the recommended swath angle. Monitor outer beam rejection during acquisition."
    });
  }
  if (c.minPingRate > 50) {
    w.push({
      type: "warning",
      title: "Ping Rate Limit Warning",
      text: `Required minimum ping rate is ${fmt(c.minPingRate,1)} Hz, which exceeds the 50 Hz input limit. Reduce vessel speed, reduce line spacing, or review density requirement.`
    });
  }

  return w;
}

function renderInputs(){
  updateBeamModes();
  updateFrequencyOptions();

  Object.keys(els).forEach(id=>{
    if(els[id]) els[id].value=state[id];
  });
}
function compareClass(current, recommended, lowerBad=false){
  const same=String(current)===String(recommended) || Math.abs(Number(current)-Number(recommended))<.0001;
  if(same) return "recommended"; if(lowerBad && Number(current)<Number(recommended)) return "warn"; return "modified";
}
function fieldMsg(id, current, recommended, lowerBad=false, unit=""){
  const el=$(id); const cls=compareClass(current,recommended,lowerBad); el.classList.remove("recommended","modified","warn"); el.classList.add(cls);
  return cls==="recommended"?`✓ Recommended: ${recommended}${unit}`:cls==="warn"?`WARN: below ${recommended}${unit}`:`~ Recommended ${recommended}${unit}`;
}
function renderStatuses(rec,c){
  
  $("freqStatus").textContent=fieldMsg("frequency",state.frequency,rec.frequency,false," kHz");
  $("angleStatus").textContent=fieldMsg("swathAngle",state.swathAngle,rec.swathAngle,false,"°");
  $("beamStatus").textContent=fieldMsg("beamCount",state.beamCount,rec.beamCount,false," beams");
  const pingMsg = fieldMsg("pingRate", state.pingRate, rec.pingRate, true, " Hz");

  $("pingStatus").textContent =
    state.pingRate >= rec.pingRate
      ? `✓ Meets minimum ${rec.pingRate} Hz`
      : `WARN: minimum ${rec.pingRate} Hz`;
  $("rangeStatus").textContent=fieldMsg("maxRange",state.maxRange,rec.maxRange,true," m");
  $("modeStatus").textContent=fieldMsg("beamMode",state.beamMode,rec.beamMode,false,"");

  $("freqStatus").title = RECOMMENDATION_BASIS.frequency;
  $("angleStatus").title = RECOMMENDATION_BASIS.swathAngle;
  $("beamStatus").title = RECOMMENDATION_BASIS.beamCount;
  $("pingStatus").title = RECOMMENDATION_BASIS.pingRate;
  $("rangeStatus").title = RECOMMENDATION_BASIS.maxRange;
  $("overlapStatus").title = RECOMMENDATION_BASIS.overlap;

  $("speedStatus").textContent=state.speed<=c.maxSpeedKnots?`✓ ≤ calculated max ${fmt(c.maxSpeedKnots,1)} kn`:`WARN: max ${fmt(c.maxSpeedKnots,1)} kn`; $("speedStatus").className=state.speed<=c.maxSpeedKnots?"":"warn";
  $("overlapStatus").textContent=fieldMsg("overlap",state.overlap,IHO_PROFILES[state.ihoOrder].overlap,true,"%");
  ["freqStatus","angleStatus","beamStatus","pingStatus","rangeStatus","modeStatus","overlapStatus"].forEach(id=>{const e=$(id); e.className=e.textContent.startsWith("✓")?"":e.textContent.startsWith("WARN")?"warn":"modified"});
}
function render(){
  renderInputs(); const c=compute(); const rec=recommendSonar(); renderStatuses(rec,c);
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===state.activeTab));
  $("fullSearchBadge").textContent=c.iho.full?"ON":"OFF";
  $("ihoRecommendation").innerHTML=`<b>${c.iho.badge}</b><br>${c.iho.desc}<br>Auto-set: grid ${c.iho.cell} m, required SPC ${c.iho.spc}, overlap ${c.iho.overlap}%, crosslines ${c.iho.cross}%.`;  $("sonarReason").innerHTML=`<b>Recommended from ${state.sonarModel} + environment</b><br>${rec.reasons.join("<br>")}`;
  $("planningRecommendation").innerHTML=`<b>Recommended planning values</b><br>Overlap ${c.iho.overlap}% · Crosslines ${c.iho.cross}% · Max speed ${fmt(c.maxSpeedKnots,1)} kn · Min ping ${fmt(c.minPingRate,0)} Hz.`;
  renderTab(c,rec); renderMap(c); renderQuick(c); renderWarnings(c,rec);
}

function getSwathAngleBasisRows(rec) {
  const prof = SONARS[state.sonarModel];
  const iho = IHO_PROFILES[state.ihoOrder];

  const fullSearchPenalty = iho.full ? 5 : 0;

  const slopePenalty =
    state.bottomSlope === "Moderate" ? 10 :
    state.bottomSlope === "Steep" ? 20 :
    state.bottomSlope === "Rugged" ? 30 : 0;

  const seaPenalty =
    state.seaState === "Moderate" ? 10 :
    state.seaState === "Rough" ? 25 : 0;

  return [
    ["Sonar maximum angle", `${prof.maxAngle}°`],
    ["Full seafloor search", `-${fullSearchPenalty}°`],
    ["Bottom slope", `-${slopePenalty}°`],
    ["Sea state", `-${seaPenalty}°`],
    ["Recommended angle", `${rec.swathAngle}°`]
  ];
}

function getUsableSwathRows(c) {
  return [
    ["Effective swath", `${fmt(c.effective,1)} m`],
    ["Bottom return", state.bottomReturn],
    ["Bottom return factor", fmt(c.bottomF,2)],
    ["Usable swath", `${fmt(c.usable,1)} m`]
  ];
}

function sideBySideInfo(leftTitle, leftRows, rightTitle, rightRows) {
  return `
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
      ${kv(leftTitle,leftRows)}
      ${kv(rightTitle,rightRows)}
    </div>
  `;
}

function renderTab(c,rec){
  const badges=`<div class="badges"><span class="badge ${c.pass?'pass':'warn'}">Density ${c.pass?'PASS':'FAIL'}</span><span class="badge">${state.ihoOrder}</span><span class="badge ${c.iho.full?'teal':''}">${c.iho.badge}</span></div>`;
  const content={
    summary: `${badges}<div class="cards">${metric('Line Spacing',fmt(c.lineSpacing,1)+' m','Overlap '+state.overlap+'%',true)}${metric('Usable Swath',fmt(c.usable,1)+' m',fmt(c.usable/c.depth,2)+'× planning depth')}${metric('Expected SPC',fmt(c.spc,1),'Required '+state.requiredSpc)}${metric('Max Speed',fmt(c.maxSpeedKnots,1)+' kn','For required density')}${metric('Survey Lines',c.mainLines,fmt(c.mainLen,0)+' m total')}${metric('Total Time',fmt(c.totalTime,2)+' h',fmt(c.totalTime/10,2)+' ops days @10h')}</div>${notice(c.pass?'pass':'critical',c.pass?'Density requirement met':'CRITICAL: Density fails',c.pass?`Expected ${fmt(c.spc,1)} ≥ required ${state.requiredSpc}.`:`Expected ${fmt(c.spc,1)} < required ${state.requiredSpc}.`) }${timeBreakdown(c)}`,
    recommendations: `${badges}<div class="section-card"><h3>Current vs Recommended</h3><table class="compare"><thead><tr><th>Parameter</th><th>Current</th><th>Recommended</th><th>Status</th></tr></thead><tbody>${row('Frequency',state.frequency+' kHz',rec.frequency+' kHz',state.frequency==rec.frequency)}${row('Swath angle',state.swathAngle+'°',rec.swathAngle+'°',state.swathAngle==rec.swathAngle)}${row('Beam count',state.beamCount,rec.beamCount,state.beamCount==rec.beamCount)}${row('Ping rate',state.pingRate+' Hz',rec.pingRate+' Hz',state.pingRate>=rec.pingRate,true)}${row('Max range',state.maxRange+' m',rec.maxRange+' m',state.maxRange>=rec.maxRange,true)}${row('Overlap',state.overlap+'%',c.iho.overlap+'%',state.overlap>=c.iho.overlap,true)}${row('Speed',state.speed+' kn','≤ '+fmt(c.maxSpeedKnots,1)+' kn',state.speed<=c.maxSpeedKnots,true)}${row('Crosslines',state.crosslinePercent+'%',c.iho.cross+'%',state.crosslinePercent>=c.iho.cross,true)}</tbody></table></div><div class="section-card"><h3>Why these recommendations?</h3><p>${rec.reasons.join(' ')}</p><p>IHO order controls grid size, required SPC, full seafloor search, recommended overlap, and crossline percentage. Sonar profile provides supported frequencies, soundings per ping, beam spacing modes, maximum swath angle, and frequency-based planning ranges. Environment modifies the recommended swath angle.</p></div>`,
    swath: `${badges}
      <div class="cards">
        ${metric('Planning Depth',fmt(c.depth,1)+' m',planningDepthLabel(),true,'Ds = selected depth source: minimum, average, or maximum depth.')}
        ${metric('Theoretical Swath',fmt(c.theoretical,1)+' m','Flat bottom geometry',false,'Wt = 2Ds tan(θ/2)')}
        ${metric('Required Slant Range',fmt(c.slant,1)+' m',c.rangeLimited?'Range limited':'Within range',false,'Rrequired = Ds / cos(θ/2)')}
        ${metric('Effective Swath',fmt(c.effective,1)+' m','After range validation',false,'We = 2Ds tan(αe)')}
        ${metric('Usable Swath',fmt(c.usable,1)+' m','Used for line spacing',false,'Wu = We × Fbottom')}
        ${metric('Effective Angle',fmt(c.effHalf*2,1)+'°','After range validation',false,'θe = 2αe')}
      </div>
      ${sideBySideInfo(
        'Swath Angle Recommendation Basis',
        getSwathAngleBasisRows(rec),
        'Usable Swath Correction',
        getUsableSwathRows(c)
      )}`,
    density: `${badges}
      <div class="cards">
        ${metric('Expected SPC',fmt(c.spc,1),'Required '+state.requiredSpc,true,'SPCest = Acell / (Δx × Δy)')}
        ${metric('Along-track',fmt(c.along,3)+' m','Speed / ping rate',false,'Δx = Vm/s / P')}
        ${metric('Across-track',fmt(c.across,3)+' m',state.beamMode==="Equidistant" ? "Wu / (Nb - 1)" : "Max angular beam spacing",false,state.beamMode==="Equidistant" ? "Δy = Wu / (Nb - 1)" : "Δydesign = max(Δyi)")}
        ${metric('Footprint area',fmt(c.footprint,4)+' m²','Approx.',false,'Afootprint = Δx × Δy')}
        ${metric('Max Speed',fmt(c.maxSpeedKnots,1)+' kn','To pass density',false,'Vmax,kn = Vmax,m/s / 0.514444')}
        ${metric('Min Ping Rate',fmt(c.minPingRate,0)+' Hz','At current speed',false,'Pmin = Vm/s / Δxmax')}
      </div>`,
    lines: `${badges}
      <div class="cards">
        ${metric('Line Spacing',fmt(c.lineSpacing,1)+' m','Based on usable swath and overlap',true,'S = Wu × (1 - O)')}
        ${metric('Number of Survey lines',c.mainLines,'Includes boundary coverage',false,'Nline = ceil(Warea / S) + 1')}
        ${metric('Average Line Length',fmt(c.avgLine,0)+' m','Includes run-in/out',false,'Lline = Larea + Rin + Rout')}
        ${metric('Total Survey line Length',fmt(c.mainLen,0)+' m','',false,'Ltotal = Nline × Lline')}
        ${metric('Planned Overlap',state.overlap+'%','Recommended '+c.iho.overlap+'%',false,'Overlap reduces usable swath to line spacing.')}
        ${metric('Area',fmt(state.areaLength*state.areaWidth/1e6,2)+' km²','Survey rectangle',false,'Area = Larea × Warea')}
      </div>
      ${timeBreakdown(c)}`,
    crosslines: `${badges}
      <div class="cards">
        ${metric('Crossline %',state.crosslinePercent+'%','Recommended '+c.iho.cross+'%',true,'PQC = selected crossline percentage')}
        ${metric('Required Crossline Length',fmt(c.reqCrossLen/1000,2)+' km','Based on total line length',false,'LQC,req = Ltotal × PQC')}
        ${metric('Number of Crosslines',c.crossLines,'',false,'NQC = ceil(LQC,req / LQC,line)')}
        ${metric('Crossline Spacing',fmt(c.crossSpacing,0)+' m','Even distribution',false,'SQC = Larea / (NQC + 1)')}
        ${metric('Crossline Azimuth',fmt(c.crossAz,0)+'°','Perpendicular',false,'Across = Amain + 90°')}
        ${metric('Crossline Length',fmt(c.crossLen/1000,2)+' km','Total',false,'LQC = NQC × LQC,line')}
      </div>
      ${notice('info','Crossline QC','Crosslines should be perpendicular to survey lines and distributed across representative depths and terrain.')}`,
  };
  $("tabContent").innerHTML=content[state.activeTab];
}

function metric(label,value,sub,primary=false,tip=""){
  return `
    <div class="metric ${primary?'primary':''}" title="${tip || sub || ''}">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="sub">${sub||''}</div>
    </div>
  `;
}
function notice(type,title,text){return `<div class="notice ${type}"><b>${title}</b><br>${text}</div>`}
function row(name,cur,rec,ok,threshold=false){return `<tr><td>${name}</td><td>${cur}</td><td>${rec}</td><td class="${ok?'status-ok':threshold?'status-warn':'status-mod'}">${ok?'Recommended / OK':threshold?'WARN':'Modified'}</td></tr>`}
function kv(title, rows){return `<div class="section-card"><h3>${title}</h3><div class="kv">${rows.map(r=>`<div><span>${r[0]}</span><strong>${typeof r[1]==='number'?fmt(r[1],2):r[1]}</strong></div>`).join('')}</div></div>`}
function timeBreakdown(c){
  return `
    <div class="section-card">
      <h3>Time breakdown</h3>
      <div class="kv">
        <div title="Survey line run = Ltotal / (Vm/s × 3600)">
          <span>Survey line run</span>
          <strong>${fmt(c.mainLen/(state.speed*.514444*3600),2)} h</strong>
        </div>
        <div title="Crossline run = LQC / (Vm/s × 3600)">
          <span>Crossline run</span>
          <strong>${fmt(c.crossLen/(state.speed*.514444*3600),2)} h</strong>
        </div>
        <div title="Tturn,total = ((Nline + NQC) × Tturn) / 60">
          <span>Turns</span>
          <strong>${fmt(c.turns,2)} h</strong>
        </div>
        <div title="Ttotal = Tsubtotal × (1 + Aops)">
          <span>Total estimated</span>
          <strong>${fmt(c.totalTime,2)} h</strong>
        </div>
      </div>
    </div>
  `;
}
function renderWarnings(c,rec){$("warnings").innerHTML=warnings(c,rec).map(x=>`<div class="warning-item ${x.type}"><b>${x.title}</b><br>${x.text}</div>`).join('')}
function renderQuick(c){$("quickFacts").innerHTML=[['Vessel speed',fmt(state.speed,1)+' kn'],['Planning depth',fmt(c.depth,0)+' m'],['Swath angle',state.swathAngle+'°'],['Ping rate',state.pingRate+' Hz'],['Usable swath',fmt(c.usable,1)+' m']].map(r=>`<div class="row"><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join('')}
function getAcrossTrackSpacing(s, usableSwath, planningDepth) {
  const beamCount = Math.max(2, Number(s.beamCount));
  const totalAngle = Number(s.swathAngle);
  const halfAngle = totalAngle / 2;

  if (s.beamMode === "Equidistant") {
    return usableSwath / (beamCount - 1);
  }

  if (s.beamMode === "Equiangular") {
    const step = totalAngle / (beamCount - 1);

    let maxSpacing = 0;

    for (let i = 0; i < beamCount - 1; i++) {
      const theta1 = -halfAngle + i * step;
      const theta2 = -halfAngle + (i + 1) * step;

      const y1 = planningDepth * Math.tan(rad(theta1));
      const y2 = planningDepth * Math.tan(rad(theta2));

      maxSpacing = Math.max(maxSpacing, Math.abs(y2 - y1));
    }

    return maxSpacing;
  }

  return usableSwath / (beamCount - 1);
}
function renderMap(c) {
  $("azBadge").textContent = `AZ ${fmt(state.azimuth, 0)}°`;

  const svg = $("planSvg");

  const viewW = 420;
  const viewH = 420;
  const margin = 70;

  const availableW = viewW - margin * 2;
  const availableH = viewH - margin * 2;

  const areaLength = Math.max(1, Number(state.areaLength));
  const areaWidth = Math.max(1, Number(state.areaWidth));

  // Scale the survey box to fit inside the SVG while preserving proportions
  const scale = Math.min(
    availableW / areaLength,
    availableH / areaWidth
  );

  const bw = areaLength * scale;
  const bh = areaWidth * scale;

  const x = (viewW - bw) / 2;
  const y = (viewH - bh) / 2;

  const cx = x + bw / 2;
  const cy = y + bh / 2;
  const rotation = Number(state.azimuth) - 90;

  let s = `
    <defs>
      <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
        <path
          d="M30 0H0V30"
          fill="none"
          stroke="#9dbed0"
          stroke-width=".5"
          opacity=".45"
        />
      </pattern>
    </defs>

    <rect width="${viewW}" height="${viewH}" fill="url(#grid)" />
  `;

  // Rotate the survey area, main lines, and crosslines together
  s += `<g transform="rotate(${rotation} ${cx} ${cy})">`;

  // Survey area border
  s += `
    <rect
      x="${x}"
      y="${y}"
      width="${bw}"
      height="${bh}"
      fill="#d9eef7"
      stroke="#173f68"
      stroke-width="1"
    />
  `;

  // Main survey lines
  const n = Math.min(c.mainLines, 18);

  for (let i = 0; i < n; i++) {
    const yy = y + (i + 0.5) * bh / n;

    s += `
      <line
        x1="${x - 15}"
        y1="${yy}"
        x2="${x + bw + 15}"
        y2="${yy}"
        stroke="#174b7b"
        stroke-width="2"
      />
    `;
  }

  // Crosslines
  const cn = Math.min(c.crossLines, 6);

  for (let i = 0; i < cn; i++) {
    const xx = x + (i + 1) * bw / (cn + 1);

    s += `
      <line
        x1="${xx}"
        y1="${y - 10}"
        x2="${xx}"
        y2="${y + bh + 10}"
        stroke="#d64545"
        stroke-dasharray="5 5"
        stroke-width="1.5"
      />
    `;
  }

  s += `</g>`;

  // Labels stay unrotated so they remain readable
  s += `
    <text
      x="${viewW / 2}"
      y="${viewH - 20}"
      text-anchor="middle"
      font-size="14"
      fill="#17304f"
      font-weight="700"
    >
      Length: ${fmt(areaLength, 0)} m x Width: ${fmt(areaWidth, 0)} m
    </text>

    <circle cx="360" cy="55" r="22" fill="#fff" stroke="#cbd5df" />

    <text
      x="360"
      y="52"
      text-anchor="middle"
      font-size="11"
      font-weight="800"
      fill="#17304f"
    >
      N
    </text>

    <line
      x1="360"
      y1="58"
      x2="360"
      y2="75"
      stroke="#17304f"
    />
  `;

  svg.innerHTML = s;
}
function loadExample(){Object.assign(state,{ihoOrder:"Order 1a",cellSize:1,requiredSpc:5,compliance:95,depth:30,minDepth:20,maxDepth:40,planningDepthSource:"Average",seaState:"Calm",bottomSlope:"Flat",bottomReturn:"Good",sonarModel:"Kongsberg EM2040",speed:6,turnTime:12,opsAllowance:15,areaLength:1500,areaWidth:600,azimuth:0,runIn:50,runOut:50,activeTab:"summary"}); applyIhoRecommendations(); applySonarRecommendations(false);}
function reset(){loadExample()}
function copySummary(){
  const c=compute(); 
  const text = `Survey Line Planner Summary\nIHO Order: ${state.ihoOrder}\nUsable swath: ${fmt(c.usable,1)} m | Line spacing: ${fmt(c.lineSpacing,1)} m | Overlap: ${state.overlap}%\nExpected SPC: ${fmt(c.spc,1)} / required ${state.requiredSpc}\nSurvey lines: ${c.mainLines}\nCrosslines: ${c.crossLines}, spacing ${fmt(c.crossSpacing,1)} m\nEstimated time: ${fmt(c.totalTime,2)} h`;
  navigator.clipboard?.writeText(text);
}
function share(){ if(navigator.share) navigator.share({title:'Survey Line Planner',text:'Try this MBES survey line planner.',url:location.href}); else copySummary();}
function exportJson(){const data={inputs:state,results:compute(),recommendedSonar:recommendSonar()}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='survey-line-plan.json'; a.click(); URL.revokeObjectURL(a.href)}
init();
