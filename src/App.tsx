import React, { useState } from 'react';
import { BlocklyWorkspace } from './components/BlocklyWorkspace';
import { CodeSaveForm } from './components/CodeSaveForm';
import { codeBlockApi } from './services/api';
import './App.css';

const App: React.FC = () => {
  const [generatedCode, setGeneratedCode] = useState('');

  const handleCodeGenerate = (code: string) => {
    setGeneratedCode(code);
  };

  const handleSaveCode = async (title: string, description: string, code: string) => {
    try {
      await codeBlockApi.createCodeBlock({
        title,
        description,
        code,
      });
      alert('코드가 성공적으로 저장되었습니다!');
    } catch (error) {
      console.error('코드 저장 실패:', error);
      alert('코드 저장에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>DNA Blockly 코드 생성기</h1>
      </header>
      <main className="app-main">
        <div className="blockly-container">
          <BlocklyWorkspace onCodeGenerate={handleCodeGenerate} />
        </div>
        <div className="code-container">
          <CodeSaveForm
            pythonCode={generatedCode}
            onSave={handleSaveCode}
          />
        </div>
      </main>
    </div>
  );
};

export default App; 