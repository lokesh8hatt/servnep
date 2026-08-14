import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';

const DEFAULT_AVATAR_URL =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User profile not found');

    // Email-only accounts have no phone number — fall back to the user ID
    // for a stable referral code suffix instead of crashing on null.
    const referralSuffix = (user.phoneNumber || user.id.replace(/-/g, '')).slice(-4);

    return {
      id: user.id,
      phone: user.phoneNumber,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl || DEFAULT_AVATAR_URL,
      referralCode: `NEP-${referralSuffix}`,
      addresses: await this.getAddresses(userId),
    };
  }

  async updateProfile(userId: string, data: { fullName: string }) {
    // Sanitize input - strip HTML tags to prevent XSS
    const sanitizedName = data.fullName.replace(/<[^>]*>/g, '').trim();
    if (!sanitizedName || sanitizedName.length < 2) {
      throw new BadRequestException('Full name must be at least 2 characters');
    }
    if (sanitizedName.length > 100) {
      throw new BadRequestException('Full name must not exceed 100 characters');
    }

    const result = await this.userRepository.update({ id: userId }, { fullName: sanitizedName });
    if (!result.affected) throw new NotFoundException('User profile not found');
    return this.getProfile(userId);
  }

  async getAddresses(userId: string): Promise<Address[]> {
    return this.addressRepository.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  async findAddressById(userId: string, addressId: string): Promise<Address | null> {
    return this.addressRepository.findOne({ where: { id: addressId, userId } });
  }

  async addAddress(
    userId: string,
    address: { label: string; street: string; city: string; lat: number; lng: number },
  ): Promise<Address> {
    return this.addressRepository.save(this.addressRepository.create({ userId, ...address }));
  }
}
