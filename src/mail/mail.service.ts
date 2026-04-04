import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) { }

  async sendPropertyInquiryEmail(
    to: string,
    agentName: string,
    propertyTitle: string,
    inquiryData: {
      fullName: string;
      phone: string;
      email: string;
      message: string;
    },
  ): Promise<void> {
    console.log('📧 [MailService] Starting to send email...');
    console.log('📧 [MailService] To:', to);
    console.log('📧 [MailService] Agent:', agentName);
    console.log('📧 [MailService] Property:', propertyTitle);

    try {
      const result = await this.mailerService.sendMail({
        to,
        subject: `New Property Inquiry: ${propertyTitle}`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 10px;">
          <div style="background: #064A7E; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🏠 SmartProperty</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #064A7E; margin-top: 0;">Hello ${agentName},</h2>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              You have received a new inquiry for your property <strong>${propertyTitle}</strong>.
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #064A7E; margin-top: 0;">📋 Client Information:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Name:</td>
                  <td style="padding: 8px 0; color: #333;">${inquiryData.fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Phone:</td>
                  <td style="padding: 8px 0; color: #333;">${inquiryData.phone}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Email:</td>
                  <td style="padding: 8px 0; color: #333;">${inquiryData.email}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">💬 Message:</h3>
              <p style="color: #856404; font-style: italic; margin: 0;">"${inquiryData.message}"</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="mailto:${inquiryData.email}" style="background: #064A7E; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; margin-right: 10px;">
                Reply via Email
              </a>
              <a href="tel:${inquiryData.phone}" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">
                Call Client
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              This email was sent from SmartProperty platform.<br>
              © ${new Date().getFullYear()} SmartProperty. All rights reserved.
            </p>
          </div>
        </div>
      `,
      });

      console.log('✅ [MailService] Email sent successfully!');
      console.log('✅ [MailService] Result:', result);
    } catch (error) {
      console.error('❌ [MailService] Failed to send email:', error);
      console.error('❌ [MailService] Error details:', {
        message: error.message,
        code: error.code,
        responseCode: error.responseCode,
        command: error.command,
      });
      throw error;
    }
  }

  async sendTestEmail(to: string): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Test Email from SmartProperty',
      html: '<h1>Test Email</h1><p>This is a test email from SmartProperty.</p>',
    });
  }

  async sendRentalPaymentEmail(to: string, subject: string, body: string): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject,
      html: `<p>${body}</p>`,
    });
  }
}
