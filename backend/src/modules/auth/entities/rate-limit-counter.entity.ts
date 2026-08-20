import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

// Persisted rather than an in-memory Map — a redeploy used to silently
// reset every rate-limit counter, giving an attacker a fresh budget on
// every deploy (which, on Render's free tier, also happens on idle-restart).
@Entity('rate_limit_counters')
export class RateLimitCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // e.g. "otp-request:9841234567", "otp-verify:test@example.com" — one row
  // per (action, identifier) pair.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'int', default: 0 })
  count: number;

  @Column({ type: 'timestamptz' })
  windowStart: Date;
}
