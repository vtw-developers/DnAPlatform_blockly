import React, { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';
import { codeBlockApi } from '../services/api';
import './BlocklyWorkspace.css';

interface BlocklyWorkspaceProps {
  onCodeGenerate: (code: string) => void;
}

const TOOLBOX_CONFIG = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: '로직',
      categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
        { kind: 'block', type: 'logic_null' },
        { kind: 'block', type: 'logic_ternary' }
      ]
    },
    {
      kind: 'category',
      name: '반복',
      categorystyle: 'loop_category',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_repeat' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for' },
        { kind: 'block', type: 'controls_forEach' },
        { kind: 'block', type: 'controls_flow_statements' }
      ]
    },
    {
      kind: 'category',
      name: '수학',
      categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_trig' },
        { kind: 'block', type: 'math_constant' },
        { kind: 'block', type: 'math_number_property' },
        { kind: 'block', type: 'math_round' },
        { kind: 'block', type: 'math_on_list' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_constrain' },
        { kind: 'block', type: 'math_random_int' },
        { kind: 'block', type: 'math_random_float' },
        { kind: 'block', type: 'math_atan2' },        
      ]
    },
    {
      kind: 'category',
      name: '텍스트',
      categorystyle: 'text_category',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_multiline' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_append' },
        { kind: 'block', type: 'text_length' },
        { kind: 'block', type: 'text_isEmpty' },
        { kind: 'block', type: 'text_indexOf' },
        { kind: 'block', type: 'text_charAt' },
        { kind: 'block', type: 'text_getSubstring' },
        { kind: 'block', type: 'text_changeCase' },
        { kind: 'block', type: 'text_trim' },
        { kind: 'block', type: 'text_count' },
        { kind: 'block', type: 'text_replace' },
        { kind: 'block', type: 'text_reverse' },
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_prompt_ext' }
      ]
    },
    {
      kind: 'category',
      name: '리스트',
      categorystyle: 'list_category',
      contents: [
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_repeat' },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_isEmpty' },
        { kind: 'block', type: 'lists_indexOf' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_setIndex' },
        { kind: 'block', type: 'lists_getSublist' },
        { kind: 'block', type: 'lists_split' },
        { kind: 'block', type: 'lists_sort' },
        { kind: 'block', type: 'lists_reverse' }
      ]
    },
    {
      kind: 'category',
      name: '색상',
      categorystyle: 'colour_category',
      contents: [
        { kind: 'block', type: 'colour_picker' },
        { kind: 'block', type: 'colour_random' },
        { kind: 'block', type: 'colour_rgb' },
        { kind: 'block', type: 'colour_blend' }
      ]
    },
    {
      kind: 'category',
      name: '변수',
      categorystyle: 'variable_category',
      custom: 'VARIABLE'
    },
    {
      kind: 'category',
      name: '함수',
      categorystyle: 'procedure_category',
      custom: 'PROCEDURE'
    }
  ]
};

export const BlocklyWorkspace: React.FC<BlocklyWorkspaceProps> = ({ onCodeGenerate }) => {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    let workspace: Blockly.WorkspaceSvg | null = null;

    if (blocklyDiv.current && !workspaceRef.current) {
      try {
        // Blockly 워크스페이스 초기화
        workspace = Blockly.inject(blocklyDiv.current, {
          toolbox: TOOLBOX_CONFIG,
          scrollbars: true,
          move: {
            drag: true,
            wheel: true
          },
          zoom: {
            controls: true,
            wheel: true,
            startScale: 1.0,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2
          },
          grid: {
            spacing: 20,
            length: 3,
            colour: '#ccc',
            snap: true
          },
          trashcan: true,
          renderer: 'geras'
        });

        workspaceRef.current = workspace;

        // 워크스페이스 변경 이벤트 리스너
        const onWorkspaceChange = (event: Blockly.Events.Abstract) => {
          if (!workspace) return;

          if (event.type === Blockly.Events.BLOCK_CHANGE || 
              event.type === Blockly.Events.BLOCK_CREATE ||
              event.type === Blockly.Events.BLOCK_DELETE ||
              event.type === Blockly.Events.BLOCK_MOVE) {
            try {
              const code = pythonGenerator.workspaceToCode(workspace);
              handleCodeGeneration(code);
            } catch (e) {
              console.error('Python 코드 생성 중 오류:', e);
            }
          }
        };

        workspace.addChangeListener(onWorkspaceChange);

        // 초기 코드 생성
        const code = pythonGenerator.workspaceToCode(workspace);
        handleCodeGeneration(code);

        // 정리 함수 반환
        return () => {
          if (workspace) {
            workspace.removeChangeListener(onWorkspaceChange);
            workspace.dispose();
            workspaceRef.current = null;
          }
        };
      } catch (error) {
        console.error('Blockly 워크스페이스 초기화 중 오류:', error);
      }
    }
  }, []); // 의존성 배열을 비워서 컴포넌트 마운트 시에만 실행

  const handleCodeGeneration = (code: string) => {
    setCurrentCode(code);
    onCodeGenerate(code);
  };

  const handleSaveCode = async () => {
    if (!currentCode || !title || !description) {
      alert('제목, 설명, 코드를 모두 입력해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      await codeBlockApi.createCodeBlock({
        title,
        description,
        code: currentCode
      });
      alert('코드가 성공적으로 저장되었습니다!');
      setTitle('');
      setDescription('');
    } catch (error) {
      console.error('코드 저장 중 오류 발생:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('코드 저장 중 알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="blockly-workspace-container">
      <div className="blockly-controls">
        <input
          type="text"
          placeholder="코드 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="blockly-input"
        />
        <textarea
          placeholder="코드 설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="blockly-textarea"
        />
        <button
          onClick={handleSaveCode}
          disabled={isSaving}
          className="blockly-save-button"
        >
          {isSaving ? '저장 중...' : '코드 저장'}
        </button>
      </div>
      <div ref={blocklyDiv} className="blockly-workspace" />
    </div>
  );
}; 