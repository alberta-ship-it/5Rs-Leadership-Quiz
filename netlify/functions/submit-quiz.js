exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  try {
    const data = JSON.parse(event.body);
    const { email, firstName, lastName, location, quizOutcome, q1, q2, q2Book, q2Film, q3, q4, q5, tagId } = data;
    const KIT_API_KEY = process.env.KIT_API_KEY;
    if (!KIT_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured.' }) };
    }
    const subResponse = await fetch('https://api.kit.com/v4/subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': KIT_API_KEY },
      body: JSON.stringify({
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
      })
    });
    const subData = await subResponse.json();
    const subscriberId = subData?.subscriber?.id;
    if (!subscriberId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Could not create subscriber.', detail: subData }) };
    }
    await fetch(`https://api.kit.com/v4/tags/${tagId}/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': KIT_API_KEY },
      body: JSON.stringify({ subscriber_id: subscriberId })
    });
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, subscriberId, outcome: quizOutcome }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
