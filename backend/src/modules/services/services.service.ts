import { Injectable } from '@nestjs/common';

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  durationMins: number;
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  items: ServiceItem[];
}

export interface Service {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  categories: ServiceCategory[];
}

@Injectable()
export class ServicesService {
  private services: Service[] = [
    {
      id: 's1',
      name: 'Plumbing',
      slug: 'plumbing',
      description: 'Expert leak repairs, pipe fitting, water tank cleaning, and sanitary installations.',
      icon: 'Droplet',
      categories: [
        {
          id: 'c1',
          name: 'Leak Repair & Fixes',
          slug: 'leak-repair',
          description: 'Fix running toilets, dripping taps, and clogged drains.',
          imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400',
          imageAlt: 'A plumber repairing a kitchen faucet with professional tools in a modern home',
          items: [
            { id: 'i1', name: 'Tap Repair/Replacement', description: 'Repairing or replacing leaky washbasin/kitchen taps.', basePrice: 350, durationMins: 30 },
            { id: 'i2', name: 'Toilet Flush Repair', description: 'Fixing flush tank leakage or mechanism replacement.', basePrice: 450, durationMins: 45 },
            { id: 'i3', name: 'Drain Unclogging', description: 'Clearing blockages in kitchen sink or bathroom drain.', basePrice: 600, durationMins: 60 },
          ],
        },
        {
          id: 'c2',
          name: 'Water Tank Cleaning',
          slug: 'water-tank-cleaning',
          description: 'Thorough cleaning and disinfection of overhead and underground water tanks.',
          imageUrl: 'https://images.unsplash.com/photo-1527689368864-3a821dbccc34?auto=format&fit=crop&q=80&w=400',
          imageAlt: 'Water flowing from a freshly cleaned overhead storage tank during maintenance',
          items: [
            { id: 'i4', name: 'Underground Tank Cleaning (up to 5000L)', description: 'Manual cleaning, scrubbing, and UV disinfection.', basePrice: 2500, durationMins: 120 },
            { id: 'i5', name: 'Overhead Tank Cleaning (up to 1000L)', description: 'Scrubbing and disinfection of black plastic tanks.', basePrice: 1200, durationMins: 90 },
          ],
        },
      ],
    },
    {
      id: 's2',
      name: 'Electrical',
      slug: 'electrical',
      description: 'Short circuit repairs, switchboard installations, and wiring upgrades.',
      icon: 'Zap',
      categories: [
        {
          id: 'c3',
          name: 'Repairs & Installations',
          slug: 'electrical-repairs',
          description: 'Fix switches, sockets, fan installations, and MCB wiring.',
          imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=400',
          imageAlt: 'An electrician installing a new switchboard with color-coded wiring in a residential property',
          items: [
            { id: 'i6', name: 'Switch/Socket Replacement', description: 'Replace broken switch board switches or sockets.', basePrice: 150, durationMins: 15 },
            { id: 'i7', name: 'Ceiling Fan Installation', description: 'Assembling and mounting ceiling fan with regulator connection.', basePrice: 400, durationMins: 45 },
            { id: 'i8', name: 'Short Circuit Diagnostic', description: 'Troubleshooting electrical trip issues in house distribution board.', basePrice: 800, durationMins: 60 },
          ],
        },
      ],
    },
    {
      id: 's3',
      name: 'AC & Appliances',
      slug: 'ac-appliance-repair',
      description: 'Servicing and repairs for AC, washing machines, refrigerators, and geysers.',
      icon: 'Tv',
      categories: [
        {
          id: 'c4',
          name: 'AC Servicing',
          slug: 'ac-servicing',
          description: 'Filter cleaning, gas filling, and deep cooling servicing.',
          imageUrl: 'https://images.unsplash.com/photo-1621905252507-b354bc25edac?auto=format&fit=crop&q=80&w=400',
          imageAlt: 'HVAC technician servicing a split air conditioning unit with diagnostic tools',
          items: [
            { id: 'i9', name: 'Split AC Servicing', description: 'Cleaning indoor/outdoor coils, filter cleaning, and diagnostics.', basePrice: 1500, durationMins: 60 },
            { id: 'i10', name: 'AC Gas Refill', description: 'Gas pressure check and complete refilling.', basePrice: 3500, durationMins: 90 },
          ],
        },
      ],
    },
    {
      id: 's4',
      name: 'Cleaning & Pest Control',
      slug: 'cleaning-pest-control',
      description: 'Deep home cleaning, sofa cleaning, and eco-friendly pest disinfection.',
      icon: 'Sparkles',
      categories: [
        {
          id: 'c5',
          name: 'Home Deep Cleaning',
          slug: 'home-deep-cleaning',
          description: 'Full house scrubbing, kitchen oil removal, and bathroom sanitization.',
          imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400',
          imageAlt: 'Professional cleaning crew deep cleaning a modern living room with specialized equipment',
          items: [
            { id: 'i11', name: '1 BHK Deep Cleaning', description: 'Complete deep cleaning of bedroom, kitchen, hall and bathroom.', basePrice: 4500, durationMins: 240 },
            { id: 'i12', name: '2 BHK Deep Cleaning', description: 'Deep scrubbing, glass window cleaning and sanitization.', basePrice: 6500, durationMins: 300 },
            { id: 'i13', name: 'Sofa Dry Cleaning (per seat)', description: 'Vacuuming, shampoo scrubbing, and wet drying.', basePrice: 250, durationMins: 30 },
          ],
        },
        {
          id: 'c6',
          name: 'Pest Control',
          slug: 'pest-control',
          description: 'Termite treatment, cockroach gel application, and rodent trapping.',
          imageUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=400',
          imageAlt: 'A pest control specialist applying eco-friendly treatment in a residential kitchen area',
          items: [
            { id: 'i14', name: 'Standard Cockroach Treatment', description: 'Eco-friendly herbal gel treatment for kitchen and bathrooms.', basePrice: 1800, durationMins: 90 },
          ],
        },
      ],
    },
  ];

  findAll() {
    return this.services;
  }

  findBySlug(slug: string) {
    return this.services.find(s => s.slug === slug);
  }

  findCategoryBySlug(serviceSlug: string, categorySlug: string) {
    const service = this.findBySlug(serviceSlug);
    if (!service) return null;
    return service.categories.find(c => c.slug === categorySlug);
  }

  findItemById(itemId: string): ServiceItem | null {
    for (const service of this.services) {
      for (const category of service.categories) {
        const item = category.items.find(i => i.id === itemId);
        if (item) return item;
      }
    }
    return null;
  }
}
