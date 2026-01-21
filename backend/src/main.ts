import 'reflect-metadata';
import { config } from 'dotenv';
config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Rate limiting middleware
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // increased for development
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
  
  // Stricter rate limit for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // increased for development
    message: 'Too many authentication attempts, please try again later.',
  });
  app.use('/auth/login', authLimiter);
  app.use('/auth/register', authLimiter);
  app.use('/auth/oauth/login', authLimiter);
  
  app.use(helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.ivao.aero", "https://login.ivao.aero", "https://sso.ivao.aero"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    disableErrorMessages: process.env.NODE_ENV === 'production',
    transformOptions: {
      enableImplicitConversion: false,
    },
  }));
  
  const allowedOrigins = process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
    : ['http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/:\d+$/, '')))) {
        return callback(null, true);
      }
      
      // Allow RFC 1918 private networks
      try {
        const url = new URL(origin);
        const hostname = url.hostname;
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('10.') ||
          hostname.startsWith('192.168.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
        ) {
          return callback(null, true);
        }
      } catch (e) {}
      
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  // Bind to 0.0.0.0 to accept connections from all network interfaces
  await app.listen(3001, '0.0.0.0');
}

bootstrap();
