const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  function makeRequest(url, options, body) {
    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  try {
    const data = JSON.parse(event.body);
    const { email, firstName, lastName, location, quizOutcome, q1, q2, q2Book, q2Film, q3, q4, q5, tagId } = data;
    const KIT_API_KEY = process.env.KIT_API_KEY;

    if (!KIT_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured.' }) };
    }

    const subscriberBody = JSON.stringify({
      email_address: email,
      first_name: firstName,
      fields: {
        last_name: lastName || '',
        location: location || '',
        quiz_outcome: quizOutcome || '',
        q1_answer: q1 || '',
        q2_answer: q2 || '',
        q2_book: q2Book || '',
        q2_film: q2Film || '',
        q3_answer: q3 || '',
        q4_answer: q4 || '',
        q5_answer: q5 || '',
      }
    });

    const subRes = await makeRequest(
      'https://api.kit.com/v4/subscribers',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kit-Api-Key': KIT_API_KEY,
          'Content-Length': Buffer.byteLength(subscriberBody)
        }
      },
      subscriberBody
    );

    const subData = JSON.parse(subRes.body);
    const subscriberId = subData?.subscriber?.id;

    if (!subscriberId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Could not create subscriber.', detail: subData }) };
    }

    const tagBody = JSON.stringify({ subscriber_id: subscriberId });

    await makeRequest(
      `https://api.kit.com/v4/tags/${tagId}/subscribers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kit-Api-Key': KIT_API_KEY,
          'Content-Length': Buffer.byteLength(tagBody)
        }
      },
      tagBody
    );

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, subscriberId, outcome: quizOutcome }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
