
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
let currentTroubleSymptom = "module_pressure_rising";
let currentTroubleBranch = null;
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
  if(!data || !$("troubleSymptoms")) return;

  const primary=[
    ["module_pressure_rising","Pressure","P↑"],
    ["product_cond_rising","Water Quality","µS"],
    ["px_flow_imbalance","PX / Flow","PX"],
    ["cp_mismatch","CP / VFD","CP"],
    ["hpp_no_start","HPP","HPP"],
    ["high_module_dp","Membranes","ΔP"],
    ["scada_local_mismatch","Instrumentation","AI"],
    ["cip","Membranes / CIP","CIP"]
  ];

  $("symptomCount").textContent=String(primary.length);
  $("troubleSymptoms").innerHTML=primary.map(([id,cat,icon])=>{
    const diag=data.diagnostics[id];
    return '<button type="button" class="ts-symptom '+(id===currentTroubleSymptom?"active":"")+'" data-symptom="'+id+'">'+
      '<span class="icon">'+icon+'</span>'+
      '<span class="copy"><b>'+escapeHtml(diag?.title||id)+'</b><small>'+escapeHtml(cat)+'</small></span>'+
      '<span class="chev">›</span></button>';
  }).join("");

  $("troubleSymptoms").addEventListener("click",e=>{
    const btn=e.target.closest("[data-symptom]"); if(!btn) return;
    currentTroubleSymptom=btn.dataset.symptom;
    currentTroubleBranch=null;
    $$("#troubleSymptoms [data-symptom]").forEach(x=>x.classList.toggle("active",x.dataset.symptom===currentTroubleSymptom));
    renderTroubleDiagnostic();
  });

  renderTroubleDiagnostic();
}

function setDiagnosticSteps(stage){
  $$(".ts-step").forEach((step,i)=>{
    step.classList.toggle("active",i<=stage);
    step.classList.toggle("done",i<stage);
  });
}

function renderTroubleDiagnostic(){
  const diag=window.RO_TROUBLESHOOTING?.diagnostics[currentTroubleSymptom];
  if(!diag) return;

  $("diagnosticTitle").textContent=diag.title||"Guided Diagnosis";
  $("diagnosticMode").className="ts-status-pill info";
  $("diagnosticMode").textContent=diag.branchOptions?"Select observation":"Verification sequence";

  const question=diag.prompt || "Use the verified plant condition below to continue the diagnostic sequence.";
  $("troubleQuestion").textContent=question;

  if(diag.branchOptions?.length){
    $("troubleBranchButtons").innerHTML=diag.branchOptions.map(([value,label])=>
      '<button type="button" class="ts-option '+(currentTroubleBranch===value?"active":"")+'" data-branch="'+value+'">'+escapeHtml(label)+'</button>'
    ).join("");

    $("troubleBranchButtons").querySelectorAll("[data-branch]").forEach(btn=>btn.addEventListener("click",()=>{
      currentTroubleBranch=btn.dataset.branch;
      $("troubleBranchButtons").querySelectorAll("[data-branch]").forEach(x=>x.classList.toggle("active",x===btn));
      renderTroubleResult();
    }));

    if(!currentTroubleBranch){
      $("diagnosticResult").innerHTML=
        '<article class="ts-result-card muted"><div class="ts-result-icon">◎</div><span>LIKELY DIRECTION</span><h3>Select the observed trend</h3><p>The likely cause changes depending on the pre-trip trend.</p></article>'+
        '<article class="ts-result-card muted"><div class="ts-result-icon">✓</div><span>VERIFY NEXT</span><h3>Evidence first</h3><p>SCADA values, local instruments and mass balance are checked before an equipment fault is assigned.</p></article>'+
        '<article class="ts-result-card muted"><div class="ts-result-icon">→</div><span>CORRECTIVE ACTION</span><h3>Only after confirmation</h3><p>No speed or valve changes should be made just to hide the symptom.</p></article>';
      setDiagnosticSteps(2);
    }else{
      renderTroubleResult();
    }
  }else{
    $("troubleBranchButtons").innerHTML='<button type="button" class="ts-option active">Use standard verification sequence</button>';
    renderTroubleResult();
  }
}

