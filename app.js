
(function(){
'use strict';
var $=function(s){return document.querySelector(s);};
var $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s));};
var byId=function(id){return document.getElementById(id);};
var n=function(id){var e=byId(id);return e?Number(e.value||0):0;};
var fmt=function(v,d){d=d===undefined?1:d;return Number.isFinite(Number(v))?Number(v).toFixed(d):'—';};
var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};

var T={lowInlet:1.5,lowRaw:2.5,lowFeed:150,lowBooster:85,highModule:60,highModuleDp:3,pxDp:2,bagDp:1.1,productPhHigh:7};

var alarms=[
{id:'low-inlet',group:'Pressure',severity:'warning',tag:'PIT 3 / PIT 7',title:'Low inlet pressure',trigger:'Feed pressure below 1.5 bar',short:'Verify pressure measurement, borehole/network pressure and bypass position.',causes:['Pressure transmitter fault','Low network pressure','Bypass valve'],engineering:'low-inlet',procedure:['Check the condition of the pressure transmitter.','Compare SCADA pressure with the pressure transmitter/local indication.','Check the status of boreholes in operation.','Increase the number of boreholes in operation when low network pressure is confirmed.','Confirm the bypass valve is closed.','Inform the supervisor if the fault cannot be rectified.']},
{id:'low-feed',group:'Flow',severity:'warning',tag:'FIT01',title:'Low feed flow',trigger:'Feed flow below 150 m³/h',short:'Check feed valve, source pressure and the feed flowmeter.',causes:['Feed valve / micro-switch fault','Low network pressure','Flowmeter fault'],engineering:'generic',procedure:['Make sure the feed valve is fully opened.','If network pressure is low, increase the number of boreholes in operation.','Compare SCADA flow with the local flowmeter.','Check the condition of the flowmeter.','Inform the supervisor if the fault cannot be rectified.']},
{id:'low-booster',group:'Flow',severity:'warning',tag:'FIT03 / FIT05',title:'Low booster flow',trigger:'Booster flow below 85 m³/h',short:'Check startup condition, flowmeter, PX condition and circulation pump.',causes:['Initial operation condition','Flowmeter fault','Pressure exchanger fault','Circulation pump fault'],engineering:'low-booster',procedure:['If this occurs during initial operation, check membrane differential pressure before changing any temporary setpoint.','Compare SCADA flow with the local flowmeter and check the flowmeter condition.','Check pressure-exchanger noise.','Check PX differential pressure; the plant procedure states it should be below 2 bar.','Check pressure-exchanger reject conductivity.','Check circulation-pump VFD status and current.','Record findings and inform the supervisor.']},
{id:'high-module',group:'Pressure',severity:'shutdown',tag:'PIT04',title:'High module feed pressure',trigger:'Module feed pressure reaches 60 bar',short:'Confirm the pressure, then distinguish RO resistance from reject-side backpressure.',causes:['Pressure transmitter fault','Pressure exchanger fault','Circulation pump fault'],engineering:'high-module',procedure:['Compare SCADA pressure with the pressure transmitter/local indication.','Check the condition of the pressure instrument.','Check pressure-exchanger noise.','Check PX differential pressure; the guide states it should be below 2 bar.','Check pressure-exchanger reject conductivity.','Check circulation-pump VFD status and current.','Record findings and inform the supervisor.']},
{id:'low-raw',group:'Pressure',severity:'warning',tag:'PIT01',title:'Low raw-water inlet pressure',trigger:'Raw-water pressure below 2.5 bar',short:'Confirm the pressure transmitter, then check borehole availability.',causes:['Pressure transmitter fault','Low network pressure'],engineering:'generic',procedure:['Compare SCADA pressure with the pressure transmitter/local indication.','Check the condition of the pressure transmitter.','Check the status of boreholes in operation.','Increase the number of boreholes in operation when low network pressure is confirmed.']},
{id:'high-module-dp',group:'Pressure',severity:'warning',tag:'RO ΔP',title:'High module differential pressure',trigger:'Module differential pressure reaches 3 bar',short:'Verify both pressure readings and localize the added hydraulic resistance.',causes:['Pressure transmitter fault','Pressure exchanger fault','Circulation pump fault'],engineering:'high-module-dp',procedure:['Verify the relevant inlet and reject pressure indications.','Check pressure-exchanger noise.','Check PX differential pressure; the guide states it should be below 2 bar.','Check pressure-exchanger reject conductivity.','Check circulation-pump VFD status and current.','Record findings and inform the supervisor.']},
{id:'valve',group:'Valves',severity:'warning',tag:'Valve feedback',title:'Valve open / close failure',trigger:'Valve fails to open or close for 30 seconds',short:'Retry the approved command, verify physical movement and check the pilot/pneumatic side.',causes:['Operational fault','Pilot valve set fault'],engineering:'generic',procedure:['Try to operate the valve manually from SCADA using the approved command.','Check physical valve status.','For a suspected pilot-valve fault, verify the pilot/pneumatic condition.','Relieve pneumatic pressure only under the approved isolation procedure.','Record findings and inform the supervisor.']},
{id:'product-pressure',group:'Pressure',severity:'warning',tag:'PIT11',title:'High product / permeate pressure',trigger:'High product pressure',short:'Check permeate valve condition before investigating module integrity.',causes:['Permeate valve','Membrane or connector damage'],engineering:'generic',procedure:['Check permeate valve status.','Record findings and inform the supervisor.','If product-side hydraulics are normal, check modules individually for membrane/interconnector/end-connector damage where symptoms support it.']},
{id:'self-filter-fault',group:'Filters',severity:'warning',tag:'Warning 12',title:'Self-cleaning filter fault',trigger:'Self-cleaning filter stops functioning',short:'Check position feedback and whether the filter motor is hot or jammed.',causes:['No feedback from filter position sensor','Motor not turning'],engineering:'generic',procedure:['Check whether the filter position-sensor light is on.','If both sensor lights are off, report to the supervisor.','Check whether the motor is hot or jammed.','If the motor is hot or jammed, inform the supervisor.']},
{id:'panel-isolator',group:'Electrical',severity:'warning',tag:'Warning 10 / 11',title:'Panel isolator switch set to OFF',trigger:'RO panel isolator switch in OFF position',short:'Check motor physical condition before returning the switch to Auto.',causes:['Switch set to OFF'],engineering:'generic',procedure:['Check the motor physical condition.','Return the switch to Auto position when appropriate.']},
{id:'self-filter-dp',group:'Filters',severity:'warning',tag:'PIT01 - PIT02',title:'Self-cleaning filter DP high',trigger:'High differential pressure across self-cleaning filter',short:'Verify PTs, flushing behavior and whether adjacent plants show the same condition.',causes:['Pressure transmitter fault','High particle density / filter blockage','Common source condition'],engineering:'generic',procedure:['Check the condition of the pressure transmitters and compare SCADA with local indications.','Monitor flushing intervals.','If the system continues flushing for more than one hour without stopping, inform the supervisor.','Compare differential pressure and flushing behavior with adjacent plants.','If only this plant is flushing, clean/inspect the filter.','If adjacent plants are also flushing, investigate the common borehole/source condition with supervisor approval.']},
{id:'bag-filter-dp',group:'Filters',severity:'warning',tag:'PIT02-PIT03 / PIT02-PIT07',title:'Bag-filter DP high',trigger:'Bag-filter DP above 1.1 bar',short:'Change the bag filter if blocked; verify PTs if the reading does not fit the plant condition.',causes:['Filter blockage','Pressure transmitter fault'],engineering:'generic',procedure:['Change/inspect the bag filter when blockage is confirmed.','Check the condition of the pressure transmitters.','Compare SCADA pressures with local/transmitter indications.','Inform the supervisor if the reading remains inconsistent.']},
{id:'conductivity',group:'Water quality',severity:'warning',tag:'QIT01 / Warning 02',title:'High product conductivity',trigger:'Guide text states >900 µS/cm for more than 6 minutes',short:'Confirm the conductivity reading, then evaluate salt rejection and vessel-level evidence.',note:"The uploaded guide labels this as high product conductivity, but the trigger sentence says 'Concentrate conductivity'. Confirm the monitored stream before commissioning the final alarm logic.",causes:['Conductivity transmitter fault','Process / ER-unit issue after measurement confirmation'],engineering:'conductivity',procedure:['Compare SCADA conductivity with the conductivity transmitter/local reading.','Check the condition of the conductivity transmitter.','Check conductivity with a manual meter.','If the manual reading agrees with the transmitter, inform the supervisor.','The guide recommends troubleshooting the ER unit when the conductivity reading is confirmed.']},
{id:'ph-high',group:'Water quality',severity:'warning',tag:'PH01 / Warning 01',title:'Product pH out of range',trigger:'pH above 7',short:'Verify pH with a manual meter before treating it as a process problem.',causes:['pH transmitter fault','Genuine pH increase'],engineering:'generic',procedure:['Compare SCADA pH with the pH transmitter/local reading.','Check the condition of the pH transmitter.','Check pH with a manual meter.','If the manual reading agrees with the transmitter, inform the supervisor.']},
{id:'hpp-no-feedback',group:'HPP',severity:'shutdown',tag:'Shutdown 22',title:'RO pump no running feedback',trigger:'VFD gives start signal but motor does not start / no running feedback',short:'Check active VFD faults, then distinguish a stopped motor from a feedback fault.',causes:['HPP VFD fault','Motor feedback fault'],engineering:'hpp-feedback',procedure:['Check whether the HPP VFD has an active fault.','Refer to the approved alarm list and reset only faults for which reset is permitted.','If the fault appears again, inform the supervisor.','Check whether the motor is physically running.','If the motor is running but the alarm remains, investigate the running-feedback signal.']},
{id:'thermistor',group:'HPP',severity:'shutdown',tag:'Shutdown 20',title:'HPP thermistor / high-temperature fault',trigger:'Motor thermistor trips',short:'Confirm the thermistor state and record actual motor body temperature.',causes:['Motor thermistor trip','High HPP motor temperature'],engineering:'generic',procedure:['Check whether the thermistor indicator is tripped.','Check and record the motor body temperature.','Inform the supervisor.']},
{id:'high-product-flow',group:'Flow',severity:'shutdown',tag:'FIT04 / Shutdown 11',title:'High product flow',trigger:'Above 50 m³/h for 1500 TPD plant or above 100 m³/h for 15 seconds',short:'Check modules individually for a suspected rupture or connector fault.',causes:['Membrane rupture or damage','Interconnector / end-connector damage'],engineering:'generic',procedure:['Check each module individually for the faulty module.','Inspect membrane interconnectors and end connectors where indicated.','Replace or repair the confirmed damaged connector/end connector as required.','Inform the supervisor.']},
{id:'oil-low',group:'HPP',severity:'shutdown',tag:'Shutdown 09',title:'HPP oil level low',trigger:'Oil level below set level',short:'Check the actual oil level; if correct but alarm remains, suspect the level sensor.',causes:['Low oil level','Level sensor fault'],engineering:'generic',procedure:['Check the HPP oil level.','Top up using the approved oil/procedure if the level is genuinely low.','Restart only after the correct level is restored and the approved procedure permits it.','If the alarm remains after refilling, investigate the level sensor and inform the supervisor.']},
{id:'hpp-vfd',group:'HPP',severity:'shutdown',tag:'Shutdown 06',title:'RO pump inverter fault',trigger:'Fault arises in the VFD',short:'Read and record the fault code before any reset decision.',causes:['VFD fault'],engineering:'generic',procedure:['Check the active VFD fault/alarm code.','Make a note of the fault.','Follow the approved drive-specific alarm procedure.','Inform the supervisor.']}
];

