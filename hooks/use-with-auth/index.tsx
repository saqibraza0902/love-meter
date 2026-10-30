import { supabase } from "@/utils/supabase";
import { useRouter } from "@/navigation/router-compat";
import React, { useEffect, useState } from "react";

const withAuth = <P extends object>(WrappedComponent: React.ComponentType<P>): React.FC<P> => {
  const AuthComponent: React.FC<P> = (props) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const router = useRouter();

    useEffect(() => {
      let mounted = true;
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        const authenticated = !!data.session;
        setIsAuthenticated(authenticated);
        if (authenticated) router.replace("/(tabs)/Home");
      });
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mounted) return;
        setIsAuthenticated(!!session);
        if (session) router.replace("/(tabs)/Home");
      });
      return () => { mounted = false; listener.subscription.unsubscribe(); };
    }, [router]);

    if (isAuthenticated !== false) return null;
    return <WrappedComponent {...props} />;
  };
  return AuthComponent;
};

export default withAuth;
