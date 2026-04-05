const crypto = require('crypto');
const { logger } = require('../utils/logger');

function createAuthController(deps) {
  const { authService, createError, getDatabase, getDeviceFingerprint, writeAuditLog, assessLoginRisk, ObjectId } = deps;

  function cookieOptions() {
    const secure = process.env.NODE_ENV === 'production';
    return { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/' };
  }

  function setAuthCookies(res, accessToken, refreshToken) {
    const cookieBase = cookieOptions();
    res.cookie('access_token', accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...cookieBase, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('csrf_token', crypto.randomBytes(32).toString('hex'), {
      secure: cookieBase.secure,
      sameSite: cookieBase.sameSite,
      path: '/',
    });
  }

  function clearAuthCookies(res) {
    const opts = cookieOptions();
    res.clearCookie('access_token', opts);
    res.clearCookie('refresh_token', opts);
    res.clearCookie('csrf_token', { ...opts, httpOnly: false });
  }

  return {
    register: async (req, res, next) => {
      try {
        const { username, password } = req.body || {};
        if (!username || typeof username !== 'string') {
          return next(createError(400, 'INVALID_USERNAME', 'Username is required'));
        }

        const result = await authService.registerUser({ username, password });
        const user = { id: result.insertedId.toString(), username, roles: ['customer'] };
        const tokens = await authService.issueAuthTokens({ _id: result.insertedId, username, roles: ['customer'] });
        setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

        return res.status(201).json({ ...tokens, user });
      } catch (error) {
        if (error && error.code === 11000) {
          return next(createError(409, 'USERNAME_TAKEN', 'Username already exists'));
        }
        return next(error);
      }
    },

    login: async (req, res, next) => {
      try {
        const { username, password } = req.body || {};
        if (!username || !password) {
          return next(createError(400, 'INVALID_CREDENTIALS', 'Username and password are required'));
        }

        const lockStatus = await authService.verifyLoginAttemptWindow(username);
        if (lockStatus.locked) {
          await writeAuditLog({ username, action: 'auth.login', outcome: 'account_locked', req });
          return next(createError(423, 'ACCOUNT_LOCKED', 'Account is temporarily locked. Try again later.'));
        }

        const database = getDatabase();
        const { user, passwordMatches } = await authService.authenticateCredentials({ username, password });

        if (!passwordMatches) {
          const failure = await authService.registerFailedAttempt(username);
          await writeAuditLog({ username, userId: user?._id, action: 'auth.login', outcome: 'failed', req });

          if (failure.lockTriggered) {
            await writeAuditLog({ username, userId: user?._id, action: 'auth.lockout', outcome: 'triggered', req });
            return next(createError(423, 'ACCOUNT_LOCKED', 'Account is temporarily locked. Try again later.'));
          }

          return next(createError(401, 'INVALID_CREDENTIALS', 'Invalid username or password'));
        }

        await authService.clearFailedAttempts(username);
        const { accessToken, refreshToken } = await authService.issueAuthTokens(user);

        let isNewDevice = false;
        let knownDeviceCount = 0;
        let riskAssessment = assessLoginRisk({
          isNewDevice: false,
          recentFailureCount: lockStatus.recentFailureCount,
          hasIpAddress: Boolean(req.ip || req.headers['x-forwarded-for']),
          hasUserAgent: Boolean(req.headers['user-agent']),
        });
        try {
          const deviceHash = getDeviceFingerprint(req);
          knownDeviceCount = await database.collection('user_devices').countDocuments({ userId: user._id });
          const result = await database.collection('user_devices').updateOne(
            { userId: user._id, deviceHash },
            { $set: { lastSeenAt: new Date(), updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
            { upsert: true },
          );
          isNewDevice = result.upsertedCount > 0;
          riskAssessment = assessLoginRisk({
            isNewDevice,
            knownDeviceCount,
            recentFailureCount: lockStatus.recentFailureCount,
            hasIpAddress: Boolean(req.ip || req.headers['x-forwarded-for']),
            hasUserAgent: Boolean(req.headers['user-agent']),
          });
        } catch (error) {
          logger.error({ err: error, username }, 'Non-blocking new-device logging failed');
        }

        setAuthCookies(res, accessToken, refreshToken);
        await writeAuditLog({
          username,
          userId: user._id,
          action: 'auth.login',
          outcome: 'success',
          req,
          isNewDevice,
          riskAssessment,
        });

        return res.status(200).json({
          accessToken,
          refreshToken,
          user: { id: user._id.toString(), username: user.username, roles: user.roles },
          securityEvent: isNewDevice
            ? {
                type: 'new_device_login',
                isNewDevice,
                knownDeviceCount,
                risk: riskAssessment,
              }
            : null,
        });
      } catch (error) {
        return next(error);
      }
    },

    refresh: async (req, res, next) => {
      try {
        const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
        if (!refreshToken) {
          return next(createError(401, 'REFRESH_TOKEN_REQUIRED', 'Refresh token is required'));
        }

        let rotated;
        try {
          rotated = await authService.rotateRefreshToken(refreshToken);
        } catch (error) {
          return next(createError(error.status || 401, error.code || 'INVALID_REFRESH_TOKEN', error.message));
        }

        setAuthCookies(res, rotated.accessToken, rotated.refreshToken);
        return res.status(200).json({ accessToken: rotated.accessToken, refreshToken: rotated.refreshToken, user: req.auth ? { id: req.auth.sub, username: req.auth.username, roles: req.auth.roles } : null });
      } catch (error) {
        return next(error);
      }
    },

    logout: async (req, res, next) => {
      try {
        const refreshToken = req.cookies?.refresh_token;
        if (refreshToken) {
          await authService.revokeRefreshToken(refreshToken);
        }

        const username = req.auth?.username || null;
        const userId = req.auth?.sub ? new ObjectId(req.auth.sub) : null;
        await writeAuditLog({ username, userId, action: 'auth.logout', outcome: 'success', req });

        clearAuthCookies(res);
        return res.status(200).json({ status: 'ok' });
      } catch (error) {
        return next(error);
      }
    },

    me: async (req, res, next) => {
      try {
        const database = getDatabase();
        const user = await database.collection('users').findOne({ _id: new ObjectId(req.auth.sub) }, { projection: { username: 1, roles: 1 } });

        if (!user) {
          return next(createError(401, 'UNAUTHORIZED', 'User not found'));
        }

        return res.status(200).json({ user: { id: req.auth.sub, username: user.username, roles: user.roles } });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = { createAuthController };
