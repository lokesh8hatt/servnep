import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { User, UserRole } from '../modules/users/entities/user.entity';
import { TechnicianProfile, KycStatus } from '../modules/users/entities/technician-profile.entity';
import { Address } from '../modules/users/entities/address.entity';
import { Service } from '../modules/services/entities/service.entity';
import { ServiceCategory } from '../modules/services/entities/service-category.entity';
import { ServiceItem } from '../modules/services/entities/service-item.entity';
import { Booking, BookingStatus, PaymentMethod, PaymentStatus } from '../modules/bookings/entities/booking.entity';
import { Review } from '../modules/reviews/entities/review.entity';
import { Payment } from '../modules/payments/entities/payment.entity';
import { SnakeNamingStrategy } from './snake-naming.strategy';

// Fixed, well-known IDs for demo accounts so they can be safely re-referenced
// (e.g. the admin dashboard's manual-dispatch demo button) and re-seeded idempotently.
export const DEMO_CUSTOMER_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_TECHNICIAN_ID = '00000000-0000-4000-8000-000000000002';
export const DEMO_ADMIN_ID = '00000000-0000-4000-8000-000000000003';

// Supports either a single DATABASE_URL (Neon, Render, Railway, ...) or the
// discrete DATABASE_HOST/PORT/... fields used for local development.
const connectionOptions = process.env.DATABASE_URL
  ? { url: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT as string, 10) || 5432,
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'servenep',
    };

const dataSource = new DataSource({
  type: 'postgres',
  ...connectionOptions,
  entities: [User, TechnicianProfile, Address, Service, ServiceCategory, ServiceItem, Booking, Payment, Review],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: true,
});

