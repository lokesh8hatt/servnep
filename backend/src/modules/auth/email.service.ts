import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return !!this.configService.get<string>('email.fromEmail') && !!this.configService.get<string>('email.brevoApiKey');
  }

  private async send(to: string, subject: string, text: string, html: string): Promise<void> {
    const fromEmail = this.configService.get<string>('email.fromEmail');
    const apiKey = this.configService.get<string>('email.brevoApiKey');
    if (!fromEmail || !apiKey) {
      throw new BadRequestException(
        'Email sending is not configured — set EMAIL_FROM and BREVO_API_KEY (see README for how to get a free Brevo API key)',
      );
    }

    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: 'ServeNep' },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Brevo send to ${to} failed (${res.status}): ${body}`);
      throw new BadRequestException('Could not send the verification email. Please try again shortly.');
    }
  }

  async sendOtpEmail(to: string, otpCode: string): Promise<void> {
    await this.send(
      to,
      `${otpCode} is your ServeNep verification code`,
      `Your ServeNep verification code is ${otpCode}. It expires in 10 minutes. If you didn't request this, you can safely ignore this email.`,
      `
        <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px;">
          <div style="background: #0B3C5D; color: #fff; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; margin-bottom: 20px;">SN</div>
          <h2 style="color: #0B3C5D; margin: 0 0 8px;">Your verification code</h2>
          <p style="color: #64748b; font-size: 14px; margin: 0 0 24px;">Use this code to continue in ServeNep. It expires in 10 minutes.</p>
          <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 0.3em; color: #0B3C5D;">${otpCode}</div>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    );
  }

  // Best-effort — a failed send here must never break the booking flow, so
  // errors are logged and swallowed rather than thrown (unlike sendOtpEmail,
  // where the caller needs to know delivery failed).
  async sendBookingAssignedEmail(
    to: string,
    data: { customerName: string; technicianName: string; bookingNumber: string; scheduledDate: string; scheduledTimeSlot: string },
  ): Promise<void> {
    try {
      await this.send(
        to,
        `${data.technicianName} is assigned to your ServeNep booking ${data.bookingNumber}`,
        `Hi ${data.customerName}, ${data.technicianName} has been assigned to your booking ${data.bookingNumber}, scheduled for ${data.scheduledDate} (${data.scheduledTimeSlot}). You can track their live location from your ServeNep dashboard once they're on the way.`,
        `
          <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px;">
            <div style="background: #0B3C5D; color: #fff; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; margin-bottom: 20px;">SN</div>
            <h2 style="color: #0B3C5D; margin: 0 0 8px;">A technician has been assigned</h2>
            <p style="color: #64748b; font-size: 14px; margin: 0 0 20px;">Hi ${data.customerName}, <strong>${data.technicianName}</strong> is on your booking <strong>${data.bookingNumber}</strong>, scheduled for ${data.scheduledDate} (${data.scheduledTimeSlot}).</p>
            <p style="color: #64748b; font-size: 14px; margin: 0;">Open your ServeNep dashboard to track their live location once they're on the way.</p>
          </div>
        `,
      );
    } catch (err: any) {
      this.logger.error(`Failed to send booking-assigned email to ${to}: ${err.message}`);
    }
  }
}
