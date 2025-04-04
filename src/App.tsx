import React, { useState } from 'react';
import { BlocklyWorkspace } from './components/BlocklyWorkspace';
import './App.css';

const App: React.FC = () => {
  const [generatedCode, setGeneratedCode] = useState('');

  const handleCodeGenerate = (code: string) => {
    setGeneratedCode(code);
    console.log('Generated Code:', code); // For debugging
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>DnA Blockly</h1>
      </header>
      <main className="app-main">
        <div className="blockly-container">
          <BlocklyWorkspace onCodeGenerate={handleCodeGenerate} />
        </div>
      </main>
    </div>
  );
};

export default App; 