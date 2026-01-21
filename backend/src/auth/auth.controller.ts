import { Controller, Post, Body, Get, Req, Query, Res } from '@nestjs/common';
import { signPayload, verifyToken } from './token.util';
import { UsersService } from '../users/users.service';
import { IvaoService } from '../ivao/ivao.service';
import axios from 'axios';

@Controller('auth')
export class AuthController {
  constructor(
    private usersService: UsersService,
    private ivaoService: IvaoService
  ) {}

  @Post('register')
  async register(@Body() body: any) {
    const { vid, rating, ratingLevel, name } = body;

    if (!vid) return { error: 'VID required' };
    if (rating === null || rating === undefined) return { error: 'Rating required' };
    if (rating < 0 || rating > 11) return { error: 'Rating must be between 0 and 11' };

    try {
      const user = await this.usersService.createUser({
        vid,
        rating: parseInt(rating),
        ratingLevel: ratingLevel || undefined,
        name: name || vid,
      });

      const token = signPayload({ 
        vid: user.vid, 
        rating: user.rating, 
        ratingLevel: user.ratingLevel,
      });

      return {
        token,
        user: {
          vid: user.vid,
          name: user.name,
          rating: user.rating,
          ratingLevel: user.ratingLevel,
        }
      };
    } catch (e) {
      return { error: 'Registration failed: ' + String(e) };
    }
  }

  @Post('login')
  async login(@Body() body: any) {
    const { vid } = body;
    if (!vid) return { error: 'VID required' };

    try {
      let user = await this.usersService.findByVid(vid);

      if (!user) {
        try {
          const ivaoUser = await this.ivaoService.getUser(vid);
          if (ivaoUser) {
            const userName = (ivaoUser.firstName && ivaoUser.lastName ? `${ivaoUser.firstName} ${ivaoUser.lastName}` : null)
              || ivaoUser.firstName 
              || ivaoUser.lastName
              || ivaoUser.publicNickname
              || `User ${vid}`;
              
            user = await this.usersService.createUser({
              vid: String(ivaoUser.id || vid),
              rating: ivaoUser.rating?.atcRating?.id ?? 2,
              ratingLevel: ivaoUser.rating?.atcRating?.shortName || 'AS1',
              name: userName,
              divisionId: ivaoUser.divisionId || undefined,
              countryId: ivaoUser.countryId || undefined,
            });
          }
        } catch (ivaoError: any) {
          // IVAO API down or rate limited - create basic user account
          if (ivaoError.response?.status === 503 || ivaoError.response?.status === 429) {
            user = await this.usersService.createUser({
              vid: String(vid),
              rating: 0,
              ratingLevel: 'NO_RATING',
              name: `User ${vid}`,
            });
          } else {
            return { error: 'User not found in IVAO database' };
          }
        }
      }

      if (!user) {
        return { error: 'User not found. Please register first.' };
      }

      const token = signPayload({
        vid: user.vid,
        rating: user.rating,
        ratingLevel: user.ratingLevel,
      });

      return {
        token,
        user: {
          vid: user.vid,
          name: user.name,
          rating: user.rating,
          ratingLevel: user.ratingLevel,
          divisionId: user.divisionId,
          countryId: user.countryId,
        }
      };
    } catch (e) {
      return { error: 'Login failed' };
    }
  }

  @Get('me')
  async me(@Req() req: any) {
    const auth = (req.headers.authorization || '').toString();
    
    if (!auth.startsWith('Bearer ')) {
      return { user: null };
    }
    
    const token = auth.substring(7);
    if (!token || token.length > 500) {
      return { user: null };
    }
    
    try {
      const obj = verifyToken(token);
      
      if (!obj?.vid) {
        return { user: null };
      }
      
      const user = await this.usersService.findByVid(obj.vid);
      
      if (!user) {
        return { user: null };
      }
      
      return {
        user: {
          vid: user.vid,
          name: user.name,
          rating: user.rating,
          ratingLevel: user.ratingLevel,
          divisionId: user.divisionId,
          countryId: user.countryId,
        }
      };
    } catch(e: any) {
      return { user: null };
    }
  }

  // OAuth 2.0 login
  @Get('oauth/login')
  async oauthLogin(@Res() res: any) {
    const clientId = process.env.IVAO_CLIENT_ID || '';
    const redirectUri = process.env.IVAO_OAUTH_CALLBACK || '';
    
    try {
      // Get OpenID configuration to use correct endpoints
      const openidResp = await axios.get('https://api.ivao.aero/.well-known/openid-configuration');
      const authEndpoint = openidResp.data.authorization_endpoint;
      
      // build oauth url with ivao's authorization endpoint
      const authUrl = `${authEndpoint}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile configuration`;
      res.redirect(authUrl);
    } catch (err: any) {
      res.redirect(`${process.env.FRONTEND_URL_MAIN}?error=config_failed`);
    }
  }

  @Get('oauth/callback')
  async oauthCallback(@Query('code') code: string, @Query('error') error: string, @Query('error_description') errorDesc: string, @Res() res: any) {
    const frontendUrl = process.env.FRONTEND_URL_MAIN || 'http://localhost:3000';
    
    if (error) return res.redirect(`${frontendUrl}?error=${error}`);
    if (!code) return res.redirect(`${frontendUrl}?error=no_code`);

    try {
      // exchange code for token
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('client_id', process.env.IVAO_CLIENT_ID || '');
      params.append('client_secret', process.env.IVAO_CLIENT_SECRET || '');
      params.append('redirect_uri', process.env.IVAO_OAUTH_CALLBACK || '');

      const tokenResp = await axios.post('https://api.ivao.aero/v2/oauth/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const accessToken = tokenResp.data.access_token;

      const userResp = await axios.get('https://api.ivao.aero/v2/users/me', {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'apiKey': process.env.IVAO_API_KEY 
        },
      });

      const ivaoUser = userResp.data;
      const vid = String(ivaoUser.id);

      let user = await this.usersService.findByVid(vid);
      if (!user) {
        const userName = (ivaoUser.firstName && ivaoUser.lastName ? `${ivaoUser.firstName} ${ivaoUser.lastName}` : null)
          || ivaoUser.firstName 
          || ivaoUser.lastName
          || ivaoUser.publicNickname
          || `User ${vid}`;
          
        user = await this.usersService.createUser({
          vid: vid,
          rating: ivaoUser.rating?.atcRating?.id ?? 2,
          ratingLevel: ivaoUser.rating?.atcRating?.shortName || 'AS1',
          name: userName,
          divisionId: ivaoUser.divisionId || undefined,
          countryId: ivaoUser.countryId || undefined,
        });
      } else {
        const userName = (ivaoUser.firstName && ivaoUser.lastName ? `${ivaoUser.firstName} ${ivaoUser.lastName}` : null)
          || ivaoUser.firstName 
          || ivaoUser.lastName
          || ivaoUser.publicNickname
          || user.name;
          
        user.name = userName;
        user.rating = ivaoUser.rating?.atcRating?.id ?? user.rating ?? 2;
        user.ratingLevel = ivaoUser.rating?.atcRating?.shortName || user.ratingLevel || 'AS1';
        user.divisionId = ivaoUser.divisionId || user.divisionId;
        user.countryId = ivaoUser.countryId || user.countryId;
        await this.usersService.updateUser(user);
      }

      // make our token
      const token = signPayload({
        vid: user.vid,
        rating: user.rating,
        ratingLevel: user.ratingLevel,
      });

      res.redirect(`${frontendUrl}?token=${token}`);
    } catch (err: any) {
      res.redirect(`${frontendUrl}?error=oauth_failed`);
    }
  }
}
