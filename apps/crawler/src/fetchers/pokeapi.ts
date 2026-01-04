import axios from 'axios';
import { Storage } from '@google-cloud/storage';
import { rateLimit } from '../utils/rateLimit';

// Configuration
const PROJECT_ID = 'road-to-wcs'; // User provided
const GCS_BUCKET_NAME = `${PROJECT_ID}-datalake`;
const BASE_URL = 'https://pokeapi.co/api/v2';
const MIN_INTERVAL_MS = 600; // 0.6s to be safe (User requested at least 0.5s)

interface PokemonListEntry {
    name: string;
    url: string;
}

interface PokemonDetails {
    id: number;
    name: string;
    species: { name: string };
    types: { slot: number; type: { name: string } }[];
    stats: { base_stat: number; stat: { name: string } }[];
    abilities: { is_hidden: boolean; ability: { name: string } }[];
    // Add other fields as necessary
}

const storage = new Storage({ projectId: PROJECT_ID });
const bucket = storage.bucket(GCS_BUCKET_NAME);

/**
 * Uploads data to GCS
 */
const uploadToGCS = async (path: string, data: any) => {
    const file = bucket.file(path);
    await file.save(JSON.stringify(data), {
        contentType: 'application/json',
        resumable: false,
    });
    console.log(`Uploaded: ${path}`);
};

/**
 * Main Fetcher Function
 */
export const fetchPokeAPIMasterData = async () => {
    console.log('Starting PokeAPI Master Data Fetch...');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
        // 1. Fetch all Pokemon list (limit=10000 to get everything including forms)
        console.log('Fetching Pokemon list...');
        const listResponse = await axios.get(`${BASE_URL}/pokemon?limit=10000`);
        const allPokemon: PokemonListEntry[] = listResponse.data.results;

        console.log(`Found ${allPokemon.length} entries.`);

        // 2. Fetch details sequentially
        const errors: string[] = [];

        for (const [index, entry] of allPokemon.entries()) {
            try {
                // STRICT RATE LIMITING: Wait before every request
                await rateLimit(MIN_INTERVAL_MS);

                console.log(`[${index + 1}/${allPokemon.length}] Fetching: ${entry.name}`);
                const detailResponse = await axios.get(entry.url);
                const data: PokemonDetails = detailResponse.data;

                // 3. Save to GCS (Raw JSON)
                // Partition by snapshot_date and categorize by species
                const gcsPath = `raw/master_pokeapi/species/snapshot_date=${today}/${entry.name}.json`;

                // Parallel execution is FORBIDDEN by user requirements.
                // We upload sequentially here. (Upload usually doesn't need rate limit but to be safe and simple keep it serial)
                await uploadToGCS(gcsPath, data);

            } catch (err: any) {
                console.error(`Error fetching ${entry.name}:`, err.message);
                errors.push(entry.name);
            }
        }

        if (errors.length > 0) {
            console.warn(`Completed with errors in: ${errors.join(', ')}`);
        } else {
            console.log('Master Data Fetch Completed Successfully.');
        }

    } catch (error) {
        console.error('Fatal Error in Pipeline:', error);
        process.exit(1);
    }
};

// Execute if run directly
if (require.main === module) {
    fetchPokeAPIMasterData();
}
