import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { createApp } from '../server/index.js';
import { createStore } from '../server/store.js';
let server, base, dir;
before(async () => { delete process.env.OPENAI_API_KEY; delete process.env.APP_ACCESS_TOKEN; dir = await mkdtemp(join(tmpdir(), 'clarity-test-')); const app = await createApp({ dataDir: dir, serveUI: false }); server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith('clarity-test-'));
    await rm(dir, { recursive: true, force: true });
});
async function call(path, method = 'GET', body) { const res = await fetch(base + '/api' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); return { status: res.status, data: await res.json() }; }
const incident = { title: 'Cooling flow variation during crystallization', product: 'Metformin HCl', batch: 'TEST-26-0001', description: 'Temperature reached 38 C against the approved range of 25-30 C. Batch is on hold.', owner: 'Test Investigator' };
test('health reports transparent local assistant mode', async () => { const r = await call('/health'); assert.equal(r.status, 200); assert.equal(r.data.aiMode, 'rule-based'); });
test('create, reopen and update are persisted with server-owned IDs and audit history', async () => {
    const created = await call('/investigations', 'POST', { ...incident, id: 'spoof', audit: [{ action: 'spoof' }] });
    assert.equal(created.status, 201);
    assert.notEqual(created.data.id, 'spoof');
    assert.equal(created.data.revision, 1);
    assert.equal(created.data.audit.length, 1);
    const reopened = await call('/investigations/' + created.data.id);
    assert.equal(reopened.data.title, incident.title);
    const updated = await call('/investigations/' + created.data.id, 'PUT', { ...reopened.data, containment: 'QA notified; material held.' });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.revision, 2);
    assert.equal(updated.data.audit.length, 2);
    const disk = JSON.parse(await readFile(join(dir, 'investigations.json'), 'utf8'));
    assert.equal(disk.records.find(r => r.id === created.data.id).containment, 'QA notified; material held.');
    const restarted = await createStore(dir);
    assert.equal(restarted.get(created.data.id).revision, 2);
});
test('stale updates return a conflict and preserve the newer data', async () => { const { data: r } = await call('/investigations', 'POST', incident); await call('/investigations/' + r.id, 'PUT', { ...r, title: 'A newer version of the investigation' }); const stale = await call('/investigations/' + r.id, 'PUT', { ...r, title: 'Stale update attempt' }); assert.equal(stale.status, 409); assert.equal((await call('/investigations/' + r.id)).data.title, 'A newer version of the investigation'); });
test('parallel creates receive distinct IDs and preserve all records', async () => { const results = await Promise.all(Array.from({ length: 5 }, (_, i) => call('/investigations', 'POST', { ...incident, title: `Parallel record number ${i}` }))); assert.equal(new Set(results.map(r => r.data.id)).size, 5); assert.ok(results.every(r => r.status === 201)); });
test('invalid records and premature closure are rejected', async () => { assert.equal((await call('/investigations', 'POST', { title: '' })).status, 422); const close = await call('/investigations', 'POST', { ...incident, status: 'Closed', reviewedBy: 'Someone', conclusion: 'Not enough evidence' }); assert.equal(close.status, 422); assert.match(close.data.error, /Before closing/); });
test('evidenced investigation with reviewed, complete CAPAs can close', async () => {
    const body = { ...incident, status: 'Closed', reviewedBy: 'Qualified Investigator', conclusion: 'Evidence review established the control gap. Correction has been verified.', whys: [{ question: 'Why did cooling vary?', answer: 'Cooling valve stuck.', evidence: 'Maintenance record MR-001.', confirmed: true }], evidence: [{ id: 'ev1', name: 'Maintenance record MR-001', type: 'Record', notes: 'Valve fault found and corrected.' }], causes: [{ id: 'cause1', detail: 'Cooling valve control failed.', evidence: 'Maintenance record MR-001.', confirmed: true }], capas: [{ id: 'capa1', type: 'Corrective', action: 'Replace valve and verify cooling function.', owner: 'Engineering', dueDate: '2026-10-28', status: 'Complete', effectiveness: 'Three subsequent batches met the approved temperature criteria.', confirmed: true }] };
    const r = await call('/investigations', 'POST', body);
    assert.equal(r.status, 201);
    assert.equal(r.data.status, 'Closed');
});
test('text and email intake preserve the source and extract labeled fields', async () => { const form = new FormData(); const source = 'Subject: Cooling deviation\nProduct: Metformin HCl\nBatch: MET-26-1042\nDate: 2026-10-27\nContainment: Batch held\nTemperature exceeded the approved range.'; form.append('text', source); const res = await fetch(base + '/api/extract', { method: 'POST', body: form }); const r = await res.json(); assert.equal(res.status, 200); assert.equal(r.fields.product, 'Metformin HCl'); assert.equal(r.fields.batch, 'MET-26-1042'); assert.equal(r.sourceText.replaceAll('\r\n', '\n'), source); assert.equal(r.mode, 'rule-based'); });
test('intake handles TXT uploads, invalid PDFs, and empty sources', async () => {
    const txt = new FormData();
    txt.append('file', new Blob(['Subject: Raw material variation\nBatch: ABC-26-1234'], { type: 'text/plain' }), 'incident.txt');
    let res = await fetch(base + '/api/extract', { method: 'POST', body: txt });
    assert.equal(res.status, 200);
    const bad = new FormData();
    bad.append('file', new Blob(['not a PDF'], { type: 'application/pdf' }), 'bad.pdf');
    res = await fetch(base + '/api/extract', { method: 'POST', body: bad });
    assert.equal(res.status, 400);
    assert.equal((await call('/extract', 'POST', { text: '' })).status, 422);
});
test('a valid text PDF extracts actual incident content', async () => {
    const content = 'BT /F1 12 Tf 40 750 Td (Subject: Reactor excursion) Tj 0 -20 Td (Batch: MET-26-1042) Tj 0 -20 Td (Product: Metformin HCl) Tj ET';
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n` + offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const form = new FormData();
    form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'incident.pdf');
    const res = await fetch(base + '/api/extract', { method: 'POST', body: form });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.match(body.sourceText, /MET-26-1042/);
    assert.equal(body.fields.product, 'Metformin HCl');
});
test('suggestions are hypotheses and never mutate saved records', async () => { const { data: r } = await call('/investigations', 'POST', incident); const result = await call('/analyze', 'POST', r); assert.equal(result.status, 200); assert.equal(result.data.mode, 'rule-based'); assert.equal(result.data.suggestions.whys.length, 5); assert.ok(result.data.suggestions.whys.every(w => w.answer.startsWith('Hypothesis:'))); assert.equal((await call('/investigations/' + r.id)).data.causes.length, 0); });
test('unknown IDs and cross-origin writes are rejected', async () => { assert.equal((await call('/investigations/no-such-id')).status, 404); const res = await fetch(base + '/api/investigations', { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: JSON.stringify(incident) }); assert.equal(res.status, 403); });
test('invalid calendar dates are rejected and suggestion provenance persists',async()=>{
    assert.equal((await call('/investigations','POST',{...incident,dueDate:'2026-02-31'})).status,422);
    const result=await call('/investigations','POST',{...incident,intakeMode:'rule-based',intakeReviewed:false,causes:[{id:'suggested-1',detail:'Hypothesis requiring investigation.',evidence:'',confirmed:false,source:'AI'}]});
    assert.equal(result.status,201);assert.equal(result.data.causes[0].source,'AI');assert.equal(result.data.causes[0].confirmed,false);
    const closed=await call('/investigations/'+result.data.id,'PUT',{...result.data,status:'Closed'});assert.equal(closed.status,422);assert.match(closed.data.error,/imported incident fields/);
});
test('optional access token protects API endpoints',async()=>{
    process.env.APP_ACCESS_TOKEN='test-workspace-gate';
    try{
        assert.equal((await call('/investigations')).status,401);
        const response=await fetch(base+'/api/investigations',{headers:{Authorization:'Bearer test-workspace-gate'}});assert.equal(response.status,200);
        const invalid=await fetch(base+'/api/health',{headers:{Authorization:'Bearer wrong-token'}});assert.equal(invalid.status,401);
    }finally{delete process.env.APP_ACCESS_TOKEN;}
});