const catalog = [
  {
    name: 'Plumbing',
    slug: 'plumbing',
    description: 'Expert leak repairs, pipe fitting, water tank cleaning, and sanitary installations.',
    icon: 'Droplet',
    categories: [
      {
        name: 'Leak Repair & Fixes',
        slug: 'leak-repair',
        description: 'Fix running toilets, dripping taps, and clogged drains.',
        imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400',
        imageAlt: 'A plumber repairing a kitchen faucet with professional tools in a modern home',
        items: [
          { name: 'Tap Repair/Replacement', description: 'Repairing or replacing leaky washbasin/kitchen taps.', basePrice: 350, durationMins: 30 },
          { name: 'Toilet Flush Repair', description: 'Fixing flush tank leakage or mechanism replacement.', basePrice: 450, durationMins: 45 },
          { name: 'Drain Unclogging', description: 'Clearing blockages in kitchen sink or bathroom drain.', basePrice: 600, durationMins: 60 },
        ],
      },
      {
        name: 'Water Tank Cleaning',
        slug: 'water-tank-cleaning',
        description: 'Thorough cleaning and disinfection of overhead and underground water tanks.',
        imageUrl: 'https://images.unsplash.com/photo-1527689368864-3a821dbccc34?auto=format&fit=crop&q=80&w=400',
        imageAlt: 'Water flowing from a freshly cleaned overhead storage tank during maintenance',
        items: [
          { name: 'Underground Tank Cleaning (up to 5000L)', description: 'Manual cleaning, scrubbing, and UV disinfection.', basePrice: 2500, durationMins: 120 },
          { name: 'Overhead Tank Cleaning (up to 1000L)', description: 'Scrubbing and disinfection of black plastic tanks.', basePrice: 1200, durationMins: 90 },
        ],
      },
    ],
  },
  {
    name: 'Electrical',
    slug: 'electrical',
    description: 'Short circuit repairs, switchboard installations, and wiring upgrades.',
    icon: 'Zap',
    categories: [
      {
        name: 'Repairs & Installations',
        slug: 'electrical-repairs',
        description: 'Fix switches, sockets, fan installations, and MCB wiring.',
        imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=400',
        imageAlt: 'An electrician installing a new switchboard with color-coded wiring in a residential property',
        items: [
          { name: 'Switch/Socket Replacement', description: 'Replace broken switch board switches or sockets.', basePrice: 150, durationMins: 15 },
          { name: 'Ceiling Fan Installation', description: 'Assembling and mounting ceiling fan with regulator connection.', basePrice: 400, durationMins: 45 },
          { name: 'Short Circuit Diagnostic', description: 'Troubleshooting electrical trip issues in house distribution board.', basePrice: 800, durationMins: 60 },
        ],
      },
    ],
  },
  {
    name: 'AC & Appliances',
    slug: 'ac-appliance-repair',
    description: 'Servicing and repairs for AC, washing machines, refrigerators, and geysers.',
    icon: 'Tv',
    categories: [
      {
        name: 'AC Servicing',
        slug: 'ac-servicing',
        description: 'Filter cleaning, gas filling, and deep cooling servicing.',
        imageUrl: 'https://images.unsplash.com/photo-1621905252507-b354bc25edac?auto=format&fit=crop&q=80&w=400',
        imageAlt: 'HVAC technician servicing a split air conditioning unit with diagnostic tools',
        items: [
          { name: 'Split AC Servicing', description: 'Cleaning indoor/outdoor coils, filter cleaning, and diagnostics.', basePrice: 1500, durationMins: 60 },
          { name: 'AC Gas Refill', description: 'Gas pressure check and complete refilling.', basePrice: 3500, durationMins: 90 },
        ],
      },
    ],
  },
  {
    name: 'Cleaning & Pest Control',
    slug: 'cleaning-pest-control',
    description: 'Deep home cleaning, sofa cleaning, and eco-friendly pest disinfection.',
    icon: 'Sparkles',
    categories: [
      {
        name: 'Home Deep Cleaning',
        slug: 'home-deep-cleaning',
        description: 'Full house scrubbing, kitchen oil removal, and bathroom sanitization.',
        imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400',
        imageAlt: 'Professional cleaning crew deep cleaning a modern living room with specialized equipment',
        items: [
          { name: '1 BHK Deep Cleaning', description: 'Complete deep cleaning of bedroom, kitchen, hall and bathroom.', basePrice: 4500, durationMins: 240 },
          { name: '2 BHK Deep Cleaning', description: 'Deep scrubbing, glass window cleaning and sanitization.', basePrice: 6500, durationMins: 300 },
          { name: 'Sofa Dry Cleaning (per seat)', description: 'Vacuuming, shampoo scrubbing, and wet drying.', basePrice: 250, durationMins: 30 },
        ],
      },
      {
        name: 'Pest Control',
        slug: 'pest-control',
        description: 'Termite treatment, cockroach gel application, and rodent trapping.',
        imageUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=400',
        imageAlt: 'A pest control specialist applying eco-friendly treatment in a residential kitchen area',
        items: [
          { name: 'Standard Cockroach Treatment', description: 'Eco-friendly herbal gel treatment for kitchen and bathrooms.', basePrice: 1800, durationMins: 90 },
        ],
      },
    ],
  },
  {
    name: 'Painting',
    slug: 'painting',
    description: 'Interior and exterior wall painting, texture finishes, and waterproof coatings by experienced painters.',
    icon: 'PaintRoller',
    categories: [
      {
        name: 'Wall Painting & Finishing',
        slug: 'wall-painting-finishing',
        description: 'Fresh coats, texture finishes, crack repairs, and waterproof coatings for interior and exterior walls.',
        imageUrl: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&q=80&w=400',
        imageAlt: 'A painter applying fresh white paint to an interior wall with a roller',
        items: [
          { name: 'Interior Wall Painting (per room)', description: 'Two-coat emulsion painting for a single room including basic surface preparation.', basePrice: 3500, durationMins: 180 },
          { name: 'Exterior Wall Painting (per 1000 sq.ft)', description: 'Weatherproof exterior emulsion painting with a primer coat.', basePrice: 12000, durationMins: 480 },
          { name: 'Textured Wall Finish (per wall)', description: 'Decorative textured finish application for a single feature wall.', basePrice: 2500, durationMins: 120 },
          { name: 'Waterproof Coating (per 100 sq.ft)', description: 'Application of waterproof membrane coating on roof or wall surfaces.', basePrice: 1800, durationMins: 90 },
          { name: 'Wall Crack Filling & Putty', description: 'Filling minor cracks and applying wall putty before painting.', basePrice: 800, durationMins: 60 },
        ],
      },
    ],
  },
];

