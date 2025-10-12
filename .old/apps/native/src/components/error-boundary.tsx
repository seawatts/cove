import { Button } from '@acme/ui/button';
import { Icons } from '@acme/ui/icons';
import { H2, P } from '@acme/ui/typography';
import { useNavigate } from '@tanstack/react-router';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return <ErrorPage error={this.state.error} />;
    }

    return this.props.children;
  }
}

function ErrorPage({ error }: { error?: Error }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <Icons.AlertTriangle className="size-12 text-destructive" />
          <H2>Something went wrong!</H2>
        </div>
        <P className="text-muted-foreground">
          {error?.message || 'An unexpected error occurred'}
        </P>
      </div>

      <div className="flex gap-4">
        <Button onClick={() => navigate({ to: '/' })}>Go Home</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
