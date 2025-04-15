import React from 'react';
import '../styles/Sections.css';

interface CodeInputSectionProps {
  title: string;
  description: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
}

export const CodeInputSection: React.FC<CodeInputSectionProps> = ({
  title,
  description,
  onTitleChange,
  onDescriptionChange
}) => {
  return (
    <div className="code-input-container">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="코드 제목"
        className="code-title-input"
      />
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="코드 설명"
        className="code-description-input"
      />
    </div>
  );
}; 