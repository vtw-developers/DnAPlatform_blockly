import { useEffect, useState, useRef } from 'react';
import * as Blockly from 'blockly';
import { pythonGenerator as BlocklyPythonGenerator } from 'blockly/python';

import { registerJpypeBlocks } from '../customBlocks/jpypeBlocks';
import { registerSummaryBlocks, pythonGenerator } from '../customBlocks/summaryBlocks';

interface UseBlocklySetupProps {
  workspaceRef: React.RefObject<HTMLDivElement>;
  toolboxConfig: any;
  onCodeChange: (code: string) => void;
}

export const useBlocklySetup = ({ workspaceRef, toolboxConfig, onCodeChange }: UseBlocklySetupProps) => {
  const [workspace, setWorkspace] = useState<Blockly.WorkspaceSvg | null>(null);
  const workspaceInitialized = useRef(false);

  useEffect(() => {
    if (!workspaceRef.current || workspaceInitialized.current) return;

    try {
      // Summary 블록 등록 (먼저 등록)
      registerSummaryBlocks();
      
      // JPype 블록 등록
      registerJpypeBlocks();

      workspaceInitialized.current = true;
      const newWorkspace = Blockly.inject(workspaceRef.current, {
        toolbox: toolboxConfig,
        scrollbars: true,
        move: {
          wheel: true,
        },
        zoom: {
          controls: true,
          wheel: true,
          startScale: 1.0,
          maxScale: 3,
          minScale: 0.3,
          scaleSpeed: 1.2,
        },
        grid: {
          spacing: 20,
          length: 3,
          colour: '#ccc',
          snap: true,
        },
      });

      // Python 생성기 초기화 및 커스텀 생성기 적용
      pythonGenerator.init(newWorkspace);
      
      // Blockly 기본 생성기를 우리 커스텀 생성기로 대체
      (BlocklyPythonGenerator as any).forBlock = pythonGenerator.forBlock;

      setWorkspace(newWorkspace);

      // 작업 공간 변경 이벤트 리스너 추가
      const changeListener = () => {
        try {
          // Python 코드 생성 (custom pythonGenerator 사용)
          const code = pythonGenerator.workspaceToCode(newWorkspace);
          onCodeChange(code);
        } catch (error) {
          console.error('Error generating code:', error);
          onCodeChange(''); // 에러 발생 시 빈 코드 전달
        }
      };

      // 변경 이벤트 등록
      newWorkspace.addChangeListener(changeListener);

      // 컴포넌트 언마운트 시 정리
      return () => {
        if (newWorkspace) {
          newWorkspace.removeChangeListener(changeListener);
          newWorkspace.dispose();
          workspaceInitialized.current = false;
        }
      };
    } catch (error) {
      console.error('Error initializing Blockly workspace:', error);
      workspaceInitialized.current = false;
    }
  }, []);

  useEffect(() => {
    if (workspace && toolboxConfig) {
      try {
        workspace.updateToolbox(toolboxConfig);
      } catch (error) {
        console.error('Error updating toolbox:', error);
      }
    }
  }, [toolboxConfig]);

  const resetWorkspace = () => {
    if (workspace) {
      workspace.clear();
      onCodeChange('');
    }
  };

  return { workspace, resetWorkspace };
}; 