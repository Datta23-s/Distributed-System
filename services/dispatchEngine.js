// Distributed Dispatch Engine & Adapter
// Complies with Section 8, 9, 10 of UrbanPulse Master Spec

const prisma = require('./db');
const geoService = require('./geoService');
const { rTreeIndex } = require('../middleware/rTreeIndex');

class DispatchEngine {
  constructor() {
    this.activeTimeouts = new Map(); // rideId -> setTimeout handler
  }

  // Find eligible candidate drivers sorted by road distance
  async findCandidates(pickupLat, pickupLng, vehicleCategory, maxRadiusKm = 15.0) {
    // 1. Query available drivers with approved vehicles matching category
    const drivers = await prisma.driverProfile.findMany({
      where: {
        status: 'AVAILABLE',
        vehicles: {
          some: {
            category: vehicleCategory,
            isApproved: true
          }
        }
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        vehicles: { where: { isApproved: true } }
      }
    });

    if (!drivers || drivers.length === 0) {
      return [];
    }

    // 2. Score and rank candidates by proximity and rating
    const candidates = [];
    for (const d of drivers) {
      const lat = d.latitude || 18.5204;
      const lng = d.longitude || 73.8567;
      const route = geoService.calculateRoute(lat, lng, pickupLat, pickupLng);
      if (route.distanceKm <= maxRadiusKm) {
        candidates.push({
          driverId: d.id,
          userId: d.user.id,
          name: d.user.name,
          phone: d.user.phone,
          rating: d.rating,
          latitude: lat,
          longitude: lng,
          distanceKm: route.distanceKm,
          etaMinutes: Math.max(2, Math.round(route.distanceKm * 2.5)),
          vehicle: d.vehicles[0]
        });
      }
    }

    // Sort by proximity ascending, then by rating descending
    candidates.sort((a, b) => a.distanceKm - b.distanceKm || b.rating - a.rating);
    return candidates;
  }

