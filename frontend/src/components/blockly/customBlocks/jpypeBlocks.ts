import * as Blockly from 'blockly/core';
import { FieldFileUpload } from './FieldFileUpload';

export function registerJpypeBlocks(pythonGen: any) {
  // 1. JVM 시작 블록 (JAR 업로드)
  Blockly.Blocks['jpype_start_jvm'] = {
    init: function() {
      this.appendDummyInput()
        .appendField("JAR 파일 업로드")
        .appendField(new FieldFileUpload(""), "JAR_PATH")
        .appendField("으로 JVM 시작");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("JAR 파일을 업로드하고 JVM을 시작합니다.");
      this.setHelpUrl("");
    }
  };

  // 2. JVM 종료 블록
  Blockly.Blocks['jpype_shutdown_jvm'] = {
    init: function() {
      this.appendDummyInput()
        .appendField("JVM 종료");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("JVM을 종료합니다.");
      this.setHelpUrl("");
    }
  };

  // 3. 파이썬 코드 직접 입력 블록
  Blockly.Blocks['jpype_java_method_call'] = {
    init: function() {
      this.appendDummyInput()
        .appendField("파이썬 코드 입력");
      this.appendDummyInput()
        .appendField(new Blockly.FieldMultilineInput("# 여기에 파이썬 코드를 입력하세요"), "PY_CODE");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip("직접 입력한 파이썬 코드를 실행합니다.");
      this.setHelpUrl("");
    }
  };

  if (pythonGen) {
    pythonGen['jpype_start_jvm'] = function(block: Blockly.Block) {
      const jar_path = block.getFieldValue('JAR_PATH');
      const code = `import jpype\nimport jpype.imports\njpype.startJVM(classpath=['${jar_path}'])\n`;
      return code;
    };

    pythonGen['jpype_shutdown_jvm'] = function(_block: Blockly.Block) {
      return 'jpype.shutdownJVM()\n';
    };

    pythonGen['jpype_java_method_call'] = function(block: Blockly.Block) {
      const pyCode = block.getFieldValue('PY_CODE') || '';
      return pyCode + '\n';
    };
  }
} 