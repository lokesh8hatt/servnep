import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

export interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  lat: number;
  lng: number;
}

@Injectable()
export class UsersService {
  constructor(private readonly authService: AuthService) {
    this.addresses.set('cust-uuid-1', [
      {
        id: 'addr-1',
        label: 'Home',
        street: 'Lazimpat Rd, Ward 2',
        city: 'Kathmandu',
        lat: 27.7196,
        lng: 85.3240,
      },
    ]);
  }

  private addresses = new Map<string, Address[]>();

  async getProfile(userId: string) {
    const registry = this.authService.getUserRegistry();
    const user = registry.find(u => u.id === userId);
    if (!user) throw new NotFoundException('User profile not found');
    
    return {
      ...user,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      referralCode: `NEP-${user.phone.slice(-4)}`,
      addresses: this.getAddresses(userId),
    };
  }

  async updateProfile(userId: string, data: { fullName: string }) {
    const updated = this.authService.updateProfile(userId, data);
    if (!updated) throw new NotFoundException('User profile not found');
    return this.getProfile(userId);
  }

  getAddresses(userId: string): Address[] {
    if (!this.addresses.has(userId)) {
      this.addresses.set(userId, []);
    }
    return this.addresses.get(userId) || [];
  }

  addAddress(userId: string, address: Omit<Address, 'id'>): Address {
    const list = this.getAddresses(userId);
    const newAddr: Address = {
      id: `addr-${Math.random().toString(36).substring(2, 11)}`,
      ...address,
    };
    list.push(newAddr);
    this.addresses.set(userId, list);
    return newAddr;
  }
}
