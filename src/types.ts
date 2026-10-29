export type Origin = 'AI' | 'Rule-based' | 'Investigator';
export type Why = {
    question: string;
    answer: string;
    evidence: string;
    confirmed: boolean;
    suggested?: boolean;
    source?: Origin;
};
export type Capa = {
    id: string;
    type: 'Corrective' | 'Preventive';
    action: string;
    owner: string;
    dueDate: string;
    status: 'Open' | 'In progress' | 'Complete';
    effectiveness: string;
    confirmed: boolean;
    source?: Origin;
};
export type Evidence = {
    id: string;
    name: string;
    notes: string;
    type: 'Document' | 'Observation' | 'Record' | 'Interview';
};
export type RecordItem = {
 manufacturingStage?:string; equipment?:string; copilotHistory?:any[]; aiFields?:string[];
    id: string;
    revision: number;
    title: string;
    product: string;
    batch: string;
    department: string;
    category: string;
    severity: string;
    status: string;
    owner: string;
    occurredOn: string;
    dueDate: string;
    description: string;
    containment: string;
    sourceText: string;
    intakeMode?: 'manual' | 'live' | 'rule-based';
    intakeReviewed?: boolean;
    whys: Why[];
    factors: {
        category: string;
        detail: string;
        confirmed: boolean;
        source?: Origin;
    }[];
    causes: {
        id: string;
        detail: string;
        evidence: string;
        confirmed: boolean;
        source?: Origin;
    }[];
    gaps: string[];
    capas: Capa[];
    evidence: Evidence[];
    conclusion: string;
    reviewedBy: string;
    createdAt: string;
    updatedAt: string;
    audit: {
        at: string;
        actor: string;
        action: string;
        revision: number;
    }[];
};
export const newRecord = (): RecordItem => ({ id: '', revision: 0, title: '', product: '', batch: '', department: 'Production', category: 'Process deviation', severity: 'Major', status: 'Draft', owner: 'Ananya Sharma', occurredOn: new Date().toISOString().slice(0, 10), dueDate: '', description: '', containment: '', sourceText: '', whys: [], factors: [], causes: [], gaps: [], capas: [], evidence: [], conclusion: '', reviewedBy: '', createdAt: '', updatedAt: '', audit: [] });
export const uid = () => crypto.randomUUID();