function renderTroubleResult(){
  const diag=window.RO_TROUBLESHOOTING?.diagnostics[currentTroubleSymptom];
  if(!diag) return;
  const result=diag.branchOptions ? (diag.branches?.[currentTroubleBranch] || diag.branches?.unknown) : diag;
  if(!result) return;

  const likely=result.likely||"Verification required before assigning a cause.";
  const checks=result.checks||[];
  const actions=result.actions||[];

  $("diagnosticMode").className="ts-status-pill good";
  $("diagnosticMode").textContent="Diagnostic path ready";
  $("diagnosticResult").innerHTML=
    '<article class="ts-result-card direction"><div class="ts-result-icon">◎</div><span>LIKELY DIRECTION</span><h3>'+escapeHtml(likely)+'</h3><p>Use this as the working direction, not as a confirmed failure, until the verification sequence is complete.</p></article>'+
    '<article class="ts-result-card verify"><div class="ts-result-icon">✓</div><span>VERIFY NEXT</span><h3>Checks in order</h3><ol>'+checks.map(x=>'<li>'+escapeHtml(x)+'</li>').join("")+'</ol></article>'+
    '<article class="ts-result-card action"><div class="ts-result-icon">→</div><span>CORRECTIVE ACTION</span><h3>After cause is confirmed</h3><ol>'+actions.map(x=>'<li>'+escapeHtml(x)+'</li>').join("")+'</ol></article>';

  lastDiagnostic={id:currentTroubleSymptom,title:diag.title,likely,checks,actions,branch:currentTroubleBranch};
  setDiagnosticSteps(4);
}

$$("[data-trouble-tab]").forEach(b=>b.addEventListener("click",()=>{
  const tab=b.dataset.troubleTab;
  $$("[data-trouble-tab]").forEach(x=>x.classList.toggle("active",x===b));
  $$(".trouble-pane").forEach(x=>x.classList.toggle("active",x.id==="trouble-"+tab));
  if(tab==="balance") runMeasuredBalance();
}));

function syncTroubleDefaults(){
  if(!lastCalc) return;
  const c=lastCalc;
  const pairs={
    mFeed:c.feed,mHpp:c.hppFlow,mPxLpIn:c.pxLpIn,mRoFeed:c.membraneFeed,mPxHpOut:c.pxHpOut,mPerm:c.permeate,
    mPxHpIn:c.pxHpIn,mPxLpOut:c.pxLpOut,mDirectReject:c.directReject,
    alarmModuleP:c.roP,alarmPxDp:Math.max(0,c.rejectP-c.pxHpOutP),
    pfFeed:c.feed,pfPerm:c.permeate,pfPressure:c.roP,pfTds:c.permTds,pfPower:c.totalPower
  };
  Object.entries(pairs).forEach(([id,val])=>{const el=$(id); if(el && !el.matches(":focus")) el.value=fmt(val,1);});
  updateFlowBalanceDiagram();
}

function flowLevel(error,tol){
  const a=Math.abs(error);
  return a<=tol?"good":a<=tol*2?"warn":"bad";
}
function flowCheckCard(title,equation,error,tol){
  const level=flowLevel(error,tol);
  const status=level==="good"?"PASS":level==="warn"?"REVIEW":"FAIL";
  return '<article class="fb-check '+level+'">'+
    '<div class="fb-check-head"><b>'+escapeHtml(title)+'</b><span class="status">'+status+'</span></div>'+
    '<div class="fb-equation">'+escapeHtml(equation)+'</div>'+
    '<div class="fb-error">'+fmt(error,1)+'%</div></article>';
}

