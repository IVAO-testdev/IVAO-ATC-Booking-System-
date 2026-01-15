import { Controller, Post, Body, Get, Req } from '@nestjs/common';
import { signPayload, verifyToken } from './token.util';
import { UsersService } from '../users/users.service';
import { IvaoService } from '../ivao/ivao.service';

@Controller('auth')
export class AuthController {
  constructor(
    private usersService: UsersService,
    private ivaoService: IvaoService
  ) {}

  @Post('register')
  async register(@Body() body: any) {
    const { vid, rating, ratingLevel, name, email } = body;

    if (!vid) return { error: 'VID required' };
    if (rating === null || rating === undefined) return { error: 'Rating required' };
    if (rating < 0 || rating > 11) return { error: 'Rating must be between 0 and 11' };

    try {
      const user = await this.usersService.createUser({
        vid,
        rating: parseInt(rating),
        ratingLevel: ratingLevel || undefined,
        name: name || vid,
        email: email || undefined,
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
            user = await this.usersService.createUser({
              vid: String(ivaoUser.id || vid),
              rating: ivaoUser.rating?.atcRating?.id || 0,
              ratingLevel: ivaoUser.rating?.atcRating?.shortName || 'AS1',
              name: ivaoUser.publicNickname || `User ${vid}`,
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
  me(@Req() req: any) {
    const auth = (req.headers.authorization || '').toString();
    const m = auth.match(/^Bearer\s+(.+)$/);
    if (!m) return { user: null };
    const t = m[1];
    const obj = verifyToken(t);
    return { user: obj || null };
  }
}
