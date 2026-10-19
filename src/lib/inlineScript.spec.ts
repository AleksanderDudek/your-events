import { describe, it, expect } from 'vitest';
import { scriptSafeJson } from './inlineScript';

describe('scriptSafeJson', () => {
  it('serializes as JSON', () => {
    expect(scriptSafeJson({ a: 'b' })).toBe('{"a":"b"}');
    expect(JSON.parse(scriptSafeJson({ name: 'Jazz <3' }))).toEqual({ name: 'Jazz <3' });
  });

  it('cannot close the surrounding script element', () => {
    expect(scriptSafeJson('</script><script>alert(1)</script>')).not.toContain('</script');
    expect(scriptSafeJson('<!--')).not.toContain('<');
  });
});