function updateFlowBalanceDiagram(){
  const ids={
    fbFeed:"mFeed",fbHpp:"mHpp",fbPxLpIn:"mPxLpIn",fbRoFeed:"mRoFeed",fbPxHpOut:"mPxHpOut",
    fbPerm:"mPerm",fbPxHpIn:"mPxHpIn",fbPxLpOut:"mPxLpOut",fbDirectReject:"mDirectReject"
  };
  Object.entries(ids).forEach(([target,source])=>{ if($(target)&&$(source)) $(target).textContent=fmt(num(source),1); });
  if($("balanceToleranceLabel")) $("balanceToleranceLabel").textContent="±"+fmt(Math.max(.1,num("mTolerance")),1)+"% tolerance";
}

function runMeasuredBalance(){
  if(!$("mFeed")) return;
  const tol=Math.max(.1,num("mTolerance"));
  const feed=num("mFeed"),hpp=num("mHpp"),lpIn=num("mPxLpIn"),roFeed=num("mRoFeed"),hpOut=num("mPxHpOut"),perm=num("mPerm"),hpIn=num("mPxHpIn"),lpOut=num("mPxLpOut"),direct=num("mDirectReject");

  const checks=[
    {title:"Raw Feed Split",eq:"HPP + PX LP IN = Total Feed",error:pctError(hpp+lpIn,feed)},
    {title:"RO Header Balance",eq:"HPP + PX HP OUT = RO Feed",error:pctError(hpp+hpOut,roFeed)},
    {title:"RO Mass Balance",eq:"Permeate + PX HP IN + Direct Reject = RO Feed",error:pctError(perm+hpIn+direct,roFeed)},
    {title:"PX Feed Side",eq:"PX HP OUT ≈ PX LP IN",error:pctError(hpOut,lpIn)},
    {title:"PX Reject Side",eq:"PX LP OUT ≈ PX HP IN",error:pctError(lpOut,hpIn)}
  ];

  $("measuredBalanceResults").innerHTML=checks.map(x=>flowCheckCard(x.title,x.eq,x.error,tol)).join("");
  updateFlowBalanceDiagram();

  const worst=checks.reduce((a,b)=>Math.abs(b.error)>Math.abs(a.error)?b:a,checks[0]);
  const failures=checks.filter(x=>Math.abs(x.error)>tol);
  const reviews=checks.filter(x=>flowLevel(x.error,tol)==="warn");

  const overall=$("flowBalanceOverall");
  const conclusion=$("flowBalanceConclusion");

  if(!failures.length){
    overall.className="fb-overall good";
    overall.innerHTML='<span>✓</span><div><b>BALANCED</b><small>All checks within tolerance</small></div>';
    conclusion.innerHTML='<div class="fb-conclusion-icon good">✓</div><div><b>Measured flows are internally consistent.</b><p>If the plant still has a pressure, conductivity or pump/PX symptom, continue with the guided diagnostic path. Do not create a hydraulic fault simply because one parameter looks unusual.</p></div>';
  }else if(reviews.length===failures.length){
    overall.className="fb-overall warn";
    overall.innerHTML='<span>!</span><div><b>REVIEW</b><small>One or more balances marginal</small></div>';
    conclusion.innerHTML='<div class="fb-conclusion-icon warn">!</div><div><b>'+escapeHtml(worst.title)+' has the largest balance error ('+fmt(worst.error,1)+'%).</b><p>Verify flowmeter scaling/zero, bypass and isolation valves, drains/sample lines and leakage paths before changing PX, HPP or CP settings.</p></div>';
  }else{
    overall.className="fb-overall bad";
    overall.innerHTML='<span>×</span><div><b>UNBALANCED</b><small>Measurement set does not close</small></div>';
    conclusion.innerHTML='<div class="fb-conclusion-icon bad">!</div><div><b>'+escapeHtml(worst.title)+' is outside the selected tolerance ('+fmt(worst.error,1)+'%).</b><p>Treat this first as a measurement or unaccounted-flow problem. Confirm instruments, bypasses, drains and valve lineup before assigning an equipment fault.</p></div>';
  }
}

