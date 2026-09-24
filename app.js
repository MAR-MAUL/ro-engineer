
const $ = id => document.getElementById(id);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const num = id => Number($(id)?.value || 0);
const fmt = (v,d=1) => Number.isFinite(v) ? v.toFixed(d) : "—";
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));

const SUPABASE_URL = "https://xjugyixmnpnwatapqzpd.supabase.co";
const SUPABASE_KEY = "sb_publishable_r1GSjkdRmC91hJBtaYkD_Q_vD952_yC";
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let currentUser = null;
let lastCalc = null;
let lastMembrane = null;
let lastDiagnostic = null;
let lastAlarmScan = [];
let currentTroubleCategory = "pressure";
let svgZoom = 1;

function row(label,value,unit,cls=""){
  return '<div class="data-row '+cls+'"><span>'+label+'</span><strong>'+value+'</strong><em>'+unit+'</em></div>';
}
function pctError(actual, expected){
  if (!Number.isFinite(expected) || Math.abs(expected) < 1e-9) return 0;
  return (actual-expected)/expected*100;
}
function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function showView(name){
  $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-"+name));
  $$("[data-view-target]").forEach(b => b.classList.toggle("active", b.dataset.viewTarget === name));
  window.scrollTo({top:0,behavior:"smooth"});
  if(name==="dashboard") renderDashboard();
  if(name==="membrane") calcMembrane();
  if(name==="energy") renderEnergyPage();
  if(name==="performance") comparePerformance();
  if(name==="projects") loadProjects();
}
$$("[data-view-target]").forEach(b => b.addEventListener("click",()=>showView(b.dataset.viewTarget)));
$$("[data-view-jump]").forEach(b => b.addEventListener("click",()=>showView(b.dataset.viewJump)));

