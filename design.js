
(function(){
'use strict';
var byId=function(id){return document.getElementById(id);};
var num=function(id){var e=byId(id);return e?Number(e.value||0):0;};
var fmt=function(v,d){d=d===undefined?1:d;return Number.isFinite(Number(v))?Number(v).toFixed(d):'—';};
var clamp=function(v,a,b){return Math.min(b,Math.max(a,v));};

function summaryRow(label,value,unit){
  return '<div class="design-summary-row"><span>'+label+'</span><strong>'+value+'</strong><em>'+unit+'</em></div>';
}
function check(level,title,text){
  return '<div class="design-check '+level+'"><i></i><div><b>'+title+'</b><p>'+text+'</p></div></div>';
}

var last=null;

function renderArray(vessels,elements){
  var host=byId('dArrayVisual'); if(!host)return;
  var show=Math.min(vessels,24),html='';
  for(var i=0;i<show;i++){
    html+='<div class="array-vessel">';
    for(var e=0;e<Math.min(elements,8);e++)html+='<i></i>';
    html+='<small>PV-'+String(i+1).padStart(2,'0')+'</small></div>';
  }
  if(vessels>show)html+='<div class="array-vessel"><small>+'+(vessels-show)+' more vessels</small></div>';
  host.innerHTML=html;
}

function calculate(){
  if(!byId('dCapacity'))return;

  var capacity=Math.max(0,num('dCapacity'));
  var permeate=capacity/24;
  var recovery=clamp(num('dRecovery')/100,.01,.95);
  var feed=permeate/recovery;
  var reject=Math.max(0,feed-permeate);

  var vessels=Math.max(1,Math.round(num('dVessels')));
  var epv=Math.max(1,Math.round(num('dElementsPerVessel')));
  var areaEach=Math.max(1,num('dElementArea'));
  var elements=vessels*epv;
  var area=elements*areaEach;
  var flux=area>0?permeate*1000/area:0;

  var feedTds=Math.max(0,num('dFeedTds'));
  var productTds=Math.max(0,num('dProductTds'));
  var rejectionReq=feedTds>0?(1-productTds/feedTds)*100:0;

  var erd=byId('dErd').value;
  var pxEff=clamp(num('dPxEff')/100,.01,1);
  var pxFraction=clamp(num('dPxFraction')/100,0,1);
  var roP=Math.max(0,num('dRoPressure'));
  var feedP=Math.max(0,num('dFeedPressure'));
  var rejectP=Math.max(0,num('dRejectPressure'));
  var hppEff=clamp(num('dHppEff')/100,.01,1);
  var cpEff=clamp(num('dCpEff')/100,.01,1);

  var pxHpIn=0,pxLpIn=0,pxHpOut=0,pxLpOut=0,directReject=reject,hppFlow=feed,cpFlow=0,pxOutP=feedP;
  if(erd==='px'){
    pxHpIn=reject*pxFraction;
    pxLpIn=pxHpIn;
    pxHpOut=pxLpIn;
    pxLpOut=pxHpIn;
    directReject=reject-pxHpIn;
    hppFlow=Math.max(0,feed-pxLpIn);
    cpFlow=pxHpOut;
    pxOutP=feedP+pxEff*Math.max(0,rejectP-feedP);
  }

  var hppPower=hppFlow*Math.max(0,roP-feedP)/(36*hppEff);
  var cpPower=cpFlow*Math.max(0,roP-pxOutP)/(36*cpEff);
  var power=hppPower+cpPower;
  var sec=permeate>0?power/permeate:0;

  var feedPerVessel=feed/vessels;
  var permPerVessel=permeate/vessels;
  var rejectPerVessel=reject/vessels;

  last={
    capacity:capacity,permeate:permeate,recovery:recovery,feed:feed,reject:reject,
    vessels:vessels,epv:epv,elements:elements,area:area,flux:flux,
    feedTds:feedTds,productTds:productTds,rejectionReq:rejectionReq,
    erd:erd,pxEff:pxEff,pxFraction:pxFraction,roP:roP,feedP:feedP,rejectP:rejectP,
    pxHpIn:pxHpIn,pxLpIn:pxLpIn,pxHpOut:pxHpOut,pxLpOut:pxLpOut,directReject:directReject,
    hppFlow:hppFlow,cpFlow:cpFlow,pxOutP:pxOutP,hppPower:hppPower,cpPower:cpPower,power:power,sec:sec,
    feedPerVessel:feedPerVessel,permPerVessel:permPerVessel,rejectPerVessel:rejectPerVessel
  };

  byId('dKpiCapacity').textContent=fmt(capacity,0);
  byId('dKpiFeed').textContent=fmt(feed,1);
  byId('dKpiFlux').textContent=fmt(flux,1);
  byId('dKpiSec').textContent=fmt(sec,2);

  byId('dHydraulicSummary').innerHTML=
    summaryRow('Permeate flow',fmt(permeate,1),'m³/h')+
    summaryRow('Feed flow',fmt(feed,1),'m³/h')+
    summaryRow('Reject flow',fmt(reject,1),'m³/h')+
    summaryRow('Recovery',fmt(recovery*100,1),'%')+
    summaryRow('HPP flow',fmt(hppFlow,1),'m³/h')+
    summaryRow('PX LP IN / HP OUT',fmt(pxLpIn,1),'m³/h')+
    summaryRow('Direct reject',fmt(directReject,1),'m³/h')+
    summaryRow('HPP power',fmt(hppPower,1),'kW')+
    summaryRow('CP power',fmt(cpPower,1),'kW')+
    summaryRow('Total RO power',fmt(power,1),'kW')+
    summaryRow('Specific energy',fmt(sec,2),'kWh/m³');

  byId('dMembraneSummary').innerHTML=
    summaryRow('Total elements',fmt(elements,0),'ea')+
    summaryRow('Total active area',fmt(area,0),'m²')+
    summaryRow('Average flux',fmt(flux,1),'LMH')+
    summaryRow('Feed / vessel',fmt(feedPerVessel,1),'m³/h')+
    summaryRow('Permeate / vessel',fmt(permPerVessel,1),'m³/h')+
    summaryRow('Reject / vessel',fmt(rejectPerVessel,1),'m³/h')+
    summaryRow('Required salt rejection',fmt(rejectionReq,2),'%');

  var water=byId('dWaterType').value;
  var checks=[];
  if(water==='seawater'){
    if(recovery>0.50)checks.push(check('warn','High seawater recovery','Recovery is above 50%. Verify concentrate chemistry, scaling risk, element limits and projection results before accepting it.'));
    else if(recovery<0.30)checks.push(check('warn','Low recovery','The design is conservative on recovery. Confirm whether this is intentional for feed quality, boron/product requirements or reliability.'));
    else checks.push(check('good','Recovery is in a reasonable preliminary range','Use the final water analysis and membrane projection to confirm the selected value.'));
    if(flux>20)checks.push(check('warn','High average flux','Average flux is '+fmt(flux,1)+' LMH. Review fouling allowance and the selected membrane model.'));
    else if(flux<8)checks.push(check('warn','Low average flux','Average flux is '+fmt(flux,1)+' LMH. Check whether the membrane array is oversized.'));
    else checks.push(check('good','Average flux is reasonable for preliminary sizing','Final allowable flux depends on the membrane model and feed-water quality.'));
  }else{
    if(recovery>0.85)checks.push(check('warn','High brackish-water recovery','Confirm concentrate chemistry, scaling tendency and element limits.'));
    else checks.push(check('good','Recovery passes the preliminary screen','Confirm using full ionic chemistry and vendor projection.'));
    if(flux>30)checks.push(check('warn','High average flux','Average flux is '+fmt(flux,1)+' LMH. Review fouling risk and vendor limits.'));
    else checks.push(check('good','Average flux passes the preliminary screen','Final allowable flux depends on the selected element and feed quality.'));
  }
  if(rejectionReq>99.8)checks.push(check('warn','Demanding product-quality target','The required overall salt rejection is '+fmt(rejectionReq,2)+'%. A second pass or a higher-rejection membrane strategy may be needed depending on feed composition.'));
  else checks.push(check('good','Product-quality target is mathematically feasible for review','Required overall rejection is '+fmt(rejectionReq,2)+'%. Ionic projection is still required.'));
  if(erd==='px'){
    if(pxHpIn>reject+0.01)checks.push(check('bad','PX flow exceeds available reject','Reduce the PX reject fraction.'));
    else checks.push(check('good','PX branch closes hydraulically','The preliminary model routes '+fmt(pxHpIn,1)+' m³/h through the PX and '+fmt(directReject,1)+' m³/h as direct reject.'));
  }
  checks.push(check('warn','Vendor projection still required','This page is a sizing and screening tool. Final membrane pressure, element-by-element flux, ion passage, pressure drop and scaling must come from a manufacturer-specific projection model.'));
  byId('dDesignChecks').innerHTML=checks.join('');

  byId('dFlowFeed').textContent=fmt(feed,1);
  byId('dFlowHeader').textContent=fmt(hppFlow+cpFlow,1);
  byId('dFlowPerm').textContent=fmt(permeate,1);
  byId('dFlowReject').textContent=fmt(reject,1);

  renderArray(vessels,epv);
}

var ids=['dCapacity','dWaterType','dFeedTds','dTemp','dRecovery','dProductTds','dMembraneFamily','dElementArea','dVessels','dElementsPerVessel','dPasses','dStages','dErd','dRoPressure','dFeedPressure','dRejectPressure','dPxEff','dPxFraction','dHppEff','dCpEff'];
ids.forEach(function(id){var el=byId(id);if(el){el.addEventListener('input',calculate);el.addEventListener('change',calculate);}});

var use=byId('dUseInBalance');
if(use)use.addEventListener('click',function(){
  if(!last)calculate();
  var map={
    fbFeed:last.feed,
    fbHpp:last.hppFlow,
    fbLpIn:last.pxLpIn,
    fbRoFeed:last.hppFlow+last.cpFlow,
    fbHpOut:last.pxHpOut,
    fbPerm:last.permeate,
    fbHpIn:last.pxHpIn,
    fbLpOut:last.pxLpOut,
    fbDirect:last.directReject
  };
  Object.keys(map).forEach(function(id){var el=byId(id);if(el)el.value=fmt(map[id],1);});
  var navBtn=document.querySelector('[data-nav="balance"]');
  if(navBtn)navBtn.click();
  setTimeout(function(){
    var run=byId('runBalance'); if(run)run.click();
  },50);
});

calculate();
})();