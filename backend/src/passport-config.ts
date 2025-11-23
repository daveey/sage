import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { query } from './db';
import { User, JWTPayload } from './types';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

// Convert database User to Express.User (JWTPayload)
function toExpressUser(user: User): Express.User {
  return {
    userId: user.id,
    email: user.email
  };
}

export function configurePassport() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const googleId = profile.id;
          const displayName = profile.displayName;
          const profilePicture = profile.photos?.[0]?.value;

          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          // Check if user exists
          const existingUser = await query<User>(
            'SELECT * FROM users WHERE google_id = $1',
            [googleId]
          );

          if (existingUser.rows.length > 0) {
            // User exists, update their info
            const updatedUser = await query<User>(
              `UPDATE users
               SET email = $1, display_name = $2, profile_picture = $3, updated_at = NOW()
               WHERE google_id = $4
               RETURNING *`,
              [email, displayName, profilePicture, googleId]
            );
            return done(null, toExpressUser(updatedUser.rows[0]));
          } else {
            // Create new user
            const newUser = await query<User>(
              `INSERT INTO users (email, google_id, display_name, profile_picture)
               VALUES ($1, $2, $3, $4)
               RETURNING *`,
              [email, googleId, displayName, profilePicture]
            );

            // Create empty personality profile for new user
            const profileResult = await query(
              `INSERT INTO personality_profiles (user_id)
               VALUES ($1)
               RETURNING id`,
              [newUser.rows[0].id]
            );

            return done(null, toExpressUser(newUser.rows[0]));
          }
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );

  // Serialize user for session (not used in JWT-based auth, but required by passport)
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const result = await query<User>('SELECT * FROM users WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        done(null, toExpressUser(result.rows[0]));
      } else {
        done(new Error('User not found'));
      }
    } catch (error) {
      done(error);
    }
  });
}
