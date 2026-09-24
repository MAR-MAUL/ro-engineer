(function(){
'use strict';

var byId=function(id){return document.getElementById(id);};
var num=function(id){var e=byId(id);return e?Number(e.value||0):0;};
var fmt=function(v,d){d=d===undefined?1:d;return Number.isFinite(Number(v))?Number(v).toFixed(d):'—';};
var clamp=function(v,a,b){return Math.min(b,Math.max(a,v));};

var activeTemplate='px';
var last=null;

var templates={
  px:{
    title:'SWRO + Pressure Exchanger',
    nodes:{
      feed:{type:'feed',label:'Feed',sub:'Pretreated source',x:20,y:190},
      particle:{type:'filter',label:'Particle Filter',sub:'Primary filtration',x:135,y:190},
      bag:{type:'filter',label:'Bag Filter',sub:'Fine filtration',x:250,y:190},
      split:{type:'split',label:'Split',sub:'HPP / PX feed split',x:365,y:190},
      hpp:{type:'hpp',label:'HPP',sub:'High pressure pump',x:485,y:80},
      blend:{type:'blend',label:'RO Header',sub:'HPP + CP blend',x:635,y:80},
      ro:{type:'ro',label:'RO Train',sub:'Membrane array',x:785,y:80},
      product:{type:'product',label:'Product',sub:'Permeate',x:920,y:80},
      px:{type:'px',label:'PX',sub:'Pressure exchanger',x:500,y:315},
      cp:{type:'cp',label:'CP',sub:'Circulation pump',x:650,y:315},
      reject:{type:'reject',label:'Reject',sub:'Discharge',x:900,y:335}
    },
    edges:[
      {id:'s1',from:'feed',to:'particle',fp:'r',tp:'l',kind:'feed',name:'Feed'},
      {id:'s2',from:'particle',to:'bag',fp:'r',tp:'l',kind:'feed',name:'Particle Filter OUT'},
      {id:'s3',from:'bag',to:'split',fp:'r',tp:'l',kind:'feed',name:'Bag Filter OUT'},
      {id:'s4',from:'split',to:'hpp',fp:'t',tp:'l',kind:'feed',name:'HPP IN'},
      {id:'s5',from:'hpp',to:'blend',fp:'r',tp:'l',kind:'feed',name:'HPP OUT'},
      {id:'s6',from:'blend',to:'ro',fp:'r',tp:'l',kind:'feed',name:'RO Feed'},
      {id:'s7',from:'ro',to:'product',fp:'r',tp:'l',kind:'product',name:'Product'},
      {id:'s8',from:'split',to:'px',fp:'b',tp:'l',kind:'feed',name:'PX LP IN'},
      {id:'s9',from:'ro',to:'px',fp:'b',tp:'r',kind:'reject',name:'PX HP IN'},
      {id:'s10',from:'px',to:'cp',fp:'r',tp:'l',kind:'feed',name:'PX HP OUT'},
      {id:'s11',from:'cp',to:'blend',fp:'t',tp:'b',kind:'feed',name:'CP OUT'},
      {id:'s12',from:'px',to:'reject',fp:'b',tp:'l',kind:'reject',name:'PX LP OUT'},
      {id:'s13',from:'ro',to:'reject',fp:'b',tp:'t',kind:'reject',name:'Direct Reject'}
    ]
  },
  simple:{
    title:'Simple RO',
    nodes:{
      feed:{type:'feed',label:'Feed',sub:'Pretreated source',x:55,y:190},
      particle:{type:'filter',label:'Particle Filter',sub:'Primary filtration',x:185,y:190},
      bag:{type:'filter',label:'Bag Filter',sub:'Fine filtration',x:315,y:190},
      hpp:{type:'hpp',label:'HPP',sub:'High pressure pump',x:465,y:190},
      ro:{type:'ro',label:'RO Train',sub:'Membrane array',x:645,y:190},
      product:{type:'product',label:'Product',sub:'Permeate',x:840,y:115},
      reject:{type:'reject',label:'Reject',sub:'Concentrate',x:840,y:285}
    },
    edges:[
      {id:'s1',from:'feed',to:'particle',fp:'r',tp:'l',kind:'feed',name:'Feed'},
      {id:'s2',from:'particle',to:'bag',fp:'r',tp:'l',kind:'feed',name:'Particle Filter OUT'},
      {id:'s3',from:'bag',to:'hpp',fp:'r',tp:'l',kind:'feed',name:'Bag Filter OUT'},
      {id:'s4',from:'hpp',to:'ro',fp:'r',tp:'l',kind:'feed',name:'RO Feed'},
      {id:'s5',from:'ro',to:'product',fp:'r',tp:'l',kind:'product',name:'Product'},
      {id:'s6',from:'ro',to:'reject',fp:'b',tp:'l',kind:'reject',name:'Reject'}
    ]
  },
  recycle:{
    title:'Concentrate Recirculation',
    nodes:{
      feed:{type:'feed',label:'Feed',sub:'Pretreated source',x:35,y:165},
      particle:{type:'filter',label:'Particle Filter',sub:'Primary filtration',x:155,y:165},
      bag:{type:'filter',label:'Bag Filter',sub:'Fine filtration',x:275,y:165},
      blend:{type:'blend',label:'Blend',sub:'Fresh + recycle',x:405,y:165},
      hpp:{type:'hpp',label:'HPP',sub:'High pressure pump',x:545,y:165},
      ro:{type:'ro',label:'RO Train',sub:'Membrane array',x:705,y:165},
      product:{type:'product',label:'Product',sub:'Permeate',x:885,y:105},
      recycle:{type:'px',label:'Recirculation',sub:'Concentrate return',x:540,y:335},
      reject:{type:'reject',label:'Reject',sub:'Net concentrate',x:875,y:335}
    },
    edges:[
      {id:'s1',from:'feed',to:'particle',fp:'r',tp:'l',kind:'feed',name:'Fresh Feed'},
      {id:'s2',from:'particle',to:'bag',fp:'r',tp:'l',kind:'feed',name:'Particle Filter OUT'},
      {id:'s3',from:'bag',to:'blend',fp:'r',tp:'l',kind:'feed',name:'Bag Filter OUT'},
      {id:'s4',from:'blend',to:'hpp',fp:'r',tp:'l',kind:'feed',name:'Pump IN'},
      {id:'s5',from:'hpp',to:'ro',fp:'r',tp:'l',kind:'feed',name:'RO Feed'},
      {id:'s6',from:'ro',to:'product',fp:'r',tp:'l',kind:'product',name:'Product'},
      {id:'s7',from:'ro',to:'recycle',fp:'b',tp:'r',kind:'reject',name:'Concentrate'},
      {id:'s8',from:'recycle',to:'blend',fp:'l',tp:'b',kind:'recycle',name:'Recycle'},
      {id:'s9',from:'recycle',to:'reject',fp:'r',tp:'l',kind:'reject',name:'Net Reject'}
    ]
  }
};

function nodeIcon(type){
  return {feed:'↦',filter:'▦',split:'Y',hpp:'▶',blend:'◇',ro:'RO',px:'↻',cp:'▶',product:'≈',reject:'↓'}[type]||'•';
}

function nodeHTML(id,n){
  return '<div class="design-node static-node '+n.type+'" style="left:'+n.x+'px;top:'+n.y+'px">'+
    '<span class="node-icon">'+nodeIcon(n.type)+'</span><strong>'+n.label+'</strong><small>'+n.sub+'</small></div>';
}

function portPoint(n,port){
  var w=92,h=58;
  if(port==='l')return{x:n.x,y:n.y+h/2};
  if(port==='r')return{x:n.x+w,y:n.y+h/2};
  if(port==='t')return{x:n.x+w/2,y:n.y};
  return{x:n.x+w/2,y:n.y+h};
}

function pathFor(e,nodes){
  var a=portPoint(nodes[e.from],e.fp||'r'),b=portPoint(nodes[e.to],e.tp||'l');
  if(e.fp==='b'&&e.tp==='t')return 'M'+a.x+' '+a.y+' V'+((a.y+b.y)/2)+' H'+b.x+' V'+b.y;
  if(e.fp==='t'&&e.tp==='b')return 'M'+a.x+' '+a.y+' V'+((a.y+b.y)/2)+' H'+b.x+' V'+b.y;
  if(e.fp==='b'||e.tp==='b'||e.fp==='t'||e.tp==='t'){
    var midY=(a.y+b.y)/2;
    return 'M'+a.x+' '+a.y+' V'+midY+' H'+b.x+' V'+b.y;
  }
  var midX=(a.x+b.x)/2;
  return 'M'+a.x+' '+a.y+' H'+midX+' V'+b.y+' H'+b.x;
}

function pointAlong(e,nodes){
  var a=portPoint(nodes[e.from],e.fp||'r'),b=portPoint(nodes[e.to],e.tp||'l');
  return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};
}

function markerDefs(){
  return '<defs>'+
    '<marker id="arr-feed" markerWidth="5" markerHeight="5" refX="4.6" refY="2.5" orient="auto"><path class="design-arrow-head feed" d="M0,0 L0,5 L5,2.5 z"/></marker>'+
    '<marker id="arr-reject" markerWidth="5" markerHeight="5" refX="4.6" refY="2.5" orient="auto"><path class="design-arrow-head reject" d="M0,0 L0,5 L5,2.5 z"/></marker>'+
    '<marker id="arr-product" markerWidth="5" markerHeight="5" refX="4.6" refY="2.5" orient="auto"><path class="design-arrow-head product" d="M0,0 L0,5 L5,2.5 z"/></marker>'+
    '<marker id="arr-recycle" markerWidth="5" markerHeight="5" refX="4.6" refY="2.5" orient="auto"><path class="design-arrow-head recycle" d="M0,0 L0,5 L5,2.5 z"/></marker>'+
  '</defs>';
}

function streamValues(){
  if(!last)return{};
  if(activeTemplate==='px')return{
    s1:{q:last.feed,p:last.feedP,tds:last.feedTds},s2:{q:last.feed,p:last.feedP,tds:last.feedTds},s3:{q:last.feed,p:last.feedP,tds:last.feedTds},
    s4:{q:last.hppFlow,p:last.feedP,tds:last.feedTds},s5:{q:last.hppFlow,p:last.roP,tds:last.feedTds},s6:{q:last.moduleFeed,p:last.roP,tds:last.feedTds},
    s7:{q:last.permeate,p:0.5,tds:last.productTds},s8:{q:last.pxLpIn,p:last.feedP,tds:last.feedTds},s9:{q:last.pxHpIn,p:last.rejectP,tds:last.rejectTds},
    s10:{q:last.pxHpOut,p:last.pxOutP,tds:last.feedTds},s11:{q:last.cpFlow,p:last.roP,tds:last.feedTds},s12:{q:last.pxLpOut,p:0.8,tds:last.rejectTds},
    s13:{q:last.directReject,p:last.rejectP,tds:last.rejectTds}
  };
  if(activeTemplate==='simple')return{
    s1:{q:last.feed,p:last.feedP,tds:last.feedTds},s2:{q:last.feed,p:last.feedP,tds:last.feedTds},s3:{q:last.feed,p:last.feedP,tds:last.feedTds},
    s4:{q:last.feed,p:last.roP,tds:last.feedTds},s5:{q:last.permeate,p:0.5,tds:last.productTds},s6:{q:last.reject,p:last.rejectP,tds:last.rejectTds}
  };
  return{
    s1:{q:last.freshFeed,p:last.feedP,tds:last.feedTds},s2:{q:last.freshFeed,p:last.feedP,tds:last.feedTds},s3:{q:last.freshFeed,p:last.feedP,tds:last.feedTds},
    s4:{q:last.moduleFeed,p:last.feedP,tds:last.mixedTds},s5:{q:last.moduleFeed,p:last.roP,tds:last.mixedTds},s6:{q:last.permeate,p:0.5,tds:last.productTds},
    s7:{q:last.membraneConcentrate,p:last.rejectP,tds:last.recycleRejectTds},s8:{q:last.recycleFlow,p:last.feedP,tds:last.recycleRejectTds},s9:{q:last.reject,p:0.8,tds:last.recycleRejectTds}
  };
}

function renderDiagram(){
  var t=templates[activeTemplate],nodes=t.nodes,vals=streamValues(),show=byId('dShowValues')?byId('dShowValues').checked:true;
  byId('dCanvasTitle').textContent=t.title;
  byId('designNodes').innerHTML=Object.keys(nodes).map(function(id){return nodeHTML(id,nodes[id]);}).join('');
  byId('designLinks').innerHTML=markerDefs()+t.edges.map(function(e){return '<path class="design-link '+e.kind+'" d="'+pathFor(e,nodes)+'" marker-end="url(#arr-'+e.kind+')"/>';}).join('');
  byId('designStreamLabels').innerHTML=t.edges.map(function(e){
    var p=pointAlong(e,nodes),v=vals[e.id]||{};
    return '<div class="stream-label static-stream '+(show?'':'hidden-value')+'" style="left:'+(p.x-42)+'px;top:'+(p.y-22)+'px">'+
      '<b>'+e.name+'</b><small>Q '+fmt(v.q,1)+' m³/h · P '+fmt(v.p,1)+' bar</small></div>';
  }).join('');
}

function summaryRow(label,value,unit){
  return '<div class="design-summary-row"><span>'+label+'</span><strong>'+value+'</strong><em>'+unit+'</em></div>';
}
function check(level,title,text){
  return '<div class="design-check '+level+'"><i></i><div><b>'+title+'</b><p>'+text+'</p></div></div>';
}

function calculate(){
  if(!byId('dCapacity'))return;

  var capacity=Math.max(0,num('dCapacity'));
  var permeate=capacity/24;
  var recovery=clamp(num('dRecovery')/100,.01,.95);
  var feedTds=Math.max(0,num('dFeedTds'));
  var productTds=Math.max(0,num('dProductTds'));
  var temp=num('dTemp');
  var roP=Math.max(0,num('dRoPressure'));
  var feedP=Math.max(0,num('dFeedPressure'));
  var rejectP=Math.max(0,num('dRejectPressure'));
  var vessels=Math.max(1,Math.round(num('dVessels')));
  var epv=Math.max(1,Math.round(num('dElementsPerVessel')));
  var areaEach=Math.max(1,num('dElementArea'));
  var elements=vessels*epv;
  var area=elements*areaEach;
  var hppEff=clamp(num('dHppEff')/100,.01,1);
  var cpEff=clamp(num('dCpEff')/100,.01,1);
  var pxEff=clamp(num('dPxEff')/100,.01,1);
  var fraction=clamp(num('dPxFraction')/100,0,.98);

  var freshFeed=permeate/recovery;
  var feed=freshFeed;
  var reject=Math.max(0,freshFeed-permeate);
  var moduleFeed=feed;

  var pxHpIn=0,pxLpIn=0,pxHpOut=0,pxLpOut=0,directReject=reject;
  var hppFlow=feed,cpFlow=0,pxOutP=feedP;
  var recycleFlow=0,membraneConcentrate=reject,mixedTds=feedTds,recycleRejectTds=reject>0?(feed*feedTds-permeate*productTds)/reject:0;

  if(activeTemplate==='px'){
    pxHpIn=reject*fraction;
    pxLpIn=pxHpIn;
    pxHpOut=pxLpIn;
    pxLpOut=pxHpIn;
    directReject=reject-pxHpIn;
    hppFlow=Math.max(0,feed-pxLpIn);
    cpFlow=pxHpOut;
    moduleFeed=hppFlow+cpFlow;
    pxOutP=feedP+pxEff*Math.max(0,rejectP-feedP);
  }else if(activeTemplate==='recycle'){
    if(fraction>.75){fraction=.30;byId('dPxFraction').value=30;}
    membraneConcentrate=reject/Math.max(.02,1-fraction);
    recycleFlow=membraneConcentrate*fraction;
    moduleFeed=freshFeed+recycleFlow;
    feed=moduleFeed;
    hppFlow=moduleFeed;
    recycleRejectTds=membraneConcentrate>0?(moduleFeed*feedTds-permeate*productTds)/membraneConcentrate:0;
    mixedTds=moduleFeed>0?(freshFeed*feedTds+recycleFlow*recycleRejectTds)/moduleFeed:feedTds;
  }

  var rejectTds=reject>0?(freshFeed*feedTds-permeate*productTds)/reject:0;
  var hppPower=hppFlow*Math.max(0,roP-feedP)/(36*hppEff);
  var cpPower=cpFlow*Math.max(0,roP-pxOutP)/(36*cpEff);
  var totalPower=hppPower+cpPower;
  var sec=permeate>0?totalPower/permeate:0;
  var flux=area>0?permeate*1000/area:0;
  var rejectionReq=feedTds>0?(1-productTds/feedTds)*100:0;

  last={
    capacity:capacity,permeate:permeate,recovery:recovery,freshFeed:freshFeed,feed:feed,reject:reject,moduleFeed:moduleFeed,
    feedTds:feedTds,productTds:productTds,rejectTds:rejectTds,temp:temp,roP:roP,feedP:feedP,rejectP:rejectP,
    vessels:vessels,epv:epv,elements:elements,area:area,flux:flux,rejectionReq:rejectionReq,
    pxHpIn:pxHpIn,pxLpIn:pxLpIn,pxHpOut:pxHpOut,pxLpOut:pxLpOut,directReject:directReject,hppFlow:hppFlow,cpFlow:cpFlow,pxOutP:pxOutP,
    hppPower:hppPower,cpPower:cpPower,totalPower:totalPower,sec:sec,recycleFlow:recycleFlow,membraneConcentrate:membraneConcentrate,
    mixedTds:mixedTds,recycleRejectTds:recycleRejectTds,fraction:fraction
  };

  renderDiagram();
  renderResults();
}

function renderResults(){
  var t=templates[activeTemplate],vals=streamValues();
  var head='<thead><tr><th>Stream</th>'+t.edges.map(function(e){return '<th>'+e.name+'</th>';}).join('')+'</tr></thead>';
  function row(name,key,d){
    return '<tr><td>'+name+'</td>'+t.edges.map(function(e){
      var v=vals[e.id]||{};
      var value=key==='temp'?last.temp:v[key];
      return '<td>'+fmt(value,d)+'</td>';
    }).join('')+'</tr>';
  }
  byId('dStreamTable').innerHTML=head+'<tbody>'+row('Flow (m³/h)','q',1)+row('Pressure (bar)','p',1)+row('TDS (mg/L)','tds',0)+row('Temperature (°C)','temp',1)+'</tbody>';

  var checks=[],water=byId('dWaterType').value;
  if(water==='seawater'){
    if(last.recovery>.50)checks.push(check('warn','High seawater recovery','Recovery exceeds 50%. Confirm scaling risk, element limits and full ionic projection.'));
    else checks.push(check('good','Recovery passes preliminary screen','Final recovery still depends on feed chemistry, pressure and membrane selection.'));
    if(last.flux>20)checks.push(check('warn','High average flux','Average flux is '+fmt(last.flux,1)+' LMH. Review lead-element flux and fouling allowance.'));
    else if(last.flux<8)checks.push(check('warn','Low average flux','Average flux is '+fmt(last.flux,1)+' LMH. The array may be oversized.'));
    else checks.push(check('good','Average flux is reasonable for preliminary sizing','Element-by-element flux must still be checked with the selected membrane model.'));
  }else{
    if(last.flux>30)checks.push(check('warn','High average flux','Average flux is '+fmt(last.flux,1)+' LMH. Review vendor limits and fouling risk.'));
    else checks.push(check('good','Average flux passes preliminary screen','Confirm against the selected BWRO element.'));
  }

  if(last.rejectionReq>99.8)checks.push(check('warn','Demanding product-quality target','Required overall rejection is '+fmt(last.rejectionReq,2)+'%. A second pass or different membrane strategy may be needed.'));
  else checks.push(check('good','Product-quality target ready for projection','Required overall rejection is '+fmt(last.rejectionReq,2)+'%.'));

  if(activeTemplate==='px'){
    checks.push(check(Math.abs(last.moduleFeed-last.freshFeed)<.05?'good':'bad','PX/HPP flow balance','HPP + CP = '+fmt(last.moduleFeed,1)+' m³/h versus feed '+fmt(last.freshFeed,1)+' m³/h.'));
  }
  if(activeTemplate==='recycle'){
    checks.push(check('warn','Recirculation needs full chemistry model','Recycle increases module feed salinity and scaling potential. Full ionic mass balance is required before final design.'));
  }
  checks.push(check('warn','Manufacturer projection still required','This canvas performs hydraulic screening. Final element flux, ion passage, pressure drop, scaling and boron/product quality need vendor-specific projection data.'));
  byId('dDesignChecks').innerHTML=checks.join('');

  byId('dEnergySummary').innerHTML=
    summaryRow('HPP flow',fmt(last.hppFlow,1),'m³/h')+
    summaryRow('HPP power',fmt(last.hppPower,1),'kW')+
    summaryRow('CP flow',fmt(last.cpFlow,1),'m³/h')+
    summaryRow('CP power',fmt(last.cpPower,1),'kW')+
    summaryRow('Total RO power',fmt(last.totalPower,1),'kW')+
    summaryRow('Specific energy',fmt(last.sec,2),'kWh/m³');
}

function setTemplate(name){
  activeTemplate=templates[name]?name:'px';
  if(activeTemplate==='recycle'&&num('dPxFraction')>75)byId('dPxFraction').value=30;
  calculate();
}

[
  'dCapacity','dRecovery','dFeedTds','dTemp','dRoPressure','dProductTds','dVessels','dElementsPerVessel',
  'dElementArea','dWaterType','dPxFraction','dPxEff','dRejectPressure','dFeedPressure','dHppEff','dCpEff'
].forEach(function(id){
  var e=byId(id);
  if(e){e.addEventListener('input',calculate);e.addEventListener('change',calculate);}
});

if(byId('dTemplate'))byId('dTemplate').addEventListener('change',function(){setTemplate(this.value);});
if(byId('dCalculate'))byId('dCalculate').addEventListener('click',calculate);
if(byId('dShowValues'))byId('dShowValues').addEventListener('change',renderDiagram);

if(byId('dUseInBalance'))byId('dUseInBalance').addEventListener('click',function(){
  if(!last)calculate();
  var map={
    fbFeed:last.freshFeed,
    fbHpp:last.hppFlow,
    fbLpIn:last.pxLpIn,
    fbRoFeed:last.moduleFeed,
    fbHpOut:last.pxHpOut,
    fbPerm:last.permeate,
    fbHpIn:last.pxHpIn,
    fbLpOut:last.pxLpOut,
    fbDirect:last.directReject
  };
  Object.keys(map).forEach(function(id){var e=byId(id);if(e)e.value=fmt(map[id],1);});
  var nav=document.querySelector('[data-nav="balance"]');
  if(nav)nav.click();
  setTimeout(function(){var run=byId('runBalance');if(run)run.click();},60);
});

calculate();
})();