function calcProcess(){
  const feed = Math.max(0,num("feedFlow"));
  const recovery = clamp(num("recovery")/100,0,0.95);
  const feedP = Math.max(0,num("feedPressure"));
  const roP = Math.max(feedP,num("roPressure"));
  const rejectP = Math.max(feedP,num("rejectPressure"));
  const pxEff = clamp(num("pxPressureEff")/100,0.01,1);
  const hppEff = clamp(num("hppEff")/100,0.01,1);
  const cpEff = clamp(num("cpEff")/100,0.01,1);

  const permeate = feed*recovery;
  const rejectTotal = Math.max(0,feed-permeate);

  let pxHpIn = Math.max(0,num("pxHpIn"));
  const invalidPx = pxHpIn > rejectTotal + 1e-9;
  pxHpIn = Math.min(pxHpIn,rejectTotal);

  const pxLpIn = pxHpIn;
  const pxHpOut = pxLpIn;
  const pxLpOut = pxHpIn;
  const hppFlow = Math.max(0,feed-pxLpIn);
  const cpFlow = pxHpOut;
  const membraneFeed = hppFlow+cpFlow;
  const directReject = Math.max(0,rejectTotal-pxHpIn);

  const pxHpOutP = feedP + pxEff*Math.max(0,rejectP-feedP);
  const hppPower = hppFlow*Math.max(0,roP-feedP)/(36*hppEff);
  const cpPower = cpFlow*Math.max(0,roP-pxHpOutP)/(36*cpEff);
  const totalPower = hppPower+cpPower;
  const sec = permeate>0 ? totalPower/permeate : 0;

  const feedErrorM3h = Math.abs(membraneFeed-feed);
  const rejectErrorM3h = Math.abs((pxLpOut+directReject)-rejectTotal);
  const balanceErrorM3h = Math.max(feedErrorM3h,rejectErrorM3h);
  const balanceErrorPct = feed>0 ? balanceErrorM3h/feed*100 : 0;
  const balanced = !invalidPx && balanceErrorPct < 0.1;

  const feedTds = Math.max(0,num("feedTds"));
  const saltRej = clamp(num("saltRejection")/100,0,1);
  const permTds = feedTds*(1-saltRej);
  const rejectTds = rejectTotal>0 ? (feedTds*feed-permTds*permeate)/rejectTotal : 0;

  lastCalc = {
    feed,recovery,feedP,roP,rejectP,pxEff,hppEff,cpEff,permeate,rejectTotal,pxHpIn,pxLpIn,pxHpOut,pxLpOut,
    hppFlow,cpFlow,membraneFeed,directReject,pxHpOutP,hppPower,cpPower,totalPower,sec,balanceErrorM3h,balanceErrorPct,
    balanced,feedTds,saltRej,permTds,rejectTds
  };

  const badge = $("balanceBadge");
  if(badge){
    badge.className = "badge "+(balanced?"ok":"bad");
    badge.textContent = balanced ? "✓ Mass Balance OK" : "⚠ Check Inputs";
  }
  if($("balanceMessage")){
    $("balanceMessage").className = "balance-message"+(balanced?"":" error");
    $("balanceMessage").textContent = invalidPx
      ? "PX HP IN cannot exceed total RO reject ("+fmt(rejectTotal)+" m³/h)."
      : "Feed side: HPP + PX HP OUT = "+fmt(membraneFeed)+" m³/h. Reject side: PX LP OUT + vessel reject = "+fmt(rejectTotal)+" m³/h.";
  }

  if($("balanceTable")) $("balanceTable").innerHTML =
    row("Feed to RO (Total)",fmt(feed),"m³/h")+
    row("To HPP (from Bag Filter)",fmt(hppFlow),"m³/h")+
    row("PX LP IN (from Bag Filter)",fmt(pxLpIn),"m³/h")+
    row("Permeate (Total)",fmt(permeate),"m³/h")+
    row("Reject (Total)",fmt(rejectTotal),"m³/h")+
    row("RO Reject to PX HP IN",fmt(pxHpIn),"m³/h")+
    row("Vessel Reject (LP Reject)",fmt(directReject),"m³/h")+
    row("Recovery (Overall)",fmt(recovery*100),"%")+
    row("Mass Balance Error",fmt(balanceErrorPct,2),"%",balanced?"good":"warn");

  if($("flowSummary")) $("flowSummary").innerHTML =
    row("Feed to RO (from Pretreatment)",fmt(feed),"m³/h")+
    row("To HPP (from Bag Filter)",fmt(hppFlow),"m³/h")+
    row("PX LP IN (from Bag Filter)",fmt(pxLpIn),"m³/h")+
    row("PX HP IN (from RO Reject)",fmt(pxHpIn),"m³/h")+
    row("Permeate (Total)",fmt(permeate),"m³/h")+
    row("Reject (Total)",fmt(rejectTotal),"m³/h")+
    row("Mass Balance Check",fmt(balanceErrorPct,2),"%",balanced?"good":"warn");

  if($("energySummary")) $("energySummary").innerHTML =
    row("HPP Power",fmt(hppPower),"kW")+
    row("HPP Efficiency",fmt(hppEff*100),"%")+
    row("CP Power",fmt(cpPower),"kW")+
    row("CP Efficiency",fmt(cpEff*100),"%")+
    row("PX Pressure Recovery",fmt(pxEff*100),"%")+
    row("Net Power (HPP + CP)",fmt(totalPower),"kW")+
    row("Specific Energy",fmt(sec,2),"kWh/m³");

  if($("qualitySummary")) $("qualitySummary").innerHTML =
    row("TDS - Feed",fmt(feedTds,0),"mg/L")+
    row("TDS - Permeate",fmt(permTds,0),"mg/L")+
    row("TDS - Reject",fmt(rejectTds,0),"mg/L")+
    row("Temperature",fmt(num("temperature")),"°C")+
    row("Salt Rejection",fmt(saltRej*100),"%");

  const tags = {
    tagFeed:fmt(feed,0),tagFeedP:fmt(feedP),tagHpp:fmt(hppFlow,0),tagHppP:fmt(roP),
    tagPxLpIn:fmt(pxLpIn,0),tagPxLpInP:fmt(feedP),tagPxHpOut:fmt(pxHpOut,0),tagPxHpOutP:fmt(pxHpOutP),
    tagCp:fmt(cpFlow,0),tagCpP:fmt(roP),tagPxHpIn:fmt(pxHpIn,0),tagRejectP:fmt(rejectP),tagPerm:fmt(permeate,0)
  };
  Object.entries(tags).forEach(([id,val])=>{ if($(id)) $(id).textContent=val; });

  syncTroubleDefaults();
  renderDashboard();
  renderEnergyPage();
  return lastCalc;
}

[
  "feedFlow","recovery","pxHpIn","feedPressure","roPressure","rejectPressure","pxPressureEff","hppEff","cpEff",
  "feedTds","saltRejection","temperature"
].forEach(id => $(id)?.addEventListener("input",calcProcess));
$("calculateBtn")?.addEventListener("click",calcProcess);

$("showValues")?.addEventListener("change",e=>{ if($("valueTags")) $("valueTags").style.display=e.target.checked?"":"none"; });
$("showInstruments")?.addEventListener("change",e=>{ $$(".freq-tag").forEach(x=>x.style.display=e.target.checked?"":"none"); });
function setZoom(v){ svgZoom=clamp(v,.8,1.3); if($("processSvg")) $("processSvg").style.transform="scale("+svgZoom+")"; if($("zoomLabel")) $("zoomLabel").textContent=Math.round(svgZoom*100)+"%"; }
$("zoomIn")?.addEventListener("click",()=>setZoom(svgZoom+.1));
$("zoomOut")?.addEventListener("click",()=>setZoom(svgZoom-.1));
$("resetView")?.addEventListener("click",()=>setZoom(1));
$("autoArrange")?.addEventListener("click",()=>setZoom(1));

