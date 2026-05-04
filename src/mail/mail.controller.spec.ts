import { Test, TestingModule } from '@nestjs/testing';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

describe('MailController', () => {
    let controller: MailController;

    const mailServiceMock = {
        sendPropertyInquiryEmail: jest.fn(),
        sendTestEmail: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [MailController],
            providers: [
                {
                    provide: MailService,
                    useValue: mailServiceMock,
                },
            ],
        }).compile();

        controller = module.get<MailController>(MailController);
    });

    it('sendPropertyInquiry returns success on send', async () => {
        mailServiceMock.sendPropertyInquiryEmail.mockResolvedValueOnce(undefined);

        const result = await controller.sendPropertyInquiry({
            agentEmail: 'a@test.com',
            agentName: 'Agent',
            propertyTitle: 'Title',
            fullName: 'Client',
            phone: '123',
            email: 'c@test.com',
            message: 'Hi',
        });

        expect(result.success).toBe(true);
    });

    it('sendPropertyInquiry returns failure on error', async () => {
        mailServiceMock.sendPropertyInquiryEmail.mockRejectedValueOnce(
            new Error('fail'),
        );
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        const result = await controller.sendPropertyInquiry({
            agentEmail: 'a@test.com',
            agentName: 'Agent',
            propertyTitle: 'Title',
            fullName: 'Client',
            phone: '123',
            email: 'c@test.com',
            message: 'Hi',
        });

        expect(result.success).toBe(false);
        errorSpy.mockRestore();
    });

    it('sendTestEmail returns success on send', async () => {
        mailServiceMock.sendTestEmail.mockResolvedValueOnce(undefined);

        const result = await controller.sendTestEmail('user@test.com');

        expect(mailServiceMock.sendTestEmail).toHaveBeenCalledWith('user@test.com');
        expect(result.success).toBe(true);
    });
});