["mFeed","mHpp","mPxLpIn","mRoFeed","mPxHpOut","mPerm","mPxHpIn","mPxLpOut","mDirectReject","mTolerance"]
  .forEach(id=>$(id)?.addEventListener("input",runMeasuredBalance));
$("runFlowBalance")?.addEventListener("click",runMeasuredBalance);
$("loadDesignFlows")?.addEventListener("click",()=>{
  if(!lastCalc) calcProcess();
  syncTroubleDefaults();
  runMeasuredBalance();
});

function scanAlarms(){
  if(!$("alarmModuleP")) return;
  const pAlarm=Math.max(0,num("setModulePAlarm")||60);
  const dpAlarm=Math.max(0,num("setModuleDpAlarm")||3);
  const pxDpAlarm=Math.max(0,num("setPxDpAlarm")||2);
  const speedDev=Math.max(0,num("setSpeedDev")||2);

  const p=num("alarmModuleP"),dp=num("alarmModuleDp"),pxdp=num("alarmPxDp"),cond=num("alarmProductCond");
  const hRef=num("alarmHppRef"),hAct=num("alarmHppAct"),cRef=num("alarmCpRef"),cAct=num("alarmCpAct");

  const out=[
    {id:"moduleP",title:"Module inlet pressure",value:p+" bar",level:p>=pAlarm?"bad":"good",text:p>=pAlarm?"At/above "+pAlarm+" bar alarm. Review pre-trip RO ΔP before changing pump speed.":"Below "+pAlarm+" bar alarm."},
    {id:"moduleDp",title:"RO module ΔP",value:dp+" bar",level:dp>=dpAlarm?"bad":"good",text:dp>=dpAlarm?"At/above "+dpAlarm+" bar alarm. Localize pressure loss and verify restriction/fouling/scaling.":"Below "+dpAlarm+" bar alarm."},
    {id:"pxDp",title:"PX ΔP",value:pxdp+" bar",level:pxdp>=pxDpAlarm?"bad":"good",text:pxdp>=pxDpAlarm?"At/above "+pxDpAlarm+" bar reference. Check pressure instruments, PX flow ratio and valve lineup.":"Below "+pxDpAlarm+" bar reference."},
    {id:"hppSpeed",title:"HPP speed tracking",value:fmt(hAct-hRef,1)+" Hz",level:Math.abs(hRef-hAct)>speedDev?"warn":"good",text:"Reference "+fmt(hRef,1)+" Hz / actual "+fmt(hAct,1)+" Hz."},
    {id:"cpSpeed",title:"CP speed tracking",value:fmt(cAct-cRef,1)+" Hz",level:Math.abs(cRef-cAct)>speedDev?"warn":"good",text:"Reference "+fmt(cRef,1)+" Hz / actual "+fmt(cAct,1)+" Hz."},
    {id:"conductivity",title:"Product conductivity",value:cond+" µS/cm",level:"good",text:"Trend against the stable borewell-feed baseline. A confirmed rise should trigger analyzer verification first, then pressure/recovery/temperature and salt rejection checks."}
  ];
  lastAlarmScan=out;

  const statusMap=[
    ["stateModuleP",p>=pAlarm],
    ["stateModuleDp",dp>=dpAlarm],
    ["statePxDp",pxdp>=pxDpAlarm]
  ];
  statusMap.forEach(([id,isAlarm])=>{const el=$(id);if(el){el.className=isAlarm?"alarm":"normal";el.textContent=isAlarm?"ALARM":"NORMAL";}});
  if($("hppSpeedState")) $("hppSpeedState").className="ts-state-dot "+(Math.abs(hRef-hAct)>speedDev?"warn":"good");
  if($("cpSpeedState")) $("cpSpeedState").className="ts-state-dot "+(Math.abs(cRef-cAct)>speedDev?"warn":"good");

  if($("displayModulePAlarm")) $("displayModulePAlarm").textContent=fmt(pAlarm,0)+" bar";
  if($("displayModuleDpAlarm")) $("displayModuleDpAlarm").textContent=fmt(dpAlarm,0)+" bar";
  if($("displayPxDpAlarm")) $("displayPxDpAlarm").textContent=fmt(pxDpAlarm,0)+" bar";

  const noteworthy=out.filter(x=>x.level!=="good");
  $("alarmResults").innerHTML=noteworthy.slice(0,3).map(x=>
    '<div class="mini-alarm '+x.level+'"><span>'+escapeHtml(x.title)+'</span><b>'+escapeHtml(x.level==="bad"?"ALARM":"REVIEW")+'</b></div>'
  ).join("") || '<div class="mini-alarm good"><span>Pressure / speed checks</span><b>NORMAL</b></div>';

  const active=out.filter(x=>x.level==="bad").length;
  const review=out.filter(x=>x.level==="warn").length;
  $("alarmSummaryBadge").className="ts-status-pill "+(active?"bad":review?"warn":"good");
  $("alarmSummaryBadge").textContent=active?active+" active alarm"+(active>1?"s":""):review?review+" item"+(review>1?"s":"")+" to review":"System checks normal";
  renderDashboard();
}
$("scanAlarms")?.addEventListener("click",scanAlarms);
["alarmModuleP","alarmModuleDp","alarmPxDp","alarmProductCond","alarmHppRef","alarmHppAct","alarmCpRef","alarmCpAct"]
  .forEach(id=>$(id)?.addEventListener("input",scanAlarms));

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


