// lib/locationMatcher.js - Match locations to MSA data

const msaData = {
  "Alabama": [
    "Birmingham-Hoover, AL MSA",
    "Huntsville, AL MSA",
    "Mobile, AL MSA",
    "Montgomery, AL MSA"
  ],
  "Alaska": [
    "Anchorage, AK MSA"
  ],
  "Arizona": [
    "Phoenix-Mesa-Scottsdale, AZ MSA",
    "Tucson, AZ MSA"
  ],
  "California": [
    "Los Angeles-Long Beach-Anaheim, CA MSA",
    "San Francisco-Oakland-Berkeley, CA MSA",
    "San Diego-Chula Vista-Carlsbad, CA MSA",
    "Riverside-San Bernardino-Ontario, CA MSA",
    "Sacramento--Roseville--Arden-Arcade, CA MSA",
    "Fresno, CA MSA",
    "Bakersfield, CA MSA",
    "Stockton, CA MSA"
  ],
  "Florida": [
    "Miami-Fort Lauderdale-West Palm Beach, FL MSA",
    "Tampa-St. Petersburg-Clearwater, FL MSA",
    "Orlando-Kissimmee-Sanford, FL MSA",
    "Jacksonville, FL MSA",
    "Fort Myers-Cape Coral, FL MSA",
    "Daytona Beach-Deltona-Ormond Beach, FL MSA",
    "Tallahassee, FL MSA"
  ],
  "Michigan": [
    "Lansing–East Lansing, MI MSA",
    "Metro Detroit",
    "Flint, MI MSA",
    "Ann Arbor, MI MSA",
    "Kalamazoo–Portage, MI MSA",
    "Grand Rapids-Kentwood, MI MSA"
  ],
  "Texas": [
    "Dallas-Fort Worth-Arlington, TX MSA",
    "Houston-The Woodlands-Sugar Land, TX MSA",
    "Austin-Round Rock-Georgetown, TX MSA",
    "San Antonio-New Braunfels, TX MSA"
  ],
  "New York": [
    "New York-Newark-Jersey City, NY-NJ-PA MSA",
    "Buffalo-Cheektowaga-Niagara Falls, NY MSA",
    "Rochester, NY MSA"
  ]
};

// Match a location string to MSA data
function matchLocationToMSA(location) {
  if (!location) return [];

  const locationLower = location.toLowerCase();
  const matches = [];

  // Check each state and its MSAs
  for (const [state, msas] of Object.entries(msaData)) {
    for (const msa of msas) {
      const msaLower = msa.toLowerCase();
      
      // Exact match or partial match
      if (msaLower.includes(locationLower) || locationLower.includes(msaLower)) {
        matches.push({
          state,
          msa,
          confidence: 'high'
        });
      }
    }
  }

  return matches;
}

// Extract locations from text using keyword matching
function extractLocationsFromText(text) {
  if (!text) return [];

  const locations = [];
  const textLower = text.toLowerCase();

  // Common city keywords
  const cityKeywords = [
    'miami', 'atlanta', 'dallas', 'houston', 'austin', 'chicago', 'new york', 'los angeles',
    'san francisco', 'seattle', 'denver', 'boston', 'orlando', 'tampa', 'detroit', 'minneapolis',
    'san antonio', 'phoenix', 'philadelphia', 'las vegas', 'portland', 'nashville', 'memphis'
  ];

  // Find cities
  for (const city of cityKeywords) {
    if (textLower.includes(city)) {
      locations.push(city);
    }
  }

  // Remove duplicates
  return [...new Set(locations)];
}

// Enhance operating locations with MSA matching
function enhanceLocations(locations) {
  if (!locations) return [];

  return locations.map(location => {
    const matches = matchLocationToMSA(location);
    
    return {
      original: location,
      type: matches.length > 0 ? 'msa' : 'city_state',
      value: location,
      matches: matches,
      confidence: matches.length > 0 ? 'high' : 'low'
    };
  });
}

module.exports = {
  matchLocationToMSA,
  extractLocationsFromText,
  enhanceLocations,
  msaData
};
