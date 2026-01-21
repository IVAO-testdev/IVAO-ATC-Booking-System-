import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class IvaoService {
  private readonly apiKey = process.env.IVAO_API_KEY;
  private readonly apiBase = this.sanitizeApiBase(process.env.IVAO_API_BASE || 'https://api.ivao.aero/v2');

  private sanitizeApiBase(url: string): string {
    // only allow ivao api domain
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'api.ivao.aero') {
        return 'https://api.ivao.aero/v2';
      }
      return url;
    } catch {
      return 'https://api.ivao.aero/v2';
    }
  }

  private get headers() {
    return {
      'apiKey': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async getUser(vid: string) {
    if (!vid || !/^\d{1,10}$/.test(vid)) {
      throw new HttpException('Invalid VID format', 400);
    }
    
    const timeout = 5000;
    try {
      const response = await axios.get(`${this.apiBase}/users/${vid}`, {
        headers: this.headers,
        timeout,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new HttpException('Failed to fetch user from IVAO', 500);
    }
  }

  async getAllATCPositions() {
    try {
      const response = await axios.get(`${this.apiBase}/ATCPositions/all`, {
        headers: this.headers,
        timeout: 5000,
      });
      return response.data;
    } catch (error: any) {
      // just return empty if fails
      return [];
    }
  }

  async getAirportPositions(icao: string) {
    if (!icao || !/^[A-Z]{4}$/.test(icao)) {
      return [];
    }
    
    try {
      const response = await axios.get(`${this.apiBase}/airports/${icao}/ATCPositions`, {
        headers: this.headers,
        timeout: 5000,
      });
      return response.data;
    } catch (error: any) {
      return [];
    }
  }

  async getDivisions() {
    try {
      const response = await axios.get(`${this.apiBase}/divisions/all`, {
        headers: this.headers,
        timeout: 5000,
      });
      return response.data;
    } catch (error: any) {
      return [];
    }
  }
}