var state={alarm:null,evidence:{},balance:null,filter:'All'};

function nav(name){
  $$('.screen').forEach(function(s){s.classList.toggle('active',s.id==='screen-'+name);});
  $$('[data-nav]').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-nav')===name);});
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='alarms')renderAlarms();
  if(name==='balance')renderBalance();
  if(name==='assistant')renderAssistantContext();
}
$$('[data-nav]').forEach(function(b){b.addEventListener('click',function(){nav(b.getAttribute('data-nav'));});});
if($('#openAssistant'))$('#openAssistant').addEventListener('click',function(){nav('assistant');});

function sevBadge(a){return '<span class="status-badge status-'+a.severity+'">'+(a.severity==='shutdown'?'Shutdown':'Warning')+'</span>';}
function iconFor(a){return a.group==='Pressure'?'P':a.group==='Flow'?'Q':a.group==='HPP'?'H':a.group==='Filters'?'F':a.group==='Water quality'?'C':'•';}

function renderHome(){
  var ids=['high-module','low-booster','conductivity','high-module-dp'];
  var colors=['color-coral','color-purple','color-mint','color-amber'];
  $('#quickAlarms').innerHTML=ids.map(function(id,i){
    var a=alarms.find(function(x){return x.id===id;});
    return '<button class="quick-card" data-alarm="'+a.id+'"><span class="icon '+colors[i]+'">'+(i===0?'P↑':i===1?'Q↓':i===2?'C↑':'ΔP')+'</span><h3>'+esc(a.title)+'</h3><p>'+esc(a.short)+'</p></button>';
  }).join('');
  $('#thresholdList').innerHTML=[['Low inlet pressure','1.5 bar'],['Low raw-water pressure','2.5 bar'],['Low feed flow','150 m³/h'],['Low booster flow','85 m³/h'],['High module pressure','60 bar'],['High module ΔP','3 bar'],['PX ΔP reference','< 2 bar'],['Bag-filter ΔP high','1.1 bar']].map(function(x){return '<div class="threshold-row"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>';}).join('');
  $$('#quickAlarms [data-alarm]').forEach(function(b){b.addEventListener('click',function(){selectAlarm(b.getAttribute('data-alarm'));});});
}

