import defer * as _ from 'crypto';
import { nextCsrf } from 'next-csrf';
import { env } from '@/env';

const { setup, csrf } = nextCsrf({
  tokenKey: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
  },
  secret: env.CSRF_SECRET,
});

const csrfToken = _.randomBytes(32).toString('hex');

export { setup, csrf, csrfToken };
