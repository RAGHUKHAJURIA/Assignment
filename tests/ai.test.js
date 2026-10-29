import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extract, analyze } from '../server/ai.js';
test('live provider uses a server-only key, disables storage and validates output', async () => {
    const original = global.fetch;
    const key = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-only-key';
    let request;
    global.fetch = async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ title: 'Test deviation', product: 'Metformin HCl', batch: 'MET-26-1234', department: 'Production', description: 'Observed temperature excursion.', containment: 'Material held.', occurredOn: '2026-10-29', severity: 'Major', category: 'Process deviation' }) }] }] }) }; };
    try {
        const r = await extract('Source text');
        assert.equal(r.title, 'Test deviation');
        const body = JSON.parse(request.options.body);
        assert.equal(request.options.headers.Authorization, 'Bearer test-only-key');
        assert.equal(body.store, false);
        assert.equal(body.text.format.type, 'json_object');
        assert.match(body.instructions, /unconfirmed suggestions/);
        assert.match(body.input, /Source text/);
    }
    finally {
        global.fetch = original;
        key === undefined ? delete process.env.OPENAI_API_KEY : process.env.OPENAI_API_KEY = key;
    }
});
test('malformed, refused and unavailable provider responses produce recoverable failures', async () => {
    const original = global.fetch;
    const key = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-only-key';
    try {
        global.fetch = async () => ({ ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: '{"invalid":true}' }] }] }) });
        await assert.rejects(() => extract('Text'), /did not pass validation/);
        global.fetch = async () => ({ ok: true, json: async () => ({ status: 'incomplete', output: [] }) });
        await assert.rejects(() => analyze({ description: 'Text' }), /incomplete or declined/);
        global.fetch = async () => ({ ok: false, status: 429 });
        await assert.rejects(() => extract('Text'), /provider request failed/);
    }
    finally {
        global.fetch = original;
        key === undefined ? delete process.env.OPENAI_API_KEY : process.env.OPENAI_API_KEY = key;
    }
});
