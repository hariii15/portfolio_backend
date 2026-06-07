import admin from 'firebase-admin';

export async function checkAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    const adminUid = process.env.ADMIN_UID || '5gEMx5ehKyUHPY69R2552cMOli52';
    if (!adminUid) {
      return res.status(500).json({ error: 'Server error. ADMIN_UID environment variable is not configured.' });
    }

    if (decodedToken.uid !== adminUid) {
      return res.status(403).json({ error: 'Forbidden. User is not authorized as admin.' });
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ 
      error: 'Unauthorized. Invalid or expired token.',
      details: error.message 
    });
  }
}

export async function optionalAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      const adminUid = process.env.ADMIN_UID || '5gEMx5ehKyUHPY69R2552cMOli52';
      if (adminUid && decodedToken.uid === adminUid) {
        req.isAdmin = true;
        req.user = decodedToken;
      }
    }
  } catch (error) {
    // Treat as non-admin visitor on signature/token failure
  }
  next();
}
