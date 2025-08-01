import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { app } from "@/utils/firebase";
import { checkPairingStatus } from "@/utils/firebase-functions/check-pair-status";

const withAuth = <P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> => {
  const AuthComponent: React.FC<P> = (props) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(
      null
    );
    const router = useRouter();
    const auth = getAuth(app);

    useEffect(() => {
      let unsubscribe: () => void;

      const checkAuthState = async () => {
        // First try to get current user immediately
        const user = auth.currentUser;
        const { isPaired, partnerData } = await checkPairingStatus();
        if (user && isPaired) {
          setIsAuthenticated(true);
          router.replace("/(tabs)/Home"); // Redirect to home if logged in
          return;
        } else if (user && !isPaired) {
          router.replace("/(tabs)/viewReq");
        }

        // Set up listener for auth changes
        unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
          if (user) {
            setIsAuthenticated(true);
            router.replace("/(tabs)/Home"); // Redirect to home if logged in
          } else {
            setIsAuthenticated(false);
            // Don't redirect, just return null (shows the login screen)
          }
        });
      };

      checkAuthState();

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }, []);

    // Return null while checking auth or if not authenticated
    if (isAuthenticated === null || isAuthenticated) {
      return null;
    }

    // Only render the wrapped component if not authenticated
    return <WrappedComponent {...props} />;
  };

  return AuthComponent;
};

export default withAuth;
