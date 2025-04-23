import React from 'react';
import '../styles/Sections.css';

interface ConvertedCodeSectionProps {
  convertedCode: string;  
}

export const ConvertedCodeSection: React.FC<ConvertedCodeSectionProps> = ({
  convertedCode
}) => {
  return (
    <div className="code-group">
      <h3 className="section-title">변환된 코드</h3>
      <textarea
        value={convertedCode}
        readOnly
        placeholder="변환된 코드가 여기에 표시됩니다"
        className="python-code-display"
      />
    </div>
  );
}; 