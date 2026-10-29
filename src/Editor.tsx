import Copilot from './Copilot';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCheck, ChevronRight, ClipboardCheck, Download, FileText, FlaskConical, Lightbulb, LoaderCircle, Mail, Plus, ShieldCheck, Sparkles, Trash2, UploadCloud, X } from 'lucide-react';
import { api, download } from './api';
import { RecordItem, newRecord, uid, Capa, Why, Origin } from './types';
export function Modal({ title, subtitle, children, onClose, wide = false }: {
    title: string;
    subtitle?: string;
    children: ReactNode;
    onClose: () => void;
    wide?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => { const d = ref.current; d?.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { d?.close(); document.body.style.overflow = old; }; }, []);
    return <dialog ref={ref} className={`modal ${wide ? 'wide-modal' : ''}`} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === ref.current) {
        const r = ref.current.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            onClose();
    } }} aria-label={title}><div className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button close-button" aria-label="Close dialog" onClick={onClose}><X size={21}/></button></div>{children}</dialog>;
}
export function IntakeModal({ onClose, onCreate, mode }: {
    onClose: () => void;
    onCreate: (r: RecordItem) => void;
    mode: string;
}) {
    const [tab, setTab] = useState('Upload document');
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [drag, setDrag] = useState(false);
    async function extract() { setBusy(true); setError(''); try {
        const form = new FormData();
        if (tab === 'Upload document') {
            if (!file)
                throw new Error('Choose a document first.');
            form.append('file', file);
        }
        else {
            if (!text.trim())
                throw new Error('Paste the incident text first.');
            form.append('text', text);
        }
        const result = await api<{
            fields: Partial<RecordItem>;
            sourceText: string;
            filename: string;
            mode: string;
        }>('/extract', { method: 'POST', body: form });
        onCreate({ ...newRecord(), ...result.fields, sourceText: result.sourceText, intakeMode: result.mode === 'live' ? 'live' : 'rule-based', intakeReviewed: false, evidence: [{ id: uid(), name: result.filename, type: 'Document', notes: 'Imported source text. Extracted fields are unconfirmed suggestions; verify against the original source.' }] });
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    function choose(f: File | undefined) { if (!f)
        return; if (f.size > 10 * 1024 * 1024) {
        setError('Choose a file smaller than 10 MB.');
        return;
    } if (!/\.(pdf|txt|eml)$/i.test(f.name)) {
        setError('Choose a PDF, TXT or EML file.');
        return;
    } setError(''); setFile(f); }
    return <Modal title="Start a new investigation" subtitle="Every improvement begins with a better understanding." onClose={() => { if (!busy)
        onClose(); }}><div className="intake-body"><div className="notice ai-notice"><Sparkles size={19}/><div><strong>Let’s start with what you know.</strong><p>{mode === 'live' ? 'AI can extract incident details for your review. Source text is sent to the configured AI provider.' : 'Rule-based mode · Extract labeled fields locally, then review and complete the details.'}</p></div></div><div className="intake-tabs">{['Upload document', 'Paste text', 'Email'].map((t, i) => { const Icon = [UploadCloud, FileText, Mail][i]; return <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}><Icon size={16}/>{t}</button>; })}</div>{tab === 'Upload document' ? <label className={`dropzone ${drag ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files[0]); }}><input type="file" accept=".pdf,.txt,.eml" onChange={e => choose(e.target.files?.[0])}/><span className="upload-icon"><UploadCloud size={29}/></span><strong>{file ? file.name : 'Drop your incident document here'}</strong><span>{file ? `${(file.size / 1024).toFixed(1)} KB · Click to replace` : 'or click to browse your files'}</span><small>PDF, TXT or EML · Up to 10 MB · Text-based PDFs</small></label> : <label className="field">{tab === 'Email' ? 'Paste the email, including its subject and body' : 'Incident details'}<textarea rows={9} value={text} maxLength={40000} onChange={e => setText(e.target.value)} placeholder={tab === 'Email' ? 'Subject: Reactor temperature excursion\nFrom: Production team\n\nProduct: Metformin HCl\nBatch: MET-26-1042\nDate: 2026-10-27\nDuring crystallization, the temperature…' : 'Describe what happened, where and when. Include the product, batch number, observed conditions and immediate actions.'}/><small>{text.length.toLocaleString()} / 40,000 characters</small></label>}{error && <div className="inline-error" role="alert">{error}</div>}<div className="intake-footer-note"><ShieldCheck size={15}/>Extracted information is a suggestion. Review every field before saving.</div></div><div className="modal-footer"><button className="text-button" disabled={busy} onClick={() => onCreate(newRecord())}>Enter details manually <ArrowRight size={14}/></button><button className="button primary" disabled={busy} onClick={extract}>{busy ? <LoaderCircle size={16} className="spin"/> : <Sparkles size={16}/>} {busy ? 'Extracting details…' : 'Extract & review'}</button></div></Modal>;
}
const steps = ['Incident details', 'Evidence', '5 Whys', 'Causes & factors', 'CAPA & review'];
type Suggestions = {
    whys: Omit<Why, 'confirmed'>[];
    factors: {
        category: string;
        detail: string;
    }[];
    causes: {
        detail: string;
        evidence: string;
    }[];
    gaps: string[];
    capas: Pick<Capa, 'type' | 'action' | 'effectiveness'>[];
};
export function InvestigationEditor({ initial, mode, onClose, onSaved }: {
    initial: RecordItem;
    mode: string;
    onClose: () => void;
    onSaved: (r: RecordItem) => void;
}) {
    const [r, setR] = useState(() => structuredClone(initial));
    const [step, setStep] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [dirty, setDirty] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
    const [suggestionMode, setSuggestionMode] = useState(mode);
    const [confirmClose, setConfirmClose] = useState(false);
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const snapshot = useRef(JSON.stringify(initial));
    useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirty) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
    function patch(p: Partial<RecordItem>) { setError(''); setR(old => ({ ...old, ...p, ...(old.intakeMode && old.intakeMode !== 'manual' && ['title', 'product', 'batch', 'description', 'containment', 'occurredOn', 'category', 'severity', 'department'].some(k => k in p) ? { intakeReviewed: false } : {}) })); setDirty(true); setMessage(''); }
    function close() { if (busy)
        return; if (dirty)
        setConfirmClose(true);
    else
        onClose(); }
    async function save() { setError(''); if (r.title.trim().length < 3) {
        setStep(0);
        setError('Enter an investigation title with at least 3 characters.');
        return;
    } setBusy(true); try {
        const result = await api<RecordItem>(r.id ? `/investigations/${r.id}` : '/investigations', { method: r.id ? 'PUT' : 'POST', body: JSON.stringify(r) });
        snapshot.current = JSON.stringify(result);
        setR(result);
        setDirty(false);
        setMessage('Investigation saved.');
        onSaved(result);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function generate() { setBusy(true); setError(''); try {
        const result = await api<{
            suggestions: Suggestions;
            mode: string;
        }>('/analyze', { method: 'POST', body: JSON.stringify(r) });
        setSuggestionMode(result.mode);
        setSuggestions(result.suggestions);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    function applySuggestions() { if (!suggestions)
        return; const source: Origin = suggestionMode === 'live' ? 'AI' : 'Rule-based'; patch({ whys: r.whys.length ? r.whys : suggestions.whys.map(w => ({ ...w, confirmed: false, suggested: true, source })), factors: [...r.factors, ...suggestions.factors.map(f => ({ ...f, confirmed: false, source }))].slice(0, 30), causes: [...r.causes, ...suggestions.causes.map(c => ({ ...c, id: uid(), confirmed: false, source }))].slice(0, 30), gaps: [...new Set([...r.gaps, ...suggestions.gaps])].slice(0, 30), capas: [...r.capas, ...suggestions.capas.map(c => ({ ...c, id: uid(), owner: '', dueDate: '', status: 'Open' as const, confirmed: false, source }))].slice(0, 50) }); setSuggestions(null); setStep(2); setMessage('Suggestions added for review. Existing 5 Whys answers have been preserved.'); }
    async function importEvidence() { if (!evidenceFile)
        return; setBusy(true); setError(''); try {
        const form = new FormData();
        form.append('file', evidenceFile);
        const result = await api<{
            sourceText: string;
            filename: string;
        }>('/extract', { method: 'POST', body: form });
        patch({ evidence: [...r.evidence, { id: uid(), name: result.filename, type: 'Document', notes: result.sourceText.slice(0, 10000) }] });
        setEvidenceFile(null);
        setMessage('Document text attached as evidence. Original binary files are not retained.');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    const field = (key: 'manufacturingStage' | 'equipment' | 'title' | 'product' | 'batch' | 'owner' | 'occurredOn' | 'dueDate' | 'description' | 'containment' | 'conclusion' | 'reviewedBy', label: string, options: {
        type?: string;
        area?: boolean;
        required?: boolean;
        placeholder?: string;
    } = {}) => <label className={`field ${options.area ? 'full-width' : ''}`}>{label}{options.required && <span className="required">*</span>}{options.area ? <textarea rows={key === 'description' ? 5 : 3} value={r[key]} maxLength={10000} placeholder={options.placeholder} onChange={e => patch({ [key]: e.target.value })}/> : <input type={options.type || 'text'} required={options.required} value={r[key]} maxLength={key === 'title' ? 200 : 100} placeholder={options.placeholder} onChange={e => patch({ [key]: e.target.value })}/>}</label>;
    const select = (key: 'department' | 'category' | 'severity' | 'status', label: string, values: string[]) => <label className="field">{label}<select value={r[key]} onChange={e => patch({ [key]: e.target.value })}>{values.map(v => <option key={v}>{v}</option>)}</select></label>;
    function whyPatch(i: number, p: Partial<Why>) { patch({ whys: r.whys.map((w, j) => j === i ? { ...w, ...p, confirmed: p.confirmed ?? false } : w) }); }
    function capaPatch(id: string, p: Partial<Capa>) { patch({ capas: r.capas.map(c => c.id === id ? { ...c, ...p, confirmed: p.confirmed ?? false } : c) }); }
    return <Modal wide title={r.id || 'New investigation'} subtitle={r.id ? `${r.product || 'API manufacturing'} · Revision ${r.revision} · ${r.status}` : 'Review the details and start building your investigation.'} onClose={close}>
    <div className="editor-layout copilot-layout"><nav className="editor-steps">{steps.map((s, i) => <button key={s} className={step === i ? 'active' : ''} onClick={() => { setStep(i); setError(''); }}><span>{i + 1}</span><strong>{s}</strong><ChevronRight size={14}/></button>)}<div className="editor-ai-note"><ShieldCheck size={23}/><strong>Your evidence.<br />Your judgment.</strong><p>AI suggestions require your review and confirmation.</p><span>{mode === 'live' ? 'LIVE AI CONNECTED' : 'RULE-BASED MODE'}</span></div></nav>
    <div className="editor-content">
      {r.aiFields?.length ? <div className="notice"><p>AI suggestions awaiting review: {r.aiFields.join(', ')}</p><button onClick={()=>patch({aiFields:[]})}>Mark fields reviewed</button></div> : null}<div className="step-heading"><div><span className="eyebrow">STEP {step + 1} OF 5</span><h3>{steps[step]}</h3><p>{['Capture the facts. Keep observations separate from assumptions.', 'Collect the records that support your investigation.', 'Follow the evidence from the event to the underlying conditions.', 'Consider the contributing factors and challenge each potential cause.', 'Turn findings into measurable improvements, then review your record.'][step]}</p></div>{step > 1 && <button className="button compact ai-button" disabled={busy} onClick={generate}>{busy ? <LoaderCircle size={15} className="spin"/> : <Sparkles size={15}/>}Suggest with {mode === 'live' ? 'AI' : 'assistant'}</button>}</div>
      {error && <div className="inline-error" role="alert">{error}</div>}{message && <div className="success-message" role="status"><Check size={15}/>{message}</div>}
      {step === 0 && <>{r.intakeMode && r.intakeMode !== 'manual' && <div className="notice ai-notice"><Sparkles size={18}/><div><strong>{r.intakeMode === 'live' ? 'AI-extracted suggestions' : 'Rule-based extraction suggestions'}</strong><p>Review each imported field against the original source. Missing details must be completed by the investigator.</p><label className="checkbox-label confirmation"><input type="checkbox" checked={!!r.intakeReviewed} onChange={e => patch({ intakeReviewed: e.target.checked })}/>I have reviewed the imported incident details</label></div></div>}<div className="form-grid">{field('title', 'Investigation title', { required: true, placeholder: 'What happened?' })}{select('severity', 'Priority', ['Critical', 'Major', 'Minor'])}{field('manufacturingStage','Manufacturing stage')}{field('equipment','Equipment involved')}{field('product', 'API / product', { placeholder: 'e.g. Metformin HCl' })}{field('batch', 'Batch number', { placeholder: 'e.g. MET-26-1042' })}{select('category', 'Deviation category', ['Process deviation', 'Out of specification', 'Equipment', 'Documentation', 'Environmental', 'Material'])}{select('department', 'Department', ['Production', 'Quality Assurance', 'Quality Control', 'Engineering', 'Warehouse'])}{field('occurredOn', 'Date observed', { type: 'date' })}{field('dueDate', 'Investigation due date', { type: 'date' })}{field('owner', 'Investigation owner')}{select('status', 'Investigation status', ['Draft', 'In progress', 'In review', 'Closed'])}{field('description', 'Incident description', { area: true, placeholder: 'Describe the event, actual versus expected conditions, and affected equipment or materials.' })}{field('containment', 'Immediate containment actions', { area: true, placeholder: 'Record actions already taken, material holds, and notifications.' })}</div>{r.sourceText && <details className="source-details"><summary><FileText size={15}/>View imported source text</summary><pre>{r.sourceText}</pre></details>}<div className="notice"><Lightbulb size={18}/><p>Priority, category and extracted details are provisional until reviewed. Saving records your edits; final quality decisions remain with qualified personnel.</p></div></>}
      {step === 1 && <><div className="evidence-upload"><UploadCloud size={24}/><div><strong>Bring your supporting records</strong><p>Import text from a PDF, TXT or EML. Keep original files in your controlled document system.</p></div><input aria-label="Evidence document" type="file" accept=".pdf,.txt,.eml" onChange={e => setEvidenceFile(e.target.files?.[0] || null)}/><button className="button compact" disabled={!evidenceFile || busy} onClick={importEvidence}>{busy ? <LoaderCircle size={14} className="spin"/> : <Plus size={14}/>}Import text</button></div><div className="section-title"><h4>Supporting evidence <span className="count">{r.evidence.length}</span></h4><button className="text-button" onClick={() => patch({ evidence: [...r.evidence, { id: uid(), name: 'New evidence record', notes: '', type: 'Record' }] })}><Plus size={15}/>Add evidence</button></div>{r.evidence.map(ev => <div className="form-card" key={ev.id}><div className="card-title"><span><FileText size={16}/>Evidence record</span><button className="icon-button" aria-label="Remove evidence" onClick={() => patch({ evidence: r.evidence.filter(x => x.id !== ev.id) })}><Trash2 size={15}/></button></div><div className="form-grid"><label className="field">Record name or controlled document reference<input value={ev.name} maxLength={200} onChange={e => patch({ evidence: r.evidence.map(x => x.id === ev.id ? { ...x, name: e.target.value } : x) })}/></label><label className="field">Evidence type<select value={ev.type} onChange={e => patch({ evidence: r.evidence.map(x => x.id === ev.id ? { ...x, type: e.target.value as typeof ev.type } : x) })}>{['Document', 'Observation', 'Record', 'Interview'].map(t => <option key={t}>{t}</option>)}</select></label><label className="field full-width">Observation, reference and relevant findings<textarea rows={3} value={ev.notes} maxLength={10000} placeholder="Record the source, date, relevant findings and any verification needed." onChange={e => patch({ evidence: r.evidence.map(x => x.id === ev.id ? { ...x, notes: e.target.value } : x) })}/></label></div></div>)}{!r.evidence.length && <div className="empty"><FileText size={28}/><strong>No supporting evidence yet</strong><p>Add a record or import document text to begin.</p></div>}</>}
      {step === 2 && <><div className="problem-statement"><span>THE OBSERVED EVENT</span><strong>{r.title || 'Add an incident title first'}</strong></div>{r.whys.map((w, i) => <div className={`why-card ${w.confirmed ? 'confirmed-card' : ''}`} key={i}><div className="why-number">{i + 1}</div><div className="why-content"><div className="card-title"><span>WHY {i + 1}{w.suggested && !w.confirmed && <span className="suggestion-tag"><Sparkles size={11}/>{w.source || 'Assistant'} suggestion</span>}</span><button className="icon-button" aria-label={`Remove Why ${i + 1}`} onClick={() => patch({ whys: r.whys.filter((_, j) => j !== i) })}><Trash2 size={14}/></button></div><label className="field">Question<input value={w.question} onChange={e => whyPatch(i, { question: e.target.value })}/></label><label className="field">Investigator answer / hypothesis<textarea rows={3} value={w.answer} onChange={e => whyPatch(i, { answer: e.target.value })}/></label><label className="field">Supporting evidence<input value={w.evidence} placeholder="Reference an evidence record and explain how it supports this answer" onChange={e => whyPatch(i, { evidence: e.target.value })}/></label><label className="checkbox-label confirmation"><input type="checkbox" checked={w.confirmed} disabled={!w.answer.trim() || !w.evidence.trim()} onChange={e => whyPatch(i, { confirmed: e.target.checked })}/>I have reviewed this answer against supporting evidence</label></div></div>)}{r.whys.length < 5 && <button className="add-row" onClick={() => patch({ whys: [...r.whys, { question: r.whys.length ? 'Why did the preceding condition occur?' : 'Why did the observed deviation occur?', answer: '', evidence: '', confirmed: false }] })}><Plus size={17}/>Add Why {r.whys.length + 1}</button>}{!r.whys.length && <div className="notice"><Lightbulb size={18}/><p>Start with the observed event. Ask why it occurred, support the answer with evidence, and use that answer to form your next question. You can also request suggestions.</p></div>}</>}
      {step === 3 && <><div className="section-title"><h4>Contributing factors</h4><button className="text-button" onClick={() => patch({ factors: [...r.factors, { category: 'Method', detail: '', confirmed: false }] })}><Plus size={15}/>Add factor</button></div><div className="factor-grid">{r.factors.map((f, i) => <div className="form-card factor-card" key={i}><div className="card-title"><select aria-label="Factor category" value={f.category} onChange={e => patch({ factors: r.factors.map((x, j) => i === j ? { ...x, category: e.target.value, confirmed: false } : x) })}>{['People', 'Method', 'Machine', 'Material', 'Measurement', 'Environment'].map(c => <option key={c}>{c}</option>)}</select><button className="icon-button" aria-label="Remove factor" onClick={() => patch({ factors: r.factors.filter((_, j) => j !== i) })}><Trash2 size={14}/></button></div>{f.source && !f.confirmed && <span className="suggestion-tag factor-suggestion">{f.source} suggestion</span>}<textarea aria-label="Factor details" value={f.detail} rows={4} onChange={e => patch({ factors: r.factors.map((x, j) => i === j ? { ...x, detail: e.target.value, confirmed: false } : x) })}/><label className="checkbox-label confirmation"><input type="checkbox" checked={f.confirmed} disabled={!f.detail.trim()} onChange={e => patch({ factors: r.factors.map((x, j) => i === j ? { ...x, confirmed: e.target.checked } : x) })}/>Reviewed by investigator</label></div>)}</div>{!r.factors.length && <p className="muted">Consider People, Method, Machine, Material, Measurement and Environment.</p>}<div className="section-title"><h4>Potential root causes</h4><button className="text-button" onClick={() => patch({ causes: [...r.causes, { id: uid(), detail: '', evidence: '', confirmed: false }] })}><Plus size={15}/>Add cause</button></div>{r.causes.map(c => <div className={`form-card ${c.confirmed ? 'confirmed-card' : ''}`} key={c.id}><div className="card-title"><span><Lightbulb size={16}/>{c.confirmed ? 'Investigator-confirmed cause' : 'Unconfirmed potential cause'}{c.source && !c.confirmed && <span className="suggestion-tag">{c.source} suggestion</span>}</span><button className="icon-button" aria-label="Remove cause" onClick={() => patch({ causes: r.causes.filter(x => x.id !== c.id) })}><Trash2 size={14}/></button></div><label className="field">Cause / hypothesis<textarea rows={3} value={c.detail} onChange={e => patch({ causes: r.causes.map(x => x.id === c.id ? { ...x, detail: e.target.value, confirmed: false } : x) })}/></label><label className="field">Evidence and rationale<textarea rows={2} value={c.evidence} placeholder="Which evidence supports this cause? What alternatives were considered?" onChange={e => patch({ causes: r.causes.map(x => x.id === c.id ? { ...x, evidence: e.target.value, confirmed: false } : x) })}/></label><label className="checkbox-label confirmation"><input type="checkbox" checked={c.confirmed} disabled={!c.evidence.trim() || !c.detail.trim()} onChange={e => patch({ causes: r.causes.map(x => x.id === c.id ? { ...x, confirmed: e.target.checked } : x) })}/>I have assessed the evidence and confirm this cause</label></div>)}<div className="section-title"><h4>Missing information & open questions</h4><button className="text-button" onClick={() => patch({ gaps: [...r.gaps, ''] })}><Plus size={15}/>Add question</button></div>{r.gaps.map((g, i) => <div className="gap-row" key={i}><span>{i + 1}</span><input aria-label={`Open question ${i + 1}`} value={g} placeholder="What do you still need to establish?" onChange={e => patch({ gaps: r.gaps.map((x, j) => i === j ? e.target.value : x) })}/><button className="icon-button" aria-label="Remove open question" onClick={() => patch({ gaps: r.gaps.filter((_, j) => i !== j) })}><X size={15}/></button></div>)}</>}
      {step === 4 && <><div className="section-title"><h4>Corrective & preventive actions</h4><button className="text-button" onClick={() => patch({ capas: [...r.capas, { id: uid(), type: 'Corrective', action: '', owner: '', dueDate: '', status: 'Open', effectiveness: '', confirmed: false }] })}><Plus size={15}/>Add action</button></div>{r.capas.map((c, i) => <div className={`form-card ${c.confirmed ? 'confirmed-card' : ''}`} key={c.id}><div className="card-title"><span><ClipboardCheck size={16}/>ACTION {i + 1}<span className="suggestion-tag">{c.confirmed ? 'Reviewed' : c.source ? `${c.source} suggestion` : 'Pending review'}</span></span><button className="icon-button" aria-label="Remove action" onClick={() => patch({ capas: r.capas.filter(x => x.id !== c.id) })}><Trash2 size={14}/></button></div><div className="form-grid"><label className="field">Action type<select value={c.type} onChange={e => capaPatch(c.id, { type: e.target.value as Capa['type'] })}><option>Corrective</option><option>Preventive</option></select></label><label className="field">Action status<select value={c.status} onChange={e => capaPatch(c.id, { status: e.target.value as Capa['status'] })}><option>Open</option><option>In progress</option><option>Complete</option></select></label><label className="field full-width">Action description<textarea rows={3} value={c.action} placeholder="Define the action and its relationship to the supported cause." onChange={e => capaPatch(c.id, { action: e.target.value })}/></label><label className="field">Action owner<input value={c.owner} onChange={e => capaPatch(c.id, { owner: e.target.value })}/></label><label className="field">Due date<input type="date" value={c.dueDate} onChange={e => capaPatch(c.id, { dueDate: e.target.value })}/></label><label className="field full-width">Effectiveness check & results<textarea rows={3} value={c.effectiveness} placeholder="Define measurable acceptance criteria, review period and actual verification results." onChange={e => capaPatch(c.id, { effectiveness: e.target.value })}/></label></div><label className="checkbox-label confirmation"><input type="checkbox" checked={c.confirmed} disabled={!c.action.trim() || !c.owner.trim() || !c.dueDate || !c.effectiveness.trim()} onChange={e => capaPatch(c.id, { confirmed: e.target.checked })}/>I have reviewed this action, ownership and effectiveness check</label></div>)}{!r.capas.length && <div className="empty"><ClipboardCheck size={28}/><strong>No actions added yet</strong><p>Add an action or request suggestions for review.</p></div>}<div className="review-section"><h4>Investigator review</h4><div className="form-grid">{field('conclusion', 'Investigation conclusion', { area: true, placeholder: 'Summarize the evidence, confirmed cause, impact assessment and rationale for the actions.' })}{field('reviewedBy', 'Reviewed by', { placeholder: 'Qualified reviewer’s name' })}{select('status', 'Investigation status', ['Draft', 'In progress', 'In review', 'Closed'])}</div><div className="notice"><ShieldCheck size={18}/><p>Closure requires confirmed, evidenced Whys and a cause, supporting evidence, completed and confirmed CAPAs, an effectiveness check, a conclusion and a reviewer. This recorded review is not an authenticated electronic signature.</p></div></div>{r.audit.length > 0 && <details className="source-details"><summary>Record activity · {r.audit.length} events</summary>{r.audit.map((a, i) => <div className="audit-entry" key={i}><strong>Revision {a.revision} · {a.action}</strong><small>{a.actor} · {new Date(a.at).toLocaleString()}</small></div>)}</details>}</>}
    </div><Copilot record={r} patch={patch} busy={busy}/></div>
    <div className="editor-footer"><div className="save-state"><span className={dirty ? 'unsaved-dot' : 'system-dot'}/>{dirty ? 'Unsaved changes' : r.id ? 'All changes saved' : 'Not saved yet'}{r.id && <button className="text-button" onClick={() => download(`${r.id}.json`, JSON.stringify(r, null, 2))}><Download size={14}/>Export record</button>}</div><div className="footer-actions">{step > 0 && <button className="button secondary" onClick={() => setStep(s => s - 1)}><ArrowLeft size={15}/>Back</button>}{step < 4 && <button className="button secondary" onClick={() => setStep(s => s + 1)}>Next step<ArrowRight size={15}/></button>}<button className="button primary" disabled={busy} onClick={save}>{busy ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>}Save investigation</button></div></div>
    {suggestions && <div className="suggestion-overlay"><div className="suggestion-review"><div className="modal-header"><div><h2><Sparkles size={20}/> Review suggested investigation</h2><p>{suggestionMode === 'live' ? 'AI-generated suggestions' : 'Rule-based template suggestions'} · All content is unconfirmed</p></div><button className="icon-button" aria-label="Dismiss suggestions" onClick={() => setSuggestions(null)}><X size={20}/></button></div><div className="suggestion-review-body"><div className="notice"><ShieldCheck size={18}/><p>These are hypotheses and investigation prompts. Adding them never confirms a cause or approves an action. Review each item against the evidence.</p></div><h4>5 Whys</h4>{r.whys.length > 0 && <p className="muted">Your existing Why answers will be preserved.</p>}{suggestions.whys.map((w, i) => <div className="suggestion-item" key={i}><strong>{i + 1}. {w.question}</strong><p>{w.answer}</p></div>)}<h4>Potential causes</h4>{suggestions.causes.map((c, i) => <p key={i}>{c.detail}</p>)}<h4>Evidence still needed</h4><ul>{suggestions.gaps.map(g => <li key={g}>{g}</li>)}</ul><h4>Suggested actions</h4>{suggestions.capas.map((c, i) => <div className="suggestion-item" key={i}><strong>{c.type}</strong><p>{c.action}</p><small>Effectiveness: {c.effectiveness}</small></div>)}</div><div className="modal-footer"><button className="button secondary" onClick={() => setSuggestions(null)}>Discard suggestions</button><button className="button primary" onClick={applySuggestions}><Plus size={16}/>Add for investigator review</button></div></div></div>}
    {confirmClose && <div className="suggestion-overlay"><div className="discard-dialog"><span className="stat-icon orange"><FileText size={24}/></span><h3>You have unsaved changes</h3><p>Save your investigation to keep your latest work, or discard the unsaved edits.</p><div><button className="button secondary" onClick={() => setConfirmClose(false)}>Keep editing</button><button className="button danger" onClick={onClose}>Discard edits</button></div></div></div>}
  </Modal>;
}
