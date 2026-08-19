import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, UserRole } from '../types';
import { getUsers, setUsers } from '../hooks/useLayoutState';
import {
  canUserAuthenticate,
  clearFailedLoginState,
  clearSession,
  createPasswordRecord,
  createSession,
  isSessionValidForUser,
  isUserLocked,
  loadSession,
  needsPasswordMigration,
  recordFailedLogin,
  saveSession,
  verifyPassword,
} from '../utils/auth';
import type { PlatformRole } from '../services/platform/platformTypes';
import { setActiveOrganizationSlug } from '../services/platform/organizationContext';
import {
  restoreSupabaseSession,
  shouldUseSupabaseAuth,
  signInWithSupabase,
  signOutSupabase,
  signUpOrganizationInvite,
  signUpWithSupabase,
} from '../services/backend/AuthBackend';

export interface AuthRegistrationParams {
  email: string;
  password: string;
  fullName: string;
  organizationName?: string;
}

interface AuthContextType {
  user: User | null;
  /** The user's active organization id (RLS scope), when on the Supabase backend. */
  organizationId: string | null;
  /** Slug for the active venue organization, used by venue-specific login/link routes. */
  organizationSlug: string | null;
  /** Global platform role, separate from the venue organization role. */
  platformRole: PlatformRole | null;
  /** True for platform_owner and platform_admin memberships. */
  isPlatformAdmin: boolean;
  /** True for any active platform membership, including support. */
  isPlatformSupport: boolean;
  isAdmin: boolean;
  isBasicUser: boolean;
  isGuest: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  loginForOrganization: (organizationId: string, username: string, password: string) => Promise<boolean>;
  /** Register a new account (Supabase backend). Returns an error message or null on success. */
  register: (params: AuthRegistrationParams) => Promise<string | null>;
  /** Register and accept an existing organization invitation without creating a new tenant. */
  registerWithInvite: (inviteToken: string, params: AuthRegistrationParams) => Promise<string | null>;
  logout: () => void;
  continueAsGuest: () => void;
  createUser: (
    username: string,
    password: string,
    name: string,
    role: UserRole,
    email?: string,
  ) => Promise<boolean>;
  updateUser: (userId: string, updates: Partial<User>) => boolean;
  deleteUser: (userId: string) => boolean;
  getAllUsers: () => User[];
  /**
   * Replace a user's password and clear their `requiresPasswordChange` flag.
   * Used by the forced "change your password on first login" gate.
   */
  changePassword: (userId: string, newPassword: string) => Promise<boolean>;
  /**
   * Re-read the active backend session (memberships, org, platform role).
   * Call after accepting an invite so the new org membership takes effect
   * without a full page reload (P1-11).
   */
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

function buildGuestUser(): User {
  return {
    id: 'guest',
    username: 'guest',
    email: 'guest@example.local',
    password: '',
    role: 'guest',
    name: 'Guest User',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationSlug, setOrganizationSlug] = useState<string | null>(null);
  const [platformRole, setPlatformRole] = useState<PlatformRole | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (shouldUseSupabaseAuth()) {
      void restoreSupabaseSession()
        .then((session) => {
          if (session?.user) {
            setUser(session.user);
            setOrganizationId(session.organizationId ?? null);
            setOrganizationSlug(session.organizationSlug ?? null);
            setActiveOrganizationSlug(session.organizationSlug);
            setPlatformRole(session.platformRole ?? null);
          } else {
            clearSession();
            setOrganizationId(null);
            setOrganizationSlug(null);
            setActiveOrganizationSlug(null);
            setPlatformRole(null);
          }
        })
        .finally(() => setInitialized(true));
      return;
    }

    const savedSession = loadSession();

    if (!savedSession) {
      clearSession();
      setInitialized(true);
      return;
    }

    if (savedSession.isGuest) {
      const guestUser = buildGuestUser();
      setUser(guestUser);
      setPlatformRole(null);
      saveSession(createSession(guestUser as any, true));
      setInitialized(true);
      return;
    }

    const users = getUsers();
    const foundUser = users.find((u) => u.id === savedSession.userId);

    if (!foundUser || !isSessionValidForUser(savedSession, foundUser as any)) {
      clearSession();
      setInitialized(true);
      return;
    }

    setUser(foundUser);
    setPlatformRole(null);
    saveSession(createSession(foundUser as any, false));
    setInitialized(true);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    if (shouldUseSupabaseAuth()) {
      const session = await signInWithSupabase(username, password);
      if (!session) return false;
      setUser(session.user);
      setOrganizationId(session.organizationId ?? null);
      setOrganizationSlug(session.organizationSlug ?? null);
      setActiveOrganizationSlug(session.organizationSlug);
      setPlatformRole(session.platformRole ?? null);
      return true;
    }

    const users = getUsers();

    const foundUser = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase(),
    );

