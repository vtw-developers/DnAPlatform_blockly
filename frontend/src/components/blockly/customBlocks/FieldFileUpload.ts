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
        // 서버로 업로드
        const res = await fetch('/api/upload-jar', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.path) {
          this.setValue(data.path); // 업로드된 경로를 필드 값으로 설정
        }
      }
    };
    input.click();
  }
} 