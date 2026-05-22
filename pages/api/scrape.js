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

    // Step 1: Scrape homepage
    let allContent = '';
    const baseUrl = new URL(url);
    const domain = baseUrl.origin;

    console.log('[SCRAPER] Scraping homepage...');
    const homeContent = await fetchAndClean(url);
    allContent += homeContent;

    // Step 2: Try to scrape related pages
    const pagesToTry = [
      '/about',
      '/about-us',
      '/team',
      '/services',
      '/projects',
      '/portfolio',
      '/work',
      '/case-studies',
      '/company',
      '/contact'
    ];

    for (const path of pagesToTry) {
      try {
        const pageUrl = domain + path;
        console.log(`[SCRAPER] Trying to scrape ${path}...`);
        const pageContent = await fetchAndClean(pageUrl);
        if (pageContent && pageContent.length > 100) {
          allContent += ' ' + pageContent;
          console.log(`[SCRAPER] Successfully scraped ${path}`);
        }
      } catch (error) {
        console.log(`[SCRAPER] Could not scrape ${path}: ${error.message}`);
        // Continue to next page
      }
    }

    // Limit total content
    allContent = allContent.substring(0, 30000);
    console.log(`[SCRAPER] Total content: ${allContent.length} chars from multiple pages`);

    // Step 3: Extract data with advanced prompt
    const extractionPrompt = `You are an expert data extraction specialist. Extract COMPREHENSIVE contractor/vendor information from this multi-page website content.

Website URL: ${url}

Website Content (from homepage + multiple pages):
${allContent}

CRITICAL RULES:
1. Extract ONLY information that exists in the content
2. Do NOT invent data
3. Extract ALL projects, locations, and employee info
4. For company size: Look for employee count, team size, "employees", "staff", "team members"
5. Return ONLY valid JSON - no markdown, no code blocks

Return this EXACT JSON:
{
  "companyName": "Business name or null",
  "headline": "Current headline, Short description max 100 chars (gerund form preferred and rephrase if possible) or null",
  "website": "${url}",
  "about": "Full company description/about/who we are with services/what we offer/what we do in bullet form or null",
  "address": "Full headquarters address or null",
  "phone": "Phone number or null (format: (123) 456-7890)",
  "email": "Email address or null",
  "companySize": "One of: 'Less than 20', '21-50', '51-200', '201-1000', 'More than 1000' or null - EXTRACT FROM EMPLOYEE COUNT IF MENTIONED",
  "employeeCount": "Exact number if mentioned (e.g., '45 employees', '120 team members') or null",
  "operatingLocations": [
    {
      "type": "city_state or region",
      "value": "City, State or Region Name",
      "keywords": ["keywords"]
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "location": "City, State",
      "description": "What it was about",
      "type": "Type of work",
      "photos": ["urls"]
    }
  ]
}

EXTRACTION TIPS:
- Employee count: Look for "X employees", "team of Y", "Z staff members" Our team, our staff
- Projects: Extract ALL mentioned (minimum 2 if available), can be case studies, in blogs or as long as they provided serives
- Locations: Extract cities AND regions
- Type: Infer from description if not explicit`;

    console.log('[SCRAPER] Calling Claude API for extraction...');
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
    profileData = enhanceProfileData(profileData);

    console.log('[SCRAPER] Extraction complete');
    console.log(`[SCRAPER] Company Size: ${profileData.companySize}, Projects: ${profileData.projects.length}, Locations: ${profileData.operatingLocations.length}`);

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
    
    // Clean HTML
    html = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return html.substring(0, 5000);
  } catch (error) {
    console.error(`[SCRAPER] Fetch error for ${url}:`, error.message);
    return '';
  }
}

function enhanceProfileData(data) {
  if (!data.projects) data.projects = [];
  if (!data.operatingLocations) data.operatingLocations = [];

  // Convert employee count to company size if needed
  if (!data.companySize && data.employeeCount) {
    const count = parseInt(data.employeeCount);
    if (count < 20) data.companySize = 'Less than 20';
    else if (count < 51) data.companySize = '21-50';
    else if (count < 201) data.companySize = '51-200';
    else if (count < 1001) data.companySize = '201-1000';
    else data.companySize = 'More than 1000';
  }

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

  data.projects = data.projects.map(project => ({
    name: project.name || 'Unnamed Project',
    location: project.location || 'Location not specified',
    description: project.description || '',
    type: project.type || 'General Work',
    photos: Array.isArray(project.photos) ? project.photos.filter(p => p) : []
  }));

  if (data.projects.length > 5) {
    data.projects = data.projects.slice(0, 5);
  }

  if (data.operatingLocations.length > 10) {
    data.operatingLocations = data.operatingLocations.slice(0, 10);
  }

  return data;
}
