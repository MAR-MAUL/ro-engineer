(function(){
'use strict';

var byId=function(id){return document.getElementById(id);};
var n=function(id){var e=byId(id);return e?Number(e.value||0):0;};
var fmt=function(v,d){d=d===undefined?1:d;return Number.isFinite(Number(v))?Number(v).toFixed(d):'—';};
var clamp=function(v,a,b){return Math.min(b,Math.max(a,v));};
var copy=function(v){return JSON.parse(JSON.stringify(v));};

var baseNodes={
  feed:{type:'feed',label:'Feed',sub:'Measured total feed',x:20,y:190},
  particle:{type:'filter',label:'Particle Filter',sub:'Pretreatment',x:135,y:190},
  bag:{type:'filter',label:'Bag Filter',sub:'Fine filtration',x:250,y:190},
  split:{type:'split',label:'Split',sub:'HPP / PX split',x:365,y:190},
  hpp:{type:'hpp',label:'HPP',sub:'High pressure branch',x:485,y:80},
  blend:{type:'blend',label:'RO Header',sub:'HPP + CP',x:635,y:80},
  ro:{type:'ro',label:'RO Train',sub:'Membrane balance',x:785,y:80},
  product:{type:'product',label:'Product',sub:'Permeate',x:920,y:80},
  px:{type:'px',label:'PX',sub:'Pressure exchanger',x:500,y:315},
  cp:{type:'cp',label:'CP',sub:'Circulation pump',x:650,y:315},
  reject:{type:'reject',label:'Reject',sub:'Combined discharge',x:900,y:335}
};

var edges=[
  {id:'s1',from:'feed',to:'particle',fp:'r',tp:'l',kind:'feed',name:'Total Feed',input:'fbFeed'},
  {id:'s2',from:'particle',to:'bag',fp:'r',tp:'l',kind:'feed',name:'Particle Filter OUT',input:'fbFeed'},
  {id:'s3',from:'bag',to:'split',fp:'r',tp:'l',kind:'feed',name:'Bag Filter OUT',input:'fbFeed'},
  {id:'s4',from:'split',to:'hpp',fp:'t',tp:'l',kind:'feed',name:'HPP Branch',input:'fbHpp'},
  {id:'s5',from:'hpp',to:'blend',fp:'r',tp:'l',kind:'feed',name:'HPP OUT',input:'fbHpp'},
  {id:'s6',from:'split',to:'px',fp:'b',tp:'l',kind:'feed',name:'PX LP IN',input:'fbLpIn'},
  {id:'s7',from:'px',to:'cp',fp:'r',tp:'l',kind:'feed',name:'PX HP OUT',input:'fbHpOut'},
  {id:'s8',from:'cp',to:'blend',fp:'t',tp:'b',kind:'feed',name:'CP OUT',input:'fbHpOut'},
  {id:'s9',from:'blend',to:'ro',fp:'r',tp:'l',kind:'feed',name:'RO Feed Header',input:'fbRoFeed'},
  {id:'s10',from:'ro',to:'product',fp:'r',tp:'l',kind:'product',name:'Permeate',input:'fbPerm'},
  {id:'s11',from:'ro',to:'px',fp:'b',tp:'r',kind:'reject',name:'PX HP IN',input:'fbHpIn'},
  {id:'s12',from:'px',to:'reject',fp:'b',tp:'l',kind:'reject',name:'PX LP OUT',input:'fbLpOut'},
  {id:'s13',from:'ro',to:'reject',fp:'b',tp:'t',kind:'reject',name:'Direct Reject',input:'fbDirect'}
];

var layout={nodes:copy(baseNodes),labels:{},routes:{},arrows:{},locked:false};
var storageKey='ro-engineer-flow-balance-layout-v1';

function loadLayout(){
  layout={nodes:copy(baseNodes),labels:{},routes:{},arrows:{},locked:false};
  try{
    var saved=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(saved){
      if(saved.nodes)Object.keys(saved.nodes).forEach(function(id){
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
  try{localStorage.setItem(storageKey,JSON.stringify(layout));}catch(e){}
  render();
}
function unlockLayout(){layout.locked=false;render();}
function resetLayout(){
  try{localStorage.removeItem(storageKey);}catch(e){}
  layout={nodes:copy(baseNodes),labels:{},routes:{},arrows:{},locked:false};
  render();
}

function icon(type){
  return {feed:'↦',filter:'▦',split:'Y',hpp:'▶',blend:'◇',ro:'RO',px:'↻',cp:'▶',product:'≈',reject:'↓'}[type]||'•';
}
function nodeHtml(id,o){
  return '<div class="design-node static-node '+o.type+'" data-fb-node="'+id+'" style="left:'+o.x+'px;top:'+o.y+'px">'+
    '<span class="node-icon">'+icon(o.type)+'</span><strong>'+o.label+'</strong><small>'+o.sub+'</small></div>';
}
function portPoint(o,port){
  var w=92,h=58;
  if(port==='l')return{x:o.x,y:o.y+h/2};
  if(port==='r')return{x:o.x+w,y:o.y+h/2};
  if(port==='t')return{x:o.x+w/2,y:o.y};
  return{x:o.x+w/2,y:o.y+h};
}
function pathFor(e){
  var a=portPoint(layout.nodes[e.from],e.fp||'r'),b=portPoint(layout.nodes[e.to],e.tp||'l'),r=layout.routes[e.id];
  if(r)return 'M'+a.x+' '+a.y+' H'+r.x+' V'+r.y+' H'+b.x+' V'+b.y;
  if(e.fp==='b'&&e.tp==='t')return 'M'+a.x+' '+a.y+' V'+((a.y+b.y)/2)+' H'+b.x+' V'+b.y;
  if(e.fp==='t'&&e.tp==='b')return 'M'+a.x+' '+a.y+' V'+((a.y+b.y)/2)+' H'+b.x+' V'+b.y;
  if(e.fp==='b'||e.tp==='b'||e.fp==='t'||e.tp==='t'){
    var midY=(a.y+b.y)/2;
    return 'M'+a.x+' '+a.y+' V'+midY+' H'+b.x+' V'+b.y;
  }
  var midX=(a.x+b.x)/2;
  return 'M'+a.x+' '+a.y+' H'+midX+' V'+b.y+' H'+b.x;
}
function defaultLabel(e){
  var a=portPoint(layout.nodes[e.from],e.fp||'r'),b=portPoint(layout.nodes[e.to],e.tp||'l');
  return{x:(a.x+b.x)/2-38,y:(a.y+b.y)/2-18};
}
function arrowFraction(id){
  var f=Number(layout.arrows[id]);
  return Number.isFinite(f)?clamp(f,.08,.96):.84;
}
function pathPoint(path,f){
  var len=path.getTotalLength(),at=clamp(f,0,1)*len;
  var p=path.getPointAtLength(at),p1=path.getPointAtLength(Math.max(0,at-1.5)),p2=path.getPointAtLength(Math.min(len,at+1.5));
  return{x:p.x,y:p.y,angle:Math.atan2(p2.y-p1.y,p2.x-p1.x)*180/Math.PI};
}
function streamValue(e){return n(e.input);}

function drawLinks(){
  var svg=byId('balanceLinks');
  if(!svg)return;
  svg.innerHTML=edges.map(function(e){
    return '<path id="fb-edge-'+e.id+'" data-fb-edge="'+e.id+'" class="design-link '+e.kind+'" d="'+pathFor(e)+'"/>';
  }).join('');
  edges.forEach(function(e){
    var path=byId('fb-edge-'+e.id);if(!path)return;
    var p=pathPoint(path,arrowFraction(e.id));
    var poly=document.createElementNS('http://www.w3.org/2000/svg','polygon');
    poly.setAttribute('points','-2,-1.7 2.4,0 -2,1.7');
    poly.setAttribute('class','design-movable-arrow '+e.kind);
    poly.setAttribute('transform','translate('+p.x+' '+p.y+') rotate('+p.angle+')');
    svg.appendChild(poly);
  });
}

function updateStatus(){
  var stage=byId('balanceStage'),status=byId('fbLayoutStatus');
  if(stage){
    stage.classList.toggle('layout-locked',layout.locked);
    stage.classList.toggle('layout-editing',!layout.locked);
  }
  if(status){
    status.textContent=layout.locked?'Layout saved':'Layout editing';
    status.classList.toggle('saved',layout.locked);
  }
  if(byId('fbSaveLayout'))byId('fbSaveLayout').disabled=layout.locked;
  if(byId('fbArrangeLayout'))byId('fbArrangeLayout').disabled=!layout.locked;
}
function routeHandlePos(e){
  if(layout.routes[e.id])return layout.routes[e.id];
  var path=byId('fb-edge-'+e.id);
  if(path)return pathPoint(path,.5);
  return defaultLabel(e);
}
function positionControls(){
  if(layout.locked)return;
  edges.forEach(function(e){
    var rh=document.querySelector('[data-fb-route="'+e.id+'"]');
    if(rh){
      var rp=routeHandlePos(e);
      rh.style.left=(rp.x-5)+'px';rh.style.top=(rp.y-5)+'px';
    }
    var ah=document.querySelector('[data-fb-arrow="'+e.id+'"]'),path=byId('fb-edge-'+e.id);
    if(ah&&path){
      var ap=pathPoint(path,arrowFraction(e.id));
      ah.style.left=(ap.x-6)+'px';ah.style.top=(ap.y-6)+'px';
      ah.style.transform='rotate('+ap.angle+'deg)';
    }
  });
}
function positionLabels(){
  edges.forEach(function(e){
    var el=document.querySelector('[data-fb-stream="'+e.id+'"]');
    if(!el)return;
    var p=layout.labels[e.id]||defaultLabel(e);
    el.style.left=p.x+'px';el.style.top=p.y+'px';
  });
}
function refreshGeometry(){drawLinks();positionLabels();positionControls();}

function render(){
  if(!byId('balanceStage'))return;
  var show=byId('fbShowValues')?byId('fbShowValues').checked:true;
  byId('balanceNodes').innerHTML=Object.keys(layout.nodes).map(function(id){return nodeHtml(id,layout.nodes[id]);}).join('');
  drawLinks();
  byId('balanceStreamLabels').innerHTML=edges.map(function(e){
    var p=layout.labels[e.id]||defaultLabel(e);
    return '<div class="stream-label static-stream '+(show?'':'hidden-value')+'" data-fb-stream="'+e.id+'" data-fb-input="'+e.input+'" style="left:'+p.x+'px;top:'+p.y+'px">'+
      '<b>'+e.name+'</b><small>'+fmt(streamValue(e),1)+' m³/h</small></div>';
  }).join('')+
  (!layout.locked?edges.map(function(e){
    return '<div class="line-route-handle" data-fb-route="'+e.id+'" title="Move line route"></div>'+
      '<div class="line-arrow-handle" data-fb-arrow="'+e.id+'" title="Move arrow position"></div>';
  }).join(''):'');
  updateStatus();positionControls();wireDragging();
}

function wireDragging(){
  if(layout.locked)return;
  document.querySelectorAll('[data-fb-node]').forEach(function(el){makeDrag(el,'node',el.getAttribute('data-fb-node'));});
  document.querySelectorAll('[data-fb-stream]').forEach(function(el){makeDrag(el,'label',el.getAttribute('data-fb-stream'));});
  document.querySelectorAll('[data-fb-route]').forEach(function(el){makeDrag(el,'route',el.getAttribute('data-fb-route'));});
  document.querySelectorAll('[data-fb-arrow]').forEach(function(el){makeDrag(el,'arrow',el.getAttribute('data-fb-arrow'));});
}
function closestFraction(path,x,y){
  var len=path.getTotalLength(),best=.5,bestD=Infinity,steps=90;
  for(var i=0;i<=steps;i++){
    var f=i/steps,p=path.getPointAtLength(len*f),dx=p.x-x,dy=p.y-y,d=dx*dx+dy*dy;
    if(d<bestD){bestD=d;best=f;}
  }
  return clamp(best,.08,.96);
}
function makeDrag(el,kind,id){
  var drag=null;
  el.addEventListener('pointerdown',function(e){
    if(layout.locked)return;
    if(e.button!==undefined&&e.button!==0)return;
    var pos;
    if(kind==='node')pos=layout.nodes[id];
    else if(kind==='label')pos=layout.labels[id]||{x:parseFloat(el.style.left)||0,y:parseFloat(el.style.top)||0};
    else if(kind==='route')pos=routeHandlePos(edges.find(function(x){return x.id===id;}));
    else pos={x:0,y:0};
    drag={sx:e.clientX,sy:e.clientY,x:pos.x,y:pos.y};
    el.classList.add('dragging');
    if(el.setPointerCapture)el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener('pointermove',function(e){
    if(!drag||layout.locked)return;
    var stage=byId('balanceStage'),rect=stage.getBoundingClientRect(),px=clamp(e.clientX-rect.left,4,1032),py=clamp(e.clientY-rect.top,4,472);
    if(kind==='node'){
      var x=clamp(drag.x+(e.clientX-drag.sx),4,940),y=clamp(drag.y+(e.clientY-drag.sy),4,420);
      layout.nodes[id].x=x;layout.nodes[id].y=y;el.style.left=x+'px';el.style.top=y+'px';refreshGeometry();
    }else if(kind==='label'){
      var lx=clamp(drag.x+(e.clientX-drag.sx),4,950),ly=clamp(drag.y+(e.clientY-drag.sy),4,440);
      layout.labels[id]={x:lx,y:ly};el.style.left=lx+'px';el.style.top=ly+'px';
    }else if(kind==='route'){
      layout.routes[id]={x:px,y:py};refreshGeometry();
    }else{
      var path=byId('fb-edge-'+id);
      if(path){layout.arrows[id]=closestFraction(path,px,py);refreshGeometry();}
    }
  });
  function end(){if(!drag)return;drag=null;el.classList.remove('dragging');}
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}

['fbFeed','fbHpp','fbLpIn','fbRoFeed','fbHpOut','fbPerm','fbHpIn','fbLpOut','fbDirect'].forEach(function(id){
  var el=byId(id);if(el)el.addEventListener('input',render);
});
if(byId('runBalance'))byId('runBalance').addEventListener('click',function(){setTimeout(render,0);});
if(byId('loadBalancedExample'))byId('loadBalancedExample').addEventListener('click',function(){setTimeout(render,0);});
if(byId('fbShowValues'))byId('fbShowValues').addEventListener('change',render);
if(byId('fbArrangeLayout'))byId('fbArrangeLayout').addEventListener('click',unlockLayout);
if(byId('fbSaveLayout'))byId('fbSaveLayout').addEventListener('click',saveLayout);
if(byId('fbResetLayout'))byId('fbResetLayout').addEventListener('click',resetLayout);

loadLayout();
render();
})();