function renderDashboard(){
  const c=lastCalc||calcProcess();
  if(!$("dashboardKpis")) return;
  $("dashboardKpis").innerHTML =
    '<div class="kpi"><span>Permeate</span><strong>'+fmt(c.permeate,1)+'</strong><small>m³/h · '+fmt(c.permeate*24,0)+' m³/day</small></div>'+
    '<div class="kpi"><span>Recovery</span><strong>'+fmt(c.recovery*100,1)+'%</strong><small>Overall RO recovery</small></div>'+
    '<div class="kpi"><span>RO Pressure</span><strong>'+fmt(c.roP,1)+'</strong><small>bar at inlet header</small></div>'+
    '<div class="kpi"><span>Specific Energy</span><strong>'+fmt(c.sec,2)+'</strong><small>kWh/m³ preliminary</small></div>';
  $("dashboardDesign").innerHTML =
    row("Feed Flow",fmt(c.feed),"m³/h")+row("HPP Branch",fmt(c.hppFlow),"m³/h")+row("PX LP IN",fmt(c.pxLpIn),"m³/h")+
    row("Reject Total",fmt(c.rejectTotal),"m³/h")+row("Product TDS",fmt(c.permTds,0),"mg/L");
  const active = lastAlarmScan.filter(x=>x.level==="bad").length;
  $("dashboardStatus").innerHTML =
    '<div class="status-line"><span>Mass Balance</span><b class="'+(c.balanced?"good":"bad")+'">'+(c.balanced?"OK":"CHECK")+'</b></div>'+
    '<div class="status-line"><span>Threshold Alarms</span><b class="'+(active?"bad":"good")+'">'+(active?active+" active":"None")+'</b></div>'+
    '<div class="status-line"><span>PX Pressure Recovery</span><b class="good">'+fmt(c.pxEff*100,1)+'%</b></div>';
}

function calcMembrane(){
  if(!$("mdVessels")) return null;
  const vessels=Math.max(1,Math.round(num("mdVessels")));
  const elements=Math.max(1,Math.round(num("mdElements")));
  const areaEach=Math.max(1,num("mdArea"));
  const feed=Math.max(0,num("mdFeed"));
  const rec=clamp(num("mdRecovery")/100,0.01,.9);
  const totalElements=vessels*elements;
  const totalArea=totalElements*areaEach;
  const perm=feed*rec;
  const reject=feed-perm;
  const capacity=perm*24;
  const flux=totalArea>0?perm*1000/totalArea:0;
  const feedV=feed/vessels;
  const permV=perm/vessels;
  const rejectV=reject/vessels;

  lastMembrane={vessels,elements,areaEach,totalElements,totalArea,feed,rec,perm,reject,capacity,flux,feedV,permV,rejectV,stage:$("mdStage").value,membrane:$("mdMembrane").value};

  $("membraneResults").innerHTML =
    row("Total Elements",fmt(totalElements,0),"ea")+
    row("Total Membrane Area",fmt(totalArea,0),"m²")+
    row("Permeate Flow",fmt(perm,1),"m³/h")+
    row("Plant Capacity",fmt(capacity,0),"m³/day")+
    row("Reject Flow",fmt(reject,1),"m³/h")+
    row("Average Flux",fmt(flux,1),"LMH")+
    row("Feed / Vessel",fmt(feedV,1),"m³/h")+
    row("Permeate / Vessel",fmt(permV,1),"m³/h")+
    row("Reject / Vessel",fmt(rejectV,1),"m³/h");

  const checks=[];
  if(flux>20) checks.push({level:"warn",title:"Average flux is high",text:"Average flux is "+fmt(flux,1)+" LMH. Review the selected membrane vendor limit, fouling allowance and actual feed quality before finalizing."});
  else if(flux<8) checks.push({level:"warn",title:"Average flux is low",text:"Average flux is "+fmt(flux,1)+" LMH. Check whether the array is oversized or the design flow/recovery is too low."});
  else checks.push({level:"good",title:"Average flux is in a reasonable preliminary range",text:"Calculated average flux is "+fmt(flux,1)+" LMH. Final acceptance still depends on the selected membrane model and vendor projection."});
  if(rec>0.5 && ($("waterType")?.value||"").startsWith("Seawater")) checks.push({level:"warn",title:"High seawater recovery",text:"Review osmotic pressure, concentrate quality, scaling risk and vendor limits before using this recovery."});
  checks.push({level:"good",title:"Single-stage vessel loading",text:vessels+" pressure vessels × "+elements+" elements/vessel = "+totalElements+" elements online."});
  $("membraneWarnings").innerHTML=checks.map(x=>'<div class="diag-block '+x.level+'"><h3>'+x.title+'</h3><p>'+x.text+'</p></div>').join("");
  return lastMembrane;
}
["mdVessels","mdElements","mdArea","mdFeed","mdRecovery","mdStage","mdMembrane"].forEach(id=>$(id)?.addEventListener("input",calcMembrane));
$("syncMembraneToProcess")?.addEventListener("click",()=>{
  $("feedFlow").value=$("mdFeed").value;
  $("recovery").value=$("mdRecovery").value;
  calcProcess();
  showView("process");
});

