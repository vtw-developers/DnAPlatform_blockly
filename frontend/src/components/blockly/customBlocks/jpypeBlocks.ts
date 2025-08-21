import * as Blockly from 'blockly/core';
import { FieldFileUpload } from './FieldFileUpload';
import { pythonGenerator } from './summaryBlocks';

// 블록이 이미 등록되었는지 확인하는 플래그
let blocksRegistered = false;

// JPype 블록 정의
const JPYPE_BLOCKS: { [key: string]: { init: () => void } } = {
  jpype_start_jvm: {
    init: function(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField("JAR 파일 업로드")
        .appendField(new FieldFileUpload(""), "JAR_PATH")
        .appendField("으로 JVM 시작");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("JAR 파일을 업로드하고 JVM을 시작합니다.");
    }
  },
  jpype_shutdown_jvm: {
    init: function(this: Blockly.Block) {
      this.jsonInit({
        "type": "jpype_shutdown_jvm",
        "message0": "JVM 종료",
        "previousStatement": null,
        "nextStatement": null,
        "colour": 230,
        "tooltip": "JVM을 종료합니다."
      });
    }
  },
  jpype_java_method_call: {
    init: function(this: Blockly.Block) {
      this.jsonInit({
        "type": "jpype_java_method_call",
        "message0": "파이썬 코드 입력 %1",
        "args0": [
          {
            "type": "field_multilinetext",
            "name": "PY_CODE",
            "text": "# 여기에 파이썬 코드를 입력하세요"
          }
        ],
        "previousStatement": null,
        "nextStatement": null,
        "colour": 160,
        "tooltip": "직접 입력한 파이썬 코드를 실행합니다."
      });
    }
  }
};

// Python 생성기 정의
const JPYPE_GENERATORS = {
  jpype_start_jvm: function(block: Blockly.Block) {
    const jar_path = block.getFieldValue('JAR_PATH');
    return [
      'import jpype',
      'import jpype.imports',
      `jpype.startJVM(classpath=['${jar_path}'])`,
      ''
    ].join('\n');
  },
  jpype_shutdown_jvm: function(_block: Blockly.Block) {
    return 'jpype.shutdownJVM()\n';
  },
  jpype_java_method_call: function(block: Blockly.Block) {
    const pyCode = block.getFieldValue('PY_CODE') || '';
    return pyCode + '\n';
  }
};

export function registerJpypeBlocks() {
  if (blocksRegistered) {
    return;
  }

  try {
    // 블록 등록
    Object.entries(JPYPE_BLOCKS).forEach(([type, block]) => {
      Blockly.Blocks[type] = block;
    });

    // 생성기 등록
    Object.entries(JPYPE_GENERATORS).forEach(([type, generator]) => {
      (pythonGenerator as any)[type] = generator;
    });

    blocksRegistered = true;
  } catch (error) {
    console.error('Error registering JPype blocks:', error);
    throw error;
  }
} 