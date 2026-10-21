/**
 * ============================================================================
 * UNIT 4: EMERGING DISTRIBUTED PARADIGMS — DISTRIBUTED MAPREDUCE (JOBS)
 * Module: services/mapreduce/jobs.js
 * ============================================================================
 *
 * Implements Hadoop/Google MapReduce jobs over distributed trip records:
 * 1. "avg_fare_by_zone": Computes average fare, trip count, and revenue per zone.
 * 2. "trips_per_driver": Aggregates fleet productivity and trip counts per driver.
 */

const JOBS = {
  AVG_FARE_BY_ZONE: {
    id: 'avg_fare_by_zone',
    title: 'Average Fare & Revenue per Zone',
    description: 'Map emits (zone, fare) -> Shuffle groups by zone -> Reduce calculates average and total.',
    map: (line) => {
      try {
        const trip = typeof line === 'string' ? JSON.parse(line) : line;
        if (trip && trip.zone && trip.fare) {
          return [{ key: trip.zone, value: parseFloat(trip.fare) }];
        }
      } catch (e) {}
      return [];
    },
    reduce: (key, values) => {
      const count = values.length;
      const total = values.reduce((sum, v) => sum + v, 0);
      return {
        zone: key,
        tripCount: count,
        totalRevenue: Number(total.toFixed(2)),
        averageFare: Number((total / count).toFixed(2))
      };
    }
  },

  TRIPS_PER_DRIVER: {
    id: 'trips_per_driver',
    title: 'Total Completed Trips per Driver',
    description: 'Map emits (driverId, 1) -> Shuffle groups by driverId -> Reduce sums total completed trips.',
    map: (line) => {
      try {
        const trip = typeof line === 'string' ? JSON.parse(line) : line;
        if (trip && trip.driverId) {
          return [{ key: trip.driverId, value: 1 }];
        }
      } catch (e) {}
      return [];
    },
    reduce: (key, values) => {
      const totalTrips = values.reduce((sum, v) => sum + v, 0);
      return {
        driverId: key,
        completedTrips: totalTrips
      };
    }
  }
};

module.exports = { JOBS };
