// Función serverless de Netlify — mantiene la API key oculta en el servidor.
// La key nunca viaja al navegador. Se guarda como variable de entorno en Netlify.

exports.handler = async (event) => {
  // Solo aceptar POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { pdfBase64, prompt } = JSON.parse(event.body);

    if (!pdfBase64 || !prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos (pdfBase64 o prompt)' }) };
    }

    // La API key se lee de la variable de entorno de Netlify (nunca del código)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'API key no configurada en el servidor' }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const msg = data.error ? data.error.message : ('HTTP ' + response.status);
      return { statusCode: 502, body: JSON.stringify({ error: msg }) };
    }

    // Devolver la respuesta de Claude al navegador
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
