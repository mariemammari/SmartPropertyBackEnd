import { AppService } from './app.service';

describe('AppService', () => {
    it('getHello returns Hello World!', () => {
        const service = new AppService();
        expect(service.getHello()).toBe('Hello World!');
    });
});