// ===== Contextual AI Troubleshooting Assistant =====
function getAiContext(){
  const c=lastCalc||calcProcess();
  const diag=window.RO_TROUBLESHOOTING?.diagnostics?.[currentTroubleSymptom];
  const branch=diag?.branchOptions ? (diag?.branches?.[currentTroubleBranch]||null) : diag;
  const tol=Math.max(.1,num("mTolerance")||3);
  const flowChecks=$("mFeed") ? [
    {name:"Raw feed split",error:pctError(num("mHpp")+num("mPxLpIn"),num("mFeed"))},
    {name:"RO header balance",error:pctError(num("mHpp")+num("mPxHpOut"),num("mRoFeed"))},
    {name:"RO mass balance",error:pctError(num("mPerm")+num("mPxHpIn")+num("mDirectReject"),num("mRoFeed"))},
    {name:"PX feed side",error:pctError(num("mPxHpOut"),num("mPxLpIn"))},
    {name:"PX reject side",error:pctError(num("mPxLpOut"),num("mPxHpIn"))}
  ] : [];
  const worst=flowChecks.length?flowChecks.reduce((a,b)=>Math.abs(b.error)>Math.abs(a.error)?b:a,flowChecks[0]):null;
  return {
    c,diag,branch,tol,flowChecks,worst,
    moduleP:num("alarmModuleP"),moduleDp:num("alarmModuleDp"),pxDp:num("alarmPxDp"),
    conductivity:num("alarmProductCond"),
    hppRef:num("alarmHppRef"),hppAct:num("alarmHppAct"),cpRef:num("alarmCpRef"),cpAct:num("alarmCpAct"),
    pAlarm:Math.max(0,num("setModulePAlarm")||60),dpAlarm:Math.max(0,num("setModuleDpAlarm")||3),pxDpAlarm:Math.max(0,num("setPxDpAlarm")||2),
    speedDev:Math.max(0,num("setSpeedDev")||2)
  };
}

