import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BlocklyWorkspace from './components/BlocklyWorkspace';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ProfilePage from './pages/auth/ProfilePage';
import UserManagementPage from './pages/auth/UserManagementPage';
import Navbar from './components/common/Navbar';

function App() {
  // 임시 인증 상태
  const isAuthenticated = false;
  const isAdmin = false;
  const userEmail = '';

  const handleCodeGenerate = (code: string) => {
    console.log('Generated code:', code);
  };

  return (
    <Router>
      <Navbar isAuthenticated={isAuthenticated} isAdmin={isAdmin} userEmail={userEmail} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route 
          path="/profile" 
          element={isAuthenticated ? <ProfilePage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/admin/users" 
          element={isAuthenticated && isAdmin ? <UserManagementPage /> : <Navigate to="/" />} 
        />
        <Route 
          path="/" 
          element={
            isAuthenticated ? (
              <BlocklyWorkspace onCodeGenerate={handleCodeGenerate} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

export default App; 