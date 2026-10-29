import {propose} from './copilot.js';
import express from 'express';
import multer from 'multer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createStore } from './store.js';
import { investigationSchema, validateClosure } from './schema.js';
import { extract, analyze, aiMode } from './ai.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function createApp({ dataDir = process.env.DATA_DIR || resolve(root, 'data'), serveUI = true } = {}) {
    const app = express();
    const store = await createStore(dataDir);
    app.disable('x-powered-by');
    app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Referrer-Policy', 'same-origin'); res.set('X-Frame-Options', 'DENY'); if (req.path.startsWith('/api'))
        res.set('Cache-Control', 'no-store'); next(); });
    app.use('/api', (req, res, next) => {
        const origin = req.get('origin');
        if (origin) {
            try {
                if (new URL(origin).host !== req.get('host'))
                    return res.status(403).json({ error: 'Cross-origin requests are not permitted.' });
            } catch {
                return res.status(403).json({ error: 'Invalid request origin.' });
            }
        }
        if (process.env.APP_ACCESS_TOKEN) {
            const token = req.get('authorization')?.replace(/^Bearer /, '') || '';
            const expected = Buffer.from(process.env.APP_ACCESS_TOKEN);
            const provided = Buffer.from(token);
            if (expected.length !== provided.length || !timingSafeEqual(expected, provided))
                return res.status(401).json({ error: 'Enter your workspace access token in Settings.' });
        }
        next();
    });
    app.use(express.json({ limit: '1mb' }));
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
    const rates = new Map();
    app.use(['/api/extract', '/api/analyze'], (req, res, next) => {
        const key = req.ip;
        const now = Date.now();
        let entry = rates.get(key);
        if (!entry || now - entry.start > 60000) {
            entry = { start: now, count: 0 };
            rates.set(key, entry);
        }
        if (++entry.count > 15)
            return res.status(429).json({ error: 'Too many assistant requests. Please wait one minute.' });
        if (rates.size > 1000)
            for (const [k, v] of rates)
                if (now - v.start > 60000)
                    rates.delete(k);
        next();
    });
    app.get('/api/health', (_req, res) => res.json({ status: 'ok', aiMode: aiMode(), model: aiMode() === 'live' ? (process.env.OPENAI_MODEL || 'gpt-4.1-mini') : null, authenticated: !!process.env.APP_ACCESS_TOKEN }));
    app.get('/api/investigations', (_req, res) => res.json(store.list()));
    app.get('/api/investigations/:id', (req, res) => { const record = store.get(req.params.id); if (!record)
        return res.status(404).json({ error: 'Investigation not found.' }); res.json(record); });
    app.post('/api/investigations', async (req, res) => {
        const record = investigationSchema.parse(req.body);
        validateClosure(record);
        const now = new Date().toISOString();
        const result = await store.mutate(db => { const year = new Date().getFullYear(); const max = db.records.filter(r => r.id.startsWith(`INV-${year}-`)).reduce((n, r) => Math.max(n, Number(r.id.split('-')[2]) || 0), 0); const entry = { ...record, id: `INV-${year}-${String(max + 1).padStart(3, '0')}`, revision: 1, createdAt: now, updatedAt: now, audit: [{ at: now, actor: record.owner || 'Local investigator', action: 'Investigation created', revision: 1 }] }; db.records.unshift(entry); return entry; });
        res.status(201).json(result);
    });
    app.put('/api/investigations/:id', async (req, res) => {
        const record = investigationSchema.parse(req.body);
        validateClosure(record);
        const result = await store.mutate(db => { const i = db.records.findIndex(r => r.id === req.params.id); if (i < 0)
            throw Object.assign(new Error('Investigation not found.'), { status: 404 }); const old = db.records[i]; if (req.body.revision !== old.revision)
            throw Object.assign(new Error('This record has been updated elsewhere. Reopen it before applying your changes.'), { status: 409 }); const now = new Date().toISOString(); const fields = Object.keys(record).filter(k => JSON.stringify(old[k]) !== JSON.stringify(record[k])); const next = { ...old, ...record, revision: old.revision + 1, updatedAt: now, audit: [...old.audit, { at: now, actor: record.reviewedBy || record.owner || 'Local investigator', action: fields.length ? `Updated ${fields.join(', ')}` : 'Record reviewed and saved', revision: old.revision + 1 }] }; db.records[i] = next; return next; });
        res.json(result);
    });
    app.post('/api/extract', upload.single('file'), async (req, res) => {
        let text = typeof req.body.text === 'string' ? req.body.text : '';
        let filename = 'Pasted incident text';
        if (req.file) {
            filename = req.file.originalname.slice(0, 200);
            if (/\.pdf$/i.test(filename)) {
                if (req.file.buffer.subarray(0, 5).toString() !== '%PDF-')
                    return res.status(400).json({ error: 'This file is not a valid PDF.' });
                try {
                    const require = createRequire(import.meta.url);
                    const pdf = require('pdf-parse/lib/pdf-parse.js');
                    text = (await pdf(new Uint8Array(req.file.buffer), { max: 50, version: 'v2.0.550' })).text;
                }
                catch (error) {
                    console.warn('PDF extraction failed:', error.message);
                    return res.status(422).json({ error: 'Could not read this PDF. Try an unencrypted, text-based PDF, or paste the incident text.' });
                }
            }
            else if (/\.(txt|eml)$/i.test(filename))
                text = req.file.buffer.toString('utf8');
            else
                return res.status(400).json({ error: 'Choose a PDF, TXT or EML file.' });
        }
        if (!text.trim())
            return res.status(422).json({ error: 'No readable text found. Scanned PDFs require OCR; please paste the text instead.' });
        if (text.length > 40000)
            return res.status(413).json({ error: 'Please limit the incident source to 40,000 characters (about 10 pages).' });
        const fields = await extract(text);
        res.json({ fields, sourceText: text, filename, mode: aiMode() });
    });
    app.post('/api/analyze', async (req, res) => { const record = investigationSchema.parse(req.body); if (!record.description.trim())
        return res.status(422).json({ error: 'Add an incident description before requesting suggestions.' }); res.json({ suggestions: await analyze(record), mode: aiMode(), generatedAt: new Date().toISOString(), requestId: randomUUID() }); });
    app.post(['/api/ai/intake','/api/ai/analyze'], async(req,res)=>res.json(await propose(req.body)));
    app.post('/api/ai/intake-file', upload.single('file'),async(req,res)=>{
        if(!req.file || req.file.mimetype!=='application/pdf' || req.file.buffer.subarray(0,5).toString()!=='%PDF-')return res.status(400).json({error:'Upload a valid PDF document.'});
        let source;
        try{const require=createRequire(import.meta.url);source=(await require('pdf-parse/lib/pdf-parse.js')(new Uint8Array(req.file.buffer),{max:50,version:'v2.0.550'})).text;}catch{return res.status(422).json({error:'Cannot extract this PDF. Use an unencrypted text-based PDF.'});}
        if(!source.trim())return res.status(422).json({error:'No selectable text found. This scanned PDF requires OCR.'});
        if(source.length>35000)return res.status(413).json({error:'PDF text exceeds 35,000 characters. Upload a shorter report.'});
        let current,history;try{current=JSON.parse(req.body.current);history=JSON.parse(req.body.history||'[]');}catch{return res.status(422).json({error:'Invalid investigation state.'});}
        const result=await propose({current,history,prompt:'Extract incident facts from this document. '+(req.body.prompt||'')+'\nDOCUMENT:\n'+source});
        res.json({...result,document_id:randomUUID(),extraction:'Text extracted successfully'});
    });
    app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
    if (serveUI) {
        if (process.argv.includes('--production')) {
            app.use(express.static(resolve(root, 'dist')));
            app.get('/{*path}', (_req, res) => res.sendFile(resolve(root, 'dist/index.html')));
        }
        else {
            const { createServer } = await import('vite');
            const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
            app.use(vite.middlewares);
        }
    }
    app.use((err, _req, res, _next) => {
        if (err.name === 'ZodError')
            return res.status(422).json({ error: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
        if (err.code === 'LIMIT_FILE_SIZE')
            return res.status(413).json({ error: 'File too large. The maximum upload size is 10 MB.' });
        const status = err.status || (err instanceof multer.MulterError ? 400 : 500);
        if (status >= 500)
            console.error(err.message);
        res.status(status).json({ error: status === 500 ? 'The server could not complete this request. Your saved data has not been changed.' : err.message });
    });
    return app;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const app = await createApp();
    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || '127.0.0.1';
    app.listen(port, host, () => console.log(`Clarity is running at http://${host}:${port} (${aiMode()} assistant)`));
}
