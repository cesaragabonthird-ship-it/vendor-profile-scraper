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
      .substring(0, 20000); // Increased limit for better extraction

    console.log(`[SCRAPER] Cleaned HTML: ${cleanHtml.length} chars`);

    // Create advanced extraction prompt
    const extractionPrompt = `You are an expert data extraction specialist. Extract COMPREHENSIVE contractor/vendor profile information from this website.

Website URL: ${url}

Website Content:
${cleanHtml}

CRITICAL RULES:
1. Extract ONLY information that actually exists in the content
2. Do NOT invent, guess, or infer any data
3. Extract ALL projects mentioned (not just one!)
4. Extract ALL operating locations and service areas
5. Return ONLY valid JSON - no markdown, no code blocks, no extra text

Return this EXACT JSON structure (and NOTHING else):
{
  "companyName": "The business name or null",
  "headline": "A short description (max 100 chars) or null. If possible, use gerund form like 'Providing...'",
  "website": "${url}",
  "about": "Company description/about/who we are text or null",
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
      "description": "What the project was about",
      "type": "Type of work (e.g., renovation, construction, etc.)",
      "photos": ["photo_url1", "photo_url2"]
    }
  ]
}

IMPORTANT EXTRACTION RULES:
- Projects: Extract EVERY project mentioned (minimum 2 if available)
- Locations: Extract specific cities AND broader service areas (Northeast, Northern California, or Nationwide etc.)
- Address: Prioritize headquarters or main office address
- About: Include the full company description if available and services in bullet form.
- Type of Work: Infer from company name and description if not explicitly stated
- Photos: Only include actual image URLs, not placeholder text`;

    // Call Claude API
    console.log('[SCRAPER] Calling Claude API...');
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4000,
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
      console.log(`[SCRAPER] Projects: ${profileData.projects?.length || 0}, Locations: ${profileData.operatingLocations?.length || 0}`);
    } catch (parseError) {
      console.error('[SCRAPER] JSON parse error:', parseError.message);
      console.error('[SCRAPER] Raw text:', jsonText.substring(0, 500));
      return res.status(500).json({
        error: 'Failed to parse Claude response as JSON',
        rawResponse: jsonText.substring(0, 500)
      });
    }

    // Enhance and validate data
    profileData = enhanceProfileData(profileData);

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

/**
 * Enhance profile data with additional processing
 */
function enhanceProfileData(data) {
  // Ensure arrays exist
  if (!data.projects) data.projects = [];
  if (!data.operatingLocations) data.operatingLocations = [];

  // Ensure we have at least basic location info
  if (data.operatingLocations.length === 0 && data.address) {
    const addressParts = data.address.split(',');
    if (addressParts.length >= 2) {
      const city = addressParts[0].trim();
      const state = addressParts[addressParts.length - 1].trim();
      data.operatingLocations.push({
        type: 'city_state',
        value: `${city}, ${state}`,
        keywords: ['headquarters']
      });
    }
  }

  // Ensure all projects have required fields
  data.projects = data.projects.map(project => ({
    name: project.name || 'Unnamed Project',
    location: project.location || 'Location not specified',
    description: project.description || '',
    type: project.type || 'General Work',
    photos: Array.isArray(project.photos) ? project.photos.filter(p => p) : []
  }));

  // Limit to 5 projects for form filling
  if (data.projects.length > 5) {
    data.projects = data.projects.slice(0, 5);
  }

  // Limit to 10 locations
  if (data.operatingLocations.length > 10) {
    data.operatingLocations = data.operatingLocations.slice(0, 10);
  }

  return data;
}