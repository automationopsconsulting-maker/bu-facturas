// Función serverless de Netlify — mantiene la API key oculta en el servidor.
// Version con diagnóstico completo de errores.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    // Paso 1: parsear el body que llega del navegador
    let pdfBase64, prompt;
    try {
      const parsed = JSON.parse(event.body || '{}');
      pdfBase64 = parsed.pdfBase64;
      prompt = parsed.prompt;
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido al parsear: ' + e.message }) };
    }

    if (!pdfBase64 || !prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos: pdfBase64 o prompt vacíos' }) };
    }

    // Paso 2: verificar que la key esté configurada
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY no está configurada en las variables de entorno de Netlify' }) };
    }

    // Paso 3: verificar que fetch exista en este runtime de Node
    if (typeof fetch === 'undefined') {
      return { statusCode: 500, body: JSON.stringify({ error: 'fetch no disponible en este runtime de Node (versión de Node muy antigua)' }) };
    }

    // Paso 4: llamar a Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
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

    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Anthropic devolvió algo no-JSON: ' + rawText.slice(0, 300) }) };
    }

    if (!response.ok || data.error) {
      const msg = data.error ? data.error.message : ('HTTP ' + response.status + ' de Anthropic');
      return { statusCode: 502, body: JSON.stringify({ error: msg }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    // Cualquier error inesperado — lo devolvemos completo, nunca oculto
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (err && err.message) ? err.message : String(err) })
    };
  }
};
