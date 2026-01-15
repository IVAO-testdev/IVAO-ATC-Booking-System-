import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class IvaoService {
  private readonly apiKey = process.env.IVAO_API_KEY;
  private readonly apiBase = process.env.IVAO_API_BASE || 'https://api.ivao.aero/v2';

  private get headers() {
    return {
      'apiKey': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async getUser(vid: string) {
    try {
      const response = await axios.get(`${this.apiBase}/users/${vid}`, {
        headers: this.headers,
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
      });
      return response.data;
    } catch (error: any) {
      return [];
    }
  }

  async getAirportPositions(icao: string) {
    try {
      const response = await axios.get(`${this.apiBase}/airports/${icao}/ATCPositions`, {
        headers: this.headers,
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
      });
      return response.data;
    } catch (error: any) {
      return [];
    }
  }
}
