const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' }
});

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return json(200, {
        success: true,
        message: 'offbyte Cloudflare Pages backend is running'
      });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(200, {
        status: 'ok',
        platform: 'cloudflare-pages',
        timestamp: new Date().toISOString()
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/ping') {
      return json(200, { success: true, data: 'pong' });
    }

    return json(404, { success: false, message: 'Route not found' });
  }
};
