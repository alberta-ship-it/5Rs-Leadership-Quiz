const https = require('https');

// Archetype tag IDs from Kit (verified 11 June 2026)
const ARCHETYPE_TAGS = {
  WAYFINDER: 19597291,
  MAKER: 19597292,
  TORCHBEARER: 19597294,
  PIONEER: 19597295,
};

function tagIdForOutcome(quizOutcome) {
  if (!quizOutcome) return null;
  const upper = String(quizOutcome).toUpperCase();
  for (const key of Object.keys(ARCHETYPE_TAGS)) {
    if (upper.includes(key)) return ARCHETYPE_TAGS[key];
  }
  return null;
}

exports.handler = async function (event) {
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
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  try {
    const data = JSON.parse(event.body);
    const { email, firstName, lastName, location, quizOutcome, q1, q2, q2Book, q2Film, q3, q4, q5 } = data;
    const KIT_API_KEY = process.env.KIT_API_KEY;

    if (!KIT_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured.' }) };
    }
    if (!email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email address is required.' }) };
    }

    // 1. Create (or update) the subscriber
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
      },
    });

    const subRes = await makeRequest(
      'https://api.kit.com/v4/subscribers',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kit-Api-Key': KIT_API_KEY,
          'Content-Length': Buffer.byteLength(subscriberBody),
        },
      },
      subscriberBody
    );

    const subData = JSON.parse(subRes.body);
    const subscriberId = subData?.subscriber?.id;

    if (!subscriberId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Could not create subscriber.', detail: subData }),
      };
    }

    // 2. Work out which archetype tag applies
    const tagId = tagIdForOutcome(quizOutcome);
    if (!tagId) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          subscriberId,
          outcome: quizOutcome,
          warning: 'Subscriber created but no archetype tag matched the quiz outcome.',
        }),
      };
    }

    // 3. Apply the tag (Kit v4 tags by email address)
    const tagBody = JSON.stringify({ email_address: email });

    const tagRes = await makeRequest(
      `https://api.kit.com/v4/tags/${tagId}/subscribers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kit-Api-Key': KIT_API_KEY,
          'Content-Length': Buffer.byteLength(tagBody),
        },
      },
      tagBody
    );

    if (tagRes.status < 200 || tagRes.status >= 300) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          error: 'Subscriber created but tagging failed.',
          subscriberId,
          tagId,
          kitResponse: tagRes.body,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, subscriberId, outcome: quizOutcome, tagId }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
