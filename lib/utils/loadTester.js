/**
 * Load Tester - Uses autocannon to simulate traffic
 */

import autocannon from 'autocannon';

/**
 * Run load test on a specific endpoint
 */
export async function runLoadTest(options) {
  const {
    url,
    method = 'GET',
    connections = 10,
    duration = 10,
    body = null
  } = options;

  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url,
      method,
      connections,
      duration,
      pipelining: 1,
      body: body ? JSON.stringify(body) : undefined,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      excludeErrorStats: true
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          requests: {
            total: result.requests.total,
            average: result.requests.average,
            mean: result.requests.mean
          },
          latency: {
            mean: result.latency.mean,
            p50: result.latency.p50,
            p99: result.latency.p99,
            max: result.latency.max
          },
          throughput: {
            average: result.throughput.average,
            mean: result.throughput.mean
          },
          errors: result.errors || 0,
          timeouts: result.timeouts || 0,
          non2xx: result.non2xx || 0
        });
      }
    });

    // Handle autocannon events
    autocannon.track(instance);
  });
}

export default { runLoadTest };