function renderFilters(){
  var groups=['All'].concat(Array.from(new Set(alarms.map(function(a){return a.group;}))));
  $('#alarmFilters').innerHTML=groups.map(function(g){return '<button class="'+(g===state.filter?'active':'')+'" data-filter="'+esc(g)+'">'+esc(g)+'</button>';}).join('');
  $$('#alarmFilters [data-filter]').forEach(function(b){b.addEventListener('click',function(){state.filter=b.getAttribute('data-filter');renderFilters();renderAlarms();});});
}
function renderAlarms(){
  renderFilters();
  var q=($('#alarmSearch')?$('#alarmSearch').value:'').trim().toLowerCase();
  var list=alarms.filter(function(a){
    var groupOk=state.filter==='All'||a.group===state.filter;
    var searchOk=!q||[a.title,a.tag,a.group,a.trigger].join(' ').toLowerCase().indexOf(q)>=0;
    return groupOk&&searchOk;
  });
  $('#alarmGrid').innerHTML=list.map(function(a){
    return '<button class="alarm-card" data-alarm="'+a.id+'"><div class="alarm-top"><span class="alarm-icon '+(a.severity==='shutdown'?'color-coral':'color-purple')+'">'+iconFor(a)+'</span>'+sevBadge(a)+'</div><h3>'+esc(a.title)+'</h3><p>'+esc(a.short)+'</p><div class="alarm-meta"><div><span>Tag</span><b>'+esc(a.tag)+'</b></div><div><span>Trigger</span><b>'+esc(a.trigger)+'</b></div></div></button>';
  }).join('')||'<div class="empty-state"><h2>No matching alarms</h2><p>Try another search or category.</p></div>';
  $$('#alarmGrid [data-alarm]').forEach(function(b){b.addEventListener('click',function(){selectAlarm(b.getAttribute('data-alarm'));});});
}
if($('#alarmSearch'))$('#alarmSearch').addEventListener('input',renderAlarms);

function selectAlarm(id){
  state.alarm=alarms.find(function(a){return a.id===id;})||null;
  state.evidence={};
  renderTroubleshoot();
  nav('troubleshoot');
}
function setSteps(n){$$('#stepper span').forEach(function(s,i){s.classList.toggle('active',i<n);});}

function renderTroubleshoot(){
  var a=state.alarm;
  if(!a){$('#tsEmpty').classList.remove('hidden');$('#tsWorkspace').classList.add('hidden');return;}
  $('#tsEmpty').classList.add('hidden');$('#tsWorkspace').classList.remove('hidden');
  $('#tsTitle').textContent=a.title;$('#tsSubtitle').textContent=a.trigger;setSteps(2);
  $('#alarmOverview').innerHTML='<div class="alarm-summary"><span class="alarm-icon '+(a.severity==='shutdown'?'color-coral':'color-purple')+'">'+iconFor(a)+'</span><div><span class="eyebrow">'+esc(a.group.toUpperCase())+' · '+esc(a.tag)+'</span><h2>'+esc(a.title)+'</h2><p>'+esc(a.trigger)+'</p></div>'+sevBadge(a)+'</div>'+(a.note?'<div class="result-banner warn" style="margin-top:14px"><h3>Source note</h3><p>'+esc(a.note)+'</p></div>':'');
  $('#officialProcedure').innerHTML='<div class="panel-head"><div><span class="eyebrow">FIRST-LINE PROCEDURE</span><h2>Start with the first-line checks</h2></div><span class="alarm-tag">Plant procedure</span></div><div class="procedure-list">'+a.procedure.map(function(s,i){return '<div class="procedure-step"><b>'+String(i+1).padStart(2,'0')+'</b><p>'+esc(s)+'</p></div>';}).join('')+'</div><div style="margin-top:14px"><button class="primary-btn" id="continueDx">Continue to engineering diagnosis</button></div>';
  $('#activeAlarmMini').innerHTML='<h3>'+esc(a.title)+'</h3><p>'+esc(a.tag)+'<br>'+esc(a.trigger)+'</p>';
  $('#engineeringInputs').classList.add('hidden');$('#diagnosisResult').classList.add('hidden');
  $('#evidenceList').innerHTML='<p class="muted">Complete the verification step to add evidence.</p>';
  byId('continueDx').onclick=function(){renderEngineeringInputs(a);};
}
if($('#changeAlarm'))$('#changeAlarm').addEventListener('click',function(){nav('alarms');});

