import { useState } from 'react';
import { codeBlockApi } from '../../../services/api';
import { CodeBlock } from '../../../types/CodeBlock';
import * as Blockly from 'blockly';

interface UseCodeBlockProps {
  workspace: Blockly.Workspace | null;
  currentCode: string;
  onRefresh?: () => void;
}

export const useCodeBlock = ({ workspace, currentCode, onRefresh }: UseCodeBlockProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<number[]>([]);
  const [selectedBlockUserId, setSelectedBlockUserId] = useState<number | null>(null);

  const handleSave = async (userId: number | null) => {
    if (!currentCode.trim()) {
      alert('저장할 코드가 없습니다.');
      return;
    }

    if (!title.trim()) {
      alert('코드 제목을 입력해주세요.');
      return;
    }

    if (selectedBlocks.length > 0 && selectedBlockUserId !== null) {
      if (!userId) {
        alert('로그인이 필요합니다.');
        return;
      }
      if (userId !== selectedBlockUserId) {
        alert('자신이 작성한 코드만 수정할 수 있습니다.');
        return;
      }
    }

    try {
      const blocklyXml = workspace ? Blockly.Xml.workspaceToDom(workspace) : null;
      const xmlString = blocklyXml ? Blockly.Xml.domToText(blocklyXml) : '';

      const codeBlock = {
        title,
        description,
        code: currentCode,
        blockly_xml: xmlString,
        is_shared: isShared
      };

      if (selectedBlocks.length > 0) {
        await codeBlockApi.updateCodeBlock(selectedBlocks[0], codeBlock);
        alert('코드가 수정되었습니다.');
      } else {
        await codeBlockApi.createCodeBlock(codeBlock);
        alert('코드가 저장되었습니다.');
      }

      onRefresh?.();
    } catch (error) {
      console.error('Error saving code:', error);
      alert('코드 저장에 실패했습니다.');
    }
  };

  const handleCreateBlock = (blockXml: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(blockXml, 'text/xml');
      
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Invalid XML format');
      }

      if (workspace) {
        workspace.clear();
        const xml = Blockly.utils.xml.textToDom(blockXml);
        Blockly.Xml.domToWorkspace(xml, workspace);
      }
    } catch (error) {
      console.error('Error creating block:', error);
      alert('블록 생성에 실패했습니다.');
    }
  };

  const handleBlockSelect = (block: CodeBlock) => {
    if (block.blockly_xml) {
      handleCreateBlock(block.blockly_xml);
      setTitle(block.title || '');
      setDescription(block.description || '');
      setIsShared(block.is_shared || false);
      setSelectedBlocks([block.id]);
      setSelectedBlockUserId(block.user_id || null);
    }
  };

  const handleToggleShare = async (userId: number | null, block?: CodeBlock) => {
    let blockId: number | null = null;
    let isSharedValue: boolean = false;
    if (block) {
      blockId = block.id;
      isSharedValue = block.is_shared;
    } else if (selectedBlocks.length) {
      blockId = selectedBlocks[0];
      isSharedValue = isShared;
    }
    if (!blockId) {
      alert('공유할 코드를 선택해주세요.');
      return;
    }
    if (selectedBlockUserId !== null && (!userId || userId !== selectedBlockUserId)) {
      alert('자신이 작성한 코드만 공유할 수 있습니다.');
      return;
    }
    try {
      await codeBlockApi.toggleShareCodeBlock(blockId);
      setIsShared(!isSharedValue);
      onRefresh?.();
      alert(isSharedValue ? '공유가 해제되었습니다.' : '코드가 공유되었습니다.');
    } catch (error) {
      console.error('Error toggling share:', error);
      alert('공유 상태 변경에 실패했습니다.');
    }
  };

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setSelectedBlocks([]);
    setSelectedBlockUserId(null);
    setIsShared(false);
  };

  return {
    title,
    description,
    isShared,
    selectedBlocks,
    selectedBlockUserId,
    setTitle,
    setDescription,
    handleSave,
    handleCreateBlock,
    handleBlockSelect,
    handleToggleShare,
    handleReset
  };
}; 