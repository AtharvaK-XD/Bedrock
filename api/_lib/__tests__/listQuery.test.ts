import { describe, it, expect } from 'vitest';
import { parseListQuery, encodeCursor, decodeCursor, LIST_PAGE } from '../dataHttp.js';

// ?id= ?limit= ?cursor= ?summary= of GET /api/prompts and GET /api/workflows

const ok = (query: Record<string, unknown> | undefined) => {
  const parsed = parseListQuery(query);
  if (!parsed.ok) throw new Error('expected a valid query, got: ' + parsed.error);
  return parsed;
};

describe('parseListQuery', () => {
  it('no parameters: not paged, so the route answers the whole list as before', () => {
    for (const query of [undefined, {}, { unrelated: 'x' }, { limit: '', cursor: '' }]) {
      expect(ok(query)).toMatchObject({ id: null, paged: false, summary: false, after: null });
    }
  });

  it('limit or cursor switches paging on; a cursor alone uses the default page size', () => {
    expect(ok({ limit: '25' })).toMatchObject({ paged: true, limit: 25, after: null });
    const cursor = encodeCursor('2026-11-02 05:00:00.123', 'prm_1');
    expect(ok({ cursor })).toMatchObject({ paged: true, limit: LIST_PAGE.defaultLimit, after: { ts: '2026-11-02 05:00:00.123', id: 'prm_1' } });
  });

  it('caps the page size', () => {
    expect(ok({ limit: '100' }).limit).toBe(100);
    expect(ok({ limit: '101' }).limit).toBe(100);
    expect(ok({ limit: '999999' }).limit).toBe(100);
  });

  it.each(['0', '-1', '1.5', 'abc', '1e3', ' 5', '5 ', '0x10', '1234567'])('rejects the limit %j', (limit) => {
    expect(parseListQuery({ limit })).toMatchObject({ ok: false });
  });

  it('rejects a limit sent as something other than text (an object or a list of values)', () => {
    expect(parseListQuery({ limit: { $gt: 1 } })).toMatchObject({ ok: false });
    expect(parseListQuery({ limit: 10 })).toMatchObject({ ok: false });
  });

  it('takes the first value when a parameter is repeated (?limit=5&limit=900)', () => {
    expect(ok({ limit: ['5', '900'] }).limit).toBe(5);
    expect(ok({ summary: ['1', '0'] }).summary).toBe(true);
  });

  it('summary is on for 1 and true only', () => {
    expect(ok({ summary: '1' }).summary).toBe(true);
    expect(ok({ summary: 'true' }).summary).toBe(true);
    for (const v of ['0', 'false', 'yes', '', undefined]) expect(ok({ summary: v }).summary).toBe(false);
  });

  it('?id= asks for one item and wins over paging', () => {
    expect(ok({ id: 'prm_123', limit: '5', cursor: 'whatever' })).toMatchObject({ id: 'prm_123', paged: false, after: null });
    expect(parseListQuery({ id: 'x'.repeat(101) })).toMatchObject({ ok: false });
    expect(parseListQuery({ id: { a: 1 } })).toMatchObject({ ok: false });
  });

  it('rejects a cursor that this server did not make', () => {
    for (const cursor of ['not-a-cursor', 'e30', Buffer.from('[1,2]').toString('base64url'), Buffer.from('["a","b"]').toString('base64url'), 'x'.repeat(401)]) {
      expect(parseListQuery({ limit: '5', cursor }), cursor.slice(0, 20)).toMatchObject({ ok: false, error: 'cursor is not valid' });
    }
  });
});

describe('cursor tokens', () => {
  it('round-trip, including timestamps with and without a fraction and ids with odd characters', () => {
    for (const [ts, id] of [
      ['2026-11-02 05:00:00', 'prm_1'],
      ['2026-11-02 05:00:00.5', 'wf-9'],
      ['2026-11-02 05:00:00.123456', "id with 'quote' and \"double\" and ünïcode"],
      ['2026-11-02T05:00:00.123', 'x'],
    ]) {
      expect(decodeCursor(encodeCursor(ts, id))).toEqual({ ts, id });
    }
  });

  it('never throws on garbage, and never lets text other than a timestamp through (it reaches a SQL cast)', () => {
    for (const bad of [undefined, null, 5, {}, [], '', '%%%', 'AAAA', encodeCursor("2026-11-02'; DROP TABLE x;--", 'id'), encodeCursor('now()', 'id'), encodeCursor('2026-11-02 05:00:00', '')]) {
      expect(decodeCursor(bad)).toBeNull();
    }
  });
});
