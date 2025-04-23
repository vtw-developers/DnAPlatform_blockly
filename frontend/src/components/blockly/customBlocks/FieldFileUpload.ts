import * as Blockly from 'blockly/core';

export class FieldFileUpload extends Blockly.FieldTextInput {
  constructor(value: string) {
    super(value);
  }

  showEditor_() {
    // 파일 업로드 input 생성
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jar';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
          // 서버로 업로드
          const res = await fetch('/api/upload-jar', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.path) {
            // 백엔드 도커 내부 경로를 필드 값으로 설정
            this.setValue(data.path);
          }
        } catch (error) {
          console.error('JAR 파일 업로드 실패:', error);
          alert('JAR 파일 업로드에 실패했습니다.');
        }
      }
    };
    input.click();
  }
} 