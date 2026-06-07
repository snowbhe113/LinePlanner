const IHO_PROFILES = {
  "Order 2": { full:false, overlap:20, cross:5, confidence:.90, spc:3, cell:5, desc:"General deeper-water survey where full seafloor search is normally not required.", badge:"GENERAL BATHYMETRY" },
  "Order 1b": { full:false, overlap:25, cross:5, confidence:.92, spc:5, cell:2, desc:"Bathymetric survey for areas shallower than 100 m where full seafloor search is not required.", badge:"BATHYMETRY ONLY" },
  "Order 1a": { full:true, overlap:30, cross:8, confidence:.95, spc:5, cell:1, desc:"Harbours, approaches and recommended tracks where under-keel clearance is critical; full seafloor search.", badge:"FULL SEAFLOOR SEARCH" },
  "Special": { full:true, overlap:40, cross:10, confidence:.97, spc:10, cell:1, desc:"Critical shallow-water navigation areas requiring high confidence and full bottom search.", badge:"SPECIAL ORDER" },
  "Exclusive": { full:true, overlap:50, cross:12, confidence:.98, spc:15, cell:.5, desc:"Highly critical areas requiring the most conservative planning assumptions.", badge:"CRITICAL NAVIGATION AREA" }
};

const SONARS = {
  "Custom MBES": { beams:512, modes:["Equidistant","Equiangular","High Density"], freqs:[200,300,400], maxAngle:140, rangeBase:120 },
  "Kongsberg EM2040": { beams:512, modes:["Equidistant","Equiangular","High Density"], freqs:[200,300,400], maxAngle:140, rangeBase:120 },
  "Kongsberg EM2042": { beams:1024, modes:["Equidistant","Equiangular","High Density"], freqs:[200,300,400], maxAngle:140, rangeBase:140 },
  "Kongsberg EM712": { beams:512, modes:["Equidistant","Equiangular"], freqs:[40,70,100], maxAngle:140, rangeBase:900 },
  "Kongsberg EM124": { beams:512, modes:["Equidistant","Equiangular"], freqs:[12], maxAngle:150, rangeBase:6000 },
  "R2Sonic 2024": { beams:1024, modes:["Equidistant","Equiangular","High Density"], freqs:[200,300,400], maxAngle:160, rangeBase:180 },
  "R2Sonic 2026": { beams:1024, modes:["Equidistant","Equiangular","High Density"], freqs:[170,200,300,400], maxAngle:160, rangeBase:220 },
  "Norbit iWBMS": { beams:512, modes:["Equidistant","Equiangular"], freqs:[200,400,700], maxAngle:140, rangeBase:100 },
  "Teledyne SeaBat T20": { beams:512, modes:["Equidistant","Equiangular"], freqs:[200,300,400], maxAngle:140, rangeBase:110 },
  "Teledyne SeaBat T50": { beams:1024, modes:["Equidistant","Equiangular"], freqs:[200,300,400], maxAngle:140, rangeBase:150 }
};

const RECOMMENDATION_BASIS = {
  frequency: "Recommended from depth and sonar frequency options.",
  swathAngle: "Recommended from IHO order, full seafloor search, bottom slope, and sea state.",
  overlap: "Recommended from IHO order and full seafloor search requirement.",
  pingRate: "Calculated from required soundings per cell, vessel speed, and beam spacing.",
  maxRange: "Recommended from depth, selected frequency, and sonar planning profile.",
  crosslinePercent: "Recommended as a percentage of total mainline length.",
  beamCount: "Planning value used for density estimation. Choose 512 or 1024 unless using a verified sonar-specific configuration."
};

const state = {
  ihoOrder:"Order 1a", cellSize:1, requiredSpc:5, compliance:95,
  depth:30, minDepth:24, maxDepth:36, planningDepthSource:"Average", seaState:"Calm", bottomSlope:"Flat", bottomReturn:"Good",
  sonarModel:"Kongsberg EM2040", frequency:300, swathAngle:140, beamCount:512, pingRate:45, maxRange:120, beamMode:"Equidistant",
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

function init(){
  inputIds.forEach(id=>els[id]=$(id));
  fillSelect(els.ihoOrder,Object.keys(IHO_PROFILES));
  fillSelect(els.planningDepthSource,["Minimum","Average","Maximum"]);
  fillSelect(els.seaState,["Calm","Moderate","Rough"]);
  fillSelect(els.bottomSlope,["Flat","Moderate","Steep","Rugged"]);
  fillSelect(els.bottomReturn,["Good","Moderate","Weak"]);
  fillSelect(els.sonarModel,Object.keys(SONARS));
  fillSelect(els.beamMode,["Equidistant","Equiangular","High Density"]);
  inputIds.forEach(id=>els[id].addEventListener("input",()=>handleInput(id)));
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{state.activeTab=b.dataset.tab;render()}));
  $("loadExample").onclick=loadExample; $("resetBtn").onclick=reset; $("copyBtn").onclick=copySummary; $("shareBtn").onclick=share; $("exportBtn").onclick=exportJson; $("applySonarRecommendations").onclick=()=>applySonarRecommendations(true);
  loadExample();
}
function fillSelect(sel, arr){sel.innerHTML=arr.map(x=>`<option>${x}</option>`).join("")}

