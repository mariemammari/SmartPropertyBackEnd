import { Injectable, BadRequestException } from '@nestjs/common';

interface POI {
    name: string;
    lat: number;
    lng: number;
    tags: Record<string, any>;
}

interface NearbyItem {
    name: string;
    km: number;
    label: string;
}

type Category = 'Education' | 'Transport' | 'Dining & Café' | 'Shopping' | 'Nature' | 'Sport';

export interface NearbyResponse {
    [key: string]: NearbyItem[];
}

@Injectable()
export class NearbyService {
    // ─── Haversine Formula: Calculate distance between two coordinates ─────
    private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371; // Earth radius in km
        const dLat = this.degreesToRadians(lat2 - lat1);
        const dLng = this.degreesToRadians(lng2 - lng1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.degreesToRadians(lat1)) *
            Math.cos(this.degreesToRadians(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    private degreesToRadians(degrees: number): number {
        return (degrees * Math.PI) / 180;
    }

    // ─── Calculate walk and drive time ─────────────────────────────────────
    private calculateTime(km: number): string {
        const walkSpeed = 5; // km/h
        const driveSpeed = 40; // km/h

        const walkTimeMinutes = Math.round((km / walkSpeed) * 60);
        const driveTimeMinutes = Math.round((km / driveSpeed) * 60);

        // Show walk time if ≤ 20 min, otherwise show drive time
        if (walkTimeMinutes <= 20) {
            return `${walkTimeMinutes} min walk`;
        } else {
            return `${driveTimeMinutes} min drive`;
        }
    }

    // ─── Map OSM tags to display category ──────────────────────────────────
    private mapTagToCategory(tags: Record<string, any>): Category | null {
        // Education
        if (tags.amenity === 'school' || tags.amenity === 'college' || tags.amenity === 'university') {
            return 'Education';
        }

        // Transport
        if (
            tags.amenity === 'bus_stop' ||
            tags.amenity === 'train_station' ||
            tags.amenity === 'bus_station' ||
            tags.public_transport === 'stop_position' ||
            tags.public_transport === 'station' ||
            tags.railway === 'station' ||
            tags.railway === 'tram_stop'
        ) {
            return 'Transport';
        }

        // Dining & Café
        if (
            tags.amenity === 'cafe' ||
            tags.amenity === 'restaurant' ||
            tags.amenity === 'fast_food' ||
            tags.amenity === 'bar'
        ) {
            return 'Dining & Café';
        }

        // Shopping
        if (
            tags.shop === 'mall' ||
            tags.shop === 'supermarket' ||
            tags.shop === 'convenience'
        ) {
            return 'Shopping';
        }

        // Nature
        if (
            tags.leisure === 'park' ||
            tags.leisure === 'playground' ||
            tags.leisure === 'garden' ||
            tags.leisure === 'nature_reserve' ||
            tags.leisure === 'recreation_ground' ||
            tags.natural === 'wood' ||
            tags.natural === 'water'
        ) {
            return 'Nature';
        }

        // Sport
        if (
            tags.leisure === 'sports_centre' ||
            tags.leisure === 'gym' ||
            tags.leisure === 'stadium' ||
            tags.leisure === 'swimming_pool' ||
            tags.leisure === 'tennis_court' ||
            tags.leisure === 'basketball_court' ||
            tags.leisure === 'pitch' ||
            tags.amenity === 'gym' ||
            tags.amenity === 'swimming_pool'
        ) {
            return 'Sport';
        }

        return null;
    }

    // ─── Normalize Arabic names: Remove common prefixes & cleanup ─────────
    private normalizeArabicName(name: string): string {
        let normalized = name.trim();

        // Remove common Arabic prefixes (محطة, ساحة, مركز, etc.)
        normalized = normalized
            .replace(/^محطة\s+/g, '')      // محطة (station)
            .replace(/^ساحة\s+/g, '')      // ساحة (square)
            .replace(/^مركز\s+/g, '')      // مركز (center)
            .replace(/^فرع\s+/g, '')       // فرع (branch)
            .replace(/^كافيه\s+/g, '')     // كافيه (caffeine)
            .replace(/\s+\(.*\)$/g, '');   // Remove text in parentheses (e.g., "ساحة (إياب)")

        return normalized.toLowerCase().trim();
    }

    // ─── Calculate string similarity (Levenshtein distance) ────────────────
    private calculateStringSimilarity(s1: string, s2: string): number {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    // ─── Levenshtein distance algorithm ────────────────────────────────────
    private levenshteinDistance(s1: string, s2: string): number {
        const costs: number[] = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }

    // ─── Deduplication: Smart matching with fuzzy + proximity ──────────────
    private deduplicatePOIs(pois: POI[]): POI[] {
        if (pois.length <= 1) return pois;

        const deduplicated: POI[] = [];
        const proximityThreshold = 0.05; // 50 meters in km
        const similarityThreshold = 0.8; // 80% similarity for fuzzy matching

        for (const poi of pois) {
            const normalizedName = this.normalizeArabicName(poi.name);
            let isDuplicate = false;

            for (const existing of deduplicated) {
                const existingNormalizedName = this.normalizeArabicName(existing.name);

                // Check 1: Normalized names are identical
                if (normalizedName === existingNormalizedName) {
                    isDuplicate = true;
                    break;
                }

                // Check 2: Fuzzy match (80%+ similarity)
                const similarity = this.calculateStringSimilarity(normalizedName, existingNormalizedName);
                if (similarity >= similarityThreshold) {
                    isDuplicate = true;
                    break;
                }

                // Check 3: Geographic proximity (within 50m)
                const distance = this.calculateDistance(poi.lat, poi.lng, existing.lat, existing.lng);
                if (distance < proximityThreshold) {
                    isDuplicate = true;
                    break;
                }
            }

            // Add POI if it's not a duplicate
            if (!isDuplicate) {
                deduplicated.push(poi);
            }
        }

        return deduplicated;
    }

    // ─── Query Overpass API ───────────────────────────────────────────────
    private async queryOverpassAPI(lat: number, lng: number, radius: number): Promise<POI[]> {
        // Build Overpass QL query to fetch multiple POI types
        const overpassQuery = `
      [out:json];
      (
        node["amenity"~"school|college|university"](around:${radius},${lat},${lng});
        node["amenity"~"bus_station|train_station|bus_stop"](around:${radius},${lat},${lng});
        node["public_transport"~"stop_position|station"](around:${radius},${lat},${lng});
        node["railway"~"station|tram_stop"](around:${radius},${lat},${lng});
        node["amenity"~"cafe|restaurant|fast_food|bar"](around:${radius},${lat},${lng});
        node["shop"~"mall|supermarket|convenience"](around:${radius},${lat},${lng});
        node["leisure"~"park|playground|garden|nature_reserve|recreation_ground|sports_centre|gym|stadium|swimming_pool|tennis_court|basketball_court|pitch"](around:${radius},${lat},${lng});
        node["natural"~"wood|water"](around:${radius},${lat},${lng});
        node["amenity"~"gym|swimming_pool"](around:${radius},${lat},${lng});
      );
      out center;
    `;
        const body = `data=${encodeURIComponent(overpassQuery)}`;

        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Overpass API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();

            // Map Overpass response to POI format
            const pois: POI[] = data.elements
                .filter((element: any) => element.tags && element.tags.name) // Only named POIs
                .map((element: any) => ({
                    name: element.tags.name,
                    lat: element.lat || element.center.lat,
                    lng: element.lon || element.center.lon,
                    tags: element.tags,
                }));

            return pois;
        } catch (error) {
            console.error('Overpass API error:', error);
            throw new BadRequestException('Failed to fetch nearby locations from Overpass API');
        }
    }

    // ─── Main method: Get nearby POIs ──────────────────────────────────────
    async getNearby(lat: number, lng: number, radius: number = 2000): Promise<NearbyResponse> {
        // Validate coordinates
        if (lat === undefined || lng === undefined) {
            throw new BadRequestException('Latitude and longitude are required');
        }

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw new BadRequestException('Invalid coordinates');
        }

        // Fetch POIs from Overpass API
        const pois = await this.queryOverpassAPI(lat, lng, radius);

        // Deduplicate: Remove exact duplicates & nearby POIs
        const dedupedPois = this.deduplicatePOIs(pois);

        // Initialize categories
        const categories: NearbyResponse = {
            'Education': [],
            'Transport': [],
            'Dining & Café': [],
            'Shopping': [],
            'Nature': [],
            'Sport': [],
        };

        // Process each deduplicated POI
        for (const poi of dedupedPois) {
            const category = this.mapTagToCategory(poi.tags);

            if (category) {
                const distance = this.calculateDistance(lat, lng, poi.lat, poi.lng);
                const timeLabel = this.calculateTime(distance);

                categories[category].push({
                    name: poi.name,
                    km: Math.round(distance * 10) / 10, // Round to 1 decimal
                    label: timeLabel,
                });
            }
        }

        // Sort by distance and limit to 5 per category
        Object.keys(categories).forEach((category) => {
            categories[category] = categories[category]
                .sort((a, b) => a.km - b.km)
                .slice(0, 5);
        });

        return categories;
    }
}
