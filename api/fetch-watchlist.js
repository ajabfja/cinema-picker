export default async function handler(req, res) {
    // Set up security handshakes for web cross-communication
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { username } = req.query;
    if (!username) {
        return res.status(400).json({ error: 'Username query parameter is required' });
    }

    // CRITICAL FIX: Force the username string to be purely lowercase and stripped of spaces immediately
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

    try {
        // Construct the native direct lowercase feed URL
        const url = `https://letterboxd.com/${cleanUsername}/watchlist/rss/`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        if (!response.ok) {
            return res.status(404).json({ error: `Could not read feed sequence for account: "${cleanUsername}". Check that your watchlist privacy is set to public.` });
        }

        const xmlText = await response.text();

        // High-fidelity structural segment text breaker
        const items = [];
        const itemSegments = xmlText.split('<item>');
        
        for (let i = 1; i < itemSegments.length; i++) {
            const segment = itemSegments[i];
            
            // Comprehensive namespace extractor matching all variations of Letterboxd RSS formats
            let titleMatch = segment.match(/<letterboxd:filmTitle>([\s\S]*?)<\/letterboxd:filmTitle>/i) || segment.match(/<title>([\s\S]*?)<\/title>/i);
            let yearMatch = segment.match(/<letterboxd:filmYear>([\s\S]*?)<\/letterboxd:filmYear>/i);
            let linkMatch = segment.match(/<link>([\s\S]*?)<\/link>/i);

            if (titleMatch) {
                let cleanTitle = titleMatch[1].trim();
                // Clean up trailing details if it fallback-matched a generic RSS title header
                if (cleanTitle.includes(',')) {
                    const parts = cleanTitle.split(',');
                    const potentialYear = parts[parts.length - 1].trim();
                    if (/^\d{4}$/.test(potentialYear) && !yearMatch) {
                        yearMatch = [null, potentialYear];
                        cleanTitle = parts.slice(0, -1).join(',').trim();
                    }
                }

                items.push({
                    title: cleanTitle.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
                    year: yearMatch ? yearMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '',
                    link: linkMatch ? linkMatch[1].trim() : ''
                });
            }
        }

        if (items.length === 0) {
            return res.status(404).json({ error: "Watchlist loaded but looks empty. Add a few films on Letterboxd first!" });
        }

        return res.status(200).json({ movies: items });
    } catch (error) {
        console.error('Server sync error:', error);
        return res.status(500).json({ error: 'Internal system connection timeout processing data streams.' });
    }
}
