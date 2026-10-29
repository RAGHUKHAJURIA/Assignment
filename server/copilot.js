import {z} from 'zod';
import {investigationSchema} from './schema.js';
const allowed=['title','product','batch','department','category','severity','owner','occurredOn','dueDate','description','containment','manufacturingStage','equipment','whys','factors','causes','gaps','capas','evidence'];
export const proposalSchema=z.object({assistant_message:z.string().max(10000),intent:z.enum(['intake','edit','analyze','question']),proposed_changes:z.array(z.object({field_path:z.enum(allowed),proposed_value:z.unknown(),source_type:z.enum(['document','user_prompt','inference']),source_reference:z.string().max(4000),reason:z.string().max(4000),confidence:z.enum(['high','medium','low'])})).max(25),missing_information:z.array(z.string()).default([]),warnings:z.array(z.string()).default([])});
export function validateProposal(value,current){
 const result=proposalSchema.parse(value);const seen=new Set();
 result.proposed_changes=result.proposed_changes.map(c=>{
  if(seen.has(c.field_path))throw Object.assign(new Error('Duplicate proposed field.'),{status:502});seen.add(c.field_path);
  let v=c.proposed_value;
  if(['whys','factors','causes','capas'].includes(c.field_path)&&Array.isArray(v))v=v.map(item=>({...item,confirmed:false,source:'AI'}));
  const checked=investigationSchema.shape[c.field_path].parse(v);
  return {...c,proposed_value:checked,current_value:current[c.field_path]??null,field_label:c.field_path};
 });return result;
}
export async function propose(body){
 const input=z.object({prompt:z.string().min(1).max(40000),current:z.record(z.unknown()),history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(10000)})).max(20).default([])}).parse(body);
 try{
  const response=await fetch((process.env.COPILOT_URL||'http://127.0.0.1:8001')+'/propose',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(100000)});
  const data=await response.json();if(!response.ok)throw Object.assign(new Error(typeof data.detail==='string'?data.detail:'Copilot service rejected this request.'),{status:response.status});
  return validateProposal(data,input.current);
 }catch(e){if(e.status)throw e;
 if(e.name==='ZodError'||e instanceof SyntaxError)throw Object.assign(new Error('The copilot returned an invalid proposal. No fields were changed. Retry with a more specific request.'),{status:502});
 throw Object.assign(new Error('Cannot reach the Python copilot at '+(process.env.COPILOT_URL||'http://127.0.0.1:8001')+'. Start it with .\\.venv\\Scripts\\python.exe -m uvicorn copilot.main:app --host 127.0.0.1 --port 8001, and configure GROQ_API_KEY in the project .env. No fields were changed.'),{status:503});}
}