async function seed() {
  await dataSource.initialize();
  console.log('Connected to database. Seeding...');

  const userRepo = dataSource.getRepository(User);
  const technicianProfileRepo = dataSource.getRepository(TechnicianProfile);
  const addressRepo = dataSource.getRepository(Address);
  const serviceRepo = dataSource.getRepository(Service);
  const bookingRepo = dataSource.getRepository(Booking);
  const reviewRepo = dataSource.getRepository(Review);

  // --- Service catalog ---
  const existingServiceCount = await serviceRepo.count();
  let plumbingItems: ServiceItem[] = [];
  if (existingServiceCount === 0) {
    for (const s of catalog) {
      const service = await serviceRepo.save(
        serviceRepo.create({ name: s.name, slug: s.slug, description: s.description, icon: s.icon }),
      );
      for (const c of s.categories) {
        const category = await dataSource.getRepository(ServiceCategory).save(
          dataSource.getRepository(ServiceCategory).create({
            serviceId: service.id,
            name: c.name,
            slug: c.slug,
            description: c.description,
            imageUrl: c.imageUrl,
            imageAlt: c.imageAlt,
          }),
        );
        const items = await dataSource.getRepository(ServiceItem).save(
          c.items.map((i) => dataSource.getRepository(ServiceItem).create({ categoryId: category.id, ...i })),
        );
        if (s.name === 'Plumbing' && c.slug === 'leak-repair') plumbingItems = items;
      }
    }
    console.log(`Seeded ${catalog.length} services.`);
  } else {
    console.log('Service catalog already present, skipping.');
    const leakRepairCategory = await dataSource
      .getRepository(ServiceCategory)
      .findOne({ where: { slug: 'leak-repair' }, relations: { items: true } });
    plumbingItems = leakRepairCategory?.items ?? [];
  }

  // --- Demo users (fixed phone numbers so OTP login reaches every dashboard) ---
  const demoCustomer = await userRepo.save(
    userRepo.create({
      id: DEMO_CUSTOMER_ID,
      phoneNumber: '9841234567',
      role: UserRole.CUSTOMER,
      fullName: 'Sabin Shrestha',
    }),
  );

  const demoTechnician = await userRepo.save(
    userRepo.create({
      id: DEMO_TECHNICIAN_ID,
      phoneNumber: '9800000001',
      role: UserRole.TECHNICIAN,
      fullName: 'Ramesh Mali (Plumber)',
    }),
  );

  await userRepo.save(
    userRepo.create({
      id: DEMO_ADMIN_ID,
      phoneNumber: '9800000002',
      role: UserRole.ADMIN,
      fullName: 'Admin User',
    }),
  );

  const existingProfile = await technicianProfileRepo.findOne({ where: { userId: demoTechnician.id } });
  if (!existingProfile) {
    await technicianProfileRepo.save(
      technicianProfileRepo.create({
        userId: demoTechnician.id,
        kycStatus: KycStatus.APPROVED,
        isAvailable: true,
        rating: 4.95,
      }),
    );
  }

  let demoAddress = await addressRepo.findOne({ where: { userId: demoCustomer.id } });
  if (!demoAddress) {
    demoAddress = await addressRepo.save(
      addressRepo.create({
        userId: demoCustomer.id,
        label: 'Home',
        street: 'Lazimpat Rd, Ward 2',
        city: 'Kathmandu',
        lat: 27.7196,
        lng: 85.324,
      }),
    );
  }

  // --- Demo booking + review ---
  const tapRepairItem = plumbingItems.find((i) => i.name === 'Tap Repair/Replacement');
  const existingBooking = await bookingRepo.findOne({ where: { bookingNumber: 'SN-2026-0001' } });
  if (!existingBooking && tapRepairItem) {
    const booking = await bookingRepo.save(
      bookingRepo.create({
        bookingNumber: 'SN-2026-0001',
        customerId: demoCustomer.id,
        technicianId: demoTechnician.id,
        addressId: demoAddress.id,
        serviceItemId: tapRepairItem.id,
        status: BookingStatus.ASSIGNED,
        scheduledDate: '2026-06-23',
        scheduledTimeSlot: '11:00 AM - 01:00 PM',
        baseAmount: tapRepairItem.basePrice,
        serviceFee: 50,
        emergencySurcharge: 0,
        totalAmount: tapRepairItem.basePrice + 50,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.CASH,
      }),
    );

    await reviewRepo.save(
      reviewRepo.create({
        bookingId: booking.id,
        customerId: demoCustomer.id,
        rating: 5,
        comment: 'Excellent plumbing fix. Ramesh arrived within 20 minutes and solved our tap leak perfectly!',
      }),
    );
    console.log('Seeded demo booking + review.');
  } else {
    console.log('Demo booking already present, skipping.');
  }

  console.log('\nDemo login phone numbers (any 6-digit OTP works — check console for the real one):');
  console.log('  Customer:   9841234567');
  console.log('  Technician: 9800000001');
  console.log('  Admin:      9800000002');

  await dataSource.destroy();
  console.log('\nSeeding complete.');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