function updateAiContext(){
  if(!$("aiContextChips")) return;
  const x=getAiContext();
  const chips=[
    ["Symptom",x.diag?.title||"Not selected",""],
    ["RO P",fmt(x.moduleP,1)+" bar",x.moduleP>=x.pAlarm?"bad":"good"],
    ["RO ΔP",fmt(x.moduleDp,1)+" bar",x.moduleDp>=x.dpAlarm?"bad":"good"],
    ["PX ΔP",fmt(x.pxDp,1)+" bar",x.pxDp>=x.pxDpAlarm?"bad":"good"],
    ["Mass balance",x.c.balanced?"Closed":"Open",x.c.balanced?"good":"bad"],
    ["HPP",fmt(x.hppAct,1)+"/"+fmt(x.hppRef,1)+" Hz",Math.abs(x.hppAct-x.hppRef)>x.speedDev?"warn":"good"],
    ["CP",fmt(x.cpAct,1)+"/"+fmt(x.cpRef,1)+" Hz",Math.abs(x.cpAct-x.cpRef)>x.speedDev?"warn":"good"]
  ];
  $("aiContextChips").innerHTML=chips.map(([k,v,cls])=>'<span class="ts-ai-chip '+cls+'">'+escapeHtml(k)+': <b>'+escapeHtml(v)+'</b></span>').join("");
}

function buildAiAnswer(promptText){
  const x=getAiContext();
  const q=String(promptText||"").toLowerCase();
  const branch=x.branch;
  const likely=branch?.likely||x.diag?.likely||"The selected symptom still needs verification before a specific cause can be assigned.";
  const checks=branch?.checks||x.diag?.checks||[];
  const actions=branch?.actions||x.diag?.actions||[];
  const flowBad=x.worst && Math.abs(x.worst.error)>x.tol;
  const pxEvidence=(x.pxDp>=x.pxDpAlarm) || (x.flowChecks.some(f=>/px/i.test(f.name)&&Math.abs(f.error)>x.tol));
  const pressureAlarm=x.moduleP>=x.pAlarm;
  const dpAlarm=x.moduleDp>=x.dpAlarm;
  const hppMismatch=Math.abs(x.hppAct-x.hppRef)>x.speedDev;
  const cpMismatch=Math.abs(x.cpAct-x.cpRef)>x.speedDev;

  if(q.includes("px") || q.includes("pressure exchanger")){
    if(pxEvidence){
      return "A PX-related issue is possible because the current data shows "+(x.pxDp>=x.pxDpAlarm?"PX ΔP at/above the "+fmt(x.pxDpAlarm,1)+" bar reference":"a PX-side flow imbalance")+". Before assigning an internal PX fault, verify the four PX flow/pressure measurements, bypass and isolation valves, and flowmeter scaling. If those checks are valid and the imbalance remains, proceed to PX condition inspection.";
    }
    return "The current entries do not give strong evidence of an internal PX fault. PX ΔP is "+fmt(x.pxDp,1)+" bar and the measured PX balance is "+(flowBad?"not fully closed":"within tolerance")+". Check instrumentation, valve lineup and CP operating point first; only then escalate to the PX.";
  }

  if(q.includes("verify") || q.includes("first") || q.includes("check")){
    const first=checks.slice(0,4);
    return "Verify in this order: "+(first.length?first.map((s,i)=>(i+1)+") "+s).join(" "):"1) confirm the symptom with a second valid measurement; 2) close the flow balance; 3) verify valve lineup; 4) compare reference vs actual pump/VFD values.")+" The aim is to separate measurement/control issues from a genuine hydraulic or mechanical fault.";
  }

  if(q.includes("action") || q.includes("do next") || q.includes("recommend")){
    if(!actions.length) return "Do not change pump speed or valve setpoints yet. First confirm the measurements and isolate which balance or pressure relationship is abnormal.";
    return "Recommended next action: "+actions.join(" ")+" Record the before/after values so the corrective action can be verified.";
  }

  if(q.includes("flow") || q.includes("balance")){
    if(!x.worst) return "Enter the measured flow values in Flow Balancing first.";
    if(Math.abs(x.worst.error)<=x.tol) return "All current measured balances are within ±"+fmt(x.tol,1)+"%. That makes a gross flowmeter/bypass imbalance less likely. Continue with pressure trend, speed tracking and component-specific checks.";
    return x.worst.name+" is the largest mismatch at "+fmt(x.worst.error,1)+"%. Treat that first as a measurement, bypass, drain or unaccounted-flow problem. Verify the affected meters and valve lineup before diagnosing the PX, HPP or CP.";
  }

  if(q.includes("conduct") || q.includes("tds") || q.includes("quality")){
    return "For rising product conductivity with comparatively stable borewell feed, verify the product conductivity analyzer first. Then compare RO pressure, recovery and temperature with normal operation, calculate salt rejection, and compare vessel/train product quality. Only after those checks support it should membrane or vessel integrity become the leading cause.";
  }

  let qualifiers=[];
  if(pressureAlarm) qualifiers.push("module inlet pressure is at/above alarm");
  if(dpAlarm) qualifiers.push("RO module ΔP is at/above alarm");
  if(x.pxDp>=x.pxDpAlarm) qualifiers.push("PX ΔP is at/above its reference");
  if(hppMismatch) qualifiers.push("HPP actual speed does not track reference");
  if(cpMismatch) qualifiers.push("CP actual speed does not track reference");
  if(flowBad) qualifiers.push(x.worst.name+" is outside flow-balance tolerance");

  return "Working diagnosis: "+likely+(qualifiers.length?" Current supporting observations: "+qualifiers.join("; ")+".":" Current entered parameters do not show a threshold alarm that independently confirms the fault.")+" Use the verification sequence before treating this as a confirmed equipment failure.";
}

