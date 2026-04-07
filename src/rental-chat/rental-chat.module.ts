import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { RentalChatService } from './rental-chat.service';
import { RentalChatController } from './rental-chat.controller';
import { RentalChatGateway } from './rental-chat.gateway';
import { Rental, RentalSchema } from '../rental/schemas/rental.schema';
import { RentalConversation, RentalConversationSchema } from './schemas/rental-conversation.schema';
import { RentalMessage, RentalMessageSchema } from './schemas/rental-message.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Rental.name, schema: RentalSchema },
            { name: RentalConversation.name, schema: RentalConversationSchema },
            { name: RentalMessage.name, schema: RentalMessageSchema },
        ]),
        JwtModule,
    ],
    controllers: [RentalChatController],
    providers: [RentalChatService, RentalChatGateway],
    exports: [RentalChatService, RentalChatGateway],
})
export class RentalChatModule { }