function field(id,label,value,unit,step){
  step=step||'0.1';
  return '<label class="field"><span>'+esc(label)+'</span><div><input id="'+id+'" type="number" value="'+value+'" step="'+step+'"><b>'+esc(unit)+'</b></div></label>';
}
function selectField(id,label,options){
  return '<label class="field"><span>'+esc(label)+'</span><div><select id="'+id+'">'+options.map(function(o){return '<option value="'+o[0]+'">'+esc(o[1])+'</option>';}).join('')+'</select></div></label>';
}
function renderEngineeringInputs(a){
  setSteps(3);
  var h=$('#engineeringInputs');h.classList.remove('hidden');
  var body='';
  if(a.engineering==='high-module'){
    body='<div class="panel-head"><div><span class="eyebrow">ENGINEERING CORRELATION</span><h2>Compare the event with the earlier stable condition</h2></div></div><div class="form-grid">'+
    field('dxModuleBefore','Module pressure · earlier',56.4,'bar')+field('dxModuleNow','Module pressure · now/trip',60.2,'bar')+
    field('dxRejectBefore','Reject pressure · earlier',54.5,'bar')+field('dxRejectNow','Reject pressure · now/trip',56.1,'bar')+
    field('dxLocalGauge','Local module pressure',60.1,'bar')+field('dxFeedBefore','Feed flow · earlier',186,'m³/h','1')+
    field('dxFeedNow','Feed flow · now',169,'m³/h','1')+field('dxPxDp','PX differential pressure',1.3,'bar')+
    field('dxHppRef','HPP reference',45,'Hz')+field('dxHppActual','HPP actual',45,'Hz')+
    field('dxCpRef','CP reference',39,'Hz')+field('dxCpActual','CP actual',39,'Hz')+
    field('dxCpCurrent','CP current',57,'A','1')+field('dxBagDp','Bag-filter DP',0.5,'bar')+'</div>';
  }else if(a.engineering==='conductivity'){
    body='<div class="panel-head"><div><span class="eyebrow">ENGINEERING CORRELATION</span><h2>Confirm the reading, then assess salt passage</h2></div></div><div class="form-grid">'+
    field('dxCondBefore','Conductivity · baseline',320,'µS/cm','1')+field('dxCondNow','Conductivity · now',700,'µS/cm','1')+
    field('dxCondManual','Manual meter',690,'µS/cm','1')+field('dxFeedCond','Borewell feed conductivity',45000,'µS/cm','10')+
    field('dxPressureBase','Module pressure · baseline',57.5,'bar')+field('dxPressureNow','Module pressure · now',57.5,'bar')+
    field('dxRecoveryBase','Recovery · baseline',42,'%')+field('dxRecoveryNow','Recovery · now',42,'%')+
    field('dxTempBase','Feed temperature · baseline',29,'°C')+field('dxTempNow','Feed temperature · now',29,'°C')+'</div>'+
    '<div class="panel-head" style="margin-top:16px"><div><span class="eyebrow">OPTIONAL</span><h2>Individual vessel permeate conductivity</h2></div></div><div class="form-grid">'+[1,2,3,4,5,6].map(function(i){return field('dxPv'+i,'PV-'+String(i).padStart(2,'0'),0,'µS/cm','1');}).join('')+'</div>';
  }else if(a.engineering==='high-module-dp'){
    body='<div class="panel-head"><div><span class="eyebrow">ENGINEERING CORRELATION</span><h2>Localize the pressure loss</h2></div></div><div class="form-grid">'+
    field('dxInletP','Module inlet pressure',58,'bar')+field('dxRejectP','Module reject pressure',54.5,'bar')+
    field('dxLocalInlet','Local inlet pressure',58,'bar')+field('dxLocalReject','Local reject pressure',54.5,'bar')+
    field('dxFeedFlow','Feed flow',180,'m³/h','1')+field('dxBagDp2','Bag-filter DP',0.5,'bar')+field('dxPxDp2','PX differential pressure',1.2,'bar')+'</div>';
  }else if(a.engineering==='low-booster'){
    body='<div class="panel-head"><div><span class="eyebrow">ENGINEERING CORRELATION</span><h2>Separate measurement, PX and CP causes</h2></div></div><div class="form-grid">'+
    field('dxBoosterScada','Booster flow · SCADA',80,'m³/h','1')+field('dxBoosterLocal','Booster flow · local',80,'m³/h','1')+
    field('dxModuleDp3','Module differential pressure',1.5,'bar')+field('dxPxDp3','PX differential pressure',1.2,'bar')+
    field('dxCpRef3','CP reference',39,'Hz')+field('dxCpActual3','CP actual',39,'Hz')+field('dxCpCurrent3','CP current',57,'A','1')+'</div>';
  }else if(a.engineering==='low-inlet'){
    body='<div class="panel-head"><div><span class="eyebrow">ENGINEERING CORRELATION</span><h2>Confirm whether the low pressure is real</h2></div></div><div class="form-grid">'+
    field('dxLowScada','SCADA pressure',1.3,'bar')+field('dxLowLocal','Local pressure',1.3,'bar')+field('dxBoreholes','Boreholes in operation',3,'ea','1')+field('dxFeedFlow2','Feed flow',145,'m³/h','1')+'</div>';
  }else if(a.engineering==='hpp-feedback'){
    body='<div class="panel-head"><div><span class="eyebrow">ENGINEERING CORRELATION</span><h2>Separate drive, motor and feedback causes</h2></div></div><div class="form-grid">'+
    selectField('dxVfdFault','VFD active fault?',[['yes','Yes'],['no','No']])+selectField('dxMotorRuns','Motor physically running?',[['no','No'],['yes','Yes']])+
    selectField('dxRunCommand','Run command present?',[['yes','Yes'],['no','No']])+selectField('dxFeedback','Running feedback present?',[['no','No'],['yes','Yes']])+'</div>';
  }else{
    body='<div class="panel-head"><div><span class="eyebrow">VERIFICATION COMPLETE</span><h2>Use the first-line procedure as the controlling path</h2></div></div><div class="result-banner warn"><h3>No deeper plant-specific decision tree is encoded yet</h3><p>The portal will not invent one. Record the first-line findings and use the AI assistant for explanation, not as a replacement for the approved procedure.</p></div>';
  }
  h.innerHTML=body+'<button class="primary-btn" id="runDx" style="margin-top:14px">Analyze evidence</button>';
  byId('runDx').onclick=function(){runDiagnosis(a);};
  h.scrollIntoView({behavior:'smooth',block:'start'});
}
function evidence(items){
  state.evidence={};
  items.forEach(function(x){state.evidence[x[0]]=x[1];});
  $('#evidenceList').innerHTML=items.map(function(x){return '<div class="evidence-item"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>';}).join('');
}
function result(level,headline,text,findings,actions){return {level:level,headline:headline,text:text,findings:findings||[],actions:actions||[]};}

