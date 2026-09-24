
const $=id=>document.getElementById(id);
const num=id=>Number($(id).value||0);
const fmt=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):"—";
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function row(label,value,unit,cls=""){return '<div class="row '+cls+'"><span>'+label+'</span><strong>'+value+'</strong><em>'+unit+'</em></div>';}
function calc(){
  const feed=Math.max(0,num("feedFlow"));
  const recovery=clamp(num("recovery")/100,0,.95);
  const feedP=Math.max(0,num("feedPressure"));
  const roP=Math.max(feedP,num("roPressure"));
  const rejectP=Math.max(feedP,num("rejectPressure"));
  const pxEff=clamp(num("pxPressureEff")/100,.01,1);
  const hppEff=clamp(num("hppEff")/100,.01,1);
  const cpEff=clamp(num("cpEff")/100,.01,1);

  const permeate=feed*recovery;
  const rejectTotal=Math.max(0,feed-permeate);
  let pxHpIn=Math.max(0,num("pxHpIn"));
  const invalidPx=pxHpIn>rejectTotal;
  pxHpIn=Math.min(pxHpIn,rejectTotal);

  const pxLpIn=pxHpIn;
  const pxHpOut=pxLpIn;
  const pxLpOut=pxHpIn;
  const hppFlow=feed-pxLpIn;
  const cpFlow=pxHpOut;
  const membraneFeed=hppFlow+cpFlow;
  const directReject=rejectTotal-pxHpIn;

  const pxHpOutP=feedP+pxEff*Math.max(0,rejectP-feedP);
  const hppPower=hppFlow*Math.max(0,roP-feedP)/(36*hppEff);
  const cpPower=cpFlow*Math.max(0,roP-pxHpOutP)/(36*cpEff);
  const totalPower=hppPower+cpPower;
  const sec=permeate>0?totalPower/permeate:NaN;

  const feedError=Math.abs(membraneFeed-feed);
  const rejectError=Math.abs((pxLpOut+directReject)-rejectTotal);
  const balanceError=Math.max(feedError,rejectError);
  const balanced=!invalidPx&&balanceError<0.01&&hppFlow>=0;

  $("balanceMessage").className="message"+(balanced?"":" error");
  $("balanceMessage").textContent=invalidPx
    ?"PX HP IN cannot exceed total RO reject ("+fmt(rejectTotal)+" m³/h)."
    :"Feed: HPP + PX HP OUT = "+fmt(membraneFeed)+" m³/h. Reject: PX LP OUT + direct reject = "+fmt(rejectTotal)+" m³/h.";

  $("balanceTable").innerHTML=
    row("Feed to RO",fmt(feed),"m³/h")+
    row("Permeate",fmt(permeate),"m³/h")+
    row("Reject total",fmt(rejectTotal),"m³/h")+
    row("PX HP IN",fmt(pxHpIn),"m³/h")+
    row("PX LP IN",fmt(pxLpIn),"m³/h")+
    row("HPP flow",fmt(hppFlow),"m³/h")+
    row("PX HP OUT → CP",fmt(pxHpOut),"m³/h")+
    row("Direct vessel reject",fmt(directReject),"m³/h")+
    row("Mass balance error",fmt(balanceError,2),"m³/h",balanced?"ok":"warn");

  $("flowSummary").innerHTML=
    row("Feed from pretreatment",fmt(feed),"m³/h")+
    row("To HPP",fmt(hppFlow),"m³/h")+
    row("PX LP IN",fmt(pxLpIn),"m³/h")+
    row("RO inlet / membrane feed",fmt(membraneFeed),"m³/h")+
    row("Permeate",fmt(permeate),"m³/h")+
    row("RO reject total",fmt(rejectTotal),"m³/h")+
    row("Reject to PX HP IN",fmt(pxHpIn),"m³/h")+
    row("Direct vessel reject",fmt(directReject),"m³/h");

  $("energySummary").innerHTML=
    row("HPP power",fmt(hppPower),"kW")+
    row("PX HP OUT pressure",fmt(pxHpOutP),"bar")+
    row("CP power",fmt(cpPower),"kW")+
    row("Net HPP + CP",fmt(totalPower),"kW")+
    row("Specific energy",fmt(sec,2),"kWh/m³");

  const feedTds=Math.max(0,num("feedTds"));
  const saltRej=clamp(num("saltRejection")/100,0,1);
  const permTds=feedTds*(1-saltRej);
  const rejectTds=rejectTotal>0?(feedTds*feed-permTds*permeate)/rejectTotal:NaN;
  $("qualitySummary").innerHTML=
    row("Feed TDS",fmt(feedTds,0),"mg/L")+
    row("Permeate TDS",fmt(permTds,0),"mg/L")+
    row("Reject TDS",fmt(rejectTds,0),"mg/L")+
    row("Temperature",fmt(num("temperature")),"°C");

  $("vFeed").textContent=fmt(feed,0)+" m³/h";
  $("vHpp").textContent=fmt(hppFlow,0)+" m³/h";
  $("vPx").textContent=fmt(pxLpIn,0)+" m³/h";
  $("vPerm").textContent=fmt(permeate,0)+" m³/h";
  $("vReject").textContent=fmt(rejectTotal,0)+" m³/h";
}
["feedFlow","recovery","pxHpIn","feedPressure","roPressure","rejectPressure","pxPressureEff","hppEff","cpEff","feedTds","saltRejection","temperature"].forEach(id=>$(id).addEventListener("input",calc));
$("calculateBtn").addEventListener("click",calc);
$("autoPx").addEventListener("click",()=>{
  const feed=Math.max(0,num("feedFlow"));
  const reject=feed*(1-clamp(num("recovery")/100,0,.95));
  $("pxHpIn").value=(reject*0.80).toFixed(1);
  calc();
});
calc();
