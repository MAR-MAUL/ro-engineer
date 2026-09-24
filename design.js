(function(){
'use strict';

var byId=function(id){return document.getElementById(id);};
var num=function(id){var e=byId(id);return e?Number(e.value||0):0;};
var fmt=function(v,d){d=d===undefined?1:d;return Number.isFinite(Number(v))?Number(v).toFixed(d):'—';};
var clamp=function(v,a,b){return Math.min(b,Math.max(a,v));};
var copy=function(v){return JSON.parse(JSON.stringify(v));};
var osmoticBar=function(tds,temp){return Math.max(0,0.00077*Number(tds||0)*((Number(temp||25)+273.15)/298.15));};

var activeTemplate='px';
var last=null;
var layout={nodes:{},labels:{},routes:{},arrows:{},locked:false};

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

function key(){return 'ro-engineer-layout-v3-'+activeTemplate;}
function resetLayoutState(){
  layout={nodes:copy(templates[activeTemplate].nodes),labels:{},routes:{},arrows:{},locked:false};
}
function loadLayout(){
  resetLayoutState();
  try{
    var saved=JSON.parse(localStorage.getItem(key())||'null');
    if(saved&&saved.nodes){
      Object.keys(saved.nodes).forEach(function(id){
        if(layout.nodes[id]){
          layout.nodes[id].x=Number(saved.nodes[id].x);
          layout.nodes[id].y=Number(saved.nodes[id].y);
        }
      });
      layout.labels=saved.labels||{};
      layout.routes=saved.routes||{};
      layout.arrows=saved.arrows||{};
      layout.locked=!!saved.locked;
    }
  }catch(e){}
}
function saveLayout(){
  layout.locked=true;
  try{localStorage.setItem(key(),JSON.stringify({nodes:layout.nodes,labels:layout.labels,routes:layout.routes,arrows:layout.arrows,locked:true}));}catch(e){}
  renderDiagram();
}
function unlockLayout(){
  layout.locked=false;
  renderDiagram();
}
function resetSavedLayout(){
  try{localStorage.removeItem(key());}catch(e){}
  resetLayoutState();
  renderDiagram();
}

function nodeIcon(type){
  return {feed:'↦',filter:'▦',split:'Y',hpp:'▶',blend:'◇',ro:'RO',px:'↻',cp:'▶',product:'≈',reject:'↓'}[type]||'•';
}
function nodeHTML(id,n){
  return '<div class="design-node static-node '+n.type+'" data-node="'+id+'" style="left:'+n.x+'px;top:'+n.y+'px">'+
    '<span class="node-icon">'+nodeIcon(n.type)+'</span><strong>'+n.label+'</strong><small>'+n.sub+'</small></div>';
}
function portPoint(n,port){
  var w=92,h=58;
  if(port==='l')return{x:n.x,y:n.y+h/2};
  if(port==='r')return{x:n.x+w,y:n.y+h/2};
  if(port==='t')return{x:n.x+w/2,y:n.y};
  return{x:n.x+w/2,y:n.y+h};
}
function pathFor(e){
  var a=portPoint(layout.nodes[e.from],e.fp||'r'),b=portPoint(layout.nodes[e.to],e.tp||'l');
  var r=layout.routes[e.id];
  if(r){
    return 'M'+a.x+' '+a.y+' H'+r.x+' V'+r.y+' H'+b.x+' V'+b.y;
  }
  if(e.fp==='b'&&e.tp==='t')return 'M'+a.x+' '+a.y+' V'+((a.y+b.y)/2)+' H'+b.x+' V'+b.y;
  if(e.fp==='t'&&e.tp==='b')return 'M'+a.x+' '+a.y+' V'+((a.y+b.y)/2)+' H'+b.x+' V'+b.y;
  if(e.fp==='b'||e.tp==='b'||e.fp==='t'||e.tp==='t'){
    var midY=(a.y+b.y)/2;
    return 'M'+a.x+' '+a.y+' V'+midY+' H'+b.x+' V'+b.y;
  }
  var midX=(a.x+b.x)/2;
  return 'M'+a.x+' '+a.y+' H'+midX+' V'+b.y+' H'+b.x;
}
function defaultLabelPos(e){
  var a=portPoint(layout.nodes[e.from],e.fp||'r'),b=portPoint(layout.nodes[e.to],e.tp||'l');
  return{x:(a.x+b.x)/2-38,y:(a.y+b.y)/2-18};
}
function markerDefs(){return '<defs></defs>';}

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

function updateLayoutStatus(){
  var stage=byId('designStage'),status=byId('dLayoutStatus');
  if(stage){
    stage.classList.toggle('layout-locked',layout.locked);
    stage.classList.toggle('layout-editing',!layout.locked);
  }
  if(status){
    status.textContent=layout.locked?'Layout saved':'Layout editing';
    status.classList.toggle('saved',layout.locked);
  }
  if(byId('dSaveLayout'))byId('dSaveLayout').disabled=layout.locked;
  if(byId('dArrangeLayout'))byId('dArrangeLayout').disabled=!layout.locked;
}

function drawLinks(){
  var t=templates[activeTemplate],svg=byId('designLinks');
  svg.innerHTML=markerDefs()+t.edges.map(function(e){
    return '<path id="edge-'+e.id+'" data-edge="'+e.id+'" class="design-link '+e.kind+'" d="'+pathFor(e)+'"/>';
  }).join('');
  t.edges.forEach(function(e){drawArrowForEdge(e);});
}
function arrowFraction(id){
  var f=Number(layout.arrows[id]);
  return Number.isFinite(f)?clamp(f,.08,.96):.84;
}
function pathPointInfo(path,fraction){
  var len=path.getTotalLength(),at=clamp(fraction,0,1)*len;
  var p=path.getPointAtLength(at);
  var p1=path.getPointAtLength(Math.max(0,at-1.5));
  var p2=path.getPointAtLength(Math.min(len,at+1.5));
  return {x:p.x,y:p.y,angle:Math.atan2(p2.y-p1.y,p2.x-p1.x)*180/Math.PI};
}
function drawArrowForEdge(e){
  var svg=byId('designLinks'),path=byId('edge-'+e.id);
  if(!svg||!path)return;
  var p=pathPointInfo(path,arrowFraction(e.id));
  var poly=document.createElementNS('http://www.w3.org/2000/svg','polygon');
  poly.setAttribute('points','-2,-1.7 2.4,0 -2,1.7');
  poly.setAttribute('class','design-movable-arrow '+e.kind);
  poly.setAttribute('transform','translate('+p.x+' '+p.y+') rotate('+p.angle+')');
  poly.setAttribute('data-arrow-shape',e.id);
  svg.appendChild(poly);
}
function positionLabels(){
  var t=templates[activeTemplate];
  t.edges.forEach(function(e){
    var el=document.querySelector('[data-stream="'+e.id+'"]');
    if(!el)return;
    var p=layout.labels[e.id]||defaultLabelPos(e);
    el.style.left=p.x+'px';el.style.top=p.y+'px';
  });
}
function renderDiagram(){
  var t=templates[activeTemplate],vals=streamValues(),show=byId('dShowValues')?byId('dShowValues').checked:true;
  byId('dCanvasTitle').textContent=t.title;
  byId('designNodes').innerHTML=Object.keys(layout.nodes).map(function(id){return nodeHTML(id,layout.nodes[id]);}).join('');
  drawLinks();
  byId('designStreamLabels').innerHTML=t.edges.map(function(e){
    var p=layout.labels[e.id]||defaultLabelPos(e),v=vals[e.id]||{};
    return '<div class="stream-label static-stream '+(show?'':'hidden-value')+'" data-stream="'+e.id+'" style="left:'+p.x+'px;top:'+p.y+'px">'+
      '<b>'+e.name+'</b><small>Q '+fmt(v.q,1)+' m³/h · P '+fmt(v.p,1)+' bar</small></div>';
  }).join('')+
  (!layout.locked?t.edges.map(function(e){
    return '<div class="line-route-handle" data-route="'+e.id+'" title="Move line route"></div>'+
           '<div class="line-arrow-handle" data-arrow="'+e.id+'" title="Move arrow position"></div>';
  }).join(''):'');
  updateLayoutStatus();
  positionControlHandles();
  wireDragging();
}

function routeHandlePos(e){
  if(layout.routes[e.id])return layout.routes[e.id];
  var path=byId('edge-'+e.id);
  if(path){
    var p=pathPointInfo(path,.5);
    return {x:p.x,y:p.y};
  }
  return defaultLabelPos(e);
}
function positionControlHandles(){
  if(layout.locked)return;
  var t=templates[activeTemplate];
  t.edges.forEach(function(e){
    var rh=document.querySelector('[data-route="'+e.id+'"]');
    if(rh){
      var rp=routeHandlePos(e);
      rh.style.left=(rp.x-5)+'px';rh.style.top=(rp.y-5)+'px';
    }
    var ah=document.querySelector('[data-arrow="'+e.id+'"]'),path=byId('edge-'+e.id);
    if(ah&&path){
      var ap=pathPointInfo(path,arrowFraction(e.id));
      ah.style.left=(ap.x-6)+'px';ah.style.top=(ap.y-6)+'px';
      ah.style.transform='rotate('+ap.angle+'deg)';
    }
  });
}
function refreshGeometry(){
  drawLinks();
  positionLabels();
  positionControlHandles();
}
function closestFractionOnPath(path,x,y){
  var len=path.getTotalLength(),bestF=.5,bestD=Infinity,steps=90;
  for(var i=0;i<=steps;i++){
    var f=i/steps,p=path.getPointAtLength(len*f);
    var dx=p.x-x,dy=p.y-y,d=dx*dx+dy*dy;
    if(d<bestD){bestD=d;bestF=f;}
  }
  return clamp(bestF,.08,.96);
}
function wireDragging(){
  if(layout.locked)return;
  document.querySelectorAll('.design-node[data-node]').forEach(function(el){
    makeDraggable(el,'node',el.getAttribute('data-node'));
  });
  document.querySelectorAll('.stream-label[data-stream]').forEach(function(el){
    makeDraggable(el,'label',el.getAttribute('data-stream'));
  });
  document.querySelectorAll('.line-route-handle[data-route]').forEach(function(el){
    makeDraggable(el,'route',el.getAttribute('data-route'));
  });
  document.querySelectorAll('.line-arrow-handle[data-arrow]').forEach(function(el){
    makeDraggable(el,'arrow',el.getAttribute('data-arrow'));
  });
}
function makeDraggable(el,kind,id){
  var drag=null;
  el.addEventListener('pointerdown',function(e){
    if(layout.locked)return;
    if(e.button!==undefined&&e.button!==0)return;
    var pos;
    if(kind==='node')pos=layout.nodes[id];
    else if(kind==='label')pos=layout.labels[id]||{x:parseFloat(el.style.left)||0,y:parseFloat(el.style.top)||0};
    else if(kind==='route')pos=routeHandlePos(templates[activeTemplate].edges.find(function(x){return x.id===id;}));
    else pos={x:e.clientX,y:e.clientY};
    drag={sx:e.clientX,sy:e.clientY,x:pos.x,y:pos.y};
    el.classList.add('dragging');
    if(el.setPointerCapture)el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener('pointermove',function(e){
    if(!drag||layout.locked)return;
    var stage=byId('designStage'),rect=stage.getBoundingClientRect();
    var px=clamp(e.clientX-rect.left,4,1032),py=clamp(e.clientY-rect.top,4,472);
    if(kind==='node'){
      var x=clamp(drag.x+(e.clientX-drag.sx),4,940),y=clamp(drag.y+(e.clientY-drag.sy),4,420);
      layout.nodes[id].x=x;layout.nodes[id].y=y;el.style.left=x+'px';el.style.top=y+'px';
      refreshGeometry();
    }else if(kind==='label'){
      var lx=clamp(drag.x+(e.clientX-drag.sx),4,950),ly=clamp(drag.y+(e.clientY-drag.sy),4,440);
      layout.labels[id]={x:lx,y:ly};el.style.left=lx+'px';el.style.top=ly+'px';
    }else if(kind==='route'){
      layout.routes[id]={x:px,y:py};
      refreshGeometry();
    }else if(kind==='arrow'){
      var path=byId('edge-'+id);
      if(path){
        layout.arrows[id]=closestFractionOnPath(path,px,py);
        refreshGeometry();
      }
    }
  });
  function end(){
    if(!drag)return;
    drag=null;el.classList.remove('dragging');
  }
  el.addEventListener('pointerup',end);
  el.addEventListener('pointercancel',end);
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
  var operatingHours=clamp(num('dOperatingHours')||24,1,24);
  var dutyTrains=Math.max(1,Math.round(num('dDutyTrains')||1));
  var plantPermeate=capacity/operatingHours;
  var permeate=plantPermeate/dutyTrains;
  var recovery=clamp(num('dRecovery')/100,.01,.95);
  var feedTds=Math.max(0,num('dFeedTds')),productTds=Math.max(0,num('dProductTds')),temp=num('dTemp');
  var roP=Math.max(0,num('dRoPressure')),feedP=Math.max(0,num('dFeedPressure')),rejectP=Math.max(0,num('dRejectPressure'));
  var feedLineLoss=Math.max(0,num('dFeedLineLoss')),permBack=Math.max(0,num('dPermBackPressure'));
  var vessels=Math.max(1,Math.round(num('dVessels'))),epv=Math.max(1,Math.round(num('dElementsPerVessel'))),areaEach=Math.max(1,num('dElementArea'));
  var elements=vessels*epv,area=elements*areaEach,hppEff=clamp(num('dHppEff')/100,.01,1),cpEff=clamp(num('dCpEff')/100,.01,1);
  var motorEff=clamp(num('dMotorEff')/100,.01,1),vfdEff=clamp(num('dVfdEff')/100,.01,1);
  var pxEff=clamp(num('dPxEff')/100,.01,1),fraction=clamp(num('dPxFraction')/100,0,.98);
  var passes=Math.max(1,Math.round(num('dPasses')||1)),stages=Math.max(1,Math.round(num('dStages')||1));
  var fluxLimit=Math.max(0,num('dFluxLimit'));
  var ph=num('dPh'),sdi=num('dSdi'),turbidity=num('dTurbidity'),conductivity=num('dConductivity');
  var boron=num('dBoron'),productBoron=num('dProductBoron');
  var feedSource=byId('dFeedSource')?byId('dFeedSource').value:'';
  var ca=num('dCa'),mg=num('dMg'),so4=num('dSo4'),hco3=num('dHco3'),silica=num('dSilica'),iron=num('dIron');
  var freshFeed=permeate/recovery,feed=freshFeed,reject=Math.max(0,freshFeed-permeate),moduleFeed=feed;
  var pxHpIn=0,pxLpIn=0,pxHpOut=0,pxLpOut=0,directReject=reject,hppFlow=feed,cpFlow=0,pxOutP=feedP;
  var recycleFlow=0,membraneConcentrate=reject,mixedTds=feedTds,recycleRejectTds=reject>0?(feed*feedTds-permeate*productTds)/reject:0;

  if(activeTemplate==='px'){
    pxHpIn=reject*fraction;pxLpIn=pxHpIn;pxHpOut=pxLpIn;pxLpOut=pxHpIn;directReject=reject-pxHpIn;
    hppFlow=Math.max(0,feed-pxLpIn);cpFlow=pxHpOut;moduleFeed=hppFlow+cpFlow;
    pxOutP=feedP+pxEff*Math.max(0,rejectP-feedP);
  }else if(activeTemplate==='recycle'){
    if(fraction>.75){fraction=.30;byId('dPxFraction').value=30;}
    membraneConcentrate=reject/Math.max(.02,1-fraction);
    recycleFlow=membraneConcentrate*fraction;moduleFeed=freshFeed+recycleFlow;feed=moduleFeed;hppFlow=moduleFeed;
    recycleRejectTds=membraneConcentrate>0?(moduleFeed*feedTds-permeate*productTds)/membraneConcentrate:0;
    mixedTds=moduleFeed>0?(freshFeed*feedTds+recycleFlow*recycleRejectTds)/moduleFeed:feedTds;
  }

  var rejectTds=reject>0?(freshFeed*feedTds-permeate*productTds)/reject:0;
  var pumpDischargeP=roP+feedLineLoss;
  var hppHydraulic=hppFlow*Math.max(0,pumpDischargeP-feedP)/(36*hppEff);
  var cpHydraulic=cpFlow*Math.max(0,pumpDischargeP-pxOutP)/(36*cpEff);
  var hppPower=hppHydraulic/(motorEff*vfdEff),cpPower=cpHydraulic/(motorEff*vfdEff);
  var totalPower=hppPower+cpPower,totalPlantPower=totalPower*dutyTrains;
  var sec=plantPermeate>0?totalPlantPower/plantPermeate:0;
  var flux=area>0?permeate*1000/area:0,rejectionReq=feedTds>0?(1-productTds/feedTds)*100:0;
  var feedOsmotic=osmoticBar(feedTds,temp),rejectOsmotic=osmoticBar(rejectTds,temp),productOsmotic=osmoticBar(productTds,temp);
  var avgHydraulic=((roP+rejectP)/2)-permBack;
  var avgOsmotic=((feedOsmotic+rejectOsmotic)/2)-productOsmotic;
  var ndp=avgHydraulic-avgOsmotic,roDp=Math.max(0,roP-rejectP);

  last={capacity:capacity,permeate:permeate,recovery:recovery,freshFeed:freshFeed,feed:feed,reject:reject,moduleFeed:moduleFeed,
    feedTds:feedTds,productTds:productTds,rejectTds:rejectTds,temp:temp,roP:roP,feedP:feedP,rejectP:rejectP,
    vessels:vessels,epv:epv,elements:elements,area:area,flux:flux,rejectionReq:rejectionReq,
    pxHpIn:pxHpIn,pxLpIn:pxLpIn,pxHpOut:pxHpOut,pxLpOut:pxLpOut,directReject:directReject,hppFlow:hppFlow,cpFlow:cpFlow,pxOutP:pxOutP,
    hppPower:hppPower,cpPower:cpPower,totalPower:totalPower,totalPlantPower:totalPlantPower,sec:sec,recycleFlow:recycleFlow,membraneConcentrate:membraneConcentrate,
    mixedTds:mixedTds,recycleRejectTds:recycleRejectTds,fraction:fraction,
    operatingHours:operatingHours,dutyTrains:dutyTrains,plantPermeate:plantPermeate,passes:passes,stages:stages,fluxLimit:fluxLimit,
    feedLineLoss:feedLineLoss,permBack:permBack,pumpDischargeP:pumpDischargeP,feedOsmotic:feedOsmotic,rejectOsmotic:rejectOsmotic,
    productOsmotic:productOsmotic,avgOsmotic:avgOsmotic,ndp:ndp,roDp:roDp,ph:ph,sdi:sdi,turbidity:turbidity,conductivity:conductivity,
    boron:boron,productBoron:productBoron,feedSource:feedSource,ca:ca,mg:mg,so4:so4,hco3:hco3,silica:silica,iron:iron};

  renderDiagram();
  renderResults();
}

function renderResults(){
  var t=templates[activeTemplate],vals=streamValues();
  var head='<thead><tr><th>Stream · per active train</th>'+t.edges.map(function(e){return '<th>'+e.name+'</th>';}).join('')+'</tr></thead>';
  function row(name,key,d){
    return '<tr><td>'+name+'</td>'+t.edges.map(function(e){
      var v=vals[e.id]||{},value=key==='temp'?last.temp:v[key];
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
  if(activeTemplate==='px')checks.push(check(Math.abs(last.moduleFeed-last.freshFeed)<.05?'good':'bad','PX/HPP flow balance','HPP + CP = '+fmt(last.moduleFeed,1)+' m³/h versus feed '+fmt(last.freshFeed,1)+' m³/h.'));
  if(activeTemplate==='recycle')checks.push(check('warn','Recirculation needs full chemistry model','Recycle increases module feed salinity and scaling potential. Full ionic mass balance is required before final design.'));

  if(last.fluxLimit>0&&last.flux>last.fluxLimit)checks.push(check('warn','Flux exceeds your design limit','Average flux is '+fmt(last.flux,1)+' LMH versus the entered limit of '+fmt(last.fluxLimit,1)+' LMH. Increase membrane area or reduce per-train production.'));
  else if(last.fluxLimit>0)checks.push(check('good','Flux is within the entered design limit','Average flux is '+fmt(last.flux,1)+' LMH versus a '+fmt(last.fluxLimit,1)+' LMH limit.'));

  if(last.sdi>5)checks.push(check('bad','High SDI15 for RO feed','SDI15 is '+fmt(last.sdi,1)+'. Pretreatment performance should be improved before accepting the membrane design.'));
  else if(last.sdi>3)checks.push(check('warn','SDI15 needs attention','SDI15 is '+fmt(last.sdi,1)+'. Check the selected membrane guideline and fouling allowance.'));
  else checks.push(check('good','SDI15 is suitable for preliminary screening','Entered SDI15 is '+fmt(last.sdi,1)+'.'));

  if(last.turbidity>1)checks.push(check('warn','Feed turbidity is high for a final RO feed','Entered turbidity is '+fmt(last.turbidity,1)+' NTU. Confirm particle filtration and pretreatment performance.'));

  if(last.ndp<=0)checks.push(check('bad','Insufficient preliminary net driving pressure','The approximate net driving pressure is '+fmt(last.ndp,1)+' bar. Review feed pressure, concentrate pressure, salinity and permeate backpressure.'));
  else checks.push(check('good','Preliminary net driving pressure is positive','Approximate NDP is '+fmt(last.ndp,1)+' bar. Final pressure must come from the membrane projection.'));

  if(last.passes>1)checks.push(check('warn','Second pass selected','The input is captured, but the current process canvas calculates the first pass only. A dedicated second-pass membrane projection will be added before treating this as a final two-pass design.'));
  if(last.productBoron>0&&last.boron>0&&last.productBoron<last.boron&&last.passes===1&&last.feedTds>20000)checks.push(check('warn','Boron target requires membrane-specific verification','Feed boron is '+fmt(last.boron,2)+' mg/L and target product boron is '+fmt(last.productBoron,2)+' mg/L. One-pass SWRO boron performance is temperature, pH and membrane dependent.'));

  if(last.feedSource==='open_sea')checks.push(check('warn','Open seawater intake selected','Confirm robust pretreatment for suspended solids, biological loading and seasonal changes.'));
  if(last.ca<=0||last.mg<=0||last.so4<=0||last.hco3<=0)checks.push(check('warn','Water analysis is incomplete','Calcium, magnesium, sulfate and bicarbonate should be entered for scaling assessment.'));
  else checks.push(check('good','Core scaling ions are captured','Calcium, magnesium, sulfate and bicarbonate are available for the detailed chemistry model.'));

  checks.push(check('warn','Manufacturer projection still required','This canvas performs hydraulic and design screening. Final element flux, ion passage, pressure drop, scaling, boron and product quality need vendor-specific projection data.'));
  byId('dDesignChecks').innerHTML=checks.join('');

  byId('dEnergySummary').innerHTML=
    summaryRow('Plant product rate',fmt(last.plantPermeate,1),'m³/h')+
    summaryRow('Duty trains',fmt(last.dutyTrains,0),'ea')+
    summaryRow('Product / train',fmt(last.permeate,1),'m³/h')+
    summaryRow('HPP flow / train',fmt(last.hppFlow,1),'m³/h')+
    summaryRow('HPP electrical power',fmt(last.hppPower,1),'kW/train')+
    summaryRow('CP electrical power',fmt(last.cpPower,1),'kW/train')+
    summaryRow('Plant RO power',fmt(last.totalPlantPower,1),'kW')+
    summaryRow('Specific energy',fmt(last.sec,2),'kWh/m³')+
    summaryRow('RO pressure drop',fmt(last.roDp,1),'bar')+
    summaryRow('Approx. feed osmotic pressure',fmt(last.feedOsmotic,1),'bar')+
    summaryRow('Approx. NDP',fmt(last.ndp,1),'bar');
}

function setTemplate(name){
  activeTemplate=templates[name]?name:'px';
  if(activeTemplate==='recycle'&&num('dPxFraction')>75)byId('dPxFraction').value=30;
  loadLayout();
  calculate();
}

[
  'dCapacity','dRecovery','dFeedTds','dTemp','dRoPressure','dProductTds','dVessels','dElementsPerVessel',
  'dElementArea','dWaterType','dPxFraction','dPxEff','dRejectPressure','dFeedPressure','dHppEff','dCpEff',
  'dFeedSource','dDutyTrains','dOperatingHours','dPasses','dStages','dFluxLimit','dPh','dSdi','dTurbidity','dConductivity',
  'dBoron','dProductBoron','dFeedLineLoss','dPermBackPressure','dMotorEff','dVfdEff','dMembraneModel','dCa','dMg','dSo4','dHco3','dSilica','dIron'
].forEach(function(id){
  var e=byId(id);
  if(e){e.addEventListener('input',calculate);e.addEventListener('change',calculate);}
});

if(byId('dTemplate'))byId('dTemplate').addEventListener('change',function(){setTemplate(this.value);});
if(byId('dCalculate'))byId('dCalculate').addEventListener('click',calculate);
if(byId('dShowValues'))byId('dShowValues').addEventListener('change',renderDiagram);
if(byId('dArrangeLayout'))byId('dArrangeLayout').addEventListener('click',unlockLayout);
if(byId('dSaveLayout'))byId('dSaveLayout').addEventListener('click',saveLayout);
if(byId('dResetLayout'))byId('dResetLayout').addEventListener('click',resetSavedLayout);

if(byId('dUseInBalance'))byId('dUseInBalance').addEventListener('click',function(){
  if(!last)calculate();
  var map={fbFeed:last.freshFeed,fbHpp:last.hppFlow,fbLpIn:last.pxLpIn,fbRoFeed:last.moduleFeed,fbHpOut:last.pxHpOut,fbPerm:last.permeate,fbHpIn:last.pxHpIn,fbLpOut:last.pxLpOut,fbDirect:last.directReject};
  Object.keys(map).forEach(function(id){var e=byId(id);if(e)e.value=fmt(map[id],1);});
  var nav=document.querySelector('[data-nav="balance"]');if(nav)nav.click();
  setTimeout(function(){var run=byId('runBalance');if(run)run.click();},60);
});

loadLayout();
calculate();
})();