function initTroubleshooting(){
  const data=window.RO_TROUBLESHOOTING;
  if(!data || !$("troubleCategories")) return;
  $("troubleCategories").innerHTML=data.categories.map(c=>'<button type="button" data-cat="'+c.id+'" class="'+(c.id===currentTroubleCategory?"active":"")+'">'+c.name+'</button>').join("");
  $("troubleCategories").addEventListener("click",e=>{
    const b=e.target.closest("[data-cat]"); if(!b) return;
    currentTroubleCategory=b.dataset.cat;
    $$("#troubleCategories [data-cat]").forEach(x=>x.classList.toggle("active",x.dataset.cat===currentTroubleCategory));
    renderTroubleSymptoms();
  });
  renderTroubleSymptoms();
}
function renderTroubleSymptoms(){
  const data=window.RO_TROUBLESHOOTING;
  const cat=data.categories.find(c=>c.id===currentTroubleCategory)||data.categories[0];
  $("troubleSymptom").innerHTML=cat.symptoms.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join("");
  renderTroubleBranch();
}
function renderTroubleBranch(){
  const diag=window.RO_TROUBLESHOOTING?.diagnostics[$("troubleSymptom")?.value];
  if(!diag) return;
  if(diag.branchOptions){
    $("trendBlock").classList.remove("hidden");
    $("troubleBranch").innerHTML=diag.branchOptions.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join("");
  }else{
    $("trendBlock").classList.add("hidden");
    $("troubleBranch").innerHTML="";
  }
}
$("troubleSymptom")?.addEventListener("change",renderTroubleBranch);

function runDiagnostic(){
  const id=$("troubleSymptom").value;
  const diag=window.RO_TROUBLESHOOTING?.diagnostics[id];
  if(!diag) return;
  let result=diag;
  if(diag.branchOptions){
    result=diag.branches[$("troubleBranch").value]||diag.branches.unknown;
  }
  const title=diag.title||"Guided Diagnosis";
  $("diagnosticTitle").textContent=title;
  const likely=result.likely||"Verification required before a cause can be assigned.";
  const checks=result.checks||[];
  const actions=result.actions||[];
  $("diagnosticResult").innerHTML=
    '<div class="diag-block warn"><h3>Likely Direction</h3><p>'+escapeHtml(likely)+'</p></div>'+
    '<div class="diag-block"><h3>Verification Sequence</h3><ol>'+checks.map(x=>'<li>'+escapeHtml(x)+'</li>').join("")+'</ol></div>'+
    '<div class="diag-block good"><h3>Corrective Action</h3><ol>'+actions.map(x=>'<li>'+escapeHtml(x)+'</li>').join("")+'</ol></div>';
  lastDiagnostic={id,title,likely,checks,actions,category:currentTroubleCategory};
}
$("runDiagnostic")?.addEventListener("click",runDiagnostic);

$$("[data-trouble-tab]").forEach(b=>b.addEventListener("click",()=>{
  const tab=b.dataset.troubleTab;
  $$("[data-trouble-tab]").forEach(x=>x.classList.toggle("active",x===b));
  $$(".trouble-pane").forEach(x=>x.classList.toggle("active",x.id==="trouble-"+tab));
}));

