import { useState } from 'react';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult(data.data);
      setError(null);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Something went wrong');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleScrape();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">
            Contractor Profile Scraper
          </h1>
          <p className="text-slate-400">
            Extract contractor data automatically using AI
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-8 shadow-lg">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Website URL
          </label>
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://example.com"
              className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleScrape}
              disabled={loading}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Scraping...' : 'Scrape'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-6 py-4 rounded-lg mb-8">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-white mb-6">Extracted Data</h2>
            
            <div className="space-y-6">
              {/* Company Name */}
              {result.companyName && (
                <div>
                  <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Company Name
                  </label>
                  <p className="text-white text-lg mt-1">{result.companyName}</p>
                </div>
              )}

              {/* Headline */}
              {result.headline && (
                <div>
                  <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Headline
                  </label>
                  <p className="text-white text-lg mt-1">{result.headline}</p>
                </div>
              )}

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                {result.phone && (
                  <div>
                    <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                      Phone
                    </label>
                    <p className="text-white mt-1">{result.phone}</p>
                  </div>
                )}
                {result.email && (
                  <div>
                    <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                      Email
                    </label>
                    <p className="text-white mt-1">{result.email}</p>
                  </div>
                )}
              </div>

              {/* Address */}
              {result.address && (
                <div>
                  <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Address
                  </label>
                  <p className="text-white mt-1">{result.address}</p>
                </div>
              )}

              {/* Company Size */}
              {result.companySize && (
                <div>
                  <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Company Size
                  </label>
                  <p className="text-white mt-1">{result.companySize}</p>
                </div>
              )}

              {/* About */}
              {result.about && (
                <div>
                  <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    About
                  </label>
                  <p className="text-white mt-1 text-sm">{result.about}</p>
                </div>
              )}

              {/* Operating Locations */}
              {result.operatingLocations && result.operatingLocations.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Operating Locations
                  </label>
                  <div className="mt-2 space-y-2">
                    {result.operatingLocations.map((loc, idx) => (
                      <div key={idx} className="bg-slate-700 px-3 py-2 rounded">
                        <p className="text-white font-medium">{loc.value}</p>
                        {loc.keywords && loc.keywords.length > 0 && (
                          <p className="text-slate-400 text-sm">
                            Keywords: {loc.keywords.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {result.projects && result.projects.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Projects ({result.projects.length})
                  </label>
                  <div className="mt-3 space-y-4">
                    {result.projects.map((project, idx) => (
                      <div key={idx} className="bg-slate-700 p-4 rounded">
                        <p className="text-white font-medium">{project.name}</p>
                        {project.location && (
                          <p className="text-slate-400 text-sm mt-1">📍 {project.location}</p>
                        )}
                        {project.description && (
                          <p className="text-slate-300 text-sm mt-2">{project.description}</p>
                        )}
                        {project.photos && project.photos.length > 0 && (
                          <p className="text-slate-400 text-sm mt-2">
                            📷 {project.photos.length} photo(s)
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Raw JSON */}
            <div className="mt-8 pt-8 border-t border-slate-700">
              <details className="cursor-pointer">
                <summary className="text-slate-400 hover:text-slate-300 font-medium">
                  View Raw JSON
                </summary>
                <pre className="mt-4 bg-slate-900 p-4 rounded text-slate-300 text-xs overflow-auto max-h-64">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block w-12 h-12 border-4 border-slate-600 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-400">Scraping website and extracting data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
