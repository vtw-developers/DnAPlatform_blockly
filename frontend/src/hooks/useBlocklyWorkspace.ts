import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';
import { TOOLBOX_CONFIG } from '../types/blockly';

interface UseBlocklyWorkspaceProps {
  onCodeGenerate: (code: string) => void;
}

export const useBlocklyWorkspace = ({ onCodeGenerate }: UseBlocklyWorkspaceProps) => {
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const blocklyDivRef = useRef<HTMLDivElement>(null);
  const [workspace, setWorkspace] = useState<Blockly.WorkspaceSvg | null>(null);

  useEffect(() => {
    if (!blocklyDivRef.current) return;

    const blocklyDiv = blocklyDivRef.current;
    const newWorkspace = Blockly.inject(blocklyDiv, {
      toolbox: TOOLBOX_CONFIG,
      scrollbars: true,
      horizontalLayout: false,
      toolboxPosition: 'start',
      css: true,
      media: 'media/',
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2
      },
      move: {
        scrollbars: true,
        drag: true,
        wheel: true
      }
    });

    workspaceRef.current = newWorkspace;
    setWorkspace(newWorkspace);

    const onWorkspaceChange = (event: Blockly.Events.Abstract) => {
      if (event.type === Blockly.Events.BLOCK_CHANGE ||
          event.type === Blockly.Events.BLOCK_CREATE ||
          event.type === Blockly.Events.BLOCK_DELETE ||
          event.type === Blockly.Events.BLOCK_MOVE) {
        const code = pythonGenerator.workspaceToCode(newWorkspace);
        onCodeGenerate(code);
      }
    };

    newWorkspace.addChangeListener(onWorkspaceChange);

    const handleResize = () => {
      Blockly.svgResize(newWorkspace);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      newWorkspace.removeChangeListener(onWorkspaceChange);
      window.removeEventListener('resize', handleResize);
      newWorkspace.dispose();
    };
  }, [onCodeGenerate]);

  const resetWorkspace = () => {
    if (workspace) {
      workspace.clear();
      onCodeGenerate('');
    }
  };

  const loadBlocks = (xml: string) => {
    if (workspace) {
      try {
        const dom = Blockly.Xml.textToDom(xml);
        workspace.clear();
        Blockly.Xml.domToWorkspace(dom, workspace);
        const code = pythonGenerator.workspaceToCode(workspace);
        onCodeGenerate(code);
      } catch (error) {
        console.error('블록 로드 실패:', error);
      }
    }
  };

  return {
    blocklyDivRef,
    workspace,
    resetWorkspace,
    loadBlocks
  };
}; 