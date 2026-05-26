export default async function handler(req, res) {
    // Enable automated cross-origin controls so your frontend can chat with this API safely
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

    try {
        // Formulate the target public Letterboxd Watchlist feed
        const url = `https://letterboxd.com/${username.trim().toLowerCase()}/watchlist/rss/`;
        const response = await fetch(url);

        if (!response.ok) {
            return res.status(404).json({ error: 'Failed to locate Letterboxd watchlist. Verify the username is public.' });
        }

        const xmlText = await response.text();

        // Break down the individual film elements using an explicit structural string parser
        const items = [];
        const itemSegments = xmlText.split('<item>');
        
        // Index 0 holds top-level feed definitions, actual films start at index 1
        for (let i = 1; i < itemSegments.length; i++) {
            const segment = itemSegments[i];
            
            // Extract the core namespaced tags natively provided in Letterboxd RSS structures
            const titleMatch = segment.match(/<letterboxd:filmTitle>([\s\S]*?)<\/letterboxd:filmTitle>/i);
            const yearMatch = segment.match(/<letterboxd:filmYear>([\s\S]*?)<\/letterboxd:filmYear>/i);
            const linkMatch = segment.match(/<link>([\s\S]*?)<\/link>/i);

            if (titleMatch) {
                items.push({
                    title: titleMatch[1].trim(),
                    year: yearMatch ? yearMatch[1].trim() : '',
                    link: linkMatch ? linkMatch[1].trim() : ''
                });
            }
        }

        // Return the parsed clean array back to your app
        return res.status(200).json({ movies: items });
    } catch (error) {
        console.error('Server sync error:', error);
        return res.status(500).json({ error: 'Internal system error processing feed data' });
    }
}