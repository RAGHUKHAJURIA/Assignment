import { z } from 'zod';
const text = z.string().trim().max(10000);
const source = z.enum(['AI', 'Rule-based', 'Investigator']).optional();
const date = z.union([z.literal(''), z.string().date('Use a valid date in YYYY-MM-DD format.')]);
export const evidenceSchema = z.object({ id: z.string().max(100), name: text.min(1), notes: text.default(''), type: z.enum(['Document', 'Observation', 'Record', 'Interview']).default('Record') });
export const investigationSchema = z.object({
    manufacturingStage:text.max(200).default(''), equipment:text.max(500).default(''), copilotHistory:z.array(z.unknown()).max(200).default([]), aiFields:z.array(z.string()).default([]),
    title: text.min(3).max(200), product: text.max(200).default(''), batch: text.max(100).default(''), department: text.max(100).default('Production'),
    category: z.enum(['Process deviation', 'Out of specification', 'Equipment', 'Documentation', 'Environmental', 'Material']).default('Process deviation'),
    severity: z.enum(['Critical', 'Major', 'Minor']).default('Major'), status: z.enum(['Draft', 'In progress', 'In review', 'Closed']).default('Draft'),
    owner: text.max(100).default(''), occurredOn: date.default(''), dueDate: date.default(''),
    description: text.default(''), containment: text.default(''), sourceText: z.string().max(40000).default(''),
    intakeMode: z.enum(['manual', 'live', 'rule-based']).default('manual'), intakeReviewed: z.boolean().default(false),
    whys: z.array(z.object({ question: text, answer: text, evidence: text, confirmed: z.boolean(), suggested: z.boolean().optional(), source })).max(5).default([]),
    factors: z.array(z.object({ category: text, detail: text, confirmed: z.boolean(), source })).max(30).default([]),
    causes: z.array(z.object({ id: z.string().max(100), detail: text, evidence: text, confirmed: z.boolean(), source })).max(30).default([]),
    gaps: z.array(text).max(30).default([]),
    capas: z.array(z.object({ id: z.string().max(100), type: z.enum(['Corrective', 'Preventive']), action: text.min(1), owner: text.max(100), dueDate: date, status: z.enum(['Open', 'In progress', 'Complete']), effectiveness: text, confirmed: z.boolean(), source })).max(50).default([]),
    evidence: z.array(evidenceSchema).max(50).default([]), conclusion: text.default(''), reviewedBy: text.max(100).default('')
});
export function validateClosure(record) {
    if (record.status !== 'Closed')
        return;
    if (record.intakeMode !== 'manual' && !record.intakeReviewed)
        throw Object.assign(new Error('Review and acknowledge the imported incident fields before closing.'), { status: 422 });
    if (!record.product.trim() || !record.batch.trim() || !record.description.trim() || !record.owner.trim() || !record.reviewedBy.trim() || !record.conclusion.trim() || !record.causes.some(c => c.confirmed && c.detail.trim() && c.evidence.trim()) || !record.evidence.length || !record.whys.length || record.whys.some(w => !w.confirmed || !w.question.trim() || !w.answer.trim() || !w.evidence.trim()) || !record.capas.length || record.capas.some(c => !c.confirmed || c.status !== 'Complete' || !c.owner.trim() || !c.dueDate || !c.effectiveness.trim())) {
        const error = new Error('Before closing, complete the incident details, add evidence, confirm each Why with supporting evidence and at least one evidenced cause, complete and confirm CAPAs with an owner, due date and effectiveness check, and record a conclusion and reviewer.');
        error.status = 422;
        throw error;
    }
}