function syncTroubleDefaults(){
  if(!lastCalc) return;
  const c=lastCalc;
  const pairs={
    mFeed:c.feed,mHpp:c.hppFlow,mPxLpIn:c.pxLpIn,mRoFeed:c.membraneFeed,mPxHpOut:c.pxHpOut,mPerm:c.permeate,
    mPxHpIn:c.pxHpIn,mPxLpOut:c.pxLpOut,mDirectReject:c.directReject,alarmModuleP:c.roP,alarmPxDp:Math.max(0,c.rejectP-c.pxHpOutP),
    pfFeed:c.feed,pfPerm:c.permeate,pfPressure:c.roP,pfTds:c.permTds,pfPower:c.totalPower
  };
  Object.entries(pairs).forEach(([id,val])=>{const el=$(id); if(el && !el.matches(":focus")) el.value=fmt(val,1);});
}
function checkCard(title,error,tolerance,detail){
  const a=Math.abs(error);
  const level=a<=tolerance?"good":a<=tolerance*2?"warn":"bad";
  const state=level==="good"?"PASS":level==="warn"?"REVIEW":"FAIL";
  return '<div class="check-card"><div><h3>'+escapeHtml(title)+'</h3><p>'+escapeHtml(detail)+'</p></div><div class="check-state '+level+'">'+state+' · '+fmt(error,1)+'%</div></div>';
}
function runMeasuredBalance(){
  const tol=Math.max(.1,num("mTolerance"));
  const feed=num("mFeed"),hpp=num("mHpp"),lpIn=num("mPxLpIn"),roFeed=num("mRoFeed"),hpOut=num("mPxHpOut"),perm=num("mPerm"),hpIn=num("mPxHpIn"),lpOut=num("mPxLpOut"),direct=num("mDirectReject");
  const checks=[
    ["Raw-feed split",pctError(hpp+lpIn,feed),"HPP branch + PX LP IN should equal total feed."],
    ["HP header balance",pctError(hpp+hpOut,roFeed),"HPP discharge + PX HP OUT should equal RO header feed."],
    ["RO mass balance",pctError(perm+hpIn+direct,roFeed),"Permeate + RO reject to PX + direct vessel reject should equal RO feed."],
    ["PX feed-side balance",pctError(hpOut,lpIn),"PX HP OUT flow should track PX LP IN flow after allowing for vendor leakage/mixing."],
    ["PX reject-side balance",pctError(lpOut,hpIn),"PX LP OUT flow should track PX HP IN flow after allowing for vendor leakage/mixing."]
  ];
  const failed=checks.filter(x=>Math.abs(x[1])>tol);
  $("measuredBalanceResults").innerHTML=checks.map(x=>checkCard(x[0],x[1],tol,x[2])).join("")+
    (failed.length?'<div class="diag-block warn"><h3>Diagnosis Rule</h3><p>Before assigning a PX or pump fault, verify flowmeter scaling/zero, bypass and isolation valves, drains/sample lines and leakage paths. An open mass balance is first treated as a measurement or unaccounted-flow problem.</p></div>':'<div class="diag-block good"><h3>Balance Status</h3><p>All entered measured balances are within the selected tolerance.</p></div>');
}
$("runFlowBalance")?.addEventListener("click",runMeasuredBalance);

function scanAlarms(){
  const pAlarm=Math.max(0,num("setModulePAlarm")||60);
  const dpAlarm=Math.max(0,num("setModuleDpAlarm")||3);
  const pxDpAlarm=Math.max(0,num("setPxDpAlarm")||2);
  const speedDev=Math.max(0,num("setSpeedDev")||2);
  const p=num("alarmModuleP"),dp=num("alarmModuleDp"),pxdp=num("alarmPxDp"),cond=num("alarmProductCond");
  const hRef=num("alarmHppRef"),hAct=num("alarmHppAct"),cRef=num("alarmCpRef"),cAct=num("alarmCpAct");
  const out=[
    {title:"Module inlet pressure",value:p+" bar",level:p>=pAlarm?"bad":"good",text:p>=pAlarm?"At/above "+pAlarm+" bar alarm. Use the rising-pressure guided diagnosis and compare pre-trip RO DP before changing speed.":"Below "+pAlarm+" bar alarm."},
    {title:"RO module DP",value:dp+" bar",level:dp>=dpAlarm?"bad":"good",text:dp>=dpAlarm?"At/above "+dpAlarm+" bar alarm. Localize pressure loss by stage/vessel and check restriction/fouling/scaling.":"Below "+dpAlarm+" bar alarm."},
    {title:"PX differential pressure",value:pxdp+" bar",level:pxdp>=pxDpAlarm?"bad":"good",text:pxdp>=pxDpAlarm?"At/above "+pxDpAlarm+" bar reference. Verify pressure instruments, flow ratio and valve lineup.":"Below "+pxDpAlarm+" bar reference."},
    {title:"HPP reference vs actual",value:fmt(hRef-hAct,1)+" Hz dev.",level:Math.abs(hRef-hAct)>speedDev?"warn":"good",text:"Reference "+hRef+" Hz / actual "+hAct+" Hz."},
    {title:"CP reference vs actual",value:fmt(cRef-cAct,1)+" Hz dev.",level:Math.abs(cRef-cAct)>speedDev?"warn":"good",text:"Reference "+cRef+" Hz / actual "+cAct+" Hz."},
    {title:"Product conductivity",value:cond+" µS/cm",level:"review",text:"Trend against the normal borewell-feed baseline. A rise should first trigger measurement verification, then pressure/recovery/temperature, salt-rejection and vessel-integrity checks."}
  ];
  lastAlarmScan=out.map(x=>({...x,level:x.level==="review"?"warn":x.level}));
  $("alarmResults").innerHTML=out.map(x=>{
    const level=x.level==="review"?"warn":x.level;
    const state=level==="good"?"NORMAL":level==="warn"?"REVIEW":"ALARM";
    return '<div class="check-card"><div><h3>'+escapeHtml(x.title)+'</h3><p>'+escapeHtml(x.text)+'</p></div><div class="check-state '+level+'">'+state+'<br>'+escapeHtml(x.value)+'</div></div>';
  }).join("");
  const active=lastAlarmScan.filter(x=>x.level==="bad").length;
  const review=lastAlarmScan.filter(x=>x.level==="warn").length;
  $("alarmSummaryBadge").className="badge "+(active?"bad":review?"warn":"ok");
  $("alarmSummaryBadge").textContent=active?active+" active alarm"+(active>1?"s":""):review?review+" item"+(review>1?"s":"")+" to review":"No active threshold alarms";
  renderDashboard();
}
$("scanAlarms")?.addEventListener("click",scanAlarms);

