import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
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
    console.log(`[SCRAPER] Starting multi-page scrape of: ${url}`);

    // Step 1: Scrape multiple pages
    let allContent = '';
    const baseUrl = new URL(url);
    const domain = baseUrl.origin;

    console.log('[SCRAPER] Scraping homepage...');
    const homeContent = await fetchAndClean(url);
    allContent += homeContent;

    // Try related pages
    const pagesToTry = [
      '/about', '/about-us', '/team', '/services', '/projects', '/portfolio',
      '/work', '/case-studies', '/company', '/contact'
    ];

    for (const path of pagesToTry) {
      try {
        const pageUrl = domain + path;
        const pageContent = await fetchAndClean(pageUrl);
        if (pageContent && pageContent.length > 100) {
          allContent += ' ' + pageContent;
        }
      } catch (error) {
        // Continue to next page
      }
    }

    allContent = allContent.substring(0, 30000);
    console.log(`[SCRAPER] Total content: ${allContent.length} chars`);

    // Step 2: Extract data with advanced prompt
    const extractionPrompt = `You are an expert data extraction specialist. Extract COMPREHENSIVE contractor/vendor information from this website.

Website URL: ${url}

Website Content:
${allContent}

CRITICAL RULES:
1. Extract ONLY information that exists in the content
2. Do NOT invent data
3. For locations: Show WHAT WORDS you found that indicate each location
4. For company size: Extract employee count, team size, staff numbers
5. Return ONLY valid JSON - no markdown

Return this EXACT JSON:
{
  "companyName": "Business name or null",
  "headline": "Short description max 100 chars (gerund form) or null",
  "website": "${url}",
  "about": "Full company description or null",
  "address": "Headquarters address or null",
  "phone": "Phone number or null",
  "email": "Email address or null",
  "companySize": "One of: 'Less than 20', '21-50', '51-200', '201-1000', 'More than 1000' or null",
  "employeeCount": "Exact number if mentioned or null",
  "operatingLocations": [
    {
      "type": "city_state or region",
      "value": "City, State or Region Name",
      "extractedWords": ["exact words found in content that indicate this location"],
      "confidence": "high or low"
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "location": "City, State",
      "description": "What it was",
      "type": "Type of work",
      "photos": []
    }
  ]
}

EXTRACTION GUIDELINES:
- For locations: If you extract "Miami, FL", show extractedWords like ["Miami", "Florida", "Southeast Florida"] 
- Show EXACT words from the website that helped you identify the location
- Add confidence level based on how explicit the location mention was
- Extract ALL locations mentioned (cities, regions, service areas)
- Employee count: Look for "X employees", "team of Y", "Z staff members", "our team", "our staff"`;

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

    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock) {
      throw new Error('No text response from Claude');
    }

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    let profileData = JSON.parse(jsonText);
    profileData = enhanceWithExcelData(profileData);

    console.log('[SCRAPER] Extraction complete');
    console.log(`[SCRAPER] Locations: ${profileData.operatingLocations.length}, Projects: ${profileData.projects.length}`);

    return res.status(200).json({
      success: true,
      data: profileData
    });

  } catch (error) {
    console.error('[SCRAPER] Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}

async function fetchAndClean(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 8000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let html = await response.text();
    html = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return html.substring(0, 5000);
  } catch (error) {
    console.error(`[SCRAPER] Fetch error for ${url}:`, error.message);
    return '';
  }
}

function enhanceWithExcelData(data) {
  if (!data.projects) data.projects = [];
  if (!data.operatingLocations) data.operatingLocations = [];

  // Convert employee count to company size
  if (!data.companySize && data.employeeCount) {
    const count = parseInt(data.employeeCount);
    if (count < 20) data.companySize = 'Less than 20';
    else if (count < 51) data.companySize = '21-50';
    else if (count < 201) data.companySize = '51-200';
    else if (count < 1001) data.companySize = '201-1000';
    else data.companySize = 'More than 1000';
  }

  // Ensure arrays
  data.projects = (data.projects || []).map(p => ({
    name: p.name || 'Unnamed',
    location: p.location || '',
    description: p.description || '',
    type: p.type || 'Work',
    photos: p.photos || []
  })).slice(0, 5);

  data.operatingLocations = (data.operatingLocations || []).map(loc => ({
    type: loc.type || 'location',
    value: loc.value || '',
    extractedWords: loc.extractedWords || [],
    confidence: loc.confidence || 'medium'
  })).slice(0, 10);

  // Add headquarters location if not present
  if (data.operatingLocations.length === 0 && data.address) {
    const addressParts = data.address.split(',');
    if (addressParts.length >= 2) {
      const city = addressParts[0].trim();
      const state = addressParts[addressParts.length - 1].trim();
      data.operatingLocations.push({
        type: 'city_state',
        value: `${city}, ${state}`,
        extractedWords: ['address', 'headquarters'],
        confidence: 'high'
      });
    }
  }

  return data;
}
