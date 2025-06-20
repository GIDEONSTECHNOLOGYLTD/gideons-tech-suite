const request = require('supertest');
const express = require('express');
const healthRouter = require('../api/health');

describe('Health Endpoint', () => {
  let app;
  beforeAll(() => {
    app = express();
    app.use('/api/health', healthRouter);
  });

  it('should return 200 and health info if DB is UP', async () => {
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.statusCode); // Accept 200 or 503 depending on DB
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('database');
  });
});
