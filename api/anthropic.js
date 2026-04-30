const https = require('https');

module.exports = function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'No API key' });
    return;
  }

  var body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  var payload = JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    system: body.system || 'You are a helpful assistant.',
    messages: body.messages || []
  });

  var options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  var request = https.request(options, function(response) {
    var data = '';
    response.on('data', function(chunk) {
      data += chunk;
    });
    response.on('end', function() {
      try {
        var parsed = JSON.parse(data);
        res.status(response.statusCode).json(parsed);
      } catch(e) {
        res.status(500).json({ error: 'parse error' });
      }
    });
  });

  request.on('error', function(err) {
    res.status(500).json({ error: err.message });
  });

  request.write(payload);
  request.end();
};
