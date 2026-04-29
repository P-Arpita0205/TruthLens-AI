const authService = require('../services/auth.service');
const { auth, db } = require('../config/firebase.config');

const getUserByEmailIfExists = async (email) => {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  }
};

const getFirestoreUserByEmailIfExists = async (email) => {
  if (!db) return null;

  const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();
  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    ref: doc.ref,
    id: doc.id,
    data: doc.data()
  };
};

const getAccountByEmailIfExists = async (email) => {
  const [authUser, firestoreUser] = await Promise.all([
    auth ? getUserByEmailIfExists(email) : null,
    getFirestoreUserByEmailIfExists(email)
  ]);

  if (authUser) {
    const userDocRef = db.collection('users').doc(authUser.uid);
    const userDocSnap = await userDocRef.get();

    return {
      authUser,
      userDocRef,
      userData: userDocSnap.exists ? userDocSnap.data() : null
    };
  }

  if (!firestoreUser) {
    return null;
  }

  return {
    authUser: null,
    userDocRef: firestoreUser.ref,
    userData: firestoreUser.data
  };
};

const getUserByUidIfExists = async (uid) => {
  try {
    return await auth.getUser(uid);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  }
};

const getAccountByUidIfExists = async (uid) => {
  if (!uid || !db) return null;

  const authUser = auth ? await getUserByUidIfExists(uid) : null;
  const userDocRef = db.collection('users').doc(uid);
  const userDocSnap = await userDocRef.get();

  if (!authUser && !userDocSnap.exists) {
    return null;
  }

  return {
    authUser,
    userDocRef,
    userData: userDocSnap.exists ? userDocSnap.data() : null
  };
};

const getResolvedName = (userRecord, userData, fallback = 'User') =>
  userRecord?.displayName || userData?.name || userData?.profile?.displayName || fallback;

const serializeProviderData = (providerData = []) =>
  providerData.map((provider) => ({
    providerId: provider?.providerId || null,
    uid: provider?.uid || null,
    displayName: provider?.displayName || null,
    email: provider?.email || null,
    phoneNumber: provider?.phoneNumber || null,
    photoURL: provider?.photoURL || null
  }));

const deleteDocumentRefs = async (docRefs) => {
  if (!db || !docRefs?.length) return;

  for (let index = 0; index < docRefs.length; index += 400) {
    const batch = db.batch();
    docRefs.slice(index, index + 400).forEach((docRef) => batch.delete(docRef));
    await batch.commit();
  }
};

const deleteUserDataForRef = async (userDocRef) => {
  if (!userDocRef || !db) return;

  const analysesSnapshot = await userDocRef.collection('analyses').get();
  await deleteDocumentRefs(analysesSnapshot.docs.map((doc) => doc.ref));
  await userDocRef.delete().catch(() => null);
};

const ensureAuthUserForAccount = async ({ email, password, account }) => {
  if (account?.authUser) {
    return account.authUser;
  }

  if (!auth) {
    throw new Error('Auth service unavailable');
  }

  const desiredUid = account?.userData?.uid || account?.userDocRef?.id;
  if (!desiredUid) {
    throw new Error('Account record is missing a uid');
  }

  try {
    return await auth.createUser({
      uid: desiredUid,
      email,
      displayName: getResolvedName(null, account.userData),
      password
    });
  } catch (error) {
    if (error.code === 'auth/uid-already-exists') {
      return auth.getUser(desiredUid);
    }

    if (error.code === 'auth/email-already-exists') {
      return auth.getUserByEmail(email);
    }

    throw error;
  }
};

