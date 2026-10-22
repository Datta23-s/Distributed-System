// UrbanPulse Dispatch Seed Script
// Populates Pune operational data, default fares, demo accounts, vehicles, and saved places

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding UrbanPulse Dispatch (Pune, MH) ---');

  // 1. Seed Fare Configurations
  const fareConfigs = [
    {
      category: 'BIKE',
      baseFare: 25.0,
      perKmRate: 9.0,
      perMinuteRate: 1.0,
      minimumFare: 30.0,
      cancellationFee: 15.0,
      surgeMultiplier: 1.0,
      currency: 'INR'
    },
    {
      category: 'AUTO',
      baseFare: 35.0,
      perKmRate: 15.0,
      perMinuteRate: 1.5,
      minimumFare: 40.0,
      cancellationFee: 20.0,
      surgeMultiplier: 1.0,
      currency: 'INR'
    },
    {
      category: 'ECONOMY',
      baseFare: 60.0,
      perKmRate: 19.0,
      perMinuteRate: 2.0,
      minimumFare: 80.0,
      cancellationFee: 30.0,
      surgeMultiplier: 1.0,
      currency: 'INR'
    },
    {
      category: 'PREMIUM',
      baseFare: 110.0,
      perKmRate: 28.0,
      perMinuteRate: 3.0,
      minimumFare: 150.0,
      cancellationFee: 50.0,
      surgeMultiplier: 1.0,
      currency: 'INR'
    }
  ];

  for (const fare of fareConfigs) {
    await prisma.fareConfiguration.upsert({
      where: { category: fare.category },
      update: fare,
      create: fare
    });
  }
  console.log('✓ Fare configurations seeded for BIKE, AUTO, ECONOMY, PREMIUM');

  // 2. Hash default password
  const defaultPassword = 'Password@123';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  // 3. Seed Customer
  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@urbanpulse.in' },
    update: {},
    create: {
      email: 'customer@urbanpulse.in',
      phone: '+91 98765 43210',
      name: 'Aarav Sharma',
      passwordHash,
      role: 'CUSTOMER',
      customerProfile: {
        create: {
          emergencyContactName: 'Priya Sharma (Sister)',
          emergencyContactPhone: '+91 98765 00000',
          rating: 4.95,
          totalRides: 14
        }
      },
      savedPlaces: {
        create: [
          {
            label: 'Home',
            address: 'FC Road, Shivajinagar, Pune, Maharashtra 411005',
            latitude: 18.5284,
            longitude: 73.8421
          },
          {
            label: 'Work',
            address: 'EON Free Zone, Kharadi, Pune, Maharashtra 411014',
            latitude: 18.5516,
            longitude: 73.9535
          },
          {
            label: 'Airport',
            address: 'Pune International Airport (PNQ), Lohegaon, Pune 411032',
            latitude: 18.5822,
            longitude: 73.9197
          }
        ]
      }
    }
  });
  console.log(`✓ Customer seeded: ${customerUser.email} (Password: ${defaultPassword})`);

  // 4. Seed Drivers & Vehicles
  const driversData = [
    {
      email: 'driver1@urbanpulse.in',
      phone: '+91 91234 56789',
      name: 'Rajesh Patil',
      license: 'MH12-2021-0084321',
      lat: 18.5204,
      lng: 73.8567, // Shivajinagar
      vehicle: {
        category: 'ECONOMY',
        make: 'Maruti Suzuki',
        model: 'Swift Dzire Tour',
        year: 2022,
        licensePlate: 'MH 12 QX 4501',
        color: 'Arctic White',
        capacity: 4
      }
    },
    {
      email: 'driver2@urbanpulse.in',
      phone: '+91 91234 56780',
      name: 'Santosh Jadhav',
      license: 'MH12-2019-0045234',
      lat: 18.5362,
      lng: 73.8940, // Koregaon Park
      vehicle: {
        category: 'AUTO',
        make: 'Bajaj',
        model: 'RE Compact Auto',
        year: 2021,
        licensePlate: 'MH 12 AB 8821',
        color: 'Yellow & Green',
        capacity: 3
      }
    },
    {
      email: 'driver3@urbanpulse.in',
      phone: '+91 91234 56781',
      name: 'Vikram Deshmukh',
      license: 'MH14-2023-0012987',
      lat: 18.5089,
      lng: 73.8055, // Kothrud
      vehicle: {
        category: 'BIKE',
        make: 'Hero',
        model: 'Splendor Plus',
        year: 2023,
        licensePlate: 'MH 14 BK 1902',
        color: 'Black Silver',
        capacity: 1
      }
    },
    {
      email: 'driver4@urbanpulse.in',
      phone: '+91 91234 56782',
      name: 'Amol Shinde',
      license: 'MH12-2020-0099412',
      lat: 18.5912,
      lng: 73.7389, // Hinjewadi Phase 1
      vehicle: {
        category: 'PREMIUM',
        make: 'Honda',
        model: 'City ZX',
        year: 2023,
        licensePlate: 'MH 12 TR 7007',
        color: 'Platinum Pearl',
        capacity: 4
      }
    }
  ];

  for (const d of driversData) {
    const existing = await prisma.user.findUnique({ where: { email: d.email } });
    if (!existing) {
      const user = await prisma.user.create({
        data: {
          email: d.email,
          phone: d.phone,
          name: d.name,
          passwordHash,
          role: 'DRIVER',
          driverProfile: {
            create: {
              licenseNumber: d.license,
              status: 'AVAILABLE',
              rating: 4.89,
              totalTrips: 180,
              totalEarnings: 24500.0,
              latitude: d.lat,
              longitude: d.lng,
              lastLocationUpdate: new Date()
            }
          }
        },
        include: { driverProfile: true }
      });

      await prisma.vehicle.create({
        data: {
          driverId: user.driverProfile.id,
          ...d.vehicle,
          isApproved: true
        }
      });
      console.log(`✓ Driver seeded: ${d.name} (${d.vehicle.category} - ${d.vehicle.licensePlate})`);
    }
  }

  // 5. Seed Admin User
  await prisma.user.upsert({
    where: { email: 'admin@urbanpulse.in' },
    update: {},
    create: {
      email: 'admin@urbanpulse.in',
      phone: '+91 99999 00001',
      name: 'Operations Dispatcher',
      passwordHash,
      role: 'ADMIN'
    }
  });
  console.log(`✓ Admin seeded: admin@urbanpulse.in (Password: ${defaultPassword})`);

  console.log('--- UrbanPulse Dispatch Seed Complete! ---');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
