import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { verifyJwt } from '../postgres/client.server';

export const requireAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest();
    const authHeader = request?.headers?.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Response('Unauthorized: Missing or invalid authorization header', { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    let claims;

    try {
      claims = verifyJwt(token);
    } catch {
      throw new Response('Unauthorized: Invalid token', { status: 401 });
    }

    if (!claims.sub) {
      throw new Response('Unauthorized: No user ID found in token', { status: 401 });
    }

    return next({
      context: {
        userId: claims.sub,
        claims,
      },
    });
  }
);
