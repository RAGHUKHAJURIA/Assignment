export function seedRecords() {
    const entries = [
        ['Reactor temperature excursion during crystallization', 'Metformin HCl', 'MET-26-1042', 'Process deviation', 'Major', 'In progress', 'Ananya Sharma', 'Production', '2026-11-05'],
        ['Residual solvent above specification', 'Losartan Potassium', 'LOS-26-0816', 'Out of specification', 'Critical', 'In review', 'Rahul Mehta', 'Quality Control', '2026-11-02'],
        ['Pressure differential variation in cleanroom', 'Atorvastatin Calcium', 'ATO-26-0923', 'Environmental', 'Minor', 'In progress', 'Priya Nair', 'Engineering', '2026-11-08'],
        ['Inconsistent yield in final filtration', 'Metformin HCl', 'MET-26-1038', 'Process deviation', 'Major', 'Draft', 'Vikram Patel', 'Production', '2026-11-10'],
        ['Calibration overdue for weighing balance', 'Amlodipine Besylate', 'AML-26-0671', 'Equipment', 'Major', 'In progress', 'Ananya Sharma', 'Engineering', '2026-11-04'],
        ['Missing verification in batch manufacturing record', 'Losartan Potassium', 'LOS-26-0809', 'Documentation', 'Minor', 'Closed', 'Priya Nair', 'Quality Assurance', '2026-10-26'],
        ['Raw material identity label mismatch', 'Valsartan', 'VAL-26-0314', 'Material', 'Major', 'Draft', 'Rahul Mehta', 'Warehouse', '2026-11-12'],
        ['Dryer vacuum hold test below acceptance limit', 'Atorvastatin Calcium', 'ATO-26-0918', 'Equipment', 'Major', 'In review', 'Vikram Patel', 'Production', '2026-11-06']
    ];
    const records = entries.map((e, i) => ({
        id: `INV-2026-${String(42 - i).padStart(3, '0')}`, revision: 1, title: e[0], product: e[1], batch: e[2], category: e[3], severity: e[4], status: e[5], owner: e[6], department: e[7], dueDate: e[8], occurredOn: `2026-10-${String(27 - i).padStart(2, '0')}`,
        description: i === 0 ? 'During the crystallization stage of Metformin HCl batch MET-26-1042 in reactor R-204, the process temperature reached 38°C against the approved range of 25–30°C for approximately 18 minutes. The excursion was observed by the shift operator on 27 October 2026. The batch was placed on hold pending Quality Assurance assessment.' : `${e[0]} was observed during manufacture of ${e[1]}, batch ${e[2]}. The affected batch is on hold pending investigation. These are illustrative demonstration records.`,
        containment: i === 0 ? 'Batch placed on hold. QA notified. Temperature restored within the approved range; historian records retained.' : 'Affected material placed on hold and Quality Assurance notified.',
        sourceText: '', whys: i === 0 ? [{ question: 'Why did the process temperature exceed the approved range?', answer: 'The cooling flow to reactor R-204 was reduced during crystallization.', evidence: 'Initial operator observation — requires verification against historian data.', confirmed: false }] : [],
        factors: [], causes: [], gaps: [], capas: i === 0 ? [{ id: 'capa-demo-1', type: 'Corrective', action: 'Review the R-204 cooling circuit and document flow verification before the next batch.', owner: 'Vikram Patel', dueDate: '2026-11-03', status: 'Open', effectiveness: 'Document stable cooling flow during three subsequent batches.', confirmed: false }] : [],
        evidence: i === 0 ? [{ id: 'ev-demo-1', name: 'Initial shift operator observation', notes: 'Temperature excursion reported at reactor R-204. Demonstration record; historian verification pending.', type: 'Observation' }] : [],
        conclusion: i === 5 ? 'Demonstration of a previously completed documentation investigation. Verification steps were added to the record review process.' : '', reviewedBy: i === 5 ? 'Priya Nair' : '',
        createdAt: `2026-10-${String(27 - i).padStart(2, '0')}T09:30:00.000Z`, updatedAt: `2026-10-${String(28 - Math.floor(i / 2)).padStart(2, '0')}T10:45:00.000Z`,
        audit: [{ at: `2026-10-${String(27 - i).padStart(2, '0')}T09:30:00.000Z`, actor: e[6], action: 'Demonstration investigation created', revision: 1 }]
    }));
    const completed = records[5];
    completed.whys = [{ question: 'Why was the verification missing?', answer: 'The demonstration review checklist did not explicitly require a second verification of the entry.', evidence: 'Illustrative checklist review, DEMO-QA-01.', confirmed: true }];
    completed.evidence = [{ id: 'ev-closed-demo', name: 'Illustrative checklist review DEMO-QA-01', type: 'Record', notes: 'Demonstration evidence only. The checklist has been revised and subsequent records reviewed.' }];
    completed.causes = [{ id: 'cause-closed-demo', detail: 'An explicit second-verification step was absent from the demonstration review checklist.', evidence: 'Illustrative checklist review DEMO-QA-01.', confirmed: true }];
    completed.capas = [{ id: 'capa-closed-demo', type: 'Preventive', action: 'Update the demonstration checklist to require a second verification.', owner: 'Priya Nair', dueDate: '2026-10-26', status: 'Complete', effectiveness: 'Demonstration: three subsequent record reviews included the required verification.', confirmed: true }];
    return records;
}
