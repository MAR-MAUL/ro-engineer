(function(){
'use strict';

var $=function(id){return document.getElementById(id);};
var num=function(id){var e=$(id);return e?Number(e.value||0):0;};
var fmt=function(v,d){d=d===undefined?1:d;return Number.isFinite(Number(v))?Number(v).toFixed(d):'—';};
var clamp=function(v,a,b){return Math.min(b,Math.max(a,v));};

var selected={kind:'node',id:'ro'};
var last=null;
var activeTemplate='px';

var templates={
  px:{
    title:'SWRO + Pressure Exchanger',
    nodes:{
      feed:{type:'feed',label:'Feed',sub:'Raw / pretreated water',x:35,y:190},
      dose:{type:'dose',label:'Dosing',sub:'Chemical conditioning',x:175,y:190},
      split:{type:'split',label:'Split',sub:'HPP / PX feed split',x:315,y:190},
      hpp:{type:'hpp',label:'HPP',sub:'High pressure pump',x:465,y:100},
      blend:{type:'blend',label:'Blend',sub:'RO inlet header',x:625,y:100},
      ro:{type:'ro',label:'RO Train',sub:'Membrane array',x:790,y:100},
      product:{type:'product',label:'Product',sub:'Permeate',x:930,y:100},
      px:{type:'px',label:'PX',sub:'Pressure exchanger',x:515,y:330},
      cp:{type:'cp',label:'CP',sub:'Circulation pump',x:680,y:330},
      reject:{type:'reject',label:'Reject',sub:'Discharge',x:900,y:330}
    },
    edges:[
      {id:'s1',from:'feed',to:'dose',fp:'r',tp:'l',kind:'feed',name:'Raw Feed'},
      {id:'s2',from:'dose',to:'split',fp:'r',tp:'l',kind:'feed',name:'Dosing OUT'},
      {id:'s3',from:'split',to:'hpp',fp:'t',tp:'l',kind:'feed',name:'HPP IN'},
      {id:'s4',from:'hpp',to:'blend',fp:'r',tp:'l',kind:'feed',name:'HPP OUT'},
      {id:'s5',from:'blend',to:'ro',fp:'r',tp:'l',kind:'feed',name:'RO Feed'},
      {id:'s6',from:'ro',to:'product',fp:'r',tp:'l',kind:'product',name:'Product'},
      {id:'s7',from:'split',to:'px',fp:'b',tp:'l',kind:'feed',name:'PX LP IN'},
      {id:'s8',from:'ro',to:'px',fp:'b',tp:'r',kind:'reject',name:'PX HP IN'},
      {id:'s9',from:'px',to:'cp',fp:'r',tp:'l',kind:'feed',name:'PX HP OUT'},
      {id:'s10',from:'cp',to:'blend',fp:'t',tp:'b',kind:'feed',name:'CP OUT'},
      {id:'s11',from:'px',to:'reject',fp:'b',tp:'l',kind:'reject',name:'PX LP OUT'},
      {id:'s12',from:'ro',to:'reject',fp:'b',tp:'t',kind:'reject',name:'Direct Reject'}
    ]
  },
  simple:{
    title:'Simple RO',
    nodes:{
      feed:{type:'feed',label:'Feed',sub:'Raw / pretreated water',x:70,y:200},
      dose:{type:'dose',label:'Dosing',sub:'Chemical conditioning',x:235,y:200},
      hpp:{type:'hpp',label:'HPP',sub:'High pressure pump',x:405,y:200},
      ro:{type:'ro',label:'RO Train',sub:'Membrane array',x:585,y:200},
      product:{type:'product',label:'Product',sub:'Permeate',x:805,y:130},
      reject:{type:'reject',label:'Reject',sub:'Concentrate',x:805,y:300}
    },
    edges:[
      {id:'s1',from:'feed',to:'dose',fp:'r',tp:'l',kind:'feed',name:'Raw Feed'},
      {id:'s2',from:'dose',to:'hpp',fp:'r',tp:'l',kind:'feed',name:'Pump IN'},
      {id:'s3',from:'hpp',to:'ro',fp:'r',tp:'l',kind:'feed',name:'RO Feed'},
      {id:'s4',from:'ro',to:'product',fp:'r',tp:'l',kind:'product',name:'Product'},
      {id:'s5',from:'ro',to:'reject',fp:'b',tp:'l',kind:'reject',name:'Reject'}
    ]
  },
  recycle:{
    title:'Concentrate Recirculation',
    nodes:{
      feed:{type:'feed',label:'Feed',sub:'Raw / pretreated water',x:55,y:150},
      dose:{type:'dose',label:'Dosing',sub:'Chemical conditioning',x:195,y:150},
      blend:{type:'blend',label:'Blend',sub:'Feed + recycle',x:350,y:150},
      hpp:{type:'hpp',label:'HPP',sub:'High pressure pump',x:505,y:150},
      ro:{type:'ro',label:'RO Train',sub:'Membrane array',x:675,y:150},
      product:{type:'product',label:'Product',sub:'Permeate',x:865,y:105},
      recycle:{type:'px',label:'Recycle',sub:'Concentrate return',x:515,y:335},
      reject:{type:'reject',label:'Reject',sub:'Net concentrate',x:855,y:335}
    },
    edges:[
      {id:'s1',from:'feed',to:'dose',fp:'r',tp:'l',kind:'feed',name:'Fresh Feed'},
      {id:'s2',from:'dose',to:'blend',fp:'r',tp:'l',kind:'feed',name:'Dosing OUT'},
      {id:'s3',from:'blend',to:'hpp',fp:'r',tp:'l',kind:'feed',name:'Pump IN'},
      {id:'s4',from:'hpp',to:'ro',fp:'r',tp:'l',kind:'feed',name:'RO Feed'},
      {id:'s5',from:'ro',to:'product',fp:'r',tp:'l',kind:'product',name:'Product'},
      {id:'s6',from:'ro',to:'recycle',fp:'b',tp:'r',kind:'reject',name:'Concentrate'},
      {id:'s7',from:'recycle',to:'blend',fp:'l',tp:'b',kind:'recycle',name:'Recycle'},
      {id:'s8',from:'recycle',to:'reject',fp:'r',tp:'l',kind:'reject',name:'Net Reject'}
    ]
  }
};

function storageKey(){return 'ro-engineer-layout-'+activeTemplate;}
function cloneNodes(obj){return JSON.parse(JSON.stringify(obj));}
var nodes=cloneNodes(templates.px.nodes);

function restorePositions(){
  nodes=cloneNodes(templates[activeTemplate].nodes);
  try{
    var saved=JSON.parse(localStorage.getItem(storageKey())||'null');
    if(saved)Object.keys(saved).forEach(function(id){if(nodes[id]){nodes[id].x=saved[id].x;nodes[id].y=saved[id].y;}});
  }catch(e){}
}
function savePositions(){
  var pos={};Object.keys(nodes).forEach(function(id){pos[id]={x:nodes[id].x,y:nodes[id].y};});
  try{localStorage.setItem(storageKey(),JSON.stringify(pos));}catch(e){}
}
function nodeIcon(type){
  return {feed:'↦',dose:'+',split:'Y',hpp:'▶',blend:'◇',ro:'RO',px:'↻',cp:'▶',product:'≈',reject:'↓'}[type]||'•';
}
function nodeHTML(id,n){
  return '<button class="design-node '+n.type+(selected.kind==='node'&&selected.id===id?' selected':'')+'" data-node="'+id+'" style="left:'+n.x+'px;top:'+n.y+'px"><span class="node-icon">'+nodeIcon(n.type)+'</span><strong>'+n.label+'</strong><small>'+n.sub+'</small></button>';
}
function portPoint(n,port){
  var w=112,h=70;
  if(port==='l')return{x:n.x,y:n.y+h/2};
  if(port==='r')return{x:n.x+w,y:n.y+h/2};
  if(port==='t')return{x:n.x+w/2,y:n.y};
  return{x:n.x+w/2,y:n.y+h};
}
function pathFor(e){
  var a=portPoint(nodes[e.from],e.fp||'r'),b=portPoint(nodes[e.to],e.tp||'l');
  if(e.fp==='b'&&e.tp==='t')return 'M'+a.x+' '+a.y+' V'+((a.y+b.y)/2)+' H'+b.x+' V'+b.y;
  if(e.fp==='t'&&e.tp==='b')return 'M'+a.x+' '+a.y+' V'+((a.y+b.y)/2)+' H'+b.x+' V'+b.y;
  if(e.fp==='b'||e.tp==='b'||e.fp==='t'||e.tp==='t'){
    var midY=(a.y+b.y)/2;return 'M'+a.x+' '+a.y+' V'+midY+' H'+b.x+' V'+b.y;
  }
  var midX=(a.x+b.x)/2;
  return 'M'+a.x+' '+a.y+' H'+midX+' V'+b.y+' H'+b.x;
}
function pointAlong(e){
  var a=portPoint(nodes[e.from],e.fp||'r'),b=portPoint(nodes[e.to],e.tp||'l');
  return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};
}
function markerDefs(){
  return '<defs>'+
    '<marker id="arr-feed" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path class="design-arrow-head feed" d="M0,0 L0,6 L8,3 z"/></marker>'+
    '<marker id="arr-reject" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path class="design-arrow-head reject" d="M0,0 L0,6 L8,3 z"/></marker>'+
    '<marker id="arr-product" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path class="design-arrow-head product" d="M0,0 L0,6 L8,3 z"/></marker>'+
    '<marker id="arr-recycle" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path class="design-arrow-head recycle" d="M0,0 L0,6 L8,3 z"/></marker>'+
  '</defs>';
}
function streamValues(){
  if(!last)return{};
  if(activeTemplate==='px')return{
    s1:{q:last.feed,p:last.feedP,tds:last.feedTds},s2:{q:last.feed,p:last.feedP,tds:last.feedTds},
    s3:{q:last.hppFlow,p:last.feedP,tds:last.feedTds},s4:{q:last.hppFlow,p:last.roP,tds:last.feedTds},
    s5:{q:last.moduleFeed,p:last.roP,tds:last.feedTds},s6:{q:last.permeate,p:0.5,tds:last.productTds},
    s7:{q:last.pxLpIn,p:last.feedP,tds:last.feedTds},s8:{q:last.pxHpIn,p:last.rejectP,tds:last.rejectTds},
    s9:{q:last.pxHpOut,p:last.pxOutP,tds:last.feedTds},s10:{q:last.cpFlow,p:last.roP,tds:last.feedTds},
    s11:{q:last.pxLpOut,p:0.8,tds:last.rejectTds},s12:{q:last.directReject,p:last.rejectP,tds:last.rejectTds}
  };
  if(activeTemplate==='simple')return{
    s1:{q:last.feed,p:last.feedP,tds:last.feedTds},s2:{q:last.feed,p:last.feedP,tds:last.feedTds},
    s3:{q:last.feed,p:last.roP,tds:last.feedTds},s4:{q:last.permeate,p:0.5,tds:last.productTds},s5:{q:last.reject,p:last.rejectP,tds:last.rejectTds}
  };
  return{
    s1:{q:last.freshFeed,p:last.feedP,tds:last.feedTds},s2:{q:last.freshFeed,p:last.feedP,tds:last.feedTds},
    s3:{q:last.moduleFeed,p:last.feedP,tds:last.mixedTds},s4:{q:last.moduleFeed,p:last.roP,tds:last.mixedTds},
    s5:{q:last.permeate,p:0.5,tds:last.productTds},s6:{q:last.membraneConcentrate,p:last.rejectP,tds:last.recycleRejectTds},
    s7:{q:last.recycleFlow,p:last.feedP,tds:last.recycleRejectTds},s8:{q:last.reject,p:0.8,tds:last.recycleRejectTds}
  };
}
function renderDiagram(){
  var t=templates[activeTemplate];
  $('dCanvasTitle').textContent=t.title;
  $('designNodes').innerHTML=Object.keys(nodes).map(function(id){return nodeHTML(id,nodes[id]);}).join('');
  $('designLinks').innerHTML=markerDefs()+t.edges.map(function(e){return '<path class="design-link '+e.kind+'" d="'+pathFor(e)+'" marker-end="url(#arr-'+e.kind+')"/>';}).join('');
  var vals=streamValues(),show=$('dShowValues')?$('dShowValues').checked:true;
  $('designStreamLabels').innerHTML=t.edges.map(function(e){
    var p=pointAlong(e),v=vals[e.id]||{};
    return '<button class="stream-label '+(show?'':'hidden-value')+'" data-stream="'+e.id+'" style="left:'+(p.x-42)+'px;top:'+(p.y-22)+'px"><b>'+e.name+'</b><small>Q '+fmt(v.q,1)+' m³/h · P '+fmt(v.p,1)+' bar</small></button>';
  }).join('');
  wireDiagramInteractions();
}
function wireDiagramInteractions(){
  document.querySelectorAll('.design-node').forEach(function(el){
    el.addEventListener('click',function(e){e.stopPropagation();selected={kind:'node',id:el.dataset.node};renderDiagram();renderInspector();});
    enableDrag(el);
  });
  document.querySelectorAll('.stream-label').forEach(function(el){
    el.addEventListener('click',function(e){e.stopPropagation();selected={kind:'stream',id:el.dataset.stream};renderInspector();});
  });
  document.querySelectorAll('[data-focus-node]').forEach(function(el){
    el.classList.toggle('active',selected.kind==='node'&&selected.id===el.dataset.focusNode);
    el.onclick=function(){
      var id=el.dataset.focusNode;if(!nodes[id])return;
      selected={kind:'node',id:id};renderDiagram();renderInspector();
      var canvas=$('designCanvas');canvas.scrollTo({left:Math.max(0,nodes[id].x-180),top:Math.max(0,nodes[id].y-130),behavior:'smooth'});
    };
  });
}
function enableDrag(el){
  var id=el.dataset.node,start=null;
  el.addEventListener('pointerdown',function(e){
    if(e.button!==undefined&&e.button!==0)return;
    start={x:e.clientX,y:e.clientY,nx:nodes[id].x,ny:nodes[id].y};
    el.setPointerCapture&&el.setPointerCapture(e.pointerId);el.classList.add('dragging');
  });
  el.addEventListener('pointermove',function(e){
    if(!start)return;
    nodes[id].x=clamp(start.nx+(e.clientX-start.x),8,920);
    nodes[id].y=clamp(start.ny+(e.clientY-start.y),8,420);
    el.style.left=nodes[id].x+'px';el.style.top=nodes[id].y+'px';
    var t=templates[activeTemplate];
    $('designLinks').innerHTML=markerDefs()+t.edges.map(function(ed){return '<path class="design-link '+ed.kind+'" d="'+pathFor(ed)+'" marker-end="url(#arr-'+ed.kind+')"/>';}).join('');
    renderStreamLabelsOnly();
  });
  function end(){if(!start)return;start=null;el.classList.remove('dragging');savePositions();}
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}
function renderStreamLabelsOnly(){
  var t=templates[activeTemplate],vals=streamValues(),show=$('dShowValues').checked;
  $('designStreamLabels').innerHTML=t.edges.map(function(e){
    var p=pointAlong(e),v=vals[e.id]||{};
    return '<button class="stream-label '+(show?'':'hidden-value')+'" data-stream="'+e.id+'" style="left:'+(p.x-42)+'px;top:'+(p.y-22)+'px"><b>'+e.name+'</b><small>Q '+fmt(v.q,1)+' m³/h · P '+fmt(v.p,1)+' bar</small></button>';
  }).join('');
  document.querySelectorAll('.stream-label').forEach(function(el){el.onclick=function(){selected={kind:'stream',id:el.dataset.stream};renderInspector();};});
}

function summaryRow(label,value,unit){return '<div class="design-summary-row"><span>'+label+'</span><strong>'+value+'</strong><em>'+unit+'</em></div>';}
function check(level,title,text){return '<div class="design-check '+level+'"><i></i><div><b>'+title+'</b><p>'+text+'</p></div></div>';}

function calculate(){
  var capacity=Math.max(0,num('dCapacity')),permeate=capacity/24,recovery=clamp(num('dRecovery')/100,.01,.95);
  var feedTds=Math.max(0,num('dFeedTds')),productTds=Math.max(0,num('dProductTds')),temp=num('dTemp');
  var roP=Math.max(0,num('dRoPressure')),feedP=Math.max(0,num('dFeedPressure')),rejectP=Math.max(0,num('dRejectPressure'));
  var vessels=Math.max(1,Math.round(num('dVessels'))),epv=Math.max(1,Math.round(num('dElementsPerVessel'))),areaEach=Math.max(1,num('dElementArea'));
  var elements=vessels*epv,area=elements*areaEach;
  var hppEff=clamp(num('dHppEff')/100,.01,1),cpEff=clamp(num('dCpEff')/100,.01,1),pxEff=clamp(num('dPxEff')/100,.01,1),fraction=clamp(num('dPxFraction')/100,0,.98);

  var freshFeed=permeate/recovery,feed=freshFeed,reject=Math.max(0,freshFeed-permeate),moduleFeed=feed;
  var pxHpIn=0,pxLpIn=0,pxHpOut=0,pxLpOut=0,directReject=reject,hppFlow=feed,cpFlow=0,pxOutP=feedP;
  var recycleFlow=0,membraneConcentrate=reject,mixedTds=feedTds,recycleRejectTds=reject>0?(feed*feedTds-permeate*productTds)/reject:0;

  if(activeTemplate==='px'){
    pxHpIn=reject*fraction;pxLpIn=pxHpIn;pxHpOut=pxLpIn;pxLpOut=pxHpIn;directReject=reject-pxHpIn;
    hppFlow=Math.max(0,feed-pxLpIn);cpFlow=pxHpOut;moduleFeed=hppFlow+cpFlow;
    pxOutP=feedP+pxEff*Math.max(0,rejectP-feedP);
  }else if(activeTemplate==='recycle'){
    if(fraction>.75){fraction=.30;$('dPxFraction').value=30;}
    membraneConcentrate=reject/Math.max(.02,1-fraction);
    recycleFlow=membraneConcentrate*fraction;
    moduleFeed=freshFeed+recycleFlow;feed=moduleFeed;hppFlow=moduleFeed;
    recycleRejectTds=membraneConcentrate>0?(moduleFeed*feedTds-permeate*productTds)/membraneConcentrate:0;
    mixedTds=moduleFeed>0?(freshFeed*feedTds+recycleFlow*recycleRejectTds)/moduleFeed:feedTds;
  }

  var rejectTds=reject>0?(freshFeed*feedTds-permeate*productTds)/reject:0;
  var hppPower=hppFlow*Math.max(0,roP-feedP)/(36*hppEff),cpPower=cpFlow*Math.max(0,roP-pxOutP)/(36*cpEff);
  var totalPower=hppPower+cpPower,sec=permeate>0?totalPower/permeate:0,flux=area>0?permeate*1000/area:0,rejectionReq=feedTds>0?(1-productTds/feedTds)*100:0;

  last={capacity:capacity,permeate:permeate,recovery:recovery,freshFeed:freshFeed,feed:feed,reject:reject,moduleFeed:moduleFeed,
    feedTds:feedTds,productTds:productTds,rejectTds:rejectTds,temp:temp,roP:roP,feedP:feedP,rejectP:rejectP,
    vessels:vessels,epv:epv,elements:elements,area:area,flux:flux,rejectionReq:rejectionReq,
    pxHpIn:pxHpIn,pxLpIn:pxLpIn,pxHpOut:pxHpOut,pxLpOut:pxLpOut,directReject:directReject,hppFlow:hppFlow,cpFlow:cpFlow,pxOutP:pxOutP,
    hppPower:hppPower,cpPower:cpPower,totalPower:totalPower,sec:sec,recycleFlow:recycleFlow,membraneConcentrate:membraneConcentrate,
    mixedTds:mixedTds,recycleRejectTds:recycleRejectTds,fraction:fraction};

  renderDiagram();renderInspector();renderResults();
}

function nodeMetrics(id){
  if(!last)return[];
  if(id==='feed')return[['Flow',fmt(last.freshFeed,1)+' m³/h'],['TDS',fmt(last.feedTds,0)+' mg/L'],['Temperature',fmt(last.temp,1)+' °C'],['Pressure',fmt(last.feedP,1)+' bar']];
  if(id==='dose')return[['Inlet flow',fmt(last.freshFeed,1)+' m³/h'],['Purpose','Pretreatment / chemical conditioning'],['Calculation','Dose model can be added later']];
  if(id==='split')return[['Total feed',fmt(last.freshFeed,1)+' m³/h'],['HPP branch',fmt(last.hppFlow,1)+' m³/h'],['PX LP branch',fmt(last.pxLpIn,1)+' m³/h']];
  if(id==='hpp')return[['Flow',fmt(last.hppFlow,1)+' m³/h'],['Discharge',fmt(last.roP,1)+' bar'],['Power',fmt(last.hppPower,1)+' kW'],['Efficiency',fmt(num('dHppEff'),0)+'%']];
  if(id==='blend')return[['RO header flow',fmt(last.moduleFeed,1)+' m³/h'],['Header pressure',fmt(last.roP,1)+' bar'],['Balance',activeTemplate==='px'?'HPP + CP':'Fresh feed + recycle']];
  if(id==='ro')return[['Feed',fmt(last.moduleFeed,1)+' m³/h'],['Permeate',fmt(last.permeate,1)+' m³/h'],['Recovery',fmt(last.recovery*100,1)+'%'],['Average flux',fmt(last.flux,1)+' LMH'],['Array',last.vessels+' × '+last.epv]];
  if(id==='px')return activeTemplate==='recycle'?[['Recycle flow',fmt(last.recycleFlow,1)+' m³/h'],['Recycle fraction',fmt(last.fraction*100,1)+'%']]:[['HP IN',fmt(last.pxHpIn,1)+' m³/h'],['LP IN',fmt(last.pxLpIn,1)+' m³/h'],['HP OUT pressure',fmt(last.pxOutP,1)+' bar'],['Pressure efficiency',fmt(num('dPxEff'),1)+'%']];
  if(id==='cp')return[['Flow',fmt(last.cpFlow,1)+' m³/h'],['Suction pressure',fmt(last.pxOutP,1)+' bar'],['Discharge',fmt(last.roP,1)+' bar'],['Power',fmt(last.cpPower,1)+' kW']];
  if(id==='product')return[['Flow',fmt(last.permeate,1)+' m³/h'],['Capacity',fmt(last.capacity,0)+' m³/day'],['TDS target',fmt(last.productTds,0)+' mg/L']];
  if(id==='reject')return[['Net reject',fmt(last.reject,1)+' m³/h'],['TDS',fmt(last.rejectTds,0)+' mg/L'],['Pressure',activeTemplate==='simple'?fmt(last.rejectP,1)+' bar':'~ atmospheric']];
  if(id==='recycle')return[['Recycle flow',fmt(last.recycleFlow,1)+' m³/h'],['Membrane concentrate',fmt(last.membraneConcentrate,1)+' m³/h'],['Net reject',fmt(last.reject,1)+' m³/h']];
  return[];
}
function renderInspector(){
  if(!$('dInspectorBody'))return;
  if(selected.kind==='stream'){
    var edge=templates[activeTemplate].edges.find(function(e){return e.id===selected.id;}),v=streamValues()[selected.id]||{};
    $('dInspectorTitle').textContent=edge?edge.name:'Stream';
    $('dInspectorBody').innerHTML='<div class="inspector-metric"><span>Flow</span><b>'+fmt(v.q,1)+' m³/h</b></div>'+
      '<div class="inspector-metric"><span>Pressure</span><b>'+fmt(v.p,1)+' bar</b></div>'+
      '<div class="inspector-metric"><span>TDS</span><b>'+fmt(v.tds,0)+' mg/L</b></div>'+
      '<div class="inspector-metric"><span>Temperature</span><b>'+fmt(last?last.temp:0,1)+' °C</b></div>'+
      '<div class="inspector-note">Stream results are preliminary. Final ionic composition and membrane-specific projection will be added in the detailed projection layer.</div>';
    return;
  }
  var node=nodes[selected.id]||nodes.ro;
  $('dInspectorTitle').textContent=node?node.label:'System';
  var rows=nodeMetrics(selected.id).map(function(x){return '<div class="inspector-metric"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>';}).join('');
  $('dInspectorBody').innerHTML=rows+'<div class="inspector-note">Click any stream label to inspect its calculated flow, pressure and TDS. Drag equipment to organize the workspace; the layout is remembered on this device.</div>';
}
function renderResults(){
  var t=templates[activeTemplate],vals=streamValues();
  var head='<thead><tr><th>Stream</th>'+t.edges.map(function(e){return '<th>'+e.name+'</th>';}).join('')+'</tr></thead>';
  function row(name,key,unit,d){return '<tr><td>'+name+'</td>'+t.edges.map(function(e){var v=vals[e.id]||{};return '<td>'+fmt(v[key],d)+' '+(unit||'')+'</td>';}).join('')+'</tr>';}
  $('dStreamTable').innerHTML=head+'<tbody>'+row('Flow','q','',1)+row('Pressure','p','',1)+row('TDS','tds','',0)+row('Temperature','temp','',1)+'</tbody>';

  var checks=[],water=$('dWaterType').value;
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
  if(activeTemplate==='recycle')checks.push(check('warn','Recirculation needs full chemistry model','Recycle increases module feed salinity and scaling potential. Full ionic mass balance is required before final design.'));
  checks.push(check('warn','Manufacturer projection still required','This canvas performs hydraulic screening. Final element flux, ion passage, pressure drop, scaling and boron/product quality need vendor-specific projection data.'));
  $('dDesignChecks').innerHTML=checks.join('');

  $('dEnergySummary').innerHTML=
    summaryRow('HPP flow',fmt(last.hppFlow,1),'m³/h')+
    summaryRow('HPP power',fmt(last.hppPower,1),'kW')+
    summaryRow('CP flow',fmt(last.cpFlow,1),'m³/h')+
    summaryRow('CP power',fmt(last.cpPower,1),'kW')+
    summaryRow('Total RO power',fmt(last.totalPower,1),'kW')+
    summaryRow('Specific energy',fmt(last.sec,2),'kWh/m³');
}

function setTemplate(name){
  activeTemplate=templates[name]?name:'px';
  restorePositions();
  if(activeTemplate==='recycle'&&num('dPxFraction')>75)$('dPxFraction').value=30;
  selected={kind:'node',id:nodes.ro?'ro':Object.keys(nodes)[0]};
  calculate();
}
function resetLayout(){localStorage.removeItem(storageKey());restorePositions();renderDiagram();}
function fitView(){var c=$('designCanvas');if(c)c.scrollTo({left:0,top:0,behavior:'smooth'});}

['dCapacity','dRecovery','dFeedTds','dTemp','dRoPressure','dProductTds','dVessels','dElementsPerVessel','dElementArea','dWaterType','dPxFraction','dPxEff','dRejectPressure','dFeedPressure','dHppEff','dCpEff'].forEach(function(id){
  var e=$(id);if(e){e.addEventListener('input',calculate);e.addEventListener('change',calculate);}
});
if($('dTemplate'))$('dTemplate').addEventListener('change',function(){setTemplate(this.value);});
if($('dCalculate'))$('dCalculate').addEventListener('click',calculate);
if($('dResetLayout'))$('dResetLayout').addEventListener('click',resetLayout);
if($('dFitView'))$('dFitView').addEventListener('click',fitView);
if($('dShowValues'))$('dShowValues').addEventListener('change',renderDiagram);
if($('dUseInBalance'))$('dUseInBalance').addEventListener('click',function(){
  if(!last)calculate();
  var map={fbFeed:last.freshFeed,fbHpp:last.hppFlow,fbLpIn:last.pxLpIn,fbRoFeed:last.moduleFeed,fbHpOut:last.pxHpOut,fbPerm:last.permeate,fbHpIn:last.pxHpIn,fbLpOut:last.pxLpOut,fbDirect:last.directReject};
  Object.keys(map).forEach(function(id){var e=$(id);if(e)e.value=fmt(map[id],1);});
  var nav=document.querySelector('[data-nav="balance"]');if(nav)nav.click();
  setTimeout(function(){var run=$('runBalance');if(run)run.click();},60);
});

restorePositions();
calculate();
})();