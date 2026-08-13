// src/features/auth/authUtils.js

export const SUPERADMIN_ACCOUNT = {
  role: 'superadmin',
  userId: '',
  email: '',
  password: '',
};

export const loadStoredAccounts = () => {
  try {
    const rawAccounts = sessionStorage.getItem('iipsPortalAccounts');
    return rawAccounts ? JSON.parse(rawAccounts) : [];
  } catch {
    return [];
  }
};

export const storeAccount = (account) => {
  const existingAccounts = loadStoredAccounts();
  const nextAccounts = [...existingAccounts.filter((item) => item.userId !== account.userId), account];
  sessionStorage.setItem('iipsPortalAccounts', JSON.stringify(nextAccounts));
};

export const buildInstituteUserId = (prefix) => {
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  return `${prefix}-2K${yearSuffix}-${String(Date.now() % 1000 || 1).padStart(3, '0')}`;
};

export const findUserByCredentials = (identifier, password) => {
  const accounts = loadStoredAccounts();
  // Include the hardcoded superadmin in the search pool
  const allAccounts = [...accounts, SUPERADMIN_ACCOUNT];

  return allAccounts.find((account) => {
    const identifiers = [account.userId, account.email]
      .filter(Boolean)
      .map((v) => v.toLowerCase());
    
    return identifiers.includes(identifier.trim().toLowerCase()) && 
           account.password === password;
  });
};

export const saveAuthData = (data) => {
  sessionStorage.setItem("token", data.token);
  sessionStorage.setItem("role", data.role);
  sessionStorage.setItem("user_id", data.user_id);
}

export const logout = () => {
  sessionStorage.clear();
}
