import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateProposal,propose} from '../server/copilot.js';
const change={field_path:'batch',proposed_value:'API-2026-014',source_type:'document',source_reference:'Batch: API-2026-014',reason:'Explicit source statement',confidence:'high'};
const response={assistant_message:'Review these extracted facts.',intent:'intake',proposed_changes:[change]};
test('copilot validates field proposals without mutating an empty or populated form',()=>{const current={title:'',batch:'OLD'};const r=validateProposal(response,current);assert.equal(r.proposed_changes[0].current_value,'OLD');assert.equal(current.batch,'OLD');assert.equal(r.proposed_changes[0].proposed_value,'API-2026-014');});
test('copilot rejects arbitrary paths and malformed field values',()=>{assert.throws(()=>validateProposal({...response,proposed_changes:[{...change,field_path:'reviewedBy'}]},{}));assert.throws(()=>validateProposal({...response,proposed_changes:[{...change,field_path:'severity',proposed_value:'Approved'}]},{}));});
test('copilot never confirms generated hypotheses',()=>{const r=validateProposal({...response,intent:'analyze',proposed_changes:[{...change,field_path:'causes',proposed_value:[{id:'hypothesis',detail:'Possible cooling variation',evidence:'',confirmed:true}]}]},{});assert.equal(r.proposed_changes[0].proposed_value[0].confirmed,false);});
test('unavailable copilot gives setup error rather than fabricated suggestions',async()=>{const original=global.fetch;global.fetch=async()=>{throw new Error('unavailable');};try{await assert.rejects(()=>propose({prompt:'Run 5 Whys',current:{}}),/configure GROQ_API_KEY/);}finally{global.fetch=original;}});
