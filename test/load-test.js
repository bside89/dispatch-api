/**
 * Load Test for Order Creation Endpoint
 *
 * !!! IMPORTANT !!!: The environment variable TEST_ENV must be set to 'true'
 * in the main application, else the test will not run well
 * because of Rate Limiting (this env var disables it).
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '5s', target: 10 }, // Ramp-up: scale to 10 users
    { duration: '20s', target: 10 }, // Plateau: maintain 10 users
    { duration: '5s', target: 0 }, // Ramp-down: finish
  ],
};

export function setup() {
  const email = `load-test-${uuidv4()}@example.com`;
  const password = 'password123';

  // Create test user
  const createRes = http.post(
    `${BASE_URL}/v1/users`,
    JSON.stringify({ name: 'Load Test User', email, password }),
    {
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': uuidv4(),
      },
    },
  );

  check(createRes, { 'setup: user created': (r) => r.status === 201 });

  // Login to obtain bearer token
  const loginRes = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(loginRes, { 'setup: login successful': (r) => r.status === 201 });

  const { accessToken } = loginRes.json('data');

  return { accessToken };
}

export default function (data) {
  const payload = JSON.stringify({
    items: [{ productId: `prod-${uuidv4()}`, quantity: 1, price: 100 }],
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'idempotency-key': uuidv4(), // Crucial to avoid hitting idempotency cache
      Authorization: `Bearer ${data.accessToken}`,
    },
  };

  const res = http.post(`${BASE_URL}/v1/orders`, payload, params);

  check(res, {
    'status is 201': (r) => r.status === 201,
    'transaction time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(2); // Small pause between requests from the same virtual user
}
