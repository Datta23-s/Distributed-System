// Server-Side Fare Calculation Engine
// Complies with Section 7 of UrbanPulse Master Spec

const prisma = require('./db');
const { serverlessEngine } = require('./serverless/serverlessRuntime');

class FareService {
  // Generate quotes for all available vehicle categories for given trip parameters
  async generateQuotes({ customerId, pickupAddress, pickupLat, pickupLng, destAddress, destLat, destLng, distanceKm, durationMinutes }) {
    // 1. Fetch active fare configurations from database
    const configs = await prisma.fareConfiguration.findMany({
      where: { isActive: true }
    });

    if (!configs || configs.length === 0) {
      throw new Error('No active fare configurations found.');
    }

    // 2. Fetch surge multiplier (bridged with Serverless FaaS pricing runtime)
    let surgeMultiplier = 1.0;
    try {
      if (serverlessEngine && serverlessEngine.functions && serverlessEngine.functions.has('surgePricing')) {
        const surgeResult = await serverlessEngine.invoke('surgePricing', {
          demandCount: 15,
          activeDrivers: 8,
          weatherScore: 0.8
        });
        if (surgeResult && surgeResult.multiplier) {
          surgeMultiplier = Number(surgeResult.multiplier.toFixed(2));
        }
      }
    } catch (e) {
      // Graceful fallback to config default
      surgeMultiplier = 1.0;
    }

    const quotes = [];
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute quote validity

    for (const config of configs) {
      const baseFare = config.baseFare;
      const distanceFare = Number((distanceKm * config.perKmRate).toFixed(2));
      const timeFare = Number((durationMinutes * config.perMinuteRate).toFixed(2));
      const effectiveSurge = Math.max(config.surgeMultiplier, surgeMultiplier);
      
      const unroundedTotal = (baseFare + distanceFare + timeFare) * effectiveSurge;
      // Apply minimum fare rule and round to nearest whole rupee in INR
      const finalTotal = Math.max(config.minimumFare, Math.round(unroundedTotal));

      // Save persistent FareQuote record
      const quote = await prisma.fareQuote.create({
        data: {
          customerId: customerId || null,
          pickupAddress,
          pickupLat,
          pickupLng,
          destAddress,
          destLat,
          destLng,
          distanceKm,
          durationMinutes,
          category: config.category,
          baseFare,
          distanceFare,
          timeFare,
          surgeMultiplier: effectiveSurge,
          totalFare: finalTotal,
          currency: config.currency,
          expiresAt
        }
      });

      // Illustrative vehicle meta & capacity
      const meta = this.getCategoryMeta(config.category);

      quotes.push({
        quoteId: quote.id,
        category: config.category,
        name: meta.name,
        description: meta.description,
        capacity: meta.capacity,
        etaMinutes: meta.etaMinutes,
        distanceKm,
        durationMinutes,
        currency: config.currency,
        totalFare: finalTotal,
        breakdown: {
          baseFare,
          distanceFare,
          timeFare,
          surgeMultiplier: effectiveSurge,
          minimumFare: config.minimumFare
        },
        expiresAt: expiresAt.toISOString(),
        pricingVersion: 'v1.2-pune'
      });
    }

    return quotes;
  }

  // Validate that a submitted quote is valid, non-expired, and matches category
  async validateQuote(quoteId, expectedCategory) {
    if (!quoteId) return null;
    const quote = await prisma.fareQuote.findUnique({
      where: { id: quoteId }
    });

    if (!quote) {
      throw new Error('Fare quote not found. Please refresh your booking request.');
    }

    if (new Date() > new Date(quote.expiresAt)) {
      throw new Error('Fare quote has expired. Please obtain a fresh fare estimate.');
    }

    if (expectedCategory && quote.category !== expectedCategory) {
      throw new Error(`Quote vehicle category (${quote.category}) does not match requested category (${expectedCategory}).`);
    }

    return quote;
  }

  getCategoryMeta(category) {
    switch (category) {
      case 'BIKE':
        return {
          name: 'UrbanPulse Moto',
          description: 'Fastest way through Pune traffic, helmet provided',
          capacity: 1,
          etaMinutes: 2
        };
      case 'AUTO':
        return {
          name: 'Pune Auto Rickshaw',
          description: 'Iconic 3-wheeler, metered affordability',
          capacity: 3,
          etaMinutes: 3
        };
      case 'ECONOMY':
        return {
          name: 'UrbanPulse Go',
          description: 'Comfortable compact AC sedans & hatchbacks',
          capacity: 4,
          etaMinutes: 4
        };
      case 'PREMIUM':
        return {
          name: 'UrbanPulse Premier',
          description: 'Top-rated drivers in premium sedans',
          capacity: 4,
          etaMinutes: 6
        };
      default:
        return {
          name: 'UrbanPulse Standard',
          description: 'Reliable point-to-point ride',
          capacity: 4,
          etaMinutes: 5
        };
    }
  }
}

module.exports = new FareService();
