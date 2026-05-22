import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log(`[SCRAPER] Starting scrape of: ${url}`);

    // Fetch website content
    let html = '';
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      html = await response.text();
      console.log(`[SCRAPER] Fetched ${html.length} bytes`);
    } catch (fetchError) {
      console.error('[SCRAPER] Fetch failed:', fetchError.message);
      return res.status(400).json({
        error: 'Failed to fetch website',
        details: fetchError.message
      });
    }

    // Clean HTML
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 15000); // Limit to 15000 chars

    console.log(`[SCRAPER] Cleaned HTML: ${cleanHtml.length} chars`);

    // Create extraction prompt
    const extractionPrompt = `You are a data extraction expert. Extract contractor profile information from this website.

Website URL: ${url}

Website Content:
${cleanHtml}

IMPORTANT RULES:
1. Extract ONLY information that actually exists in the content
2. Do NOT invent, guess, or infer any data
3. Return ONLY valid JSON - no markdown, no code blocks, no extra text
4. If a field has no data, use null

Return this exact JSON structure (and ONLY this JSON, nothing else):
{
  "companyName": "The business name or null",
  "headline": "A short description (max 100 chars) or null. If possible, use gerund form like 'Providing...' or 'Offering...'",
  "website": "${url}",
  "about": "Company description/about text or null",
  "address": "Full address (prioritize headquarters/main office) or null",
  "phone": "Phone number or null",
  "email": "Email address or null",
  "companySize": "One of: 'Less than 20', '21-50', '51-200', '201-1000', 'More than 1000', or null",
  "operatingLocations": [
    {
      "type": "city_state or region",
      "value": "City, State or Region Name",
      "keywords": ["related keywords found"]
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "location": "City, State",
      "description": "What the project was",
      "photos": ["photo_url1", "photo_url2"]
    }
  ]
}`;

    // Call Claude API
    console.log('[SCRAPER] Calling Claude API...');
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: extractionPrompt
        }
      ]
    });

    // Extract response
    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock) {
      throw new Error('No text response from Claude');
    }

    console.log('[SCRAPER] Got response from Claude');

    // Parse JSON carefully
    let jsonText = textBlock.text.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    let profileData;
    try {
      profileData = JSON.parse(jsonText);
      console.log('[SCRAPER] Successfully parsed JSON');
    } catch (parseError) {
      console.error('[SCRAPER] JSON parse error:', parseError.message);
      console.error('[SCRAPER] Raw text:', jsonText.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        rawResponse: jsonText.substring(0, 500)
      });
    }

    return res.status(200).json({
      success: true,
      data: profileData
    });

  } catch (error) {
    console.error('[SCRAPER] Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
      type: error.constructor.name
    });
  }
}
