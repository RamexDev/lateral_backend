// Import test utilities.
import { describe, it, expect } from 'vitest';

// Import HTTP test client.
import request from 'supertest';

// Import Express app.
import app from '../src/app.js';

// Test health endpoint.
describe('health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
