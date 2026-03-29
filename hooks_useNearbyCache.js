import { useState, useCallback } from 'react';

/**
 * Custom hook for caching nearby POI data
 * Prevents refetching when coordinates haven't changed
 * 
 * Usage:
 * const { getFromCache, saveToCache, isCacheValid } = useNearbyCache();
 * 
 * const cached = getFromCache(lat, lng, radius);
 * if (cached && isCacheValid(cached)) {
 *   setData(cached.data);
 *   return;
 * }
 */
export function useNearbyCache() {
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generate cache key from coordinates (rounded to 4 decimals for nearby grouping)
  const getCacheKey = useCallback((lat, lng, radius = 1000) => {
    return `${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}`;
  }, []);

  // Get from cache or return null
  const getFromCache = useCallback((lat, lng, radius = 1000) => {
    const key = getCacheKey(lat, lng, radius);
    return cache[key] || null;
  }, [cache, getCacheKey]);

  // Save to cache with timestamp
  const saveToCache = useCallback((lat, lng, data, radius = 1000) => {
    const key = getCacheKey(lat, lng, radius);
    setCache(prev => ({
      ...prev,
      [key]: {
        data,
        timestamp: Date.now(),
        lat,
        lng,
        radius
      }
    }));
  }, [getCacheKey]);

  // Clear all cache
  const clearCache = useCallback(() => {
    setCache({});
  }, []);

  // Check if cache is still valid (default: 1 hour expiry)
  const isCacheValid = useCallback((cachedItem, maxAge = 3600000) => {
    if (!cachedItem) return false;
    return (Date.now() - cachedItem.timestamp) < maxAge;
  }, []);

  // Get cache stats for debugging
  const getCacheStats = useCallback(() => {
    const stats = {
      totalEntries: Object.keys(cache).length,
      entries: Object.entries(cache).map(([key, value]) => ({
        key,
        age: Date.now() - value.timestamp,
        coordinates: `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`,
        radius: value.radius
      }))
    };
    return stats;
  }, [cache]);

  return {
    cache,
    loading,
    setLoading,
    error,
    setError,
    getFromCache,
    saveToCache,
    clearCache,
    isCacheValid,
    getCacheStats
  };
}