function runDiagnosis(a){
  setSteps(4);
  var r=result('warn','Follow the verified alarm procedure','No deeper plant-specific engineering decision tree is available for this alarm yet.',[],a.procedure.slice(-3));
  var ev=[];
  if(a.engineering==='high-module'){
    var mb=n('dxModuleBefore'),mn=n('dxModuleNow'),rb=n('dxRejectBefore'),rn=n('dxRejectNow'),local=n('dxLocalGauge'),fb=n('dxFeedBefore'),fn=n('dxFeedNow'),px=n('dxPxDp'),hr=n('dxHppRef'),ha=n('dxHppActual'),cr=n('dxCpRef'),ca=n('dxCpActual'),bag=n('dxBagDp');
    var dpb=mb-rb,dpn=mn-rn,dpr=dpn-dpb,fc=fb?((fn-fb)/fb*100):0,gauge=Math.abs(mn-local)<=1,hpp=Math.abs(hr-ha)<=0.5,cp=Math.abs(cr-ca)<=0.5;
    ev=[['RO pressure',fmt(mn)+' bar'],['RO ΔP',fmt(dpn)+' bar'],['ΔP change',fmt(dpr)+' bar'],['Feed change',fmt(fc,1)+'%'],['PX ΔP',fmt(px)+' bar'],['Bag-filter ΔP',fmt(bag)+' bar'],['HPP tracking',hpp?'OK':'Mismatch'],['CP tracking',cp?'OK':'Mismatch']];
    if(!gauge)r=result('bad','Pressure indication not confirmed','SCADA/PIT and local pressure do not agree closely enough. Verify the measurement chain before changing plant hydraulics.',[],['Check PIT/transmitter condition and scaling.','Confirm local gauge accuracy.','Re-run the diagnosis with a confirmed pressure value.']);
    else if(!hpp||!cp)r=result('bad','Correct pump speed-reference tracking first','At least one fixed-reference pump is not following its reference, so the hydraulic diagnosis is not yet reliable.',[!hpp?'HPP actual does not follow reference.':'HPP tracking is normal.',!cp?'CP actual does not follow reference.':'CP tracking is normal.'],['Investigate the VFD/motor/control reason for the mismatch.','Re-check the pressure trend after speed tracking is restored.']);
    else if((dpn>=T.highModuleDp||dpr>=0.7)&&fc<=-3)r=result('bad','Increasing RO hydraulic resistance is the primary direction','Module pressure rose while RO differential pressure increased and feed flow fell. This pattern supports increasing resistance through the RO path more than pure reject-side backpressure.',[],['Verify both module pressure measurements locally.','Check pretreatment and bag-filter DP and confirm feed valve position.','Localize the added pressure loss by stage/vessel where possible.','Investigate feed-channel fouling, scaling, debris or a restricted valve/line.','Do not simply reduce fixed HPP/CP references to suppress the symptom.']);
    else if(Math.abs(dpr)<=0.5&&dpn<T.highModuleDp)r=result('warn','RO ΔP is stable — investigate backpressure / reject-side hydraulics','High inlet pressure with stable RO differential pressure points away from increasing membrane/feed-channel resistance.',[],['Verify concentrate/reject valve position and movement.','Check reject-line restriction and PX high-pressure path.','Check PX noise, PX DP and reject conductivity.','Check CP current/VFD while confirming actual speed remains at its fixed reference.']);
    else r=result('warn','Mixed hydraulic pattern — localize before assigning a component fault','The current values do not cleanly separate RO restriction from reject-side backpressure.',[],['Trend module inlet pressure, reject pressure, feed flow, reject flow and PX DP over the same event window.','Use the direction of ΔP and flow change to separate RO resistance from backpressure.']);
  }else if(a.engineering==='conductivity'){
    var cb=n('dxCondBefore'),cn=n('dxCondNow'),cm=n('dxCondManual'),cf=n('dxFeedCond'),pb=n('dxPressureBase'),pn=n('dxPressureNow'),rrb=n('dxRecoveryBase'),rrn=n('dxRecoveryNow'),tb=n('dxTempBase'),tn=n('dxTempNow');
    var manual=Math.abs(cm-cn)<=Math.max(50,.1*Math.max(cn,1)),rej=cf>0?(1-cn/cf)*100:0,rejB=cf>0?(1-cb/cf)*100:0,pchg=pn-pb,rchg=rrn-rrb,tchg=tn-tb;
    ev=[['Conductivity',fmt(cn,0)+' µS/cm'],['Manual',fmt(cm,0)+' µS/cm'],['Salt rejection',fmt(rej,2)+'%'],['Pressure change',fmt(pchg)+' bar'],['Recovery change',fmt(rchg,1)+' pp'],['Temperature change',fmt(tchg,1)+' °C']];
    if(!manual)r=result('bad','Conductivity reading not confirmed','The transmitter/SCADA value does not agree with the manual meter closely enough.',[],['Inspect/clean/calibrate the conductivity sensor.','Verify temperature compensation and signal scaling.','Repeat the manual comparison before membrane or PX diagnosis.']);
    else{
      var vessels=[];for(var i=1;i<=6;i++){var vv=n('dxPv'+i);if(vv>0)vessels.push({name:'PV-'+String(i).padStart(2,'0'),value:vv});}
      var out=null;
      if(vessels.length>=3){var vals=vessels.map(function(v){return v.value;}).sort(function(a,b){return a-b;});var med=vals[Math.floor(vals.length/2)];var mx=vessels.slice().sort(function(a,b){return b.value-a.value;})[0];if(mx.value>med*1.6&&mx.value-med>150)out={name:mx.name,value:mx.value,med:med};}
      if(out)r=result('bad','Conductivity abnormality appears localized',out.name+' is materially higher than the other entered vessel values.',[out.name+' = '+fmt(out.value,0)+' µS/cm','Vessel median = '+fmt(out.med,0)+' µS/cm'],['Check the suspect vessel elements, interconnectors, O-rings and end connectors.','Compare the suspect vessel with adjacent vessels at similar hydraulic conditions.']);
      else if(pchg<=-1)r=result('warn','Investigate why RO operating pressure fell','The conductivity rise is accompanied by lower module pressure while HPP/CP references are expected to remain fixed.',[],['Verify feed flow and upstream restriction.','Check PX/CP branch condition and actual speed tracking.','Reassess product conductivity after the pressure condition is corrected.']);
      else if(rchg>=2)r=result('warn','Verify excessive recovery / flow balance first','Recovery is above baseline enough to affect product-quality interpretation.',[],['Verify feed, permeate and reject flowmeters.','Recalculate recovery from confirmed measurements.','Return to the approved recovery range before judging membrane integrity.']);
      else r=result('warn','Investigate increasing salt passage through the RO system','The conductivity reading is confirmed and no single entered operating change fully explains it.',[],['Confirm borewell-feed conductivity remains near its normal baseline.','Compare normalized salt passage/rejection with commissioning or clean baseline.','Sample individual vessel permeate conductivity to localize the problem.','If all vessels deteriorate similarly, investigate system-wide membrane condition, chemical exposure/oxidation, aging, temperature effects and operating pressure.']);
    }
  }else if(a.engineering==='high-module-dp'){
    var pi=n('dxInletP'),po=n('dxRejectP'),li=n('dxLocalInlet'),lo=n('dxLocalReject'),ff=n('dxFeedFlow'),bd=n('dxBagDp2'),pd=n('dxPxDp2'),dp=pi-po,ok=Math.abs(pi-li)<=1&&Math.abs(po-lo)<=1;
    ev=[['RO ΔP',fmt(dp)+' bar'],['Feed',fmt(ff,0)+' m³/h'],['Bag-filter ΔP',fmt(bd)+' bar'],['PX ΔP',fmt(pd)+' bar'],['Pressure verification',ok?'Confirmed':'Mismatch']];
    if(!ok)r=result('bad','Verify the pressure measurements first','At least one SCADA/transmitter value does not agree closely enough with the local pressure.',[],['Check both pressure instruments and scaling.','Repeat the ΔP calculation after measurement confirmation.']);
    else if(dp>=T.highModuleDp)r=result('bad','High RO differential pressure confirmed','The calculated RO differential pressure is at/above the 3 bar reference.',[],['Check feed flow and pretreatment/filter pressure loss.','Localize the pressure drop by stage/vessel where instrumentation allows.','Investigate feed-channel restriction, fouling, scaling, debris or a restricted valve/line before changing fixed pump references.']);
    else r=result('warn','Entered RO ΔP is below the alarm reference','The entered values calculate to '+fmt(dp)+' bar, below 3 bar.',[],['Compare values at the exact alarm timestamp.','Check for transient pressure spikes or instrument issues.']);
  }else if(a.engineering==='low-booster'){
    var fs=n('dxBoosterScada'),fl=n('dxBoosterLocal'),md=n('dxModuleDp3'),pxd=n('dxPxDp3'),cpr=n('dxCpRef3'),cpa=n('dxCpActual3'),ci=n('dxCpCurrent3'),flowOk=Math.abs(fs-fl)<=Math.max(3,.05*Math.max(fs,1)),speedOk=Math.abs(cpr-cpa)<=0.5;
    ev=[['Booster flow',fmt(fs,0)+' m³/h'],['Local flow',fmt(fl,0)+' m³/h'],['RO ΔP',fmt(md)+' bar'],['PX ΔP',fmt(pxd)+' bar'],['CP speed',fmt(cpa)+'/'+fmt(cpr)+' Hz'],['CP current',fmt(ci,0)+' A']];
    if(!flowOk)r=result('bad','Flow measurement not confirmed','SCADA and local booster-flow values do not agree closely enough.',[],['Check flowmeter condition and scaling.','Repeat the diagnosis with a confirmed flow value.']);
    else if(!speedOk)r=result('bad','CP speed is not following its reference','Correct the CP/VFD tracking problem before diagnosing the PX hydraulically.',[],['Check VFD status/faults and actual motor speed.','Recheck booster flow after speed tracking is restored.']);
    else if(pxd>T.pxDp)r=result('warn','PX path needs investigation','PX differential pressure is above the 2 bar reference while the booster-flow measurement is confirmed.',[],['Check PX noise and reject conductivity.','Check valve/bypass lineup and PX flow balance.','Escalate to PX inspection only after instruments and external hydraulics are verified.']);
    else r=result('warn','PX ΔP and CP speed look normal','The basic PX/CP indicators entered here do not identify an obvious PX or CP fault.',[],['Check startup condition and module ΔP.','Check valve/line restriction and confirm all flow measurements.','Use Flow Balance to test the PX branch relationships.']);
  }else if(a.engineering==='low-inlet'){
    var ps=n('dxLowScada'),pl=n('dxLowLocal'),bh=n('dxBoreholes'),f2=n('dxFeedFlow2'),confirm=Math.abs(ps-pl)<=0.3;
    ev=[['SCADA pressure',fmt(ps)+' bar'],['Local pressure',fmt(pl)+' bar'],['Boreholes',fmt(bh,0)],['Feed flow',fmt(f2,0)+' m³/h']];
    if(!confirm)r=result('bad','Pressure reading not confirmed','SCADA and local pressure do not agree.',[],['Check the pressure transmitter and scaling before changing borehole operation.']);
    else r=result('warn','Low inlet pressure is confirmed','The low pressure is present locally as well as in SCADA.',[],['Check borehole/network pressure and availability.','Confirm the bypass is closed.','Increase boreholes according to the approved operating procedure if source pressure is low.']);
  }else if(a.engineering==='hpp-feedback'){
    var vf=byId('dxVfdFault').value,mr=byId('dxMotorRuns').value,rc=byId('dxRunCommand').value,fbk=byId('dxFeedback').value;
    ev=[['VFD fault',vf],['Motor running',mr],['Run command',rc],['Running feedback',fbk]];
    if(vf==='yes')r=result('bad','Active VFD fault is the first diagnostic direction','Read and record the active fault code and follow the approved drive-specific alarm procedure.',[],['Do not repeatedly reset a recurring protection fault.','Reset only where the approved procedure permits.']);
    else if(mr==='yes'&&fbk==='no')r=result('warn','Running-feedback circuit / signal fault likely','The motor is physically running while feedback remains absent.',[],['Check the running-feedback switch/signal, PLC input and mapping.','Keep the motor condition separate from the feedback problem.']);
    else r=result('warn','Motor is not confirmed running','With no active VFD fault entered, continue through run command, permissive/interlock and motor checks.',[],['Confirm run command and permissives.','Check motor/electrical condition and drive status.','Escalate if the cause is not identified.']);
  }
  evidence(ev);
  renderResult(r);
}
function renderResult(r){
  var h=$('#diagnosisResult');h.classList.remove('hidden');
  h.innerHTML='<div class="panel-head"><div><span class="eyebrow">ENGINEERING RESULT</span><h2>Diagnostic direction</h2></div><span class="status-badge status-info">Evidence-based</span></div><div class="result-banner '+r.level+'"><h3>'+esc(r.headline)+'</h3><p>'+esc(r.text)+'</p></div>'+
  (r.findings.length?'<div class="findings">'+r.findings.map(function(x){return '<div class="finding"><b>Finding</b><p>'+esc(x)+'</p></div>';}).join('')+'</div>':'')+
  '<div class="panel-head" style="margin-top:16px"><div><span class="eyebrow">NEXT ACTION</span><h2>Recommended checks</h2></div></div><div class="procedure-list">'+r.actions.map(function(s,i){return '<div class="procedure-step"><b>'+String(i+1).padStart(2,'0')+'</b><p>'+esc(s)+'</p></div>';}).join('')+'</div>';
  h.scrollIntoView({behavior:'smooth',block:'start'});
  renderAssistantContext();
}
if($('#askAboutAlarm'))$('#askAboutAlarm').addEventListener('click',function(){nav('assistant');});