function handleInput(id){
  const el=els[id];
  state[id]=el.tagName==="SELECT"?el.value:Number(el.value);
  if(id==="ihoOrder") applyIhoRecommendations();
  if(["sonarModel","depth","minDepth","maxDepth","planningDepthSource","bottomSlope","seaState","bottomReturn","ihoOrder","requiredSpc","cellSize","speed"].includes(id)) {
    if(id==="sonarModel") updateBeamModes();
    const rec=recommendSonar();
    if(id==="sonarModel") applySonarRecommendations(false);
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
function depthFrequency(depth, freqs){
  let target = depth<=20?400:depth<=75?300:depth<=200?200:depth<=1000?70:12;
  return freqs.reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a, freqs[0]);
}
function recommendSonar(){
  const prof=SONARS[state.sonarModel]; const iho=IHO_PROFILES[state.ihoOrder];
  const planningDepth=getPlanningDepth(state);
  const frequency=depthFrequency(planningDepth,prof.freqs);
  let angle=prof.maxAngle;
  if(state.bottomSlope==="Moderate") angle-=10;
  if(state.bottomSlope==="Steep") angle-=20;
  if(state.bottomSlope==="Rugged") angle-=30;
  if(state.seaState==="Moderate") angle-=10;
  if(state.seaState==="Rough") angle-=25;
  if(iho.full) angle-=5;
  angle=clamp(Math.round(angle/5)*5,90,prof.maxAngle);
  const range = Math.max(planningDepth*1.25, Math.min(prof.rangeBase, planningDepth/Math.cos(rad(angle/2))*1.15));
  const mode = prof.modes.includes("Equidistant")?"Equidistant":prof.modes[0];
  const preliminary = compute({...state, frequency, swathAngle:angle, beamCount:prof.beams, maxRange:range, beamMode:mode, pingRate:state.pingRate});
  const pingRate = Math.max(5, Math.ceil(preliminary.minPingRate));
  const safeSpeed = Math.max(1, Math.min(state.speed, preliminary.maxSpeedKnots));
  return {frequency, swathAngle:angle, beamCount:prof.beams, maxRange:Math.ceil(range), beamMode:mode, pingRate, maxSpeed:safeSpeed,
    reasons:[`${planningDepthLabel(state)} ${fmt(planningDepth,0)} m selects ${frequency} kHz from supported sonar frequencies.`, `${state.bottomSlope} slope and ${state.seaState.toLowerCase()} sea state reduce usable swath angle to ${angle}° for conservative planning.`, `Ping rate is calculated from required SPC, speed, cell size, and usable beam spacing.`]};
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
  const slopeF={Flat:1,Moderate:.93,Steep:.86,Rugged:.78}[s.bottomSlope];
  const seaF={Calm:1,Moderate:.93,Rough:.84}[s.seaState];
  const bottomF={Good:1,Moderate:.94,Weak:.86}[s.bottomReturn];
  const conf=iho.confidence; const usable=effective*slopeF*seaF*bottomF*conf;
  const lineSpacing=usable*(1-s.overlap/100); const mainLines=Math.max(1,Math.ceil(s.areaWidth/Math.max(lineSpacing,1))+1);
  const avgLine=s.areaLength+s.runIn+s.runOut; const mainLen=mainLines*avgLine;
  const along=speedMps/Math.max(s.pingRate,.1); let across=usable/Math.max(s.beamCount,1); if(s.beamMode==="High Density") across*=.75; if(s.beamMode==="Equiangular") across*=1.15;
  const cellArea=s.cellSize*s.cellSize; const footprint=along*across; const spc=cellArea/Math.max(footprint,.000001); const pass=spc>=s.requiredSpc;
  const recCross=IHO_PROFILES[s.ihoOrder].cross; const crossPct=s.crosslinePercent; const reqCrossLen=mainLen*crossPct/100; const avgCross=s.areaWidth+s.runIn+s.runOut; const crossLines=crossPct>0?Math.max(1,Math.ceil(reqCrossLen/Math.max(avgCross,1))):0; const crossSpacing=s.areaLength/(crossLines+1); const crossLen=crossLines*avgCross; const crossAz=(Number(s.azimuth)+90)%360;
  const runHours=(mainLen+crossLen)/(Math.max(speedMps,.1)*3600); const turns=(mainLines+crossLines)*s.turnTime/60; const subtotal=runHours+turns; const totalTime=subtotal*(1+s.opsAllowance/100);
  const alongRequired=cellArea/(Math.max(s.requiredSpc,.1)*Math.max(across,.000001)); const maxSpeedMps=alongRequired*s.pingRate; const maxSpeedKnots=maxSpeedMps/.514444; const minPingRate=speedMps/Math.max(alongRequired,.000001);
  
  return {iho, depth, theoretical,slant,effHalf,effective,usable,lineSpacing,mainLines,avgLine,mainLen,along,across,footprint,spc,pass,recCross,reqCrossLen,avgCross,crossLines,crossSpacing,crossLen,crossAz,runHours,turns,totalTime,maxSpeedKnots,minPingRate,slopeF,seaF,bottomF,conf,rangeLimited};
}

function warnings(c, rec){
  const w=[];
  if(c.pass) w.push({type:"pass",title:"Density requirement met",text:`Expected ${fmt(c.spc,1)} soundings/cell ≥ required ${state.requiredSpc}.`});
  else w.push({type:"critical",title:"CRITICAL: Density requirement not achieved",text:`Expected ${fmt(c.spc,1)} soundings/cell is below required ${state.requiredSpc}. Reduce speed, increase ping rate, or tighten line spacing.`});
  if(c.rangeLimited) w.push({type:"warning",title:"WARNING: Swath is range limited",text:`Outer-beam slant range ${fmt(c.slant,1)} m exceeds usable range ${fmt(state.maxRange,0)} m. Usable swath is reduced.`});
  if(state.overlap < IHO_PROFILES[state.ihoOrder].overlap) w.push({type:"warning",title:"WARNING: Overlap below recommendation",text:`Current ${state.overlap}% is below recommended ${IHO_PROFILES[state.ihoOrder].overlap}% for ${state.ihoOrder}.`});
  if(state.speed > c.maxSpeedKnots) w.push({type:"warning",title:"WARNING: Speed too high for density",text:`Current ${fmt(state.speed,1)} kn exceeds calculated max ${fmt(c.maxSpeedKnots,1)} kn.`});
  if(state.seaState==="Rough") w.push({type:"caution",title:"CAUTION: Rough sea state",text:"Use conservative swath angles and monitor outer beam rejection."});
  return w;
}

function renderInputs(){
  Object.keys(els).forEach(id=>{ if(els[id]) els[id].value=state[id]; });
  updateBeamModes(); Object.keys(els).forEach(id=>{ if(els[id]) els[id].value=state[id]; });
}
function compareClass(current, recommended, lowerBad=false){
  const same=String(current)===String(recommended) || Math.abs(Number(current)-Number(recommended))<.0001;
  if(same) return "recommended"; if(lowerBad && Number(current)<Number(recommended)) return "warn"; return "modified";
}
function fieldMsg(id, current, recommended, lowerBad=false, unit=""){
  const el=$(id); const cls=compareClass(current,recommended,lowerBad); el.classList.remove("recommended","modified","warn"); el.classList.add(cls);
  return cls==="recommended"?`✓ Recommended: ${recommended}${unit}`:cls==="warn"?`WARN: below recommended ${recommended}${unit}`:`Modified; recommended ${recommended}${unit}`;
}
function renderStatuses(rec,c){
  
  $("freqStatus").textContent=fieldMsg("frequency",state.frequency,rec.frequency,false," kHz");
  $("angleStatus").textContent=fieldMsg("swathAngle",state.swathAngle,rec.swathAngle,false,"°");
  $("beamStatus").textContent=fieldMsg("beamCount",state.beamCount,rec.beamCount,false," beams");
  $("pingStatus").textContent=fieldMsg("pingRate",state.pingRate,rec.pingRate,true," Hz");
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
  $("ihoRecommendation").innerHTML=`<b>${c.iho.badge}</b><br>${c.iho.desc}<br>Auto-set: overlap ${c.iho.overlap}%, crosslines ${c.iho.cross}%, confidence factor ${c.iho.confidence}.`;
  $("sonarReason").innerHTML=`<b>Recommended from ${state.sonarModel} + environment</b><br>${rec.reasons.join("<br>")}`;
  $("planningRecommendation").innerHTML=`<b>Recommended planning values</b><br>Overlap ${c.iho.overlap}% · Crosslines ${c.iho.cross}% · Max speed ${fmt(c.maxSpeedKnots,1)} kn · Min ping ${fmt(c.minPingRate,0)} Hz.`;
  renderTab(c,rec); renderMap(c); renderQuick(c); renderWarnings(c,rec);
}
function renderTab(c,rec){
  const badges=`<div class="badges"><span class="badge ${c.pass?'pass':'warn'}">Density ${c.pass?'PASS':'FAIL'}</span><span class="badge">${state.ihoOrder}</span><span class="badge ${c.iho.full?'teal':''}">${c.iho.badge}</span></div>`;
  const content={
    summary: `${badges}<div class="cards">${metric('Line Spacing',fmt(c.lineSpacing,1)+' m','Overlap '+state.overlap+'%',true)}${metric('Usable Swath',fmt(c.usable,1)+' m',fmt(c.usable/c.depth,2)+'× planning depth')}${metric('Expected SPC',fmt(c.spc,1),'Required '+state.requiredSpc)}${metric('Max Speed',fmt(c.maxSpeedKnots,1)+' kn','For required density')}${metric('Main Lines',c.mainLines,fmt(c.mainLen,0)+' m total')}${metric('Total Time',fmt(c.totalTime,2)+' h',fmt(c.totalTime/10,2)+' ops days @10h')}</div>${notice(c.pass?'pass':'critical',c.pass?'Density requirement met':'CRITICAL: Density fails',c.pass?`Expected ${fmt(c.spc,1)} ≥ required ${state.requiredSpc}.`:`Expected ${fmt(c.spc,1)} < required ${state.requiredSpc}.`) }${timeBreakdown(c)}`,
    recommendations: `${badges}<div class="section-card"><h3>Current vs Recommended</h3><table class="compare"><thead><tr><th>Parameter</th><th>Current</th><th>Recommended</th><th>Status</th></tr></thead><tbody>${row('Frequency',state.frequency+' kHz',rec.frequency+' kHz',state.frequency==rec.frequency)}${row('Swath angle',state.swathAngle+'°',rec.swathAngle+'°',state.swathAngle==rec.swathAngle)}${row('Beam count',state.beamCount,rec.beamCount,state.beamCount==rec.beamCount)}${row('Ping rate',state.pingRate+' Hz',rec.pingRate+' Hz',state.pingRate>=rec.pingRate,true)}${row('Max range',state.maxRange+' m',rec.maxRange+' m',state.maxRange>=rec.maxRange,true)}${row('Overlap',state.overlap+'%',c.iho.overlap+'%',state.overlap>=c.iho.overlap,true)}${row('Speed',state.speed+' kn','≤ '+fmt(c.maxSpeedKnots,1)+' kn',state.speed<=c.maxSpeedKnots,true)}${row('Crosslines',state.crosslinePercent+'%',c.iho.cross+'%',state.crosslinePercent>=c.iho.cross,true)}</tbody></table></div><div class="section-card"><h3>Why these recommendations?</h3><p>${rec.reasons.join(' ')}</p><p>IHO order controls full seafloor search, recommended overlap, crossline percentage, and confidence factor. Sonar profile provides supported frequencies, beam count, modes, and range limits. Environment modifies the planning swath.</p></div>`,
    swath: `${badges}<div class="cards">${metric('Planning Depth',fmt(c.depth,1)+' m',planningDepthLabel(),true)}${metric('Theoretical Swath',fmt(c.theoretical,1)+' m','Flat bottom geometry')}${metric('Slant Range',fmt(c.slant,1)+' m',c.rangeLimited?'Range limited':'Within range')}${metric('Effective Swath',fmt(c.effective,1)+' m','After range limit')}${metric('Usable Swath',fmt(c.usable,1)+' m','Used for line spacing')}${metric('Effective Angle',fmt(c.effHalf*2,1)+'°','Total usable angle')}${metric('Confidence Factor',fmt(c.conf,2),'From IHO order')}</div>${kv('Correction factors',[['Slope',c.slopeF],['Sea state',c.seaF],['Bottom return',c.bottomF],['IHO confidence',c.conf]])}`,
    density: `${badges}<div class="cards">${metric('Expected SPC',fmt(c.spc,1),'Required '+state.requiredSpc,true)}${metric('Along-track',fmt(c.along,3)+' m','Speed / ping rate')}${metric('Across-track',fmt(c.across,3)+' m','Usable swath / beams')}${metric('Footprint area',fmt(c.footprint,4)+' m²','Approx.')}${metric('Max Speed',fmt(c.maxSpeedKnots,1)+' kn','To pass density')}${metric('Min Ping Rate',fmt(c.minPingRate,0)+' Hz','At current speed')}</div>`,
    lines: `${badges}<div class="cards">${metric('Line Spacing',fmt(c.lineSpacing,1)+' m','Recommended current',true)}${metric('Number of Mainlines',c.mainLines,'')}${metric('Average Line Length',fmt(c.avgLine,0)+' m','Includes run-in/out')}${metric('Total Mainline Length',fmt(c.mainLen,0)+' m','')}${metric('Planned Overlap',state.overlap+'%','Recommended '+c.iho.overlap+'%')}${metric('Area',fmt(state.areaLength*state.areaWidth/1e6,2)+' km²','Survey rectangle')}</div>${timeBreakdown(c)}`,
    crosslines: `${badges}<div class="cards">${metric('Crossline %',state.crosslinePercent+'%','Recommended '+c.iho.cross+'%',true)}${metric('Required Crossline Length',fmt(c.reqCrossLen/1000,2)+' km','')}${metric('Number of Crosslines',c.crossLines,'')}${metric('Crossline Spacing',fmt(c.crossSpacing,0)+' m','Even distribution')}${metric('Crossline Azimuth',fmt(c.crossAz,0)+'°','Perpendicular')}${metric('Crossline Length',fmt(c.crossLen/1000,2)+' km','Total')}</div>${notice('info','Crossline QC','Crosslines should be perpendicular to main lines and distributed across representative depths and terrain.')}`
  };
  $("tabContent").innerHTML=content[state.activeTab];
}
function metric(label,value,sub,primary=false){return `<div class="metric ${primary?'primary':''}"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub||''}</div></div>`}
function notice(type,title,text){return `<div class="notice ${type}"><b>${title}</b><br>${text}</div>`}
function row(name,cur,rec,ok,threshold=false){return `<tr><td>${name}</td><td>${cur}</td><td>${rec}</td><td class="${ok?'status-ok':threshold?'status-warn':'status-mod'}">${ok?'Recommended / OK':threshold?'WARN':'Modified'}</td></tr>`}
function kv(title, rows){return `<div class="section-card"><h3>${title}</h3><div class="kv">${rows.map(r=>`<div><span>${r[0]}</span><strong>${typeof r[1]==='number'?fmt(r[1],2):r[1]}</strong></div>`).join('')}</div></div>`}
function timeBreakdown(c){return `<div class="section-card"><h3>Time breakdown</h3><div class="kv"><div><span>Mainline run</span><strong>${fmt(c.mainLen/(state.speed*.514444*3600),2)} h</strong></div><div><span>Crossline run</span><strong>${fmt(c.crossLen/(state.speed*.514444*3600),2)} h</strong></div><div><span>Turns</span><strong>${fmt(c.turns,2)} h</strong></div><div><span>Total estimated</span><strong>${fmt(c.totalTime,2)} h</strong></div></div></div>`}
function renderWarnings(c,rec){$("warnings").innerHTML=warnings(c,rec).map(x=>`<div class="warning-item ${x.type}"><b>${x.title}</b><br>${x.text}</div>`).join('')}
function renderQuick(c){$("quickFacts").innerHTML=[['Vessel speed',fmt(state.speed,1)+' kn'],['Planning depth',fmt(c.depth,0)+' m'],['Swath angle',state.swathAngle+'°'],['Ping rate',state.pingRate+' Hz'],['Usable swath',fmt(c.usable,1)+' m']].map(r=>`<div class="row"><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join('')}

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
  const text = `Survey Line Planner Summary\nIHO Order: ${state.ihoOrder}\nUsable swath: ${fmt(c.usable,1)} m | Line spacing: ${fmt(c.lineSpacing,1)} m | Overlap: ${state.overlap}%\nExpected SPC: ${fmt(c.spc,1)} / required ${state.requiredSpc}\nMain lines: ${c.mainLines}\nCrosslines: ${c.crossLines}, spacing ${fmt(c.crossSpacing,1)} m\nEstimated time: ${fmt(c.totalTime,2)} h`;
  navigator.clipboard?.writeText(text);
}
function share(){ if(navigator.share) navigator.share({title:'Survey Line Planner',text:'Try this MBES survey line planner.',url:location.href}); else copySummary();}
function exportJson(){const data={inputs:state,results:compute(),recommendedSonar:recommendSonar()}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='survey-line-plan.json'; a.click(); URL.revokeObjectURL(a.href)}
init();