function renderEnergyPage(){
  const c=lastCalc||calcProcess();
  if(!$("energyKpis")) return;
  $("energyKpis").innerHTML=
    '<div class="kpi"><span>HPP Power</span><strong>'+fmt(c.hppPower,1)+'</strong><small>kW</small></div>'+
    '<div class="kpi"><span>CP Power</span><strong>'+fmt(c.cpPower,1)+'</strong><small>kW</small></div>'+
    '<div class="kpi"><span>Net Power</span><strong>'+fmt(c.totalPower,1)+'</strong><small>kW</small></div>'+
    '<div class="kpi"><span>SEC</span><strong>'+fmt(c.sec,2)+'</strong><small>kWh/m³</small></div>';
  $("energyInputsSummary").innerHTML=
    row("Feed Pressure",fmt(c.feedP),"bar")+row("RO Header Pressure",fmt(c.roP),"bar")+row("Reject Pressure",fmt(c.rejectP),"bar")+
    row("HPP Flow",fmt(c.hppFlow),"m³/h")+row("PX / CP Flow",fmt(c.cpFlow),"m³/h");
  $("energyDetail").innerHTML=
    row("PX HP OUT Pressure",fmt(c.pxHpOutP),"bar")+row("PX Pressure Recovery",fmt(c.pxEff*100),"%")+
    row("HPP Efficiency",fmt(c.hppEff*100),"%")+row("CP Efficiency",fmt(c.cpEff*100),"%")+
    row("HPP + CP Power",fmt(c.totalPower),"kW")+row("Daily Energy",fmt(c.totalPower*24,0),"kWh/day");
}

function comparePerformance(){
  if(!$("pfFeed")) return;
  const c=lastCalc||calcProcess();
  const feed=Math.max(0,num("pfFeed")),perm=Math.max(0,num("pfPerm")),pressure=Math.max(0,num("pfPressure")),dp=Math.max(0,num("pfDp")),tds=Math.max(0,num("pfTds")),power=Math.max(0,num("pfPower"));
  const rec=feed>0?perm/feed:0;
  const sec=perm>0?power/perm:0;
  const warn=Math.max(1,num("setPerformance")||10);
  const metrics=[
    ["Feed Flow",feed,c.feed,"m³/h"],
    ["Permeate Flow",perm,c.permeate,"m³/h"],
    ["Recovery",rec*100,c.recovery*100,"%"],
    ["RO Pressure",pressure,c.roP,"bar"],
    ["Product TDS",tds,c.permTds,"mg/L"],
    ["Specific Energy",sec,c.sec,"kWh/m³"]
  ];
  $("performanceResults").innerHTML=metrics.map(([n,a,d,u])=>row(n,fmt(a,2),u,Math.abs(pctError(a,d))>warn?"warn":"good")).join("");
  const flags=[];
  metrics.forEach(([name,a,d,u])=>{
    const dev=pctError(a,d);
    if(Math.abs(dev)>warn) flags.push({level:"warn",title:name+" deviation",text:"Actual "+fmt(a,2)+" "+u+" vs design "+fmt(d,2)+" "+u+" ("+fmt(dev,1)+"%)."});
  });
  if(dp>=num("setModuleDpAlarm")) flags.push({level:"bad",title:"High module DP",text:"Actual module DP "+fmt(dp,1)+" bar is at/above the configured alarm."});
  if(!flags.length) flags.push({level:"good",title:"Performance within configured variance",text:"No entered performance metric exceeds the "+fmt(warn,0)+"% variance threshold."});
  $("performanceFlags").innerHTML=flags.map(x=>'<div class="diag-block '+x.level+'"><h3>'+x.title+'</h3><p>'+x.text+'</p></div>').join("");
}
$("comparePerformance")?.addEventListener("click",comparePerformance);

