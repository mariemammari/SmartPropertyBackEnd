import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { MailService } from './mail.service';

interface PropertyInquiryDto {
  agentEmail: string;
  agentName: string;
  propertyTitle: string;
  fullName: string;
  phone: string;
  email: string;
  message: string;
}

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('property-inquiry')
  @HttpCode(HttpStatus.OK)
  async sendPropertyInquiry(@Body() inquiryData: PropertyInquiryDto) {
    try {
      await this.mailService.sendPropertyInquiryEmail(
        inquiryData.agentEmail,
        inquiryData.agentName,
        inquiryData.propertyTitle,
        {
          fullName: inquiryData.fullName,
          phone: inquiryData.phone,
          email: inquiryData.email,
          message: inquiryData.message,
        },
      );

      return {
        success: true,
        message: 'Email sent successfully to the agent',
      };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        command: error.command,
      });
      return {
        success: false,
        message: 'Failed to send email',
        error: error.message,
        details: error.code || 'UNKNOWN_ERROR',
      };
    }
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async sendTestEmail(@Body('email') email: string) {
    try {
      await this.mailService.sendTestEmail(email);
      return {
        success: true,
        message: 'Test email sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send test email',
        error: error.message,
      };
    }
  }
}