function addAiMessage(role,text){
  if(!$("aiConversation")) return;
  const wrap=document.createElement("div");
  wrap.className="ai-message "+(role==="user"?"user":"assistant");
  wrap.innerHTML='<span class="ai-avatar">'+(role==="user"?"YOU":"AI")+'</span><div><b>'+(role==="user"?"Engineer":"RO Engineering Assistant")+'</b><p>'+escapeHtml(text)+'</p></div>';
  $("aiConversation").appendChild(wrap);
  $("aiConversation").scrollTop=$("aiConversation").scrollHeight;
}

function askAi(text){
  const question=String(text||$("aiQuestion")?.value||"").trim();
  if(!question) return;
  addAiMessage("user",question);
  const answer=buildAiAnswer(question);
  addAiMessage("assistant",answer);
  if($("aiQuestion")) $("aiQuestion").value="";
  updateAiContext();
}

$("askAiBtn")?.addEventListener("click",()=>askAi());
$("aiQuestion")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();askAi();}});
$$("[data-ai-prompt]").forEach(btn=>btn.addEventListener("click",()=>{
  const map={summarize:"Summarize the likely cause from the current data.",verify:"What should I verify first?",px:"Could this be a PX problem?",action:"What is the recommended next action?"};
  askAi(map[btn.dataset.aiPrompt]||btn.textContent);
}));
$("askAiBalance")?.addEventListener("click",()=>{
  const answer=buildAiAnswer("Interpret the current flow balance and tell me what to check next.");
  const el=$("flowAiInterpretation");
  if(el){el.classList.remove("hidden");el.innerHTML='<b>AI interpretation:</b> '+escapeHtml(answer);}
});
["alarmModuleP","alarmModuleDp","alarmPxDp","alarmProductCond","alarmHppRef","alarmHppAct","alarmCpRef","alarmCpAct",
 "mFeed","mHpp","mPxLpIn","mRoFeed","mPxHpOut","mPerm","mPxHpIn","mPxLpOut","mDirectReject","mTolerance"]
.forEach(id=>$(id)?.addEventListener("input",updateAiContext));

const _oldRenderTroubleResult=renderTroubleResult;
renderTroubleResult=function(){
  _oldRenderTroubleResult();
  updateAiContext();
};