function generateReport(){
  const c=lastCalc||calcProcess();
  const m=lastMembrane||calcMembrane();
  const diag=lastDiagnostic;
  const alarms=lastAlarmScan.filter(x=>x.level!=="good");
  const html=
    '<h3>Active Design Case</h3>'+
    '<table><tr><th>Parameter</th><th>Value</th></tr>'+
    '<tr><td>Feed</td><td>'+fmt(c.feed)+' m³/h</td></tr>'+
    '<tr><td>Permeate</td><td>'+fmt(c.permeate)+' m³/h</td></tr>'+
    '<tr><td>Recovery</td><td>'+fmt(c.recovery*100)+'%</td></tr>'+
    '<tr><td>RO Pressure</td><td>'+fmt(c.roP)+' bar</td></tr>'+
    '<tr><td>Specific Energy</td><td>'+fmt(c.sec,2)+' kWh/m³</td></tr>'+
    '<tr><td>Mass Balance</td><td>'+(c.balanced?"OK":"Check required")+'</td></tr></table>'+
    '<h3>Membrane Design</h3><p>'+(m?m.vessels+" vessels × "+m.elements+" elements/vessel; "+fmt(m.totalArea,0)+" m² total membrane area; "+fmt(m.flux,1)+" LMH average flux.":"Membrane design not calculated.")+'</p>'+
    '<h3>Troubleshooting</h3><p>'+(diag?'<b>'+escapeHtml(diag.title)+':</b> '+escapeHtml(diag.likely):"No guided diagnostic has been run for this report.")+'</p>'+
    '<h3>Abnormal Parameters</h3><p>'+(alarms.length?alarms.map(x=>escapeHtml(x.title)+" — "+escapeHtml(x.text)).join("<br>"):"No active threshold alarms from the latest scan.")+'</p>';
  $("reportPreview").innerHTML=html;
}
$("generateReport")?.addEventListener("click",generateReport);
$("printReport")?.addEventListener("click",()=>{generateReport();window.print();});
$("downloadCsv")?.addEventListener("click",()=>{
  const c=lastCalc||calcProcess();
  const rows=[
    ["Parameter","Value","Unit"],
    ["Feed",c.feed,"m3/h"],["Permeate",c.permeate,"m3/h"],["Recovery",c.recovery*100,"%"],["Reject",c.rejectTotal,"m3/h"],
    ["HPP Flow",c.hppFlow,"m3/h"],["PX LP IN",c.pxLpIn,"m3/h"],["RO Pressure",c.roP,"bar"],["Net Power",c.totalPower,"kW"],["SEC",c.sec,"kWh/m3"],
    ["Feed TDS",c.feedTds,"mg/L"],["Permeate TDS",c.permTds,"mg/L"],["Reject TDS",c.rejectTds,"mg/L"]
  ];
  const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="ro-engineer-case.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});

async function refreshAuth(){
  if(!db) return;
  const {data}=await db.auth.getSession();
  currentUser=data.session?.user||null;
  renderAuthState();
}
function renderAuthState(){
  if(!$("dbStatus")) return;
  $("dbStatus").className="badge "+(currentUser?"ok":"calc");
  $("dbStatus").textContent=currentUser?"Signed in":"Not signed in";
  $("profileState").textContent=currentUser?currentUser.email:"RO Design";
  if(currentUser) loadProjects();
}
$("signInBtn")?.addEventListener("click",async()=>{
  if(!db) return;
  const {data,error}=await db.auth.signInWithPassword({email:$("authEmail").value.trim(),password:$("authPassword").value});
  $("authMessage").textContent=error?error.message:"Signed in.";
  if(!error){currentUser=data.user;renderAuthState();}
});
$("signUpBtn")?.addEventListener("click",async()=>{
  if(!db) return;
  const {data,error}=await db.auth.signUp({email:$("authEmail").value.trim(),password:$("authPassword").value});
  $("authMessage").textContent=error?error.message:"Account created. If email confirmation is enabled, confirm the email before signing in.";
  if(data?.user && data?.session){currentUser=data.user;renderAuthState();}
});
$("signOutBtn")?.addEventListener("click",async()=>{
  if(!db) return;
  await db.auth.signOut();currentUser=null;renderAuthState();$("savedProjects").innerHTML='<div class="empty-state">Sign in to load saved projects.</div>';
});
$("saveProjectBtn")?.addEventListener("click",async()=>{
  if(!db || !currentUser){$("authMessage").textContent="Sign in before saving a project.";return;}
  const c=lastCalc||calcProcess();
  const projectName=$("saveProjectName").value.trim()||"RO Project";
  const caseName=$("saveCaseName").value.trim()||"Design Case";
  let {data:projects,error}=await db.from("projects").select("id").eq("name",projectName).eq("owner_id",currentUser.id).limit(1);
  if(error){$("authMessage").textContent=error.message;return;}
  let projectId=projects?.[0]?.id;
  if(!projectId){
    const ins=await db.from("projects").insert({name:projectName,description:"RO Engineer project",owner_id:currentUser.id}).select("id").single();
    if(ins.error){$("authMessage").textContent=ins.error.message;return;}
    projectId=ins.data.id;
  }
  const payload={
    project_id:projectId,owner_id:currentUser.id,name:caseName,water_type:$("waterType").value,
    feed_flow_m3h:c.feed,recovery_percent:c.recovery*100,feed_pressure_bar:c.feedP,ro_header_pressure_bar:c.roP,
    reject_pressure_bar:c.rejectP,px_hp_in_m3h:c.pxHpIn,px_pressure_eff_percent:c.pxEff*100,hpp_eff_percent:c.hppEff*100,
    cp_eff_percent:c.cpEff*100,feed_tds_mgl:c.feedTds,salt_rejection_percent:c.saltRej*100,temperature_c:num("temperature")
  };
  const insCase=await db.from("design_cases").insert(payload).select("id").single();
  if(insCase.error){$("authMessage").textContent=insCase.error.message;return;}
  await db.from("design_results").insert({
    design_case_id:insCase.data.id,owner_id:currentUser.id,permeate_m3h:c.permeate,reject_total_m3h:c.rejectTotal,hpp_flow_m3h:c.hppFlow,
    px_lp_in_m3h:c.pxLpIn,px_hp_out_m3h:c.pxHpOut,cp_flow_m3h:c.cpFlow,direct_reject_m3h:c.directReject,
    hpp_power_kw:c.hppPower,cp_power_kw:c.cpPower,net_power_kw:c.totalPower,specific_energy_kwh_m3:c.sec,permeate_tds_mgl:c.permTds,reject_tds_mgl:c.rejectTds
  });
  $("authMessage").textContent="Design saved to Supabase.";
  loadProjects();
});

async function loadProjects(){
  if(!$("savedProjects")) return;
  if(!db || !currentUser){$("savedProjects").innerHTML='<div class="empty-state">Sign in to load saved projects.</div>';return;}
  const {data,error}=await db.from("design_cases").select("id,name,created_at,project_id,feed_flow_m3h,recovery_percent,feed_pressure_bar,ro_header_pressure_bar,reject_pressure_bar,px_hp_in_m3h,px_pressure_eff_percent,hpp_eff_percent,cp_eff_percent,feed_tds_mgl,salt_rejection_percent,temperature_c,projects(name)").eq("owner_id",currentUser.id).order("created_at",{ascending:false}).limit(30);
  if(error){$("savedProjects").innerHTML='<div class="empty-state">'+escapeHtml(error.message)+'</div>';return;}
  if(!data?.length){$("savedProjects").innerHTML='<div class="empty-state">No saved cases yet.</div>';return;}
  $("savedProjects").innerHTML=data.map((x,i)=>'<div class="project-item"><b>'+escapeHtml(x.projects?.name||"RO Project")+'</b><small>'+escapeHtml(x.name)+' · '+new Date(x.created_at).toLocaleString()+'</small><button type="button" data-load-case="'+i+'">Load Case</button></div>').join("");
  $("savedProjects").querySelectorAll("[data-load-case]").forEach(b=>b.addEventListener("click",()=>{
    const x=data[Number(b.dataset.loadCase)];
    $("feedFlow").value=x.feed_flow_m3h;$("recovery").value=x.recovery_percent;$("feedPressure").value=x.feed_pressure_bar;$("roPressure").value=x.ro_header_pressure_bar;
    $("rejectPressure").value=x.reject_pressure_bar;$("pxHpIn").value=x.px_hp_in_m3h;$("pxPressureEff").value=x.px_pressure_eff_percent;$("hppEff").value=x.hpp_eff_percent;
    $("cpEff").value=x.cp_eff_percent;$("feedTds").value=x.feed_tds_mgl;$("saltRejection").value=x.salt_rejection_percent;$("temperature").value=x.temperature_c;
    $("project").innerHTML='<option>'+escapeHtml(x.projects?.name||"RO Project")+'</option>';$("case").innerHTML='<option>'+escapeHtml(x.name)+'</option>';
    calcProcess();showView("process");
  }));
}

function init(){
  calcProcess();
  calcMembrane();
  initTroubleshooting();
  runMeasuredBalance();
  scanAlarms();
  comparePerformance();
  refreshAuth();
}
init();