var flowFields=[['fbFeed','Total Feed',188],['fbHpp','HPP Branch',78],['fbLpIn','PX LP IN',110],['fbRoFeed','RO Feed Header',188],['fbHpOut','PX HP OUT',110],['fbPerm','Permeate',50],['fbHpIn','PX HP IN',110],['fbLpOut','PX LP OUT',110],['fbDirect','Direct Reject',28]];
function renderFlowInputs(){
  $('#flowInputs').innerHTML=flowFields.map(function(x){return '<label class="flow-field"><span>'+x[1]+'</span><div><input id="'+x[0]+'" type="number" value="'+x[2]+'" step="0.1"><b>m³/h</b></div></label>';}).join('');
  flowFields.forEach(function(x){byId(x[0]).addEventListener('input',updateMap);});
}
function updateMap(){
  var m={mapFeed:n('fbFeed'),mapHpp:n('fbHpp'),mapLpIn:n('fbLpIn'),mapPxOut:n('fbHpOut'),mapRoFeed:n('fbRoFeed'),mapPerm:n('fbPerm'),mapHpIn:n('fbHpIn'),mapDirect:n('fbDirect')};
  Object.keys(m).forEach(function(id){if(byId(id))byId(id).textContent=fmt(m[id],0);});
}
function wireFbCanvas(){
  document.querySelectorAll('.fb-node[data-fb-focus]').forEach(function(b){
    b.onclick=function(){
      document.querySelectorAll('.fb-node').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active');
      var target=byId(b.getAttribute('data-fb-focus'));
      if(target){target.focus();target.scrollIntoView({behavior:'smooth',block:'center'});}
    };
  });
}
function pctErr(actual,expected){return Math.abs(expected)>1e-9?(actual-expected)/Math.abs(expected)*100:0;}
function runBalance(){
  var tol=Math.max(.1,n('fbTolerance')||3);
  var f={feed:n('fbFeed'),hpp:n('fbHpp'),lpIn:n('fbLpIn'),roFeed:n('fbRoFeed'),hpOut:n('fbHpOut'),perm:n('fbPerm'),hpIn:n('fbHpIn'),lpOut:n('fbLpOut'),direct:n('fbDirect')};
  var checks=[
    {name:'Feed split',eq:'Feed = HPP + PX LP IN',error:pctErr(f.hpp+f.lpIn,f.feed),detail:'Tests whether the feed split closes.'},
    {name:'RO header',eq:'RO Feed = HPP + PX HP OUT',error:pctErr(f.hpp+f.hpOut,f.roFeed),detail:'Tests the high-pressure header balance.'},
    {name:'RO mass balance',eq:'RO Feed = Permeate + PX HP IN + Direct Reject',error:pctErr(f.perm+f.hpIn+f.direct,f.roFeed),detail:'Tests the membrane-train outlet balance.'},
    {name:'PX feed side',eq:'PX LP IN ≈ PX HP OUT',error:pctErr(f.hpOut,f.lpIn),detail:'A mismatch first points to metering, leakage/bypass or operating-point issues.'},
    {name:'PX reject side',eq:'PX HP IN ≈ PX LP OUT',error:pctErr(f.lpOut,f.hpIn),detail:'A mismatch first points to metering, leakage/bypass or operating-point issues.'}
  ];
  checks.forEach(function(c){c.level=Math.abs(c.error)<=tol?'good':Math.abs(c.error)<=tol*2?'warn':'bad';});
  state.balance={tol:tol,f:f,checks:checks};renderBalanceSummary();renderBalanceInterpretation();renderAssistantContext();
}
function renderBalanceSummary(){
  var data=state.balance?state.balance.checks:[
    {name:'Feed split',error:0,level:'good'},{name:'RO mass balance',error:0,level:'good'},{name:'PX feed side',error:0,level:'good'},{name:'PX reject side',error:0,level:'good'}
  ];
  var wanted=['Feed split','RO mass balance','PX feed side','PX reject side'];
  $('#balanceSummary').innerHTML=wanted.map(function(name){var c=data.find(function(x){return x.name===name;})||{error:0,level:'good'};return '<div class="balance-kpi '+c.level+'"><small>'+name+'</small><strong>'+fmt(Math.abs(c.error),1)+'%</strong><span>'+c.level.toUpperCase()+'</span></div>';}).join('');
}
function renderBalanceInterpretation(){
  var h=$('#balanceInterpretation');
  if(!state.balance){h.innerHTML='<div class="muted">Enter measured flows and run the balance check.</div>';return;}
  var bad=state.balance.checks.filter(function(c){return c.level!=='good';});
  var intro=!bad.length?'<div class="result-banner good"><h3>All measured relationships close within tolerance</h3><p>A gross meter/bypass imbalance is less likely. If a hydraulic symptom remains, continue with pressure, valve, pump and PX checks.</p></div>':'<div class="result-banner warn"><h3>One or more balances are open</h3><p>Verify affected meters, bypass/isolation valves, drains/sample lines and unaccounted flows before assigning an internal PX, HPP or CP fault.</p></div>';
  h.innerHTML=intro+'<div class="interpretation-list">'+state.balance.checks.map(function(c){return '<div class="interpretation-item '+c.level+'"><i></i><div><b>'+esc(c.name)+' · '+fmt(c.error,1)+'%</b><p>'+esc(c.eq)+'. '+esc(c.detail)+'</p></div></div>';}).join('')+'</div>';
}
function renderBalance(){updateMap();renderBalanceSummary();renderBalanceInterpretation();}
if($('#runBalance'))$('#runBalance').addEventListener('click',runBalance);
if($('#loadBalancedExample'))$('#loadBalancedExample').addEventListener('click',function(){flowFields.forEach(function(x){byId(x[0]).value=x[2];});byId('fbTolerance').value=3;updateMap();runBalance();});
if($('#balanceAiBtn'))$('#balanceAiBtn').addEventListener('click',function(){nav('assistant');});

