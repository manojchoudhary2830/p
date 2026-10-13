/**
 * SEO & Structured Data Helpers
 * Implements Security Audit fix from p.md lines 120-124:
 * Prevents Cross-Site Scripting (XSS) in JSON-LD script blocks
 * by escaping '</' to '<\\/' in serialized JSON output.
 */

export function escapeJsonLd(data) {
  if (!data) return '';
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
  // CRITICAL SECURITY FIX: Escape </ to <\/ to prevent closing </script> tag injection
  return jsonString.replace(/<\//g, '<\\/');
}

export function generatePropertySchema(property) {
  if (!property) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: property.title,
    description: property.description,
    image: property.images || [property.cover_image],
    address: {
      '@type': 'PostalAddress',
      streetAddress: property.address,
      addressLocality: property.city ? property.city.toUpperCase() : '',
      addressRegion: 'Rajasthan',
      addressCountry: 'IN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: property.latitude || 26.9124,
      longitude: property.longitude || 75.7873,
    },
    priceRange: `₹${property.monthly_rent_start} - ₹${property.monthly_rent_start * 2}`,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: property.rating || 4.8,
      reviewCount: property.reviews_count || 12,
      bestRating: 5,
      worstRating: 1,
    },
    amenityFeature: (property.amenities || []).map((amenity) => ({
      '@type': 'LocationFeatureSpecification',
      name: amenity,
      value: true,
    })),
  };
}

export function generateBreadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
