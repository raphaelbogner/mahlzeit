import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type LinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'to'>;

export interface WorkspaceLinkProps extends LinkProps {
  to: string;
  children: ReactNode;
}

// Preserves the workspace token (`?w=...`) across in-app navigation.
export function WorkspaceLink({ to, children, ...rest }: WorkspaceLinkProps) {
  const { search } = useLocation();
  return (
    <Link to={{ pathname: to, search }} {...rest}>
      {children}
    </Link>
  );
}

export function useWorkspaceNavigate(): (to: string) => void {
  const navigate = useNavigate();
  const { search } = useLocation();
  return (to: string) => navigate({ pathname: to, search });
}
