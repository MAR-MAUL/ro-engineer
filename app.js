
const $ = id => document.getElementById(id);
const num = id => Number($(id)?.value || 0);
const fmt = (v,d=1) => Number.isFinite(v) ? v.toFixed(d) : "—";
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));

function row(label,value,unit,cls=""){
  return '<div class="data-row '+cls+'"><span>'+label+'</span><strong>'+value+'</strong><em>'+unit+'</em></div>';
}

function calc(){
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

  const hppFlow = feed - pxLpIn;
  const cpFlow = pxHpOut;
  const membraneFeed = hppFlow + cpFlow;
  const directReject = rejectTotal - pxHpIn;

  const pxHpOutP = feedP + pxEff*Math.max(0,rejectP-feedP);

  const hppPower = hppFlow*Math.max(0,roP-feedP)/(36*hppEff);
  const cpPower = cpFlow*Math.max(0,roP-pxHpOutP)/(36*cpEff);
  const totalPower = hppPower + cpPower;
  const sec = permeate > 0 ? totalPower/permeate : NaN;

  const feedError = Math.abs(membraneFeed-feed);
  const rejectError = Math.abs((pxLpOut+directReject)-rejectTotal);
  const balanceError = Math.max(feedError,rejectError);
  const balanced = !invalidPx && balanceError < 0.01 && hppFlow >= 0;

  const badge = $("balanceBadge");
  badge.className = "badge " + (balanced ? "ok" : "bad");
  badge.textContent = balanced ? "✓ Mass Balance OK" : "⚠ Check Inputs";

  $("balanceMessage").className = "balance-message" + (balanced ? "" : " error");
  $("balanceMessage").textContent = invalidPx
    ? "PX HP IN cannot exceed the total RO reject flow ("+fmt(rejectTotal)+" m³/h)."
    : "Feed side: HPP + PX HP OUT = "+fmt(membraneFeed)+" m³/h. Reject side: PX LP OUT + vessel reject = "+fmt(rejectTotal)+" m³/h.";

  $("balanceTable").innerHTML =
    row("Feed to RO (Total)",fmt(feed),"m³/h") +
    row("To HPP (from Bag Filter)",fmt(hppFlow),"m³/h") +
    row("PX LP IN (from Bag Filter)",fmt(pxLpIn),"m³/h") +
    row("Permeate (Total)",fmt(permeate),"m³/h") +
    row("Reject (Total)",fmt(rejectTotal),"m³/h") +
    row("RO Reject to PX HP IN",fmt(pxHpIn),"m³/h") +
    row("Vessel Reject (LP Reject)",fmt(directReject),"m³/h") +
    row("Recovery (Overall)",fmt(recovery*100),"%") +
    row("Mass Balance Error",fmt(balanceError,2),"%",balanced?"good":"warn");

  $("flowSummary").innerHTML =
    row("Feed to RO (from Pretreatment)",fmt(feed),"m³/h") +
    row("To HPP (from Bag Filter)",fmt(hppFlow),"m³/h") +
    row("PX LP IN (from Bag Filter)",fmt(pxLpIn),"m³/h") +
    row("PX HP IN (from RO Reject)",fmt(pxHpIn),"m³/h") +
    row("Permeate (Total)",fmt(permeate),"m³/h") +
    row("Reject (Total)",fmt(rejectTotal),"m³/h") +
    row("Mass Balance Check",fmt(balanceError,2),"%",balanced?"good":"warn");

  $("energySummary").innerHTML =
    row("HPP Power",fmt(hppPower),"kW") +
    row("HPP Efficiency",fmt(hppEff*100),"%") +
    row("CP Power",fmt(cpPower),"kW") +
    row("CP Efficiency",fmt(cpEff*100),"%") +
    row("PX Pressure Recovery",fmt(pxEff*100),"%") +
    row("Net Power (HPP + CP)",fmt(totalPower),"kW") +
    row("Specific Energy",fmt(sec,2),"kWh/m³");

  const feedTds = Math.max(0,num("feedTds"));
  const saltRej = clamp(num("saltRejection")/100,0,1);
  const permTds = feedTds*(1-saltRej);
  const rejectTds = rejectTotal>0 ? (feedTds*feed-permTds*permeate)/rejectTotal : NaN;

  $("qualitySummary").innerHTML =
    row("TDS - Feed",fmt(feedTds,0),"mg/L") +
    row("TDS - Permeate",fmt(permTds,0),"mg/L") +
    row("TDS - Reject",fmt(rejectTds,0),"mg/L") +
    row("Temperature",fmt(num("temperature")),"°C") +
    row("Salt Rejection",fmt(saltRej*100),"%");

  $("tagFeed").textContent = fmt(feed,0);
  $("tagFeedP").textContent = fmt(feedP);
  $("tagHpp").textContent = fmt(hppFlow,0);
  $("tagHppP").textContent = fmt(roP);
  $("tagPxLpIn").textContent = fmt(pxLpIn,0);
  $("tagPxLpInP").textContent = fmt(feedP);
  $("tagPxHpOut").textContent = fmt(pxHpOut,0);
  $("tagPxHpOutP").textContent = fmt(pxHpOutP);
  $("tagCp").textContent = fmt(cpFlow,0);
  $("tagCpP").textContent = fmt(roP);
  $("tagPxHpIn").textContent = fmt(pxHpIn,0);
  $("tagRejectP").textContent = fmt(rejectP);
  $("tagPerm").textContent = fmt(permeate,0);
}

[
  "feedFlow","recovery","pxHpIn","feedPressure","roPressure","rejectPressure",
  "pxPressureEff","hppEff","cpEff","feedTds","saltRejection","temperature"
].forEach(id => $(id)?.addEventListener("input",calc));

$("calculateBtn")?.addEventListener("click",calc);

$("showValues")?.addEventListener("change",e=>{
  $("valueTags").style.display = e.target.checked ? "" : "none";
});

calc();
