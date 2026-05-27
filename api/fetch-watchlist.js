export default async function handler(req, res) {
    // Enable cross-origin handshakes so your interface can read this stream safely
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // The backend now looks for a specific "page" number sent from the browser
    const { username, page = 1 } = req.query;
    if (!username) return res.status(400).json({ error: 'Username parameter is required' });

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

    try {
        const url = `https://letterboxd.com/${cleanUsername}/watchlist/page/${page}/`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        // If the page doesn't exist, it means we cleanly reached the absolute end of their watchlist
        if (!response.ok) {
            return res.status(200).json({ movies: [], hasMore: false });
        }

        const htmlText = await response.text();
        const items = [];
        const segments = htmlText.split('data-film-slug="');

        for (let i = 1; i < segments.length; i++) {
            const segment = segments[i];
            const slugMatch = segment.match(/^([\s\S]*?)"/);
            const altMatch = segment.match(/alt="([^"]+)"/);
            
            if (altMatch) {
                const fullSlug = slugMatch ? slugMatch[1] : '';
                const title = altMatch[1].trim();
                const yearMatch = fullSlug.match(/-(\d{4})\/?$/);
                const year = yearMatch ? yearMatch[1] : '';
                
                items.push({
                    title: title,
                    year: year,
                    link: `https://letterboxd.com${fullSlug}`
                });
            }
        }

        // Clever Check: If the page has a "Next" button in the HTML structure, tell the browser to keep going
        const hasMore = htmlText.includes('class="next"') || htmlText.includes('class="next-page"');

        return res.status(200).json({ movies: items, hasMore: hasMore });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'System connection error.' });
    }
}