  // Atomically dispatch ride to the next eligible driver
  async dispatchRide(rideId, socketManager = null) {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { customer: true }
    });

    if (!ride || ride.status !== 'REQUESTED' && ride.status !== 'SEARCHING') {
      return null;
    }

    // Mark ride as SEARCHING
    await prisma.ride.update({
      where: { id: rideId },
      data: { status: 'SEARCHING' }
    });

    // Record timeline event
    await prisma.rideStatusEvent.create({
      data: {
        rideId,
        status: 'SEARCHING',
        note: `Searching for nearby ${ride.vehicleCategory} drivers in Pune.`
      }
    });

    if (socketManager) {
      socketManager.notifyCustomer(ride.customerId, 'RIDE_STATUS_UPDATED', {
        rideId,
        status: 'SEARCHING',
        message: 'Searching for nearby drivers...'
      });
    }

    // Find candidates
    const candidates = await this.findCandidates(ride.pickupLat, ride.pickupLng, ride.vehicleCategory);

    if (candidates.length === 0) {
      // No available drivers in range
      await prisma.ride.update({
        where: { id: rideId },
        data: { status: 'NO_DRIVER_AVAILABLE' }
      });

      await prisma.rideStatusEvent.create({
        data: {
          rideId,
          status: 'NO_DRIVER_AVAILABLE',
          note: 'No drivers available in the requested Pune zone at this moment.'
        }
      });

      if (socketManager) {
        socketManager.notifyCustomer(ride.customerId, 'RIDE_STATUS_UPDATED', {
          rideId,
          status: 'NO_DRIVER_AVAILABLE',
          message: 'No drivers available nearby. Please try again in a few moments.'
        });
      }
      return null;
    }

    // Select top candidate
    const candidate = candidates[0];

    // Atomically create assignment and reserve driver
    const assignment = await prisma.$transaction(async (tx) => {
      // Check driver availability atomically
      const currentDriver = await tx.driverProfile.findUnique({
        where: { id: candidate.driverId }
      });

      if (!currentDriver || currentDriver.status !== 'AVAILABLE') {
        return null;
      }

      await tx.driverProfile.update({
        where: { id: candidate.driverId },
        data: { status: 'RESERVED' }
      });

      return await tx.rideAssignment.create({
        data: {
          rideId,
          driverId: candidate.driverId,
          status: 'OFFERED'
        }
      });
    });

    if (!assignment) {
      // Candidate was snatched concurrently, retry search
      return this.dispatchRide(rideId, socketManager);
    }

    // Notify Driver via WebSocket
    if (socketManager) {
      socketManager.notifyDriver(candidate.driverId, 'INCOMING_RIDE_OFFER', {
        assignmentId: assignment.id,
        rideId: ride.id,
        rideNumber: ride.rideNumber,
        vehicleCategory: ride.vehicleCategory,
        pickupAddress: ride.pickupAddress,
        pickupLat: ride.pickupLat,
        pickupLng: ride.pickupLng,
        destAddress: ride.destAddress,
        destLat: ride.destLat,
        destLng: ride.destLng,
        distanceKm: ride.distanceKm,
        estimatedFare: ride.estimatedFare,
        customerName: ride.customer.name,
        expiresInSeconds: 30
      });
    }

    // Set 30-second offer timeout
    const timeoutHandle = setTimeout(async () => {
      await this.handleOfferTimeout(assignment.id, rideId, candidate.driverId, socketManager);
    }, 30000);

    this.activeTimeouts.set(assignment.id, timeoutHandle);

    return { assignment, candidate };
  }

  // Handle Driver Accepting Offer
  async acceptOffer(driverId, assignmentId, socketManager = null) {
    if (this.activeTimeouts.has(assignmentId)) {
      clearTimeout(this.activeTimeouts.get(assignmentId));
      this.activeTimeouts.delete(assignmentId);
    }

    // Execute in database transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.rideAssignment.findUnique({
        where: { id: assignmentId },
        include: { ride: true }
      });

      if (!assignment) {
        throw new Error('Assignment offer does not exist.');
      }

      if (assignment.status !== 'OFFERED') {
        throw new Error(`Assignment offer is already ${assignment.status.toLowerCase()}.`);
      }

      if (assignment.driverId !== driverId) {
        throw new Error('Unauthorized driver assignment.');
      }

      if (assignment.ride.status !== 'SEARCHING' && assignment.ride.status !== 'REQUESTED') {
        throw new Error(`Ride is no longer available (current status: ${assignment.ride.status}).`);
      }

      // Mark assignment accepted
      await tx.rideAssignment.update({
        where: { id: assignmentId },
        data: { status: 'ACCEPTED', respondedAt: new Date() }
      });

      // Assign ride and transition to DRIVER_ASSIGNED
      const updatedRide = await tx.ride.update({
        where: { id: assignment.rideId },
        data: {
          driverId,
          status: 'DRIVER_ASSIGNED'
        },
        include: {
          driver: {
            include: {
              user: { select: { name: true, phone: true } },
              vehicles: true
            }
          },
          customer: { select: { id: true, name: true, phone: true } }
        }
      });

      // Update driver status to RESERVED/ARRIVING
      await tx.driverProfile.update({
        where: { id: driverId },
        data: { status: 'RESERVED' }
      });

      // Add status event
      await tx.rideStatusEvent.create({
        data: {
          rideId: assignment.rideId,
          status: 'DRIVER_ASSIGNED',
          note: `Driver ${updatedRide.driver.user.name} accepted the ride.`
        }
      });

      return updatedRide;
    });

    // Notify Customer and Driver via WebSocket
    if (socketManager) {
      socketManager.notifyCustomer(result.customerId, 'RIDE_ASSIGNED', {
        rideId: result.id,
        status: 'DRIVER_ASSIGNED',
        driver: {
          name: result.driver.user.name,
          phone: result.driver.user.phone,
          rating: result.driver.rating,
          latitude: result.driver.latitude,
          longitude: result.driver.longitude,
          vehicle: result.driver.vehicles[0]
        },
        tripPin: result.tripPin // Reveal OTP to customer for verification
      });

      socketManager.notifyDriver(driverId, 'RIDE_ACCEPTED_CONFIRMATION', {
        rideId: result.id,
        rideNumber: result.rideNumber,
        status: 'DRIVER_ASSIGNED',
        customer: result.customer,
        pickupAddress: result.pickupAddress,
        pickupLat: result.pickupLat,
        pickupLng: result.pickupLng,
        destAddress: result.destAddress,
        destLat: result.destLat,
        destLng: result.destLng,
        estimatedFare: result.estimatedFare
      });
    }

    return result;
  }

  // Handle Driver Rejecting Offer
  async rejectOffer(driverId, assignmentId, socketManager = null) {
    if (this.activeTimeouts.has(assignmentId)) {
      clearTimeout(this.activeTimeouts.get(assignmentId));
      this.activeTimeouts.delete(assignmentId);
    }

    const assignment = await prisma.rideAssignment.findUnique({
      where: { id: assignmentId }
    });

    if (!assignment || assignment.status !== 'OFFERED') return null;

    await prisma.rideAssignment.update({
      where: { id: assignmentId },
      data: { status: 'REJECTED', respondedAt: new Date() }
    });

    // Release driver back to AVAILABLE
    await prisma.driverProfile.update({
      where: { id: driverId },
      data: { status: 'AVAILABLE' }
    });

    // Retry dispatch to next candidate
    return this.dispatchRide(assignment.rideId, socketManager);
  }

  // Handle Offer Timeout (30s)
  async handleOfferTimeout(assignmentId, rideId, driverId, socketManager = null) {
    this.activeTimeouts.delete(assignmentId);

    const assignment = await prisma.rideAssignment.findUnique({
      where: { id: assignmentId }
    });

    if (assignment && assignment.status === 'OFFERED') {
      await prisma.rideAssignment.update({
        where: { id: assignmentId },
        data: { status: 'TIMED_OUT', respondedAt: new Date() }
      });

      // Free driver back to AVAILABLE
      await prisma.driverProfile.update({
        where: { id: driverId },
        data: { status: 'AVAILABLE' }
      });

      if (socketManager) {
        socketManager.notifyDriver(driverId, 'OFFER_TIMED_OUT', { assignmentId, rideId });
      }

      // Automatically retry dispatch for remaining candidates
      return this.dispatchRide(rideId, socketManager);
    }
  }
}

module.exports = new DispatchEngine();