function renderAssistantContext(){
  var parts=[];
  if(state.alarm)parts.push(['Active alarm',state.alarm.title],['Tag',state.alarm.tag],['Trigger',state.alarm.trigger]);
  var e=Object.keys(state.evidence||{});if(e.length)parts.push(['Evidence',e.slice(0,3).map(function(k){return k+': '+state.evidence[k];}).join(' · ')]);
  if(state.balance){var worst=state.balance.checks.slice().sort(function(a,b){return Math.abs(b.error)-Math.abs(a.error);})[0];parts.push(['Flow balance','Largest mismatch: '+worst.name+' '+fmt(worst.error,1)+'%']);}
  $('#assistantContext').innerHTML=parts.length?parts.map(function(x){return '<div class="context-pill"><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></div>';}).join(''):'<div class="context-pill"><small>Context</small><b>No alarm or balance selected yet</b></div>';
}
function answer(q){
  var a=state.alarm,t=q.toLowerCase();
  if(!a)return 'Select an alarm first. I can then use the first-line procedure and the evidence you enter instead of giving a generic answer.';
  if(t.indexOf('verify')>=0||t.indexOf('first')>=0)return 'Start with the first-line checks for '+a.title+': '+a.procedure.slice(0,3).join(' ')+' If those confirm the alarm is genuine, continue to engineering correlation.';
  if(t.indexOf('px')>=0){
    if(state.balance){var px=state.balance.checks.filter(function(c){return c.name.indexOf('PX')>=0;});var open=px.some(function(c){return c.level!=='good';});return open?'A PX-related issue is possible because at least one PX flow relationship is outside tolerance. Before calling the PX faulty, verify the four flowmeters, bypass/isolation valves and leakage or unaccounted-flow paths.':'The PX flow relationships are within tolerance. That makes a gross flow imbalance less likely; use pressure-transfer, ΔP, noise, conductivity and CP evidence next.';}
    return 'Do not conclude PX fault from the alarm name alone. Check PX differential pressure, the four PX flow relationships, bypass/valve lineup, CP condition and instrument validity first.';
  }
  if(t.indexOf('likely')>=0||t.indexOf('direction')>=0){
    if(Object.keys(state.evidence).length)return 'Use the engineering result as the leading direction, but not as a confirmed component failure. The entered evidence is: '+Object.keys(state.evidence).slice(0,5).map(function(k){return k+' '+state.evidence[k];}).join(', ')+'.';
    return 'The plant procedure lists these first-line causes for '+a.title+': '+a.causes.join(', ')+'. Run the engineering diagnosis before choosing among them.';
  }
  if(t.indexOf('flow')>=0||t.indexOf('balance')>=0){
    if(!state.balance)return 'Open Flow Balance and enter the measured values first.';
    var w=state.balance.checks.slice().sort(function(x,y){return Math.abs(y.error)-Math.abs(x.error);})[0];
    return 'The largest balance mismatch is '+w.name+' at '+fmt(w.error,1)+'%. Treat that first as a measurement, bypass, drain or unaccounted-flow problem before blaming equipment.';
  }
  if(t.indexOf('conduct')>=0||t.indexOf('quality')>=0)return 'For rising product conductivity, confirm the reading with a manual meter first, then check salt rejection, RO pressure, recovery and temperature, and finally compare vessel permeate conductivity. The uploaded plant procedure has a product-versus-concentrate wording inconsistency for QIT01 that should be resolved before final commissioning.';
  return 'For '+a.title+', keep the sequence: confirm the condition, complete the MWSC first-line checks, collect only the readings relevant to the alarm, then use engineering correlation to choose the next inspection path. Do not jump straight to a component failure.';
}
function addMsg(role,text){var d=document.createElement('div');d.className='message '+role;d.innerHTML='<span>'+(role==='assistant'?'✦':'YOU')+'</span><p>'+esc(text)+'</p>';$('#chatLog').appendChild(d);$('#chatLog').scrollTop=$('#chatLog').scrollHeight;}
function send(text){var q=String(text||$('#chatInput').value||'').trim();if(!q)return;addMsg('user',q);addMsg('assistant',answer(q));$('#chatInput').value='';}
if($('#sendChat'))$('#sendChat').addEventListener('click',function(){send();});
if($('#chatInput'))$('#chatInput').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();send();}});
$$('[data-prompt]').forEach(function(b){b.addEventListener('click',function(){send(b.getAttribute('data-prompt'));});});

renderHome();renderFilters();renderAlarms();renderFlowInputs();renderBalance();wireFbCanvas();renderAssistantContext();
})();
