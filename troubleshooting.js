window.RO_TROUBLESHOOTING = {
  categories: [
    {id:"pressure", name:"Pressure", symptoms:[
      {id:"module_pressure_rising", name:"Module inlet pressure rising / trip"},
      {id:"high_module_dp", name:"High RO module differential pressure"},
      {id:"low_ro_pressure", name:"Low RO operating pressure"}
    ]},
    {id:"flow", name:"Flow & Balance", symptoms:[
      {id:"low_feed_flow", name:"Low feed / booster flow"},
      {id:"raw_split_imbalance", name:"Bag-filter outlet split imbalance"},
      {id:"px_flow_imbalance", name:"PX HP / LP flow imbalance"},
      {id:"ro_mass_imbalance", name:"RO mass balance mismatch"}
    ]},
    {id:"water", name:"Water Quality", symptoms:[
      {id:"product_cond_rising", name:"Product conductivity rising / high"},
      {id:"salt_rejection_decline", name:"Salt rejection declining"},
      {id:"ph_abnormal", name:"Product pH high / low"}
    ]},
    {id:"pxcp", name:"PX / CP", symptoms:[
      {id:"px_transfer_poor", name:"Poor PX pressure transfer"},
      {id:"px_noise", name:"PX noise / vibration"},
      {id:"cp_mismatch", name:"CP current / VFD / speed mismatch"},
      {id:"px_dp_high", name:"PX differential pressure high"}
    ]},
    {id:"hpp", name:"HPP", symptoms:[
      {id:"hpp_no_start", name:"HPP no-start / trip"},
      {id:"hpp_low_pressure", name:"HPP low discharge pressure"},
      {id:"hpp_high_current", name:"HPP high current"},
      {id:"hpp_vibration", name:"HPP vibration / temperature abnormal"}
    ]},
    {id:"filters", name:"Filters / Valves", symptoms:[
      {id:"bag_filter_dp", name:"Bag-filter differential pressure high"},
      {id:"valve_restriction", name:"Suspected valve / line restriction"},
      {id:"feed_path_restriction", name:"Feed path restriction"}
    ]},
    {id:"membranes", name:"Membranes", symptoms:[
      {id:"fouling_scaling", name:"Suspected fouling / scaling"},
      {id:"vessel_imbalance", name:"Vessel flow / pressure imbalance"},
      {id:"integrity", name:"Membrane / vessel integrity concern"},
      {id:"cip", name:"CIP assessment required"}
    ]},
    {id:"instrumentation", name:"Instrumentation", symptoms:[
      {id:"scada_local_mismatch", name:"SCADA vs local instrument mismatch"},
      {id:"unstable_signal", name:"Unstable / drifting instrument signal"},
      {id:"missing_signal", name:"No reading / frozen value"}
    ]}
  ],
  diagnostics: {
    module_pressure_rising: {
      title:"Module inlet pressure rising / trip",
      prompt:"Select the pre-trip trend that best matches the event.",
      branchOptions:[
        ["dp_rising","RO differential pressure was rising"],
        ["dp_stable","RO differential pressure stayed stable"],
        ["pxcp_change","PX / CP operating point changed before pressure rise"],
        ["pit_mismatch","Local pressure did not agree with SCADA"],
        ["unknown","Trend not yet confirmed"]
      ],
      branches:{
        dp_rising:{
          likely:"Restriction developing across the RO train.",
          checks:["Compare stage / vessel inlet and reject pressures to localize where DP is increasing.","Check feed and reject flow before and during the pressure rise.","Inspect bag filter condition, valve positions and reject path for restriction.","Review fouling, scaling, debris loading and recent cleaning history."],
          actions:["Correct any confirmed valve or line restriction.","If DP growth is across the membrane train, assess membrane fouling/scaling and CIP need.","Do not increase fixed pump speed to overcome an unexplained rising DP."]
        },
        dp_stable:{
          likely:"Backpressure / control restriction rather than increasing membrane DP.",
          checks:["Verify reject control valve position and downstream reject header pressure.","Confirm module inlet pressure and reject pressure with local instruments.","Check whether permeate backpressure or downstream valve condition changed.","Review HPP / CP speed references against actual speed."],
          actions:["Remove confirmed downstream restriction or incorrect valve position.","Correct control-loop or speed-reference mismatch before changing design setpoints."]
        },
        pxcp_change:{
          likely:"PX / CP operating-point change affecting RO header pressure.",
          checks:["Compare CP actual speed, reference speed, current and discharge pressure.","Check PX HP IN, HP OUT, LP IN and LP OUT flow balance.","Check PX pressure differential; reference alarm threshold is 2 bar.","Verify bypass / isolation valves and flowmeter validity before assigning a PX fault."],
          actions:["Restore the intended CP operating point if a speed/reference mismatch is confirmed.","Correct bypass or valve lineup issues.","Investigate PX mechanically only after instrumentation, bypass and flow balance checks are valid."]
        },
        pit_mismatch:{
          likely:"Pressure instrumentation / transmitter issue.",
          checks:["Compare SCADA PIT value with a local calibrated pressure gauge.","Inspect impulse line / tapping for blockage or air pockets if applicable.","Check transmitter zero, range, wiring and scaling.","Confirm the trip source uses the same valid pressure signal."],
          actions:["Correct instrument, impulse-line or scaling fault before mechanical intervention.","Re-test alarm and trip thresholds after correction."]
        },
        unknown:{
          likely:"Pre-trip trend is required to separate restriction, backpressure, PX/CP or PIT causes.",
          checks:["Capture at least module inlet pressure, reject pressure, RO DP, HPP speed, CP speed, PX flows and reject flow over the pre-trip period.","Compare local pressure with SCADA during the event.","Confirm valve positions and any operator / control-system changes before the rise."],
          actions:["Classify the event using the trend branches above before changing pump speed or valve setpoints."]
        }
      }
    },
    high_module_dp:{
      title:"High RO module differential pressure",
      likely:"Restriction, fouling, scaling, debris loading or abnormal vessel distribution.",
      checks:["Confirm module DP with valid inlet and reject pressure instruments.","Compare DP across vessels / stages to identify whether the rise is localized.","Check feed flow, reject flow and recovery against the design case.","Inspect pretreatment / bag-filter condition and recent water-quality changes."],
      actions:["Correct upstream restriction if present.","If membrane DP is genuinely high and rising, assess fouling / scaling and CIP requirement.","Module DP alarm reference: 3 bar."]
    },
    low_ro_pressure:{
      title:"Low RO operating pressure",
      likely:"HPP / CP underperformance, low feed supply, incorrect valve position or instrument error.",
      checks:["Compare HPP and CP reference speed with actual speed.","Verify feed flow and suction condition.","Check HPP discharge, PX HP OUT and CP discharge pressures separately.","Compare SCADA pressure with local instruments."],
      actions:["Correct the confirmed pump, feed, valve or measurement issue.","Avoid compensating with speed changes until the weak section is identified."]
    },
    low_feed_flow:{
      title:"Low feed / booster flow",
      likely:"Feed-side restriction, borehole / upstream supply issue, filter loading, valve position or flowmeter error.",
      checks:["Compare total feed with HPP branch plus PX LP IN.","Check bag-filter DP and valve lineup.","Check upstream borehole / feed-pump availability and local flow indication.","Compare flowmeter value with another mass-balance point."],
      actions:["Restore feed supply or remove confirmed restriction.","Correct invalid flow measurement before adjusting PX or pump settings."]
    },
    raw_split_imbalance:{
      title:"Bag-filter outlet split imbalance",
      likely:"Branch restriction, valve position, flowmeter error or pump operating-point mismatch.",
      checks:["Check Feed = HPP suction + PX LP IN.","Compare HPP actual speed/reference and CP actual speed/reference.","Check branch valve positions and differential pressures.","Verify both flowmeters before assigning a hydraulic fault."],
      actions:["Correct the branch restriction, valve or pump reference mismatch.","Rebalance only after measurements are validated."]
    },
    px_flow_imbalance:{
      title:"PX HP / LP flow imbalance",
      likely:"Meter error, bypass/leakage, incorrect valve lineup or PX hydraulic imbalance.",
      checks:["Compare PX LP IN with PX HP OUT.","Compare PX HP IN with PX LP OUT.","Verify bypass and isolation valves.","Check flowmeter scaling / zero before diagnosing the PX itself."],
      actions:["Correct meter, bypass or valve issue first.","If valid measurements remain imbalanced, inspect PX condition and operating point."]
    },
    ro_mass_imbalance:{
      title:"RO mass balance mismatch",
      likely:"One or more flow measurements are invalid, a bypass exists, or an unmeasured stream is present.",
      checks:["Check RO feed = permeate + total reject.","Check total reject = PX HP IN + direct vessel reject.","Check feed split = HPP branch + PX LP IN.","Inspect drain, flush, sample or bypass lines that may not be included."],
      actions:["Correct measurement / accounting first.","Do not assign a membrane or PX fault from an open mass balance."]
    },
    product_cond_rising:{
      title:"Product conductivity rising / high",
      prompt:"Which observation best matches the conductivity increase?",
      branchOptions:[
        ["cond_unverified","Conductivity rise has not been confirmed locally"],
        ["operating_change","RO pressure, recovery or temperature changed"],
        ["one_vessel","One vessel / train is worse than the others"],
        ["all_vessels","All vessels / product header are rising together"],
        ["feed_changed","Feed conductivity also changed"]
      ],
      branches:{
        cond_unverified:{
          likely:"Product conductivity measurement / analyzer issue must be excluded first.",
          checks:["Verify product conductivity with an independent calibrated handheld or laboratory measurement.","Check analyzer sample flow, sample point flushing and temperature compensation.","Check transmitter scaling and SCADA engineering units.","Compare the analyzer trend with another product-quality measurement if available."],
          actions:["Correct the sample, analyzer or scaling issue if the independent reading does not confirm the rise.","Do not open vessels or replace membranes from an unverified conductivity signal."]
        },
        operating_change:{
          likely:"The product-quality change may be driven by the RO operating point rather than membrane damage.",
          checks:["Compare module inlet pressure, recovery and temperature with the normal operating baseline.","Calculate salt rejection from valid feed and permeate conductivity / TDS.","Check whether the change coincided with HPP/CP speed or reject-control changes.","Confirm feed conductivity remained stable as expected for the borewell source."],
          actions:["Restore the normal hydraulic operating point if the change explains the conductivity increase.","Reassess normalized product quality before assigning a membrane fault."]
        },
        one_vessel:{
          likely:"Localized vessel integrity, interconnector / O-ring or membrane-element issue.",
          checks:["Confirm the affected vessel with individual vessel permeate conductivity where available.","Verify the sample point and instrument before isolation work.","Compare vessel inlet/reject pressure and flow for abnormal distribution.","Inspect interconnectors, O-rings, end adapters and membrane integrity in the confirmed vessel."],
          actions:["Repair the confirmed seal / connector issue or replace the affected element only after the location is verified.","Re-test vessel product quality after corrective work."]
        },
        all_vessels:{
          likely:"Common operating-condition, analyzer, product-header or system-wide membrane-performance issue.",
          checks:["Verify the common product conductivity measurement independently.","Because borewell feed conductivity is normally stable, compare pressure, recovery and temperature first.","Review normalized salt passage / rejection and membrane age or recent cleaning history.","Check whether the rise began after a common event such as shutdown, flushing, chemical exposure or control change."],
          actions:["Correct the common measurement or operating-condition issue first.","If the rise remains confirmed and normalized salt passage has increased, proceed with membrane-performance / integrity assessment."]
        },
        feed_changed:{
          likely:"Feed-water quality change is contributing to the product conductivity change.",
          checks:["Confirm feed conductivity/TDS with an independent measurement.","Compare feed and product changes on the same time basis.","Recalculate salt rejection rather than judging product conductivity alone.","Review borewell / source changes or blending that could explain the feed shift."],
          actions:["Use normalized salt rejection to decide whether RO performance also deteriorated.","Address the feed-water change separately from any membrane integrity issue."]
        }
      }
    },
    salt_rejection_decline:{
      title:"Salt rejection declining",
      likely:"Operating-condition shift, membrane aging/damage, O-ring / interconnector leak or vessel integrity problem.",
      checks:["Verify feed and permeate conductivity instruments.","Normalize for recovery, pressure and temperature changes.","Compare individual vessel / train permeate quality where available.","Inspect integrity-related causes if one vessel is significantly worse."],
      actions:["Correct instrumentation or operating condition first.","Plan integrity inspection / membrane replacement only where supported by vessel-level evidence."]
    },
    ph_abnormal:{
      title:"Product pH abnormal",
      likely:"Dosing / post-treatment issue, sample issue or instrument calibration problem.",
      checks:["Verify pH with a calibrated handheld meter.","Check sample point and flushing.","Review chemical dosing and post-treatment status.","Confirm whether conductivity / production changed at the same time."],
      actions:["Correct measurement or dosing issue based on verification."]
    },
    px_transfer_poor:{
      title:"Poor PX pressure transfer",
      likely:"Incorrect flow balance, bypass / valve issue, PX condition or invalid pressure measurement.",
      checks:["Check PX HP IN, HP OUT, LP IN and LP OUT flows first.","Check PX HP IN and HP OUT pressures and calculate pressure transfer.","Verify bypass/isolation valve lineup.","Confirm pressure and flow instruments locally where practical."],
      actions:["Restore correct flow balance and valve lineup.","Investigate PX internals only after external hydraulic causes are ruled out."]
    },
    px_noise:{
      title:"PX noise / vibration",
      likely:"Cavitation / entrained air, off-design flow, mechanical wear or unstable CP/PX interaction.",
      checks:["Check LP inlet pressure and flow stability.","Check PX flow balance and differential pressure.","Check CP speed/current stability.","Listen for change with operating point and compare with normal baseline."],
      actions:["Correct suction / air ingress or off-design flow first.","Escalate for mechanical inspection if abnormal noise remains at valid operating conditions."]
    },
    cp_mismatch:{
      title:"CP current / VFD / speed mismatch",
      likely:"Reference/actual speed mismatch, hydraulic restriction, motor/VFD issue or invalid feedback.",
      checks:["Compare fixed/reference frequency with actual frequency.","Compare current with normal current at the same flow.","Check CP suction/discharge pressure and PX HP OUT condition.","Verify VFD feedback and motor status."],
      actions:["Correct reference/feedback issue before retuning hydraulic setpoints.","Investigate motor/pump mechanically if current remains abnormal at a valid operating point."]
    },
    px_dp_high:{
      title:"PX differential pressure high",
      likely:"Restriction, incorrect flow ratio, valve issue or PX internal condition.",
      checks:["Verify pressure instruments on both sides.","Check PX flow ratio and valve lineup.","Inspect strainers / restrictions in the PX path.","PX DP reference alarm: 2 bar."],
      actions:["Remove confirmed restriction or incorrect valve setting.","Investigate PX condition if DP stays high with valid flow and instrumentation."]
    },
    hpp_no_start:{
      title:"HPP no-start / trip",
      likely:"VFD/interlock, electrical protection, motor/pump mechanical issue or missing permissive.",
      checks:["Check VFD trip code and active interlocks.","Check motor current, insulation/protection status and supply.","Check suction permissive / low-pressure interlock.","Check pump free rotation / mechanical condition if electrical checks are normal."],
      actions:["Clear only the confirmed cause; do not repeatedly reset an unexplained trip."]
    },
    hpp_low_pressure:{
      title:"HPP low discharge pressure",
      likely:"Low speed, low suction, worn hydraulic components, bypass/open valve or pressure measurement error.",
      checks:["Compare speed reference with actual speed.","Check suction pressure and flow.","Check bypass / discharge valve lineup.","Verify discharge pressure locally."],
      actions:["Correct supply, speed, valve or measurement issue before pump overhaul."]
    },
    hpp_high_current:{
      title:"HPP high current",
      likely:"Hydraulic overload, high pressure, mechanical drag, motor issue or incorrect speed.",
      checks:["Compare current with pressure, flow and speed at the same time.","Check discharge restriction and RO DP.","Check vibration / bearing temperature.","Review motor/VFD alarms."],
      actions:["Remove hydraulic overload or mechanical cause; avoid running against abnormal pressure."]
    },
    hpp_vibration:{
      title:"HPP vibration / temperature abnormal",
      likely:"Bearing, alignment, cavitation, imbalance or hydraulic operating-point problem.",
      checks:["Check vibration trend and bearing temperatures.","Check suction pressure / cavitation symptoms.","Check alignment/coupling condition.","Compare flow and pressure to the normal operating point."],
      actions:["Correct hydraulic cause if present; schedule mechanical inspection for persistent vibration."]
    },
    bag_filter_dp:{
      title:"Bag-filter differential pressure high",
      likely:"Filter loading or blocked element.",
      checks:["Confirm DP with valid upstream/downstream pressure readings.","Check total feed flow trend.","Inspect filter condition and service interval."],
      actions:["Replace / service filter and confirm DP returns to normal."]
    },
    valve_restriction:{
      title:"Suspected valve / line restriction",
      likely:"Partially closed valve, failed actuator, debris or line obstruction.",
      checks:["Verify valve command and actual position.","Compare pressure before/after the suspected location.","Check whether the restriction appeared after maintenance or lineup change."],
      actions:["Correct valve position / actuator or remove confirmed obstruction."]
    },
    feed_path_restriction:{
      title:"Feed path restriction",
      likely:"Filter, valve, line or upstream supply restriction.",
      checks:["Trend pressure and flow from pretreatment through bag filter to HPP/PX split.","Localize the largest unexpected pressure loss.","Check recent maintenance and valve lineup."],
      actions:["Remove the localized restriction and recheck branch balance."]
    },
    fouling_scaling:{
      title:"Suspected membrane fouling / scaling",
      likely:"Confirmed rising membrane DP and/or normalized production decline after hydraulic/instrument checks.",
      checks:["Confirm DP rise is across the membrane train, not a valve or pipe.","Compare normalized permeate flow, pressure and salt passage to baseline.","Review pretreatment, antiscalant/dosing and feed-water events.","Check vessel-to-vessel distribution."],
      actions:["Use the verified trend and foulant evidence to decide CIP type/timing.","Do not use CIP solely because pressure is high if RO DP is stable."]
    },
    vessel_imbalance:{
      title:"Vessel flow / pressure imbalance",
      likely:"Vessel restriction, membrane loading difference, interconnector issue or measurement problem.",
      checks:["Compare inlet/reject pressure and permeate quality across vessels.","Check individual vessel flow where available.","Inspect vessel valve / orifice / connector condition."],
      actions:["Localize and correct the affected vessel rather than treating the whole train first."]
    },
    integrity:{
      title:"Membrane / vessel integrity concern",
      likely:"Membrane damage, O-ring/interconnector leak, vessel seal issue or localized bypass.",
      checks:["Confirm abnormal permeate conductivity on the affected vessel/train.","Rule out sample and conductivity instrument error.","Compare pressure/recovery/temperature with normal operation.","Perform integrity/isolation checks according to maintenance procedure."],
      actions:["Repair seals/connectors or replace damaged element only when the affected location is confirmed."]
    },
    cip:{
      title:"CIP assessment required",
      likely:"CIP should be based on confirmed performance decline / DP increase rather than a single pressure reading.",
      checks:["Review normalized permeate flow decline.","Review normalized salt passage increase.","Review membrane DP increase.","Confirm hydraulic restrictions and instrumentation have been excluded."],
      actions:["Proceed with CIP planning when membrane-related performance criteria are met.","Record pre-CIP baseline and compare post-CIP recovery."]
    },
    scada_local_mismatch:{
      title:"SCADA vs local instrument mismatch",
      likely:"Transmitter, scaling, wiring, communication or local instrument issue.",
      checks:["Compare both values against a third calibrated reference if possible.","Check transmitter range and engineering-unit scaling.","Check PLC/SCADA scaling and raw signal.","Inspect wiring / impulse lines / sensor condition."],
      actions:["Correct the measurement chain before using the value for diagnosis or control."]
    },
    unstable_signal:{
      title:"Unstable / drifting instrument signal",
      likely:"Sensor degradation, air/impulse issue, wiring/noise, grounding or process pulsation.",
      checks:["Compare raw signal with process stability.","Check wiring, shielding and grounding.","Inspect pressure impulse / sample conditions.","Compare with another independent measurement."],
      actions:["Correct installation/sensor fault; filter only after the physical cause is understood."]
    },
    missing_signal:{
      title:"No reading / frozen value",
      likely:"Power, wiring, communications, sensor failure or PLC/SCADA mapping issue.",
      checks:["Check device power and local display.","Check signal at PLC input / network node.","Check tag mapping and communication status.","Check last valid value timestamp."],
      actions:["Restore the failed measurement chain and verify alarming."]
    }
  }
};