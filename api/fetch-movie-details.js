const TMDB_API_KEY = '53a66f3e9d1a0f20c9dbc519c742679b';

export default async function handler(req, res) {
    // Set up cross-origin security rules so the browser allows data sharing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { title, year } = req.query;
    if (!title) return res.status(400).json({ error: 'Movie title is required' });

    try {
        // Step 1: Search TMDB for the movie to get its unique ID number
        let searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
        if (year) searchUrl += `&year=${year}`;
        
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        
        if (!searchData.results || searchData.results.length === 0) {
            return res.status(404).json({ error: 'Movie not found on TMDB' });
        }
        
        const movieId = searchData.results[0].id;
        
        // Step 2: Fetch the full details, crew list, and historical keywords for that ID
        const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits,keywords`;
        const detailsRes = await fetch(detailsUrl);
        const movieDetails = await detailsRes.json();
        
        // Extract Director from the crew registry
        const directorObj = movieDetails.credits?.crew?.find(member => member.job === 'Director');
        const directorName = directorObj ? directorObj.name : 'Unknown Director';
        
        // Convert genres array into a clean comma-separated text string
        const genresString = movieDetails.genres ? movieDetails.genres.map(g => g.name).join(', ') : '';
        
        // Convert production countries array into a clean text string
        const countriesString = movieDetails.production_countries ? movieDetails.production_countries.map(c => c.name).join(', ') : '';
        
        // Look at TMDB keywords to auto-detect cinematic eras/movements
        const keywordsList = movieDetails.keywords?.keywords ? movieDetails.keywords.keywords.map(k => k.name) : [];
        let detectedEra = '';
        const lowerKeywords = keywordsList.join(' ').toLowerCase();
        
        if (lowerKeywords.includes('french new wave') || lowerKeywords.includes('nouvelle vague')) detectedEra = 'French New Wave';
        else if (lowerKeywords.includes('neorealism') || lowerKeywords.includes('italian neorealism')) detectedEra = 'Italian Neorealism';
        else if (lowerKeywords.includes('new hollywood')) detectedEra = 'New Hollywood';
        else if (lowerKeywords.includes('soviet montage')) detectedEra = 'Soviet Montage';
        else if (lowerKeywords.includes('german expressionism')) detectedEra = 'German Expressionism';
        else if (lowerKeywords.includes('dogme 95')) detectedEra = 'Dogme 95';
        else if (lowerKeywords.includes('film noir')) detectedEra = 'Film Noir';
        else if (lowerKeywords.includes('mumblecore')) detectedEra = 'Mumblecore';
        else if (lowerKeywords.includes('spaghetti western')) detectedEra = 'Spaghetti Western';
        
        // Historical fallbacks based on rules if no explicit keywords are tagged
        if (!detectedEra && countriesString.includes('Italy') && movieDetails.release_date) {
            const releaseYear = parseInt(movieDetails.release_date.split('-')[0]);
            if (releaseYear >= 1943 && releaseYear <= 1952) detectedEra = 'Italian Neorealism';
        }
        if (!detectedEra && countriesString.includes('France') && movieDetails.release_date) {
            const releaseYear = parseInt(movieDetails.release_date.split('-')[0]);
            if (releaseYear >= 1958 && releaseYear <= 1964) detectedEra = 'French New Wave';
        }

        // Return a perfectly formatted packet containing all missing metadata
        return res.status(200).json({
            runtime: movieDetails.runtime || 0,
            genres: genresString,
            countries: countriesString,
            director: directorName,
            era: detectedEra,
            poster: movieDetails.poster_path ? `https://image.tmdb.org/t/p/w500${movieDetails.poster_path}` : null
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to enrich movie data payload' });
    }
}