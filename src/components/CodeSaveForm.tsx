import React, { useState } from 'react';

interface CodeSaveFormProps {
  pythonCode: string;
  onSave: (title: string, description: string, code: string) => void;
}

export const CodeSaveForm: React.FC<CodeSaveFormProps> = ({ pythonCode, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(title, description, pythonCode);
    setTitle('');
    setDescription('');
  };

  return (
    <form onSubmit={handleSubmit} className="code-save-form">
      <div className="form-group">
        <label htmlFor="title">코드 제목:</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="description">설명:</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>
      <div className="form-group">
        <label>생성된 Python 코드:</label>
        <pre>{pythonCode}</pre>
      </div>
      <button type="submit">저장</button>
    </form>
  );
}; 