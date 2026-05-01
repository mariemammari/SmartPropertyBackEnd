import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * OptionalJwtAuthGuard
 *
 * Behaves like JwtAuthGuard but never rejects.
 * If a valid JWT is present → req.user is populated.
 * If not → req.user stays undefined and the request proceeds.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Call the parent which will run the passport-jwt strategy
    return super.canActivate(context);
  }

  /**
   * Override handleRequest so that a missing/invalid token does NOT throw.
   * If passport fails (err or !user) we simply return null instead of throwing.
   */
  handleRequest(err: any, user: any) {
    // No error throwing — just return user or null
    return user || null;
  }
}
