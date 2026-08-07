import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import Zavudev from '@zavudev/sdk';

@Injectable()
export class ZavuService implements OnModuleInit {
  private readonly logger = new Logger(ZavuService.name);
  private client: Zavudev;
  private whatsappOtpTemplateId: string;
  private senderId: string;
  private signatureImageBase64: string;

  onModuleInit() {
    const apiKey = process.env.ZAVUDEV_API_KEY;
    if (!apiKey) {
      throw new Error('ZAVUDEV_API_KEY is not configured');
    }

    const senderId = process.env.ZAVU_SENDER_ID;
    if (!senderId) {
      throw new Error(
        'ZAVU_SENDER_ID is not configured (Zavu dashboard → Senders)',
      );
    }

    const templateId =
      process.env.ZAVU_OTP_TEMPLATE_ID ??
      process.env.ZAVU_WHATSAPP_OTP_TEMPLATE_ID;
    if (!templateId) {
      throw new Error(
        'ZAVU_OTP_TEMPLATE_ID is not configured (WhatsApp OTP template)',
      );
    }

    this.senderId = senderId;
    this.whatsappOtpTemplateId = templateId;
    this.signatureImageBase64 = this.loadSignatureImage();
    this.client = new Zavudev({
      apiKey,
      defaultHeaders: { 'Zavu-Sender': senderId },
    });
  }

  /** Send OTP via email (inline subject/body — no template). */
  async sendEmailOtp(params: {
    to: string;
    otp: string;
    subject: string;
  }): Promise<void> {
    const text = [
      `Your ValuPro OTP is ${params.otp}.`,
      'It expires in 5 minutes. Do not share this code.',
      '',
      'VNV Engineers',
      'PROPERTY VALUATION & ENGINEERING CONSULTANCY',
      'P: +91-94585 63975 | E: info@vnvengineers.com',
      'W: vnvengineers.com',
      'Agra · Noida',
    ].join('\n');

    try {
      const result = await this.client.messages.send({
        to: params.to,
        channel: 'email',
        subject: params.subject,
        text,
        htmlBody: this.buildOtpEmailHtml(params.otp),
        attachments: [
          {
            filename: 'vnv-engineers-logo.png',
            content: this.signatureImageBase64,
            content_type: 'image/png',
            content_id: 'vnv-logo',
          },
        ],
        'Zavu-Sender': this.senderId,
      });
      this.logger.log(
        `Email OTP queued to ${params.to} (messageId=${result.message?.id ?? 'n/a'})`,
      );
    } catch (err) {
      this.logger.error('Zavu email OTP send failed', err);
      throw new InternalServerErrorException('Failed to send OTP email');
    }
  }

  /** Send OTP via WhatsApp using the configured AUTHENTICATION template. */
  async sendWhatsAppOtp(params: { to: string; otp: string }): Promise<void> {
    const to = this.toE164(params.to);
    try {
      const result = await this.client.messages.send({
        to,
        channel: 'whatsapp',
        messageType: 'template',
        content: {
          templateId: this.whatsappOtpTemplateId,
          templateVariables: { '1': params.otp },
        },
        'Zavu-Sender': this.senderId,
      });
      this.logger.log(
        `WhatsApp OTP queued to ${to} (messageId=${result.message?.id ?? 'n/a'})`,
      );
    } catch (err) {
      this.logger.error('Zavu WhatsApp OTP send failed', err);
      throw new InternalServerErrorException('Failed to send OTP via WhatsApp');
    }
  }

  /** Normalize Indian 10-digit numbers to E.164; pass through if already +prefixed. */
  toE164(mobile: string): string {
    const trimmed = mobile.trim().replace(/[\s-]/g, '');
    if (trimmed.startsWith('+')) return trimmed;
    if (/^91\d{10}$/.test(trimmed)) return `+${trimmed}`;
    if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
    return trimmed;
  }

  private buildOtpEmailHtml(otp: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VNV Engineers (ValPro) OTP</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e8e8e8;">
          <tr>
            <td style="padding:28px 28px 8px 28px;color:#1a2a4a;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;">
              VNV Engineers (ValPro) verification
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 8px 28px;color:#555;font-size:15px;line-height:1.5;">
              Use this one-time password to continue. It expires in <strong>5 minutes</strong>.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 28px 8px 28px;">
              <div style="display:inline-block;background:#f0f3f8;border:1px solid #d9e0ea;border-radius:8px;padding:14px 28px;font-size:32px;font-weight:bold;letter-spacing:6px;color:#1a2a4a;font-family:Arial,Helvetica,sans-serif;">
                ${otp}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px 28px;color:#888;font-size:13px;line-height:1.5;">
              If you did not request this code, you can ignore this email. Do not share this OTP with anyone.
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px;">
              <hr style="border:none;border-top:1px solid #e6e6e6;margin:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                <tr>
                  <td style="padding-bottom:12px;">
                    <img
                      src="cid:vnv-logo"
                      alt="VNV Engineers"
                      width="220"
                      style="display:block;width:220px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;"
                    />
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:bold;color:#1a2a4a;padding-bottom:2px;">
                    VNV Engineers
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.4px;color:#7a8799;padding-bottom:10px;">
                    PROPERTY VALUATION &amp; ENGINEERING CONSULTANCY
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #c9a24a;padding-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a2a4a;line-height:1.6;">
                    <span style="color:#c9a24a;">P:</span> +91-94585 63975
                    &nbsp;|&nbsp;
                    <span style="color:#c9a24a;">E:</span>
                    <a href="mailto:info@vnvengineers.com" style="color:#1a2a4a;text-decoration:none;">info@vnvengineers.com</a>
                    <br />
                    <span style="color:#c9a24a;">W:</span>
                    <a href="https://vnvengineers.com" style="color:#1a2a4a;text-decoration:none;">vnvengineers.com</a>
                    <br />
                    <span style="color:#7a8799;font-size:12px;">Agra · Noida</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private loadSignatureImage(): string {
    const candidates = [
      join(__dirname, '../assets/vnv-engineers-logo.png'),
      join(process.cwd(), 'src/common/assets/vnv-engineers-logo.png'),
      join(process.cwd(), 'dist/common/assets/vnv-engineers-logo.png'),
    ];

    for (const path of candidates) {
      try {
        return readFileSync(path).toString('base64');
      } catch {
        // try next candidate
      }
    }

    throw new Error('VNV Engineers logo not found in common/assets');
  }
}
