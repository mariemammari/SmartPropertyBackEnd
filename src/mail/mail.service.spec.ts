import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;

  const mailerServiceMock = {
    sendMail: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MailService(mailerServiceMock as unknown as MailerService);
  });

  it('sendTestEmail sends an email', async () => {
    await service.sendTestEmail('user@test.com');

    expect(mailerServiceMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: 'Test Email from SmartProperty',
      }),
    );
  });

  it('sendPropertyInquiryEmail sends an email', async () => {
    await service.sendPropertyInquiryEmail(
      'agent@test.com',
      'Agent',
      'Title',
      {
        fullName: 'Client',
        phone: '123',
        email: 'client@test.com',
        message: 'Hello',
      },
    );

    expect(mailerServiceMock.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'agent@test.com',
        subject: expect.stringContaining('Title'),
      }),
    );
  });

  it('sendMail forwards options to mailerService', async () => {
    await service.sendMail({
      to: 'user@test.com',
      subject: 'Subject',
      html: '<p>Hi</p>',
    });

    expect(mailerServiceMock.sendMail).toHaveBeenCalledWith({
      to: 'user@test.com',
      subject: 'Subject',
      html: '<p>Hi</p>',
    });
  });
});
