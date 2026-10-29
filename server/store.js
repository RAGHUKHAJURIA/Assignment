import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { seedRecords } from './seed.js';
export async function createStore(directory) {
    const dir = resolve(directory);
    await mkdir(dir, { recursive: true });
    const path = resolve(dir, 'investigations.json');
    let db;
    try {
        db = JSON.parse(await readFile(path, 'utf8'));
        if (!Array.isArray(db.records))
            throw new Error('Invalid database format');
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            throw e;
        db = { records: seedRecords() };
        await writeFile(path, JSON.stringify(db, null, 2));
    }
    let queue = Promise.resolve();
    return {
        list: () => structuredClone(db.records),
        get: id => structuredClone(db.records.find(r => r.id === id)),
        mutate(fn) {
            const operation = queue.then(async () => { const next = structuredClone(db); const result = fn(next); await writeFile(path + '.tmp', JSON.stringify(next, null, 2)); await rename(path + '.tmp', path); db = next; return structuredClone(result); });
            queue = operation.catch(() => { });
            return operation;
        }
    };
}