    if (!foundUser) {
      return false;
    }

    if (!canUserAuthenticate(foundUser as any) || isUserLocked(foundUser as any)) {
      return false;
    }

    const success = await verifyPassword(foundUser as any, password);
    if (!success) {
      const updatedUsers = users.map((u) =>
        u.id === foundUser.id ? (recordFailedLogin(u as any) as User) : u,
      );
      setUsers(updatedUsers);
      return false;
    }

    const migratedPasswordRecord = needsPasswordMigration(foundUser as any)
      ? await createPasswordRecord(password)
      : null;

    const updatedUsers = users.map((u) => {
      if (u.id !== foundUser.id) return u;

      const cleared = clearFailedLoginState(u as any) as User;
      if (!migratedPasswordRecord) return cleared;

        return {
          ...cleared,
          password: '',
          requiresPasswordChange: false,
          ...(migratedPasswordRecord as any),
          sessionVersion: ((cleared as any).sessionVersion ?? 1) + 1,
        } as User;
    });
    setUsers(updatedUsers);

    const authenticatedUser =
      updatedUsers.find((u) => u.id === foundUser.id) || foundUser;

    setUser(authenticatedUser);
    saveSession(createSession(authenticatedUser as any, false));
    return true;
  };

  const loginForOrganization: AuthContextType['loginForOrganization'] = async (organizationId, username, password) => {
    if (!shouldUseSupabaseAuth()) return false;
    const session = await signInWithSupabase(username, password, organizationId);
    if (!session) return false;
    setUser(session.user);
    setOrganizationId(session.organizationId ?? null);
    setOrganizationSlug(session.organizationSlug ?? null);
    setActiveOrganizationSlug(session.organizationSlug);
    setPlatformRole(session.platformRole ?? null);
    return true;
  };

  const logout = () => {
    setUser(null);
    setOrganizationId(null);
    setOrganizationSlug(null);
    setActiveOrganizationSlug(null);
    setPlatformRole(null);
    clearSession();
    if (shouldUseSupabaseAuth()) {
      void signOutSupabase();
    }
  };

  const register: AuthContextType['register'] = async ({ email, password, fullName, organizationName }) => {
    if (!shouldUseSupabaseAuth()) {
      return 'Account registration requires the Supabase backend. Contact the venue administrator.';
    }
    try {
      const session = await signUpWithSupabase({ email, password, fullName, organizationName });
      setUser(session.user);
      setOrganizationId(session.organizationId ?? null);
      setOrganizationSlug(session.organizationSlug ?? null);
      setActiveOrganizationSlug(session.organizationSlug);
      setPlatformRole(session.platformRole ?? null);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to create your account.';
    }
  };

  const registerWithInvite: AuthContextType['registerWithInvite'] = async (inviteToken, { email, password, fullName }) => {
    if (!shouldUseSupabaseAuth()) {
      return 'Organization invitations require the Supabase backend.';
    }
    try {
      const session = await signUpOrganizationInvite({ email, password, fullName, inviteToken });
      setUser(session.user);
      setOrganizationId(session.organizationId ?? null);
      setOrganizationSlug(session.organizationSlug ?? null);
      setActiveOrganizationSlug(session.organizationSlug);
      setPlatformRole(session.platformRole ?? null);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unable to create your invited account.';
    }
  };

  const continueAsGuest = () => {
    const guestUser = buildGuestUser();
    setUser(guestUser);
    setPlatformRole(null);
    saveSession(createSession(guestUser as any, true));
  };

  const createUser = async (
    username: string,
    password: string,
    name: string,
    role: UserRole,
    email?: string,
  ): Promise<boolean> => {
    const users = getUsers();

    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      return false;
    }

    const passwordRecord = await createPasswordRecord(password);

    const newUser: User = {
      id: `user-${Date.now()}`,
      username,
      email: email || username,
      password: '',
      role,
      name,
      contactPhoneNumber: '',
      phoneType: 'Mobile',
      preferredCommunication: [],
      eventRole: '',
      eventName: '',
      userRole: 'shared',
      isMasterUser: false,
      parentUserId: undefined,
      allowSharedAccess: false,
      sharedUserLimit: 0,
      userStatus: 'active',
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: user?.id,
      ...(passwordRecord as any),
      sessionVersion: 1,
    };

    setUsers([...users, newUser]);
    return true;
  };

  const updateUser = (userId: string, updates: Partial<User>): boolean => {
    const users = getUsers();
    const index = users.findIndex((u) => u.id === userId);

    if (index === -1) return false;

    if (updates.role && updates.role !== 'admin') {
      const admins = users.filter((u) => u.role === 'admin');
      if (admins.length === 1 && admins[0].id === userId) {
        return false;
      }
    }

    const shouldBumpSessionVersion =
      updates.password !== undefined ||
      (updates as any).passwordHash !== undefined ||
      (updates as any).passwordSalt !== undefined ||
      updates.userStatus !== undefined ||
      updates.isActive !== undefined;

    const currentVersion = ((users[index] as any).sessionVersion ?? 1) as number;

    users[index] = {
      ...users[index],
      ...updates,
      ...(shouldBumpSessionVersion
        ? { sessionVersion: currentVersion + 1 }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    setUsers(users);

    if (user?.id === userId) {
      setUser(users[index]);
    }

    return true;
  };

  const deleteUser = (userId: string): boolean => {
    const users = getUsers();

    const admins = users.filter((u) => u.role === 'admin');
    const userToDelete = users.find((u) => u.id === userId);

    if (userToDelete?.role === 'admin' && admins.length === 1) {
      return false;
    }

    if (user?.id === userId) {
      return false;
    }

    setUsers(users.filter((u) => u.id !== userId));
    return true;
  };

  const getAllUsers = (): User[] => {
    return getUsers();
  };

  const refreshSession = useCallback(async (): Promise<void> => {
    if (shouldUseSupabaseAuth()) {
      const session = await restoreSupabaseSession();
      if (session?.user) {
        setUser(session.user);
        setOrganizationId(session.organizationId ?? null);
        setOrganizationSlug(session.organizationSlug ?? null);
        setActiveOrganizationSlug(session.organizationSlug);
        setPlatformRole(session.platformRole ?? null);
      }
      return;
    }

    const savedSession = loadSession();
    if (!savedSession) return;
    if (savedSession.isGuest) {
      setUser(buildGuestUser());
      return;
    }
    const users = getUsers();
    const foundUser = users.find((u) => u.id === savedSession.userId);
    if (foundUser && isSessionValidForUser(savedSession, foundUser as any)) {
      setUser(foundUser);
    }
  }, []);

  const changePassword = async (
    userId: string,
    newPassword: string,
  ): Promise<boolean> => {
    const users = getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) return false;

    const passwordRecord = await createPasswordRecord(newPassword);

    const updated = {
      ...users[index],
      password: '',
      ...(passwordRecord as any),
      requiresPasswordChange: false,
      sessionVersion: ((users[index] as any).sessionVersion ?? 1) + 1,
      updatedAt: new Date().toISOString(),
    } as User;

    users[index] = updated;
    setUsers(users);

    // If this is the signed-in user, refresh in-memory state so the forced
    // change gate clears and the workspace can render.
    if (user?.id === userId) {
      setUser(updated);
      saveSession(createSession(updated as any, false));
    }

    return true;
  };

  const isPlatformAdmin = platformRole === 'platform_owner' || platformRole === 'platform_admin';
  const isPlatformSupport = isPlatformAdmin || platformRole === 'platform_support';
  const isAdmin = user?.role === 'admin';
  const isBasicUser = user?.role === 'basic';
  const isGuest = user?.role === 'guest';

  if (!initialized) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        organizationId,
        organizationSlug,
        platformRole,
        isPlatformAdmin,
        isPlatformSupport,
        isAdmin,
        isBasicUser,
        isGuest,
        login,
        loginForOrganization,
        register,
        registerWithInvite,
        logout,
        continueAsGuest,
        createUser,
        updateUser,
        deleteUser,
        getAllUsers,
        changePassword,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}