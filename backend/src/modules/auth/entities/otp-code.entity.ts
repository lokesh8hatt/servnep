import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum OtpPurpose {
  PHONE_LOGIN = 'PHONE_LOGIN',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

// Persisted rather than kept in a process-memory Map — a Render redeploy
// (which happens on every push, and sometimes on free-tier idle-restart)
// used to silently invalidate any code a user had just been sent.
//
// The unique index on (identifier, purpose) is what lets storeOtp() use a
// real atomic upsert instead of delete-then-insert — the delete-then-insert
// version had a race where two concurrent requests for the same identifier
// could both insert, leaving an orphaned row a later verify might match
// against a code the user was never actually shown.
@Entity('otp_codes')
@Index(['identifier', 'purpose'], { unique: true })
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Phone number for PHONE_LOGIN, email address for PASSWORD_RESET.
  @Column({ type: 'varchar', length: 255 })
  identifier: string;

  @Column({ type: 'enum', enum: OtpPurpose })
  purpose: OtpPurpose;

  @Column({ type: 'varchar', length: 6 })
  code: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
