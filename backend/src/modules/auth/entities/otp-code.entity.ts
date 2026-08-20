import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum OtpPurpose {
  PHONE_LOGIN = 'PHONE_LOGIN',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

// Persisted rather than kept in a process-memory Map — a Render redeploy
// (which happens on every push, and sometimes on free-tier idle-restart)
// used to silently invalidate any code a user had just been sent.
@Entity('otp_codes')
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
