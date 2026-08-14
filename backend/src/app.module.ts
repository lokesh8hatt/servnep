import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesModule } from './modules/services/services.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import configuration from './config/configuration';
import { SnakeNamingStrategy } from './database/snake-naming.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('database.url');
        const connectionOptions = url
          ? { url }
          : {
              host: config.get<string>('database.host'),
              port: config.get<number>('database.port'),
              username: config.get<string>('database.username'),
              password: config.get<string>('database.password'),
              database: config.get<string>('database.database'),
            };
        return {
          type: 'postgres' as const,
          ...connectionOptions,
          autoLoadEntities: true,
          namingStrategy: new SnakeNamingStrategy(),
          synchronize: config.get<boolean>('database.synchronize'),
          logging: process.env.NODE_ENV !== 'production' ? ['error', 'warn'] : ['error'],
          retryAttempts: 3,
          retryDelay: 3000,
          // Managed Postgres providers terminate TLS with certs not in
          // Node's default trust store — rejectUnauthorized:false accepts
          // that without disabling encryption itself.
          ssl: process.env.NODE_ENV === 'production' || !!url ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    ServicesModule,
    AuthModule,
    UsersModule,
    BookingsModule,
    PaymentsModule,
    ReviewsModule,
  ],
})
export class AppModule {}