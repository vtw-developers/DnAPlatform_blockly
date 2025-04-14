import React from 'react';
import LoginForm from '../../components/auth/LoginForm';

interface LoginPageProps {
  onLoginSuccess: () => Promise<void>;
}

const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  return <LoginForm onLoginSuccess={onLoginSuccess} />;
};

export default LoginPage; 