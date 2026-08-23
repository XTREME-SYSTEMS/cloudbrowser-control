import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      // If the app ID is missing, the backend will reject all requests with
      // "Invalid id value: null". Show a clear message instead of the cryptic error.
      if (!appParams.appId) {
        setAuthError({
          type: 'unknown',
          message: 'App ID is missing. Please hard-refresh the page (Ctrl+Shift+R or Cmd+Shift+R) to clear any stale cache, then try again.'
        });
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
        return;
      }
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: false
      });
      
      try {
        const rawResponse = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        const publicSettings = rawResponse.data;
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        // With interceptResponses: false, errors are raw axios errors.
        // Normalize to a common shape: { status, data, message }
        const status = appError?.status || appError?.response?.status;
        const data = appError?.data || appError?.response?.data;
        const message = appError?.message || appError?.response?.data?.message || 'Failed to load app';

        // If the request failed due to a stale/invalid token (ObjectNotFoundError,
        // 401, etc.), clear the token and retry without it so the user can
        // see the login page cleanly instead of an error screen.
        if (appParams.token && (status === 401 || status === 404 || data?.error_type === 'ObjectNotFoundError' || !status)) {
          clearStaleTokens();
          // Retry without the stale token
          try {
            const retryClient = createAxiosClient({
              baseURL: `/api/apps/public`,
              headers: { 'X-App-Id': appParams.appId },
              interceptResponses: false
            });
            const retryResponse = await retryClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
            setAppPublicSettings(retryResponse.data);
            setIsLoadingAuth(false);
            setIsAuthenticated(false);
            setAuthChecked(true);
            setIsLoadingPublicSettings(false);
            return;
          } catch (retryError) {
            // Retry failed — fall through to normal error handling
          }
        }

        // Handle app-level errors
        if (status === 403 && data?.extra_data?.reason) {
          const reason = data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const clearStaleTokens = () => {
    try {
      localStorage.removeItem('base44_access_token');
      localStorage.removeItem('token');
    } catch (e) {}
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      // Clear any stale/invalid tokens so the user can log in cleanly
      clearStaleTokens();
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      // Don't set authError here — let the app render normally.
      // Unauthenticated users are redirected to /login by ProtectedRoute.
      // Only set auth_required if it's a genuine 403 (user not allowed),
      // not a stale-token lookup failure.
      if (error?.status === 403 && error?.data?.extra_data?.reason === 'auth_required') {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};