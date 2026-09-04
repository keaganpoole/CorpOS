export function needsMfa({ currentLevel, nextLevel }, tenant) {
  return currentLevel !== 'aal2' && (tenant?.mfa_required === true || nextLevel === 'aal2');
}

export async function enrollTotp(auth) {
  const { data, error } = await auth.mfa.enroll({ factorType: 'totp', friendlyName: `Nodemere ${new Date().toISOString()}` });
  if (error) throw new Error('Could not start authenticator setup. Please try again.');
  return data;
}

export async function verifyTotp(auth, factorId, code) {
  if (!/^\d{6}$/.test(code)) throw new Error('Enter the six-digit authenticator code.');
  const challenge = await auth.mfa.challenge({ factorId });
  if (challenge.error) throw new Error('Could not start verification. Please try again.');
  const result = await auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
  if (result.error) throw new Error('The code is invalid or expired. Please try again.');
  return result.data;
}

export async function removeTotp(auth, factorId) {
  const assurance = await auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== 'aal2') throw new Error('Verify an existing authenticator first.');
  const factors = await auth.mfa.listFactors();
  if (factors.error || (factors.data?.totp || []).filter(f => f.status === 'verified' && f.id !== factorId).length === 0) {
    throw new Error('Add and verify a replacement authenticator before removing this one.');
  }
  const result = await auth.mfa.unenroll({ factorId });
  if (result.error) throw new Error('Could not remove the authenticator.');
}