exports.sendEmailOTP = async (req, res) => {
  try {
    const { email, mode = 'signup' } = req.body;
    const normalizedEmail = authService.normalizeEmail(email);
    if (!normalizedEmail) return res.status(400).json({ error: 'Email is required' });
    if (!auth) return res.status(503).json({ error: 'Auth service unavailable' });

    const normalizedMode = ['signup', 'reset'].includes(mode) ? mode : 'signup';
    if (normalizedMode === 'signup') {
      const validation = authService.validateEmail(normalizedEmail);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.message });
      }
    }

    const existingAccount = await getAccountByEmailIfExists(normalizedEmail);

    if (normalizedMode === 'signup' && existingAccount) {
      return res.status(409).json({ error: 'Email is already registered. Please log in.' });
    }

    if (normalizedMode === 'reset' && !existingAccount) {
      return res.status(404).json({ error: "Email doesn't exist" });
    }

    const otp = authService.generateOTP();
    await authService.sendEmailOTP(normalizedEmail, otp);

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = authService.normalizeEmail(email);
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingAccount = await getAccountByEmailIfExists(normalizedEmail);
    if (!existingAccount) {
      return res.status(404).json({ error: "Email doesn't exist" });
    }

    if (!existingAccount.userData?.passwordHash) {
      return res.status(401).json({ error: 'This account needs a password reset before login.' });
    }

    if (!authService.verifyPassword(password, existingAccount.userData.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userRecord = await ensureAuthUserForAccount({
      email: normalizedEmail,
      password,
      account: existingAccount
    });

    const userDocRef = db.collection('users').doc(userRecord.uid);
    await userDocRef.set(
      {
        uid: userRecord.uid,
        email: normalizedEmail,
        name: getResolvedName(userRecord, existingAccount.userData),
        lastLogin: new Date().toISOString()
      },
      { merge: true }
    );

    const customToken = await auth.createCustomToken(userRecord.uid);

    return res.status(200).json({
      message: 'Login successful',
      token: customToken,
      user: {
        uid: userRecord.uid,
        name: getResolvedName(userRecord, existingAccount.userData),
        email: userRecord.email
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp, name, mode = 'signup', password } = req.body;
    const normalizedEmail = authService.normalizeEmail(email);
    if (!normalizedEmail || !otp) return res.status(400).json({ error: 'Email and OTP are required' });
    if (!auth || !db) return res.status(503).json({ error: 'Auth service unavailable' });

    const result = authService.verifyOTP(normalizedEmail, otp);
    if (result.valid) {
      const normalizedMode = ['signup', 'login', 'reset'].includes(mode) ? mode : 'signup';
      if (normalizedMode === 'signup') {
        const validation = authService.validateEmail(normalizedEmail);
        if (!validation.valid) {
          return res.status(400).json({ error: validation.message });
        }
      }
      if (normalizedMode === 'signup' && !name) {
        return res.status(400).json({ error: 'Name is required for signup' });
      }
      if (normalizedMode === 'signup' && !password) {
        return res.status(400).json({ error: 'Password is required for signup' });
      }

      if (normalizedMode === 'reset') {
        const existingAccount = await getAccountByEmailIfExists(normalizedEmail);
        if (!existingAccount) {
          return res.status(404).json({ error: "Email doesn't exist" });
        }
        authService.createResetSession(normalizedEmail);
        return res.status(200).json({ message: 'OTP verified. Continue with password reset.' });
      }

      let customToken = "mock-token-for-dev";
      let userRecord;
      let createdSignupUser = false;
      
      try {
        const existingAccount = await getAccountByEmailIfExists(normalizedEmail);

        if (normalizedMode === 'signup') {
          if (existingAccount) {
            return res.status(409).json({ error: 'Email is already registered. Please log in.' });
          }
          userRecord = await auth.createUser({ email: normalizedEmail, displayName: name.trim(), password });
          createdSignupUser = true;
        } else {
          if (!existingAccount) {
            return res.status(404).json({ error: "Email doesn't exist" });
          }

          if (existingAccount.authUser) {
            userRecord = existingAccount.authUser;
          } else {
            return res.status(409).json({ error: 'Account exists but needs a password reset. Please use Forgot Password.' });
          }
        }

        customToken = await auth.createCustomToken(userRecord.uid);

        // SYNC WITH FIRESTORE - Real-time user details sync
        const resolvedName = getResolvedName(userRecord, existingAccount?.userData, name || 'User');
        const userDoc = {
          uid: userRecord.uid,
          email: userRecord.email,
          name: resolvedName,
          authMethod: 'email',
          createdAt: userRecord.metadata.creationTime || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          emailVerified: userRecord.emailVerified || false,
          disabled: userRecord.disabled || false,
          providerData: serializeProviderData(userRecord.providerData),
          profile: {
            displayName: resolvedName,
            photoURL: userRecord.photoURL || null,
            preferences: {
              theme: 'light',
              notifications: true,
              language: 'en'
            }
          },
          analytics: {
            totalAnalyses: 0,
            lastAnalysisDate: null,
            subscriptionTier: 'free',
            joinDate: new Date().toISOString()
          },
          ...(normalizedMode === 'signup' && { passwordHash: authService.hashPassword(password) })
        };

        await db.collection('users').doc(userRecord.uid).set(userDoc, { merge: true });

        console.log(`User ${normalizedEmail} synced to Firestore successfully:`, {
          uid: userRecord.uid,
          name: userDoc.name,
          authMethod: userDoc.authMethod
        });
      } catch (e) {
        if (normalizedMode === 'signup' && createdSignupUser && userRecord?.uid) {
          await db.collection('users').doc(userRecord.uid).delete().catch(() => null);
          await auth.deleteUser(userRecord.uid).catch(() => null);
        }
        console.error("Firebase sync failed:", e.message);
        return res.status(500).json({ error: 'Failed to complete authentication' });
      }

      return res.status(200).json({
        message: 'Verified successfully',
        token: customToken,
        user: {
          uid: userRecord.uid,
          name: userRecord.displayName || name || 'User',
          email: userRecord.email
        }
      });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;
    const normalizedEmail = authService.normalizeEmail(email);
    if (!normalizedEmail || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Email and passwords are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (!authService.hasValidResetSession(normalizedEmail)) {
      return res.status(401).json({ error: 'Reset session expired. Please verify OTP again.' });
    }

    const existingAccount = await getAccountByEmailIfExists(normalizedEmail);
    if (!existingAccount) {
      return res.status(404).json({ error: "Email doesn't exist" });
    }

    let userRecord = existingAccount.authUser;
    if (userRecord) {
      await auth.updateUser(userRecord.uid, { password: newPassword });
    } else {
      userRecord = await ensureAuthUserForAccount({
        email: normalizedEmail,
        password: newPassword,
        account: existingAccount
      });
    }

    await db.collection('users').doc(userRecord.uid).set(
      {
        uid: userRecord.uid,
        email: normalizedEmail,
        name: getResolvedName(userRecord, existingAccount.userData),
        passwordHash: authService.hashPassword(newPassword),
        lastPasswordReset: new Date().toISOString()
      },
      { merge: true }
    );

    authService.clearResetSession(normalizedEmail);
    return res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword, confirmPassword } = req.body;
    const normalizedEmail = authService.normalizeEmail(email);

    if (!normalizedEmail || !currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Email and all password fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const existingAccount = await getAccountByEmailIfExists(normalizedEmail);
    if (!existingAccount) {
      return res.status(404).json({ error: "Email doesn't exist" });
    }

    if (!existingAccount.userData?.passwordHash || !authService.verifyPassword(currentPassword, existingAccount.userData.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    let userRecord = existingAccount.authUser;
    if (userRecord) {
      await auth.updateUser(userRecord.uid, { password: newPassword });
    } else {
      userRecord = await ensureAuthUserForAccount({
        email: normalizedEmail,
        password: newPassword,
        account: existingAccount
      });
    }

    await db.collection('users').doc(userRecord.uid).set(
      {
        uid: userRecord.uid,
        email: normalizedEmail,
        name: getResolvedName(userRecord, existingAccount.userData),
        passwordHash: authService.hashPassword(newPassword),
        lastPasswordReset: new Date().toISOString()
      },
      { merge: true }
    );

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

exports.deleteProfile = async (req, res) => {
  try {
    const { email, uid } = req.body;
    const normalizedEmail = authService.normalizeEmail(email);

    if (!normalizedEmail && !uid) {
      return res.status(400).json({ error: 'Email or uid is required' });
    }

    if (!db) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    let existingAccount = normalizedEmail
      ? await getAccountByEmailIfExists(normalizedEmail)
      : null;

    if (!existingAccount && uid) {
      existingAccount = await getAccountByUidIfExists(uid);
    }

    if (!existingAccount) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const resolvedUid =
      existingAccount.authUser?.uid ||
      existingAccount.userData?.uid ||
      uid ||
      existingAccount.userDocRef?.id;

    const userDocRefs = [];
    if (existingAccount.userDocRef) {
      userDocRefs.push(existingAccount.userDocRef);
    }

    if (resolvedUid) {
      const canonicalUserRef = db.collection('users').doc(resolvedUid);
      if (!userDocRefs.some((docRef) => docRef.path === canonicalUserRef.path)) {
        userDocRefs.push(canonicalUserRef);
      }
    }

    for (const userDocRef of userDocRefs) {
      await deleteUserDataForRef(userDocRef);
    }

    if (resolvedUid) {
      const topLevelAnalysesSnapshot = await db.collection('analyses').where('userId', '==', resolvedUid).get();
      await deleteDocumentRefs(topLevelAnalysesSnapshot.docs.map((doc) => doc.ref));
    }

    if (auth) {
      const authUid = existingAccount.authUser?.uid || resolvedUid;
      if (authUid) {
        try {
          await auth.deleteUser(authUid);
        } catch (error) {
          if (error.code !== 'auth/user-not-found') {
            throw error;
          }
        }
      }
    }

    const resolvedEmail = authService.normalizeEmail(
      normalizedEmail || existingAccount.authUser?.email || existingAccount.userData?.email
    );

    if (resolvedEmail) {
      authService.clearResetSession(resolvedEmail);
    }

    return res.status(200).json({ message: 'Profile deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
