import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { getUsers, setUsers } from '../hooks/useLayoutState';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isBasicUser: boolean;
  isGuest: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  continueAsGuest: () => void;
  createUser: (username: string, password: string, name: string, role: UserRole, email?: string) => boolean;
  updateUser: (userId: string, updates: Partial<User>) => boolean;
  deleteUser: (userId: string) => boolean;
  getAllUsers: () => User[];
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Check for saved session
    const savedSession = localStorage.getItem('spm_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.expiry > Date.now()) {
          const users = getUsers();
          const foundUser = users.find(u => u.id === session.userId);
          if (foundUser) {
            setUser(foundUser);
          } else if (session.isGuest) {
            setUser({
              id: 'guest',
              username: 'guest',
              password: '',
              role: 'guest',
              name: 'Guest User',
              isActive: true,
              createdAt: new Date().toISOString()
            });
          }
        }
      } catch (e) {
        localStorage.removeItem('spm_session');
      }
    }
    setInitialized(true);
  }, []);

  const login = (username: string, password: string): boolean => {
    const users = getUsers();
    const foundUser = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );
    
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('spm_session', JSON.stringify({
        userId: foundUser.id,
        expiry: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        isGuest: false
      }));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('spm_session');
  };

  const continueAsGuest = () => {
    const guestUser: User = {
      id: 'guest',
      username: 'guest',
      password: '',
      role: 'guest',
      name: 'Guest User',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    setUser(guestUser);
    localStorage.setItem('spm_session', JSON.stringify({
      userId: 'guest',
      expiry: Date.now() + 24 * 60 * 60 * 1000,
      isGuest: true
    }));
  };

  const createUser = (username: string, password: string, name: string, role: UserRole, email?: string): boolean => {
    const users = getUsers();
    
    // Check if username already exists
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return false;
    }
    
    const newUser: User = {
      id: `user-${Date.now()}`,
      username,
      password,
      role,
      name,
      email,
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
      createdBy: user?.id
    };
    
    setUsers([...users, newUser]);
    return true;
  };

  const updateUser = (userId: string, updates: Partial<User>): boolean => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    
    if (index === -1) return false;
    
    // Don't allow changing the last admin to non-admin
    if (updates.role && updates.role !== 'admin') {
      const admins = users.filter(u => u.role === 'admin');
      if (admins.length === 1 && admins[0].id === userId) {
        return false;
      }
    }
    
    users[index] = { ...users[index], ...updates };
    setUsers(users);
    
    // Update current user if it's the same
    if (user?.id === userId) {
      setUser(users[index]);
    }
    
    return true;
  };

  const deleteUser = (userId: string): boolean => {
    const users = getUsers();
    
    // Don't allow deleting the last admin
    const admins = users.filter(u => u.role === 'admin');
    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete?.role === 'admin' && admins.length === 1) {
      return false;
    }
    
    // Don't allow deleting yourself
    if (user?.id === userId) {
      return false;
    }
    
    setUsers(users.filter(u => u.id !== userId));
    return true;
  };

  const getAllUsers = (): User[] => {
    return getUsers();
  };

  const isAdmin = user?.role === 'admin';
  const isBasicUser = user?.role === 'basic';
  const isGuest = user?.role === 'guest';

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-plum border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      isBasicUser,
      isGuest,
      login,
      logout,
      continueAsGuest,
      createUser,
      updateUser,
      deleteUser,
      getAllUsers
    }}>
      {children}
    </AuthContext.Provider>
  );